// Agente de prospecção ativa: roda dentro do processo do servidor (sem depender do navegador).
// Envia abordagem fria só em horário comercial, com intervalo aleatório e teto diário.
import { db } from './db';
import { getEvolutionCfg, sendEvolutionText, evolutionHasHistory, getEvolutionState } from './evolution';
import { Contact } from './types';
import { isRealBrPhone, last8 } from './phone';
import { AUTHORIZED_BUSINESS_NUMBER } from './whatsapp';

const TZ = 'America/Bahia';
// Horas em decimal: 6.5 = 6h30. Domingo não envia (negócios fechados); PROSPECTOR_SKIP_SUNDAY=false liga o domingo.
const WINDOW_START = Number(process.env.PROSPECTOR_START_HOUR ?? 6.5);
const SKIP_SUNDAY = process.env.PROSPECTOR_SKIP_SUNDAY !== 'false';
const WINDOW_END = Number(process.env.PROSPECTOR_END_HOUR ?? 19);
const MIN_GAP_S = Number(process.env.PROSPECTOR_MIN_GAP_S ?? 240); // 4 min
const MAX_GAP_S = Number(process.env.PROSPECTOR_MAX_GAP_S ?? 540); // 9 min
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
      minute: '2-digit',
      weekday: 'long',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map(p => [p.type, p.value])
  );
  const hour = Number(parts.hour);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour, at: hour + Number(parts.minute) / 60, sunday: parts.weekday === 'Sunday' };
}

const fmtH = (h: number) => `${Math.floor(h)}h${Math.round((h % 1) * 60) ? String(Math.round((h % 1) * 60)).padStart(2, '0') : ''}`;
function inWindowNow(): boolean {
  const n = bahiaNow();
  if (SKIP_SUNDAY && n.sunday) return false;
  return n.at >= WINDOW_START && n.at < WINDOW_END;
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
  const low = greeting.toLowerCase();
  const first = personFirstName(contact.name);
  // Rodízio curto e natural: não parece script e continua pedindo só uma resposta.
  const withName = [`${greeting}, ${first}!`, `Oi, ${first}! ${greeting}.`, `${first}, ${low}!`, `Olá, ${first}! ${greeting}.`];
  const noName = [`${greeting}!`, `Oi, ${low}!`, `Olá, ${low}!`, `${greeting}, tudo certo?`];
  const pool = first ? withName : noName;
  return pool[Math.floor(Math.random() * pool.length)];
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
    inWindow: inWindowNow(),
    window: `${fmtH(WINDOW_START)}-${fmtH(WINDOW_END)}${SKIP_SUNDAY ? ', exceto domingo' : ''} (America/Bahia)`,
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
let failStreak = 0;

const OWNER = (process.env.OWNER_PHONE || '5574981017188').replace(/\D/g, '');

// Avisa o dono pelo WhatsApp uma vez por dia por tipo de aviso. Não depende do painel nem de ninguém acordado.
async function notifyOwnerOnce(kind: string, day: string, text: string) {
  try {
    const cfg = await db.getConfig();
    const sent = cfg.ownerNotice || {};
    if (sent[kind] === day) return;
    const r = await sendEvolutionText(OWNER, text, 800);
    if (r.success) await db.saveConfig({ ownerNotice: { ...sent, [kind]: day } });
    await db.addAuditLog({ type: 'status_change', summary: `Aviso ao dono (${kind}): ${text.slice(0, 120)}${r.success ? '' : ' [falhou: ' + r.error + ']'}` });
  } catch (err) {
    console.warn('[Prospector] aviso ao dono falhou:', err);
  }
}

// Vigia própria do servidor: às 7h, se nada saiu, descobre o motivo e avisa o dono.
async function watchdog() {
  try {
    const { day, at } = bahiaNow();
    if (at < 7 || at >= 8 || !inWindowNow()) return;
    const cfg = await db.getConfig();
    const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
    if (sentToday > 0) return;
    let why = '';
    if (cfg.prospectorPaused) why = 'a prospecção está pausada. Mande "retomar" aqui para ligar.';
    else if ((await db.getContacts()).filter(isEligible).length === 0) why = 'a fila está vazia. Precisa colocar empresas novas.';
    else {
      const st = await getEvolutionState();
      why = st === 'open' ? 'o WhatsApp está conectado, mas o envio falhou. Veja Ajustes, Atividade recente.' : `o WhatsApp está "${st}". Reconecte pelo painel.`;
    }
    await notifyOwnerOnce('nao_comecou', day, `Atenção: até as 7h nenhuma abordagem saiu hoje. Motivo: ${why}`);
  } catch (err) {
    console.warn('[Prospector] vigia falhou:', err);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (Date.now() < nextAt) return;
    if (!getEvolutionCfg()) return;

    const { day, hour } = bahiaNow();
    if (!inWindowNow()) return;

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

    // Segunda trava: o WhatsApp conectado já tem conversa com esse número? (o banco pode não conhecer)
    // Se a Evolution não responder, não envia agora e tenta de novo daqui a pouco.
    try {
      if (await evolutionHasHistory(contact.phone)) {
        await db.saveContact({ ...contact, status: 'esfriou', lastInteractionAt: new Date().toISOString() });
        await db.addAuditLog({ type: 'status_change', phone: contact.phone, summary: `Pulado: o WhatsApp já tem conversa com ${contact.phone}. Não abordado de novo.` });
        nextAt = 0;
        return;
      }
    } catch (err: any) {
      nextAt = Date.now() + 2 * 60_000;
      await db.addAuditLog({ type: 'error', phone: contact.phone, summary: `Não consegui conferir o histórico no WhatsApp (${String(err?.message || err).slice(0, 80)}). Envio adiado.` });
      return;
    }

    const text = buildOpener(contact, hour);
    const res = await sendEvolutionText(contact.phone, text, 2500);

    if (!res.success) {
      nextAt = Date.now() + 5 * 60_000; // backoff em falha de envio
      failStreak++;
      if (failStreak === 3) await notifyOwnerOnce('falhas', day, `Atenção: 3 envios seguidos falharam. Último erro: ${String(res.error).slice(0, 120)}`);
      await db.addAuditLog({
        type: 'error',
        phone: contact.phone,
        summary: `Falha ao enviar abordagem para ${contact.phone}: ${res.error}`,
      });
      return;
    }

    nextAt = Date.now() + rand(MIN_GAP_S, MAX_GAP_S) * 1000;
    failStreak = 0;
    if (sentToday === 0) {
      const hhmm = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' }).format(new Date());
      void notifyOwnerOnce('comecou', day, `Prospecção começou: a 1ª mensagem do dia saiu às ${hhmm} para ${contact.company || contact.phone}. Fila: ${queue.length - 1}.`);
    }
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
  setInterval(watchdog, 5 * 60_000);
  console.log(
    `[Prospector] ativo. Janela ${fmtH(WINDOW_START)}-${fmtH(WINDOW_END)}, teto ${DAILY_CAP}/dia, intervalo ${MIN_GAP_S}-${MAX_GAP_S}s`
  );
}
