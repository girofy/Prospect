// Importa o histórico de conversas que a Evolution guarda para o banco do painel.
// Uso: EVOLUTION_URL=... EVOLUTION_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/import-evolution-history.ts
// Idempotente: mensagens já existentes (pelo id do WhatsApp) não são duplicadas.
import { supabase } from '../api/lib/supabaseClient';
import { formatPhoneNumber } from '../api/lib/whatsapp';

const URL_BASE = (process.env.EVOLUTION_URL || '').replace(/\/+$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'prospectfy';

async function fetchPage(page: number): Promise<{ records: any[]; pages: number }> {
  const res = await fetch(`${URL_BASE}/chat/findMessages/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: JSON.stringify({ where: {}, page }),
  });
  if (!res.ok) throw new Error(`findMessages página ${page}: HTTP ${res.status}`);
  const j: any = await res.json();
  return { records: j.messages?.records || [], pages: j.messages?.pages || 1 };
}

function textOf(m: any): string | null {
  const msg = m.message || {};
  if (msg.conversation) return String(msg.conversation).trim();
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text).trim();
  if (msg.audioMessage) return '[Áudio]';
  if (msg.imageMessage) return msg.imageMessage.caption ? `[Imagem] ${msg.imageMessage.caption}` : '[Imagem]';
  if (msg.documentMessage) return '[Documento]';
  return null; // protocolo, reações, etc.
}

async function main() {
  if (!URL_BASE || !KEY) throw new Error('Defina EVOLUTION_URL e EVOLUTION_API_KEY');
  const sb = supabase();

  // Limpeza da importação anterior (identificadores com prefixo 'lid'): recomeça do zero, sem tocar em outros dados.
  await sb.from('messages').delete().like('contact_phone', 'lid%');
  await sb.from('contacts').delete().like('phone', 'lid%');

  // Mensagens já no banco (para não duplicar) e IDs enviados pelo bot
  const existing = new Set<string>();
  const botIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('messages').select('id, meta_message_id, from').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (r.meta_message_id) existing.add(r.meta_message_id);
      if (r.meta_message_id && r.from === 'bot') botIds.add(r.meta_message_id);
    }
    if (data.length < 1000) break;
  }

  const first = await fetchPage(1);
  const pages = first.pages;
  const messages: any[] = [];
  const contacts = new Map<string, { name: string; first: number; last: number; leadMsgs: number }>();
  let skipped = 0;
  const reasons = { protocolo: 0, sem_id: 0, ja_existia: 0, lid_sem_numero: 0, com_numero: 0 };

  for (let page = 1; page <= pages; page++) {
    const { records } = page === 1 ? first : await fetchPage(page);
    for (const r of records) {
      const key = r.key || {};
      const jid = String(key.remoteJid || '');
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') { skipped++; continue; }
      const source = key.remoteJidAlt || jid;
      const text = textOf(r);
      if (!text) { reasons.protocolo++; continue; }
      const id = String(key.id || '');
      if (!id) { reasons.sem_id++; continue; }
      if (existing.has(id)) { reasons.ja_existia++; continue; }

      // Número real quando existe; identificador novo (@lid) sem número vira conversa "lid:" (só para estudo, nunca para envio)
      let phone: string;
      if (source.endsWith('@lid')) {
        phone = source.split('@')[0].replace(/\D/g, ''); // só dígitos: 14 dígitos, nunca confundido com telefone (12-13)
        reasons.lid_sem_numero++;
      } else {
        phone = formatPhoneNumber(source.split('@')[0]);
        reasons.com_numero++;
      }

      const ts = r.messageTimestamp ? new Date(Number(r.messageTimestamp) * 1000).toISOString() : new Date().toISOString();
      const from = key.fromMe ? (botIds.has(id) ? 'bot' : 'operator') : 'lead';
      messages.push({
        id: `hist-${id}`,
        contact_phone: phone,
        from,
        text,
        type: r.messageType === 'audioMessage' ? 'audio' : r.messageType === 'imageMessage' ? 'image' : 'text',
        timestamp: ts,
        meta_message_id: id,
        status: key.fromMe ? 'sent' : 'received',
      });

      const c = contacts.get(phone) || { name: '', first: Infinity, last: 0, leadMsgs: 0 };
      if (!key.fromMe && r.pushName && !c.name) c.name = String(r.pushName);
      const t = Date.parse(ts);
      c.first = Math.min(c.first, t);
      c.last = Math.max(c.last, t);
      if (from === 'lead') c.leadMsgs++;
      contacts.set(phone, c);
    }
    if (page % 10 === 0) console.log(`página ${page}/${pages}`);
  }

  // Contatos: cria os que não existem. Status: 'em_conversa' se houve troca; 'novo' se só saiu mensagem nossa.
  const { data: existingContacts } = await sb.from('contacts').select('phone, status').in('phone', [...contacts.keys()].slice(0, 1000));
  const known = new Map((existingContacts || []).map((c: any) => [c.phone, c.status]));
  const now = new Date().toISOString();
  const contactRows = [...contacts.entries()].map(([phone, c]) => ({
    phone,
    id: `contact-${phone}`,
    name: c.name || `Contato ${phone.slice(-4)}`,
    company: 'Em qualificação',
    role: 'decisor',
    status: known.get(phone) || (c.leadMsgs > 0 ? 'em_conversa' : 'novo'),
    agent_state: 'ai_active',
    opt_out_detected: false,
    last_interaction_at: new Date(c.last || Date.now()).toISOString(),
    created_at: new Date(c.first === Infinity ? Date.now() : c.first).toISOString(),
  }));

  for (let i = 0; i < contactRows.length; i += 200) {
    const { error } = await sb.from('contacts').upsert(contactRows.slice(i, i + 200), { onConflict: 'phone', ignoreDuplicates: false });
    if (error) throw new Error('contatos: ' + error.message);
  }
  // A paginação pode repetir mensagens entre páginas: uma linha por id.
  const uniqueMessages = [...new Map(messages.map(m => [m.id, m])).values()];
  for (let i = 0; i < uniqueMessages.length; i += 200) {
    const { error } = await sb.from('messages').upsert(uniqueMessages.slice(i, i + 200), { onConflict: 'id' });
    if (error) throw new Error('mensagens: ' + error.message);
  }

  console.log(JSON.stringify({ paginas: pages, mensagens_importadas: uniqueMessages.length, contatos: contactRows.length, motivos: reasons, grupos_ou_status_ignorados: skipped }));
}

main().catch(err => {
  console.error('FALHA:', err.message);
  process.exit(1);
});
