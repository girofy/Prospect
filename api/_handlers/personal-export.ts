import { getEvolutionCfg } from '../lib/evolution';
import { transcribeAudio } from '../lib/transcribe';

// Exportação ÚNICA das conversas de um WhatsApp pessoal (o seu).
// Regras: nada vai para o banco. O arquivo fica só na memória deste processo, sai UMA vez no download,
// e depois a conexão é encerrada e a instância apagada. Expira sozinha em 1 hora.

type Job = {
  instance: string;
  status: 'waiting_qr' | 'connected' | 'building' | 'ready' | 'error';
  qr?: string;
  pairingCode?: string;
  chats?: number;
  messages?: number;
  file?: string;
  error?: string;
  startedAt: number;
};

let job: Job | null = null;
const MAX_AGE_MS = 60 * 60_000;
const MAX_PAGES_PER_CHAT = 50;
const MAX_AUDIOS = 80; // teto de áudios transcritos por exportação (cota gratuita do Whisper)

async function evo(method: string, path: string, body?: unknown): Promise<any> {
  const cfg = getEvolutionCfg();
  if (!cfg) throw new Error('Evolution não configurada no servidor.');
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* resposta vazia ou não JSON */ }
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${String(json?.message || text).slice(0, 160)}`);
  return json;
}

// Encerra a conexão do WhatsApp e apaga a instância temporária. Tenta sempre, mesmo se der erro antes.
async function closeJob(): Promise<void> {
  if (!job) return;
  const name = job.instance;
  job = null;
  try { await evo('DELETE', `/instance/logout/${encodeURIComponent(name)}`); } catch { /* já desconectada */ }
  try { await evo('DELETE', `/instance/delete/${encodeURIComponent(name)}`); } catch (err: any) {
    console.error('[Export] não consegui apagar a instância temporária:', err?.message);
  }
}

function textOf(message: any): string | null {
  if (!message) return null;
  if (message.conversation) return String(message.conversation);
  if (message.extendedTextMessage?.text) return String(message.extendedTextMessage.text);
  if (message.audioMessage) return '[Áudio]';
  if (message.imageMessage) return message.imageMessage.caption ? `[Imagem] ${message.imageMessage.caption}` : '[Imagem]';
  if (message.videoMessage) return message.videoMessage.caption ? `[Vídeo] ${message.videoMessage.caption}` : '[Vídeo]';
  if (message.documentMessage) return `[Documento] ${message.documentMessage.fileName || ''}`.trim();
  if (message.stickerMessage) return '[Figurinha]';
  return null; // protocolo, reações e outros eventos sem conteúdo
}

// Baixa e transcreve um áudio da exportação. Sem transcrição, fica só o marcador.
async function audioText(name: string, m: any, budget: { left: number }): Promise<string> {
  if (budget.left <= 0) return '[Áudio não transcrito: limite da exportação]';
  budget.left--;
  try {
    const r = await evo('POST', `/chat/getBase64FromMediaMessage/${encodeURIComponent(name)}`, { message: { key: m.key, message: m.message }, convertToMp4: false });
    if (!r?.base64) return '[Áudio]';
    const t = await transcribeAudio({ mimeType: String(r.mimetype || 'audio/ogg').split(';')[0], data: String(r.base64).replace(/^data:[^;]+;base64,/, '') });
    return t ? `[Áudio] ${t}` : '[Áudio sem fala reconhecida]';
  } catch {
    return '[Áudio]';
  }
}

async function build(): Promise<void> {
  if (!job) return;
  const current = job;
  const budget = { left: MAX_AUDIOS };
  current.status = 'building';
  try {
    const name = current.instance;
    const chatsRes = await evo('POST', `/chat/findChats/${encodeURIComponent(name)}`, {});
    const chats: any[] = Array.isArray(chatsRes) ? chatsRes : chatsRes?.chats || [];
    const conversas: any[] = [];
    let total = 0;

    for (const chat of chats) {
      const jid = String(chat.remoteJid || chat.id || '');
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue; // ignora grupos e status
      const mensagens: any[] = [];
      let page = 1;
      let pages = 1;
      do {
        const r = await evo('POST', `/chat/findMessages/${encodeURIComponent(name)}`, { where: { key: { remoteJid: jid } }, page });
        pages = r?.messages?.pages || 1;
        for (const m of r?.messages?.records || []) {
          const text = m.message?.audioMessage ? await audioText(name, m, budget) : textOf(m.message);
          if (!text) continue;
          mensagens.push({
            de: m.key?.fromMe ? 'eu' : 'contato',
            quando: m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : null,
            texto: text,
          });
        }
        page++;
      } while (page <= pages && page <= MAX_PAGES_PER_CHAT);
      if (mensagens.length === 0) continue;
      total += mensagens.length;
      mensagens.sort((a, b) => String(a.quando).localeCompare(String(b.quando)));
      conversas.push({ contato: jid, nome: chat.name || chat.pushName || '', mensagens });
    }

    current.chats = conversas.length;
    current.messages = total;
    current.file = JSON.stringify({ exportado_em: new Date().toISOString(), conversas: conversas.length, mensagens: total, conversas_lista: conversas }, null, 2);
    current.status = 'ready';
  } catch (err: any) {
    current.status = 'error';
    current.error = String(err?.message || err).slice(0, 200);
  }
}

function view(j: Job | null) {
  if (!j) return { status: 'none' };
  return {
    status: j.status,
    qr: j.qr || '',
    pairingCode: j.pairingCode || '',
    chats: j.chats ?? null,
    messages: j.messages ?? null,
    error: j.error || '',
  };
}

export default async function handler(req: any, res: any) {
  if (job && Date.now() - job.startedAt > MAX_AGE_MS) await closeJob();

  // Download: entrega uma vez e encerra tudo.
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.searchParams.get('download') === '1') {
    if (!job || job.status !== 'ready' || !job.file) return res.status(404).json({ error: 'Nada pronto para baixar.' });
    const file = job.file;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="conversas-whatsapp.json"');
    res.status(200).end(file);
    await closeJob(); // depois de entregar: desconecta e apaga. Não existe segunda entrega.
    return;
  }

  try {
    if (req.method === 'GET') {
      if (job && job.status === 'waiting_qr') {
        const st = await evo('GET', `/instance/connectionState/${encodeURIComponent(job.instance)}`);
        if (st?.instance?.state === 'open') job.status = 'connected';
      }
      return res.status(200).json(view(job));
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const action = String(body.action || '');

      if (action === 'start') {
        // Pareamento por CÓDIGO no número informado (é como o celular cola o código). Sem número, cai no QR.
        const number = String(body.number || '').replace(/\D/g, '');
        if (number && !/^55[1-9][1-9](9\d{8}|[2-5]\d{7})$/.test(number)) {
          return res.status(400).json({ error: 'Número inválido. Use 55, DDD e número, ex.: 5574981017188.' });
        }
        if (job) await closeJob();
        const name = `export-${Date.now().toString(36)}`;
        await evo('POST', '/instance/create', { instanceName: name, integration: 'WHATSAPP-BAILEYS', qrcode: !number, ...(number ? { number } : {}) });
        const c = await evo('GET', `/instance/connect/${encodeURIComponent(name)}${number ? `?number=${number}` : ''}`);
        const qr = c?.base64 || c?.qrcode?.base64 || '';
        job = {
          instance: name,
          status: 'waiting_qr',
          qr: qr ? (String(qr).startsWith('data:') ? String(qr) : `data:image/png;base64,${qr}`) : '',
          pairingCode: c?.pairingCode || c?.code || '',
          startedAt: Date.now(),
        };
        return res.status(200).json(view(job));
      }

      if (action === 'build') {
        if (!job || job.status !== 'connected') return res.status(400).json({ error: 'Conecte o WhatsApp primeiro.' });
        build(); // roda em segundo plano; o painel acompanha pelo GET
        return res.status(202).json(view(job));
      }

      if (action === 'cancel') {
        await closeJob();
        return res.status(200).json({ status: 'none' });
      }

      return res.status(400).json({ error: 'Ação inválida.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[Export] erro:', err?.message);
    return res.status(500).json({ error: err?.message || 'Falha na exportação.' });
  }
}
