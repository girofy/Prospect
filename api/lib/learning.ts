// Aprendizado: lê conversas que já tiveram desfecho e grava o que funcionou e o que não funcionou.
// Roda no processo (sem depender do navegador) e usa a mesma cota gratuita da IA.
// O resultado vai para a tabela `learnings` e entra no prompt da IA nas próximas conversas.
import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { reserveAiCall } from './gemini';
import { Contact, ChatMessage } from './types';

const LEARNING_MODEL = 'gemini-3.6-flash';
const MAX_PER_PASS = Number(process.env.LEARNING_MAX_PER_PASS ?? 5);
const CLOSED_STATUSES = new Set(['reuniao_marcada', 'aguardando_humano', 'esfriou', 'bloqueado']);

function transcript(msgs: ChatMessage[]): string {
  return msgs
    .slice(-30)
    .map(m => `${m.from === 'bot' ? 'Assistente' : m.from === 'operator' ? 'César' : 'Pessoa'}: ${m.text}`)
    .join('\n');
}

function outcomeOf(c: Contact, msgs: ChatMessage[]): string {
  if (c.status === 'reuniao_marcada') return 'reuniao';
  if (c.optOutDetected || c.status === 'bloqueado') return 'opt_out';
  if (!msgs.some(m => m.from === 'lead')) return 'sem_resposta';
  if (c.status === 'aguardando_humano') return 'passou_para_humano';
  return 'esfriou';
}

export async function runLearningPass(): Promise<number> {
  const contacts = await db.getContacts();
  const learned = await db.getLearnedPhonesSince(new Date(Date.now() - 14 * 86400_000).toISOString());
  const candidates = contacts
    .filter(c => CLOSED_STATUSES.has(c.status) || c.status === 'em_conversa')
    .filter(c => !learned.has(c.phone));

  if (candidates.length === 0) return 0;

  const cfg = await db.getConfig();
  const apiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return 0;

  const ai = new GoogleGenAI({ apiKey });
  let saved = 0;

  for (const c of candidates) {
    if (saved >= MAX_PER_PASS) break; // limite por passe, contando só conversas com troca de fato
    const msgs = await db.getMessages(c.phone);
    if (msgs.length < 2 || !msgs.some(m => m.from === 'lead')) continue; // conversa sem troca não ensina nada
    if (!(await reserveAiCall())) break; // cota do dia acabou: para e tenta amanhã

    const outcome = outcomeOf(c, msgs);
    const prompt = `Você analisa uma conversa de prospecção por WhatsApp feita por um assistente de IA da Girofy (engenharia digital para negócios locais). Desfecho registrado: ${outcome}.

Conversa:
${transcript(msgs)}

Responda SOMENTE um JSON com as chaves:
- "worked": o que na conversa funcionou (frase curta, ou "-")
- "failed": o que não funcionou ou afastou a pessoa (frase curta, ou "-")
- "why": por que você acha que aconteceu (uma frase)
- "opener_style": o estilo da primeira mensagem que deu resposta (uma frase, ou "-")
Sem texto fora do JSON. Sem inventar fatos que não estão na conversa.`;

    try {
      const res = await ai.models.generateContent({
        model: LEARNING_MODEL,
        contents: prompt,
        config: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      });
      const parsed = JSON.parse(res.text || '{}');
      await db.saveLearning({
        contactPhone: c.phone,
        outcome,
        worked: String(parsed.worked || '-').slice(0, 300),
        failed: String(parsed.failed || '-').slice(0, 300),
        why: String(parsed.why || '-').slice(0, 300),
        openerStyle: String(parsed.opener_style || '-').slice(0, 200),
      });
      saved += 1;
    } catch (err: any) {
      console.warn('[Learning] falha numa conversa:', err?.message || err);
    }
  }
  return saved;
}

export function startLearning(everyMs = 6 * 3600_000) {
  if (process.env.LEARNING_ENABLED === 'false') return;
  setInterval(() => {
    runLearningPass().catch(err => console.warn('[Learning] passe falhou:', err));
  }, everyMs);
}
