// Fila de quem ficou sem resposta: quando a IA estava fora (cota, pausa ou erro), o telefone entra aqui.
// A cada minuto, o sistema tenta responder o primeiro da fila. Se a IA ainda estiver fora, espera.
import { db } from './db';
import { generateGirofyCommercialReply } from './gemini';
import { sendEvolutionText } from './evolution';
import { ChatMessage } from './types';

const TICK_MS = 60_000;
const MAX_AGE_MS = 12 * 60 * 60_000; // lead que chamou há mais de 12 h não recebe resposta atrasada

export async function markPending(phone: string): Promise<void> {
  const cfg = await db.getConfig();
  const list = new Set(cfg.aiPendingPhones || []);
  list.add(phone);
  await db.saveConfig({ aiPendingPhones: [...list].slice(-50) });
}

async function drop(phone: string): Promise<void> {
  const cfg = await db.getConfig();
  await db.saveConfig({ aiPendingPhones: (cfg.aiPendingPhones || []).filter(p => p !== phone) });
}

let running = false;
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const cfg = await db.getConfig();
    const pending = cfg.aiPendingPhones || [];
    if (!pending.length) return;
    const phone = pending[0];

    const contact = await db.getContactByPhone(phone);
    if (!contact || contact.optOutDetected || contact.agentState !== 'ai_active') return drop(phone);

    const msgs: ChatMessage[] = await db.getMessages(phone);
    const last = msgs[msgs.length - 1];
    if (!last || last.from !== 'lead') return drop(phone); // alguém já respondeu (você ou a IA)
    if (Date.now() - Date.parse(last.timestamp) > MAX_AGE_MS) {
      await db.addAuditLog({ type: 'status_change', phone, summary: `Resposta atrasada descartada: ${phone} chamou há mais de 12 h.` });
      return drop(phone);
    }

    const ai = await generateGirofyCommercialReply(contact, { text: last.text }, msgs.slice(0, -1));
    if (!ai.aiAvailable) return; // IA ainda fora: fica na fila para a próxima rodada

    const typingMs = Math.min(7000, Math.max(2000, ai.replyText.length * 45));
    const send = await sendEvolutionText(phone, ai.replyText, typingMs);
    if (!send.success) return; // falha de envio: tenta de novo na próxima rodada

    if (send.messageId) await db.markMessageAsProcessed(send.messageId);
    const now = new Date().toISOString();
    await db.saveMessage({ id: `out-catchup-${send.messageId || Date.now()}`, contactPhone: phone, from: 'bot', text: ai.replyText, type: 'text', timestamp: now, metaMessageId: send.messageId, status: 'sent' } as ChatMessage);
    if (ai.transferToHuman) await db.saveContact({ ...contact, agentState: 'human_takeover', status: 'aguardando_humano', lastInteractionAt: now });
    else await db.saveContact({ ...contact, lastInteractionAt: now });
    await db.addAuditLog({ type: 'ai_reply', phone, summary: `Resposta atrasada enviada para ${phone} (estava na fila da IA).` });
    await drop(phone);
  } catch (err) {
    console.error('[Catchup] falhou:', err);
  } finally {
    running = false;
  }
}

export function startCatchup(): void {
  setInterval(tick, TICK_MS);
  console.log('[Catchup] fila de respostas atrasadas ativa');
}
