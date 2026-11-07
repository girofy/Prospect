// Agente de prospecção ativa: roda dentro do processo do servidor (sem depender do navegador).
// Envia abordagem fria só em horário comercial, com intervalo aleatório e teto diário.
import { db } from './db';
import { getEvolutionCfg, sendEvolutionText } from './evolution';
import { Contact } from './types';

const TZ = 'America/Bahia';
const WINDOW_START = Number(process.env.PROSPECTOR_START_HOUR ?? 8);
const WINDOW_END = Number(process.env.PROSPECTOR_END_HOUR ?? 19);
const MIN_GAP_S = Number(process.env.PROSPECTOR_MIN_GAP_S ?? 120);
const MAX_GAP_S = Number(process.env.PROSPECTOR_MAX_GAP_S ?? 420);
const DAILY_CAP = Number(process.env.PROSPECTOR_DAILY_CAP ?? 40);
const TICK_MS = 15_000;

function bahiaNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map(p => [p.type, p.value])
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function firstNameOf(contact: Contact): string | null {
  const name = (contact.name || '').trim();
  if (!name || /^contato\s/i.test(name)) return null;
  return name.split(' ')[0];
}

export function buildOpener(contact: Contact, hour: number): string {
  const greeting = hour < 12 ? 'Bom dia' : 'Boa tarde';
  const first = firstNameOf(contact);
  return first ? `${greeting}, ${first}! Tudo bem?` : `${greeting}! Tudo bem?`;
}

function isEligible(c: Contact): boolean {
  return (
    c.status === 'novo' &&
    c.agentState === 'ai_active' &&
    !c.optOutDetected &&
    c.phone.replace(/\D/g, '').length >= 12
  );
}

export async function getProspectStats() {
  const contacts = await db.getContacts();
  const cfg = await db.getConfig();
  const { day, hour } = bahiaNow();
  const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
  const repliedPhones = new Set(
    (await db.getMessages()).filter(m => m.from === 'lead').map(m => m.contactPhone)
  );
  return {
    enabled: process.env.PROSPECTOR_ENABLED !== 'false',
    evolutionConfigured: !!getEvolutionCfg(),
    inWindow: hour >= WINDOW_START && hour < WINDOW_END,
    window: `${WINDOW_START}h-${WINDOW_END}h (America/Bahia)`,
    sentToday,
    dailyCap: DAILY_CAP,
    queue: contacts.filter(isEligible).length,
    inConversation: contacts.filter(c => c.status === 'em_conversa').length,
    replied: contacts.filter(c => repliedPhones.has(c.phone)).length,
    totalContacts: contacts.length,
  };
}

let nextAt = 0;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    if (Date.now() < nextAt) return;
    if (!getEvolutionCfg()) return;

    const { day, hour } = bahiaNow();
    if (hour < WINDOW_START || hour >= WINDOW_END) return;

    const cfg = await db.getConfig();
    const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
    if (sentToday >= DAILY_CAP) return;

    const queue = (await db.getContacts())
      .filter(isEligible)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const contact = queue[0];
    if (!contact) return;

    const text = buildOpener(contact, hour);
    const res = await sendEvolutionText(contact.phone, text, 2500);

    if (!res.success) {
      nextAt = Date.now() + 5 * 60_000; // backoff em falha de envio
      await db.addAuditLog({
        type: 'error',
        phone: contact.phone,
        summary: `Falha ao enviar abordagem para ${contact.phone}: ${res.error}`,
      });
      return;
    }

    nextAt = Date.now() + rand(MIN_GAP_S, MAX_GAP_S) * 1000;

    const now = new Date().toISOString();
    await db.saveMessage({
      id: `out-prospect-${res.messageId || Date.now()}`,
      contactPhone: contact.phone,
      from: 'bot',
      text,
      type: 'text',
      timestamp: now,
      metaMessageId: res.messageId,
      status: 'sent',
    });
    await db.saveContact({ ...contact, status: 'em_conversa', lastInteractionAt: now });
    await db.saveConfig({ prospectDay: day, prospectSentToday: sentToday + 1 });
    await db.addAuditLog({
      type: 'ai_reply',
      phone: contact.phone,
      summary: `Abordagem ${sentToday + 1}/${DAILY_CAP} enviada: "${text}"`,
    });
  } catch (err) {
    console.error('[Prospector] tick falhou:', err);
  } finally {
    running = false;
  }
}

export function startProspector() {
  if (process.env.PROSPECTOR_ENABLED === 'false') {
    console.log('[Prospector] desativado (PROSPECTOR_ENABLED=false)');
    return;
  }
  if (!getEvolutionCfg()) {
    console.warn('[Prospector] EVOLUTION_URL/EVOLUTION_API_KEY ausentes: loop iniciado, mas sem envio.');
  }
  setInterval(tick, TICK_MS);
  console.log(
    `[Prospector] ativo. Janela ${WINDOW_START}h-${WINDOW_END}h, teto ${DAILY_CAP}/dia, intervalo ${MIN_GAP_S}-${MAX_GAP_S}s`
  );
}
