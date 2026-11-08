// Envio de resposta em até duas mensagens seguidas (separadas por linha em branco), como gente digitando.
// Cada mensagem tem o seu "digitando"; a segunda sai logo depois da primeira.
import { db } from './db';
import { sendEvolutionText } from './evolution';

export function splitBubbles(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).slice(0, 2);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const typingFor = (t: string) => Math.min(7000, Math.max(2000, t.length * 45));

export async function sendLeadReply(
  phone: string,
  text: string,
  opts: { preWait?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const parts = splitBubbles(text);
  if (!parts.length) return { success: false, error: 'mensagem vazia' };
  for (let i = 0; i < parts.length; i++) {
    const typingMs = typingFor(parts[i]);
    // Ritmo de gente: antes da primeira, espera o dobro do "digitando" e nunca menos de 8 s.
    if (i === 0 && opts.preWait) await sleep(Math.max(typingMs * 2, 8000)); // total ≥ 10 s com o "digitando"
    const send = await sendEvolutionText(phone, parts[i], typingMs);
    if (!send.success) return { success: false, error: send.error };
    if (send.messageId) await db.markMessageAsProcessed(send.messageId); // eco do envio não vira "manual"
    await db.saveMessage({
      id: `out-${send.messageId || Date.now()}-${i}`,
      contactPhone: phone,
      from: 'bot',
      text: parts[i],
      type: 'text',
      timestamp: new Date().toISOString(),
      metaMessageId: send.messageId,
      status: 'sent',
    });
    if (i < parts.length - 1) await sleep(1200);
  }
  return { success: true };
}
