import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';
import { db } from './db';

// Regras fixas do agente. Conhecimento do negócio entra pela pasta knowledge/ (arquivos .md).
const GIROFY_SYSTEM_PROMPT = `
Você é o assistente de IA da Girofy, estúdio de engenharia digital que resolve problemas de negócio (sistemas, sites e automações).
Você conversa por WhatsApp com negócios locais e regionais. O objetivo é entender a dor do negócio e marcar uma conversa curta de 15 minutos.

REGRAS DE CONVERSA:
1. Escreva como gente no WhatsApp: curto, direto, sem enrolação e sem jargão.
2. Cada mensagem tem no máximo 15 palavras. Se precisar, use no máximo 2 balões curtos.
3. Nunca mande listas, tópicos ou parágrafos longos.
4. Faça UMA pergunta por vez. Pergunte sobre a dor (como o cliente perde dinheiro ou tempo hoje), não sobre o produto.
5. Não empurre preço cedo. Só fale valor quando perguntarem.
6. IDENTIDADE: você é uma IA da Girofy. Se perguntarem se é robô ou IA, confirme com honestidade e diga que o César acompanha as conversas. Nunca diga que é humano.
7. Se o contato pedir atendente ou humano, inclua a tag [TRANSF_HUMANO: motivo] e avise com gentileza.
8. Se o contato pedir para parar, não insista.
9. Não invente preço, prazo, cliente ou resultado. Se não souber, diga que o César confirma.
`;

const KNOWLEDGE_MAX_CHARS = 12000;

// Lê a base de conhecimento (todos os .md em knowledge/). Lido a cada chamada, barato e sem cache.
export function loadKnowledge(): string {
  try {
    const dir = path.resolve(process.cwd(), 'knowledge');
    if (!fs.existsSync(dir)) return '';
    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.md')).sort();
    let out = '';
    for (const f of files) {
      out += `\n\n# ${f}\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`;
    }
    return out.slice(0, KNOWLEDGE_MAX_CHARS).trim();
  } catch (err) {
    console.warn('[Knowledge] falha ao ler knowledge/:', err);
    return '';
  }
}

export interface AiGenerationResult {
  replyText: string;
  aiAvailable: boolean; // false = IA não rodou (sem chave ou erro). Nada deve ser enviado.
  transferToHuman: boolean;
  transferReason?: string;
  isMeetingRequested?: boolean;
}

export async function generateGirofyCommercialReply(
  contact: Contact,
  incomingText: string,
  history: ChatMessage[]
): Promise<AiGenerationResult> {
  const unavailable: AiGenerationResult = { replyText: '', aiAvailable: false, transferToHuman: false };

  const dynamicConfig = await db.getConfig();
  const apiKey = (dynamicConfig.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY não configurada: resposta não enviada.');
    return unavailable;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const recentHistory = history
      .slice(-12)
      .map(m => {
        const who = m.from === 'bot' ? 'Assistente Girofy' : m.from === 'operator' ? 'César (humano)' : contact.name || 'Contato';
        return `${who}: ${m.text}`;
      })
      .join('\n');

    const knowledge = loadKnowledge();

    const prompt = `
${GIROFY_SYSTEM_PROMPT}
${knowledge ? `\nBASE DE CONHECIMENTO DA GIROFY:\n${knowledge}\n` : ''}
DADOS DO CONTATO:
- Nome: ${contact.name || 'Não informado'}
- Empresa: ${contact.company && contact.company !== 'Em qualificação' ? contact.company : 'Não informada'}
- Status: ${contact.status}

HISTÓRICO RECENTE (inclui mensagens que o César mandou pessoalmente; respeite o que ele já disse):
${recentHistory || '(Sem histórico anterior)'}

NOVA MENSAGEM DO CONTATO:
"${incomingText}"

Gere só o texto da próxima mensagem para o WhatsApp:
`;

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 120,
      },
    });

    let rawText = response.text ? response.text.trim() : '';

    let transferToHuman = false;
    let transferReason: string | undefined;

    const transferMatch = rawText.match(/\[TRANSF_HUMANO:\s*([^\]]+)\]/i);
    if (transferMatch) {
      transferToHuman = true;
      transferReason = transferMatch[1].trim();
      rawText = rawText.replace(/\[TRANSF_HUMANO:[^\]]+\]/gi, '').trim();
    }

    const directHumanPattern = /(falar com (humano|atendente|pessoa|alguém|proprietário|responsável)|me liga|passa para humano)/i;
    if (directHumanPattern.test(incomingText)) {
      transferToHuman = true;
      transferReason = 'Pedido explícito de atendimento humano pelo cliente';
      if (!rawText) {
        rawText = 'Com certeza! Vou passar para o César te responder pessoalmente. Um instante.';
      }
    }

    if (!rawText) return unavailable;

    const isMeetingRequested = /meet\.google\.com|reunião|alinhamento de 15|15 min/i.test(rawText);

    return {
      replyText: rawText,
      aiAvailable: true,
      transferToHuman,
      transferReason,
      isMeetingRequested,
    };
  } catch (err: any) {
    console.error('[Gemini AI Server Error]:', err?.message);
    return unavailable;
  }
}
