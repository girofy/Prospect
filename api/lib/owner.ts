// Modo dono: você conversa com o agente pelo seu WhatsApp pessoal.
// - Quem é você: pelo número.
// - O modelo conversa e escolhe UMA ação de uma lista fixa. Quem executa é este código.
// - Ações que mexem com lead (mandar mensagem) pedem um "sim" seu antes, em até 10 minutos.
import { db } from './db';
import { getProspectStats } from './prospector';
import { last8, isRealBrPhone } from './phone';
import { generateOwnerReply, OwnerAction } from './gemini';
import { sendEvolutionText } from './evolution';
import { AUTHORIZED_BUSINESS_NUMBER } from './whatsapp';
import { Contact } from './types';

export const OWNER_PHONE = (process.env.OWNER_PHONE || '5574981017188').replace(/\D/g, '');
const CONFIRM_MIN = 10;
const MAX_TURNS = 8;
const ownerTurns: { from: 'owner' | 'bot'; text: string }[] = [];

type Pending = { type: 'resume' } | { type: 'send'; phone: string; name: string; text: string };

export function isOwner(phone: string): boolean {
  return last8(phone) === last8(OWNER_PHONE);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const YES = /^(sim|s|pode|confirma|confirmo|isso|bora|manda|vai|claro|ok|beleza|pode mandar)\b/;
const NO = /^(nao|cancela|deixa|para|nem|cancelar)\b/;

function readPending(cfg: { ownerPending?: string; ownerPendingUntil?: string }): Pending | null {
  if (!cfg.ownerPending || !(Date.parse(cfg.ownerPendingUntil || '') > Date.now())) return null;
  try { return JSON.parse(cfg.ownerPending) as Pending; } catch { return cfg.ownerPending === 'resume' ? { type: 'resume' } : null; }
}

async function setPending(p: Pending | null): Promise<void> {
  await db.saveConfig({
    ownerPending: p ? JSON.stringify(p) : '',
    ownerPendingUntil: p ? new Date(Date.now() + CONFIRM_MIN * 60_000).toISOString() : '',
  });
}

async function snapshot(): Promise<string> {
  const s = await getProspectStats();
  const all = await leads();
  const replied = await db.getRepliedPhones();
  const travados = all.filter(c => c.status === 'aguardando_humano' || c.status === 'esfriou').length;
  const reunioes = all.filter(c => c.status === 'reuniao_marcada').length;
  const saidas = all.filter(c => c.optOutDetected || c.status === 'bloqueado').length;
  const quentes = all.filter(c => replied.has(c.phone) && c.status !== 'bloqueado').length;
  const semNumero = all.filter(c => !isRealBrPhone(c.phone)).length;
  const bahia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' });
  return [
    `- Hora em Salvador: ${bahia}`,
    `- Prospecção: ${s.paused ? 'PAUSADA' : 'ativa'}`,
    `- Janela de envio (8h-19h): ${s.inWindow ? 'dentro' : 'fora'}`,
    `- Hoje: ${s.sentToday} de ${s.dailyCap} abordagens enviadas`,
    `- Fila com telefone válido: ${s.queue}${s.queue === 0 ? ' (vazia: falta lista com telefone)' : ''}`,
    `- Leads em conversa: ${s.inConversation}; responderam: ${s.replied}`,
    `- Quentes (responderam): ${quentes}; travados: ${travados}; reuniões marcadas: ${reunioes}; pediram para sair: ${saidas}`,
    `- Conversas sem número real (só dá para ler, não enviar): ${semNumero}`,
  ].join('\n');
}

// Só leads de verdade: sem o seu número e sem o número da empresa.
async function leads(): Promise<Contact[]> {
  return (await db.getContacts()).filter(c => !isOwner(c.phone) && last8(c.phone) !== last8(AUTHORIZED_BUSINESS_NUMBER));
}

function findLead(all: Contact[], target: string): Contact | 'many' | null {
  const digits = target.replace(/\D/g, '');
  if (digits.length >= 8) {
    const hit = all.filter(c => last8(c.phone) === last8(digits));
    if (hit.length === 1) return hit[0];
    if (hit.length > 1) return 'many';
  }
  const t = norm(target);
  if (!t) return null;
  const hit = all.filter(c => norm(c.name || '').includes(t));
  if (hit.length === 1) return hit[0];
  if (hit.length > 1) return 'many';
  return null;
}

async function listFor(filter: string): Promise<string> {
  const all = await leads();
  const replied = await db.getRepliedPhones();
  const f = norm(filter);
  let list = all;
  if (/quente|respond/.test(f)) list = all.filter(c => replied.has(c.phone) && c.status !== 'bloqueado');
  else if (/trav|parad|esfri|humano/.test(f)) list = all.filter(c => c.status === 'aguardando_humano' || c.status === 'esfriou');
  else if (/reuni/.test(f)) list = all.filter(c => c.status === 'reuniao_marcada');
  else if (/saida|sair|optout|bloque/.test(f)) list = all.filter(c => c.optOutDetected || c.status === 'bloqueado');
  const comNumero = list.filter(c => isRealBrPhone(c.phone));
  const semNumero = list.length - comNumero.length;
  list = [...comNumero].sort((a, b) => String(b.lastInteractionAt).localeCompare(String(a.lastInteractionAt)));
  if (!list.length) return 'Nenhum lead com número real nesse filtro.';
  const linhas = list.slice(0, 15).map(c => `- ${c.name || 'sem nome'} (${c.phone}), ${c.status}, último contato ${String(c.lastInteractionAt).slice(0, 10)}`).join('\n');
  return semNumero ? `${linhas}\n(${semNumero} sem número real ficaram de fora)` : linhas;
}

async function conversationFor(c: Contact): Promise<string> {
  const msgs = await db.getMessages(c.phone);
  const last = msgs.slice(-30).map(m => `${m.from === 'bot' ? 'Agente' : m.from === 'operator' ? 'César' : 'Lead'}: ${m.text}`).join('\n');
  return `LEAD: ${c.name || 'sem nome'} (${c.phone}), status ${c.status}\nCONVERSA (últimas mensagens):\n${last || '(sem mensagens)'}`;
}

async function executePending(p: Pending): Promise<string> {
  if (p.type === 'resume') {
    await db.saveConfig({ prospectorPaused: false });
    await db.addAuditLog({ type: 'status_change', summary: 'Dono confirmou: prospecção retomada.' });
    return 'Feito. Prospecção retomada, dentro do horário e do limite do dia.';
  }
  const res = await sendEvolutionText(p.phone, p.text, 2000);
  if (!res.success) return `Não consegui enviar para ${p.name}: ${res.error}`;
  if (res.messageId) await db.markMessageAsProcessed(res.messageId);
  const now = new Date().toISOString();
  await db.saveMessage({ id: `owner-${res.messageId || Date.now()}`, contactPhone: p.phone, from: 'operator', text: p.text, type: 'text', timestamp: now, metaMessageId: res.messageId, status: 'sent' } as any);
  const c = await db.getContactByPhone(p.phone);
  if (c) await db.saveContact({ ...c, agentState: 'human_takeover', lastInteractionAt: now }); // a IA para de responder esse lead
  await db.addAuditLog({ type: 'human_message', phone: p.phone, summary: `Dono enviou para ${p.name}: "${p.text.slice(0, 80)}". IA pausada para esse lead.` });
  return `Enviado para ${p.name}. A IA fica quieta nessa conversa até você liberar.`;
}

export async function handleOwnerMessage(raw: string): Promise<string> {
  const text = raw.trim();
  const n = norm(text);
  const cfg = await db.getConfig();

  const pending = readPending(cfg);
  if (pending) {
    if (YES.test(n)) { await setPending(null); return executePending(pending); }
    if (NO.test(n)) { await setPending(null); return 'Ok, cancelei.'; }
  }

  const ai = await generateOwnerReply(text, ownerTurns, await snapshot());
  if (!ai) return 'Não consegui pensar agora (IA indisponível ou sem cota). Tenta de novo daqui a pouco.';

  const action: OwnerAction = ai.action;
  let reply = ai.reply;

  if (action === 'pause') {
    await db.saveConfig({ prospectorPaused: true });
    await setPending(null);
    await db.addAuditLog({ type: 'status_change', summary: 'Dono pediu pausa da prospecção (conversa).' });
  } else if (action === 'resume') {
    await setPending({ type: 'resume' });
    if (!reply.includes('?')) reply += ' Confirma? Responde sim.';
  } else if (action === 'list') {
    reply = `${reply}\n${await listFor(ai.target)}`;
  } else if (action === 'summarize') {
    const found = findLead(await leads(), ai.target);
    if (!found) reply = 'Não achei esse lead. Me manda o nome ou o número.';
    else if (found === 'many') reply = 'Achei mais de um com esse nome. Me manda o número.';
    else {
      const second = await generateOwnerReply('Resuma esta conversa: quem é, o que quer, em que ponto parou e o que você sugere fazer. Curto.', ownerTurns, await snapshot(), await conversationFor(found));
      reply = second?.reply || 'Não consegui resumir agora. Tenta de novo.';
    }
  } else if (action === 'send') {
    const found = findLead(await leads(), ai.target);
    if (!found) reply = 'Não achei esse lead. Me manda o nome ou o número.';
    else if (found === 'many') reply = 'Achei mais de um com esse nome. Me manda o número.';
    else if (!ai.message) reply = `O que você quer que eu mande para ${found.name || found.phone}?`;
    else {
      await setPending({ type: 'send', phone: found.phone, name: found.name || found.phone, text: ai.message });
      reply = `Vou mandar para ${found.name || found.phone}: "${ai.message}". Confirma? Responde sim.`;
    }
  }

  ownerTurns.push({ from: 'owner', text }, { from: 'bot', text: reply });
  while (ownerTurns.length > MAX_TURNS * 2) ownerTurns.shift();
  return reply;
}
