// Recebe eventos da Evolution (messages.upsert), responde com a IA e registra o histórico.
// Configurar na Evolution: webhook URL = https://<seu-app>/api/evolution/webhook?token=<EVOLUTION_WEBHOOK_TOKEN>
// evento: MESSAGES_UPSERT
import { db } from '../lib/db';
import { formatPhoneNumber } from '../lib/whatsapp';
import { generateGirofyCommercialReply } from '../lib/gemini';
import { sendEvolutionText, fetchEvolutionMedia, OPT_OUT_REGEX } from '../lib/evolution';
import { getProspectStats } from '../lib/prospector';
import { transcribeAudio } from '../lib/transcribe';
import { markPending } from '../lib/catchup';
import { sendLeadReply } from '../lib/bubbles';
import { isOwner, handleOwnerMessage, OWNER_PHONE } from '../lib/owner';

// Aviso para o dono quando um lead mostra interesse de compra (no máximo um aviso a cada 30 min por contato).
const HOT_RE = /(quanto (custa|fica|sai|e|é)|pre[cç]o|valor|pr[eé]via|or[cç]amento|quero (fechar|contratar|comprar)|fechar (o )?neg[oó]cio|contratar)/i;
const lastHotAlert = new Map<string, number>();

async function alertOwnerIfHot(phone: string, name: string, text: string): Promise<void> {
  if (!HOT_RE.test(text)) return;
  if (Date.now() - (lastHotAlert.get(phone) || 0) < 30 * 60_000) return;
  lastHotAlert.set(phone, Date.now());
  const who = name && !/^(contato|lead)/i.test(name) ? `${name} (${phone})` : phone;
  await sendEvolutionText(OWNER_PHONE, `Lead quente: ${who}\nDisse: "${text.slice(0, 200)}"\nPara eu resumir, mande: resumo ${phone.slice(-8)}`, 1000);
}
import { Contact, ChatMessage } from '../lib/types';

// Texto que vai para o histórico (o que o César vê no painel).
function labelOf(message: any): string | null {
  if (!message) return null;
  if (message.conversation) return String(message.conversation).trim();
  if (message.extendedTextMessage?.text) return String(message.extendedTextMessage.text).trim();
  if (message.audioMessage) return '[Áudio]';
  if (message.imageMessage) return message.imageMessage.caption ? `[Imagem] ${message.imageMessage.caption}` : '[Imagem]';
  if (message.documentMessage) return '[Documento]';
  return null;
}

// Mídia que a IA consegue ler diretamente (imagem e áudio).
function mediaKindOf(message: any): 'image' | 'audio' | null {
  if (message?.audioMessage) return 'audio';
  if (message?.imageMessage) return 'image';
  return null;
}

async function handleUpsert(d: any) {
  const key = d?.key;
  if (!key) return;

  const jid = String(key.remoteJid || '');
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return; // ignora grupos e status

  const sourceJid = key.remoteJidAlt || jid;
  if (sourceJid.endsWith('@lid')) {
    console.warn(`[Evolution] JID LID sem número real, ignorado: ${sourceJid}`);
    return;
  }

  const phone = formatPhoneNumber(sourceJid.split('@')[0]);
  const msgId = String(key.id || '');
  if (!msgId || (await db.hasProcessedMessage(msgId))) return; // já tratada (inclui eco das mensagens do bot)
  await db.markMessageAsProcessed(msgId);

  let text = labelOf(d.message);
  if (!text) return;
  const mediaKind = mediaKindOf(d.message);

  // Mensagem que VOCÊ mandou pelo celular: entra no histórico como humano, a IA não responde a ela.
  if (key.fromMe) {
    await db.saveMessage({
      id: `op-${msgId}`,
      contactPhone: phone,
      from: 'operator',
      text,
      type: 'text',
      timestamp: new Date().toISOString(),
      metaMessageId: msgId,
      status: 'sent',
    } as ChatMessage);
    return;
  }

  // Áudio: transcreve (Whisper, Groq). Se não der, a IA ouve o áudio direto (Gemini).
  let media: { mimeType: string; data: string } | undefined;
  let transcript = '';
  if (mediaKind) {
    const got = await fetchEvolutionMedia({ id: msgId, remoteJid: jid, fromMe: false }, d.message);
    if (got && mediaKind === 'audio') transcript = await transcribeAudio(got);
    if (got && !transcript) media = got;
  }
  if (transcript) text = `[Áudio] ${transcript}`;
  const aiInput = transcript || text;

  // Modo dono: seu WhatsApp pessoal dá comandos. Não entra no histórico de leads nem vai para a IA.
  if (isOwner(phone)) {
    const reply = await handleOwnerMessage(aiInput);
    await sendEvolutionText(OWNER_PHONE, reply, 1000);
    await db.addAuditLog({ type: 'status_change', phone, summary: `Comando do dono: "${aiInput.slice(0, 80)}" → ${reply.slice(0, 120)}` });
    return;
  }

  // Histórico ANTES de salvar a mensagem atual (evita duplicar no prompt da IA)
  const history = await db.getMessages(phone);

  let contact = await db.getContactByPhone(phone);
  if (!contact) {
    contact = await db.saveContact({
      id: `contact-${phone}`,
      phone,
      name: d.pushName || `Contato ${phone.slice(-4)}`,
      company: 'Em qualificação',
      role: 'decisor',
      status: 'em_conversa',
      agentState: 'ai_active',
      optOutDetected: false,
      lastInteractionAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  await db.saveMessage({
    id: `in-${msgId}`,
    contactPhone: phone,
    from: 'lead',
    text,
    type: 'text',
    timestamp: now,
    metaMessageId: msgId,
    status: 'received',
  } as ChatMessage);

  // Opt-out LGPD: para tudo para esse número
  if (OPT_OUT_REGEX.test(text)) {
    await db.saveContact({
      ...contact,
      status: 'bloqueado',
      optOutDetected: true,
      optOutReason: 'Solicitação explícita do titular (Opt-Out LGPD)',
      agentState: 'paused',
      lastInteractionAt: now,
    });
    await db.addAuditLog({ type: 'opt_out', phone, summary: `Opt-out registrado para ${phone}: "${text}"` });
    return;
  }

  if (contact.optOutDetected || contact.agentState !== 'ai_active') return;

  if (contact.status === 'novo') {
    contact = await db.saveContact({ ...contact, status: 'em_conversa', lastInteractionAt: now });
  }

  // Resposta automática da empresa ("estamos descansando", "seja bem-vindo"...): não é a pessoa. A IA espera.
  if (!mediaKind && looksAutomatic(aiInput, history)) {
    await db.addAuditLog({ type: 'status_change', phone, summary: `Resposta automática da empresa ignorada, esperando a pessoa: "${aiInput.slice(0, 80)}"` });
    return;
  }

  await alertOwnerIfHot(phone, contact.name, aiInput);

  // Uma resposta por vez por contato: mensagens que chegam juntas viram UMA resposta.
  if (busy.has(phone)) { again.add(phone); return; }
  await respond(phone, media);
}

const busy = new Set<string>();
const again = new Set<string>();
const AUTO_RE = /(mensagem autom[aá]tica|resposta autom[aá]tica|no momento (n[aã]o|estamos)|estamos (descansando|fora|ausentes)|fora do (nosso )?hor[aá]rio|hor[aá]rio de (atendimento|funcionamento)|responderemos (assim|em breve|o mais)|retornaremos|agradecemos (a |sua |o seu |pelo |pela )?(sua )?(mensagem|contato)|seja (muito )?bem[- ]?vind|obrigad[oa] por (entrar em contato|sua mensagem|nos contatar|escolher)|n[aã]o estamos dispon[ií]veis|logo (te )?responderemos|em breve (retornaremos|responderemos|daremos|um de nossos))/i;

function looksAutomatic(text: string, history: ChatMessage[]): boolean {
  if (AUTO_RE.test(text)) return true;
  // Chegou segundos depois da nossa primeira mensagem e é um texto longo: quase sempre é saudação automática.
  const ours = history.filter(m => m.from === 'bot' || m.from === 'operator');
  const theirs = history.filter(m => m.from === 'lead');
  const last = ours[ours.length - 1];
  return !!last && ours.length === 1 && theirs.length === 0 && Date.now() - Date.parse(last.timestamp) < 20_000 && text.length > 80;
}

async function respond(phone: string, media?: { mimeType: string; data: string }): Promise<void> {
  busy.add(phone);
  try {
    await new Promise(r => setTimeout(r, 4000)); // junta mensagens que chegam em sequência
    const all = await db.getMessages(phone);
    let cut = all.length;
    while (cut > 0 && all[cut - 1].from === 'lead') cut--;
    const prior = all.slice(0, cut);
    const pending = all.slice(cut).filter(m => !looksAutomatic(m.text || '', prior));
    if (!pending.length) return;
    const aiInput = pending.map(m => String(m.text || '').replace(/^\[Áudio\] /, '')).join('\n');

    let contact = await db.getContactByPhone(phone);
    if (!contact || contact.optOutDetected || contact.agentState !== 'ai_active') return;
    const now = new Date().toISOString();

    const ai = await generateGirofyCommercialReply(contact, { text: aiInput, media }, prior);

    if (!ai.aiAvailable) {
      await db.saveContact({ ...contact, status: 'aguardando_humano', lastInteractionAt: now });
      if (ai.unavailableReason === 'quota' || ai.unavailableReason === 'error') await markPending(phone);
      const why =
        ai.unavailableReason === 'quota' ? 'cota diária da IA atingida'
        : ai.unavailableReason === 'no_key' ? 'chave da IA não configurada'
        : 'erro da IA';
      await db.addAuditLog({ type: 'error', phone, summary: `IA não respondeu (${why}). Aguardando você: ${phone}.` });
      return;
    }

    if (ai.transferToHuman) {
      contact = await db.saveContact({ ...contact, agentState: 'human_takeover', status: 'aguardando_humano', lastInteractionAt: now });
      await db.addAuditLog({ type: 'status_change', phone, summary: `Transferido para humano: ${ai.transferReason || 'complexidade da negociação'}` });
    } else if (ai.isMeetingRequested) {
      await db.saveContact({ ...contact, status: 'reuniao_marcada', lastInteractionAt: now });
    }

    const sent = await sendLeadReply(phone, ai.replyText, { preWait: true });
    if (!sent.success) {
      await db.addAuditLog({ type: 'error', phone, summary: `Falha ao responder ${phone}: ${sent.error}. Vai para a fila de respostas.` });
      await markPending(phone);
    }
  } finally {
    busy.delete(phone);
    if (again.delete(phone)) await respond(phone);
  }
}


export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(await getProspectStats());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = new URL(req.url || '/', 'http://localhost').searchParams.get('token');
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (expected && token !== expected) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  res.status(200).json({ ok: true }); // confirma rápido para a Evolution não reenviar

  const event = String(body.event || '').toLowerCase().replace(/_/g, '.');
  if (event !== 'messages.upsert') return;

  const items = Array.isArray(body.data) ? body.data : [body.data];
  for (const item of items) {
    try {
      await handleUpsert(item);
    } catch (err) {
      console.error('[Evolution Webhook] erro ao processar mensagem:', err);
    }
  }
}
