// Agente de prospecção ativa: roda dentro do processo do servidor (sem depender do navegador).
// Envia abordagem fria só em horário comercial, com intervalo aleatório e teto diário.
import { db } from './db';
import { getEvolutionCfg, sendEvolutionText } from './evolution';
import { Contact } from './types';
import { isRealBrPhone, last8 } from './phone';
import { AUTHORIZED_BUSINESS_NUMBER } from './whatsapp';

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

// Palavras que denunciam nome comercial/genérico: nesses casos NÃO usa nome nenhum.
const BUSINESS_WORDS = /(ltda|\bme\b|eireli|restaurante|pizza|burger|barbearia|festas?|buffet|loja|mercado|mec[aâ]nica|oficina|cl[ií]nica|studio|est[uú]dio|empresa|com[eé]rcio|constru|imobili|hotel|pousada|lanchonete|padaria|academia|sal[aã]o|distribuidora|contab|advoc|escola|farm[aá]cia|auto|motos?|tech|digital|girofy|lead|contato|cliente|servi[cç]os?|solu[cç][oõ]es|atacado|varejo|bar\b|a[cç]ougue|pet|the\b)/i;

// Só usa nome se parecer nome de pessoa: 1 a 2 palavras, só letras, sem palavra de empresa.
export function personFirstName(name: string | undefined | null): string | null {
  const n = (name || '').trim();
  if (!n || n.length > 30) return null;
  if (BUSINESS_WORDS.test(n)) return null;
  if (!/^[A-Za-zÀ-ú]+( [A-Za-zÀ-ú]+)?$/.test(n)) return null;
  const first = n.split(' ')[0];
  if (first !== first[0].toUpperCase() + first.slice(1).toLowerCase() && first.toUpperCase() === first) return null; // CAIXA ALTA = empresa
  return first;
}

// Abertura: só "Bom dia" ou "Boa tarde" + nome, sem "tudo bem" e sem nome comercial.
export function buildOpener(contact: Contact, hour: number): string {
  const greeting = hour < 12 ? 'Bom dia' : 'Boa tarde';
  const first = personFirstName(contact.name);
  return first ? `${greeting}, ${first}!` : `${greeting}!`;
}

function isEligible(c: Contact): boolean {
  return (
    c.status === 'novo' &&
    c.agentState === 'ai_active' &&
    !c.optOutDetected &&
    last8(c.phone) !== last8(AUTHORIZED_BUSINESS_NUMBER) && // nunca o próprio número da Girofy, em nenhum formato
    isRealBrPhone(c.phone) // só telefone brasileiro válido; identificador interno (@lid) nunca recebe abordagem
  );
}

export async function getProspectStats() {
  const contacts = await db.getContacts();
  const cfg = await db.getConfig();
  const { day, hour } = bahiaNow();
  const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
  const repliedPhones = await db.getRepliedPhones();
  return {
    enabled: process.env.PROSPECTOR_ENABLED !== 'false',
    evolutionConfigured: !!getEvolutionCfg(),
    inWindow: hour >= WINDOW_START && hour < WINDOW_END,
    window: `${WINDOW_START}h-${WINDOW_END}h (America/Bahia)`,
    sentToday,
    paused: !!cfg.prospectorPaused,
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
    if (cfg.prospectorPaused) return; // pausa do dono (WhatsApp ou painel)
    const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
    if (sentToday >= DAILY_CAP) return;

    const queue = (await db.getContacts())
      .filter(isEligible)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const contact = queue[0];
    if (!contact) return;

    // Memória de contatos: se já houve qualquer conversa com esse número (mesmo em outro formato,
    // mesmo sem resposta), não abordamos de novo. Sai da fila e fica registrado.
    if (await db.hasHistoryWith(contact.phone)) {
      await db.saveContact({ ...contact, status: 'esfriou', lastInteractionAt: new Date().toISOString() });
      await db.addAuditLog({ type: 'status_change', phone: contact.phone, summary: `Pulado: já havia conversa com ${contact.phone}. Não abordado de novo.` });
      nextAt = 0;
      return;
    }

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
    if (res.messageId) await db.markMessageAsProcessed(res.messageId); // eco do envio não vira "mensagem manual"

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
