import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';
import { db } from './db';

// Modelo de conversa: Flash 3.6 (3.8 deu 503 repetido). Thinking desligado, resposta curta.
// Trocar com GEMINI_MODEL quando o 3.8 estabilizar.
const DEFAULT_MODEL = 'gemini-3.6-flash';
const RETIRED_MODEL = /^gemini-2\.5-/; // 2.5 foi descontinuado pela Google (404)

function resolveModel(fromDb?: string): string {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (fromDb && !RETIRED_MODEL.test(fromDb)) return fromDb;
  return DEFAULT_MODEL;
}

// Teto de chamadas por dia para ficar dentro da cota gratuita (sem gasto em dólar).
// Acima disso a IA para e nada é enviado no automático.
const DAILY_CALL_LIMIT = Number(process.env.GEMINI_DAILY_CALL_LIMIT ?? 200);

const SYSTEM_PROMPT = `
Você responde no WhatsApp pela Girofy, um estúdio de engenharia digital que resolve problemas de negócio (sistemas, sites, automações). Você conversa com donos e gerentes de negócios locais e regionais.

COMO ESCREVER (o mais importante):
- Soe como gente digitando no celular. Português do Brasil, informal, educado.
- Responda primeiro ao que a pessoa acabou de dizer, com as palavras dela quando der.
- Mensagem curta: uma ou duas frases. Se a pessoa escreveu pouco, escreva pouco.
- No máximo UMA pergunta por mensagem. Pergunte sobre a rotina ou a dor ("como chega cliente novo aí hoje?"), nunca sobre o produto.
- Proibido: "Obrigado pelo retorno", "Posso te apresentar brevemente", "Com certeza!", "Excelente", "Perfeito", listas, tópicos, emojis em excesso, parágrafos.
- Não repita frases que você já mandou. Veja as suas últimas mensagens no histórico e mude a forma.
- Se a pessoa estiver seca ("ok", "sim", "não"), não insista: responda curto e deixe a porta aberta.

CONTEXTO DA PESSOA:
- Use o nome e o nicho quando ajudar, sem forçar. Nunca chame de "Lead" ou "Contato".
- Não invente nada sobre a empresa que não esteja nos dados abaixo.

IMAGEM E ÁUDIO:
- Se a pessoa mandou imagem ou áudio, você recebe o conteúdo. Reaja ao conteúdo de verdade, em uma frase. Nunca diga que não consegue ver ou ouvir quando o conteúdo estiver aqui.

OBJETIVO:
- Entender a dor e propor uma conversa curta de 15 minutos quando houver dor clara.
- Preço só quando perguntarem. Se perguntarem: "A partir de R$ 997 para landing page pronta. Depende do que você precisa."

REGRAS FIXAS:
- Você é uma IA da Girofy. Se perguntarem se é robô ou IA, diga que sim, que é o assistente da Girofy e que o César acompanha as conversas. Nunca diga que é humano.
- Se pedirem atendente ou humano, inclua [TRANSF_HUMANO: motivo] e avise com gentileza que o César responde.
- Se pedirem para parar, confirme em uma frase e não mande mais nada.
- Não invente preço, prazo, cliente ou resultado. Se não souber, diga que o César confirma.
`;

const KNOWLEDGE_MAX_CHARS = 12000;

// Lê a base de conhecimento (todos os .md em knowledge/). Lido a cada chamada.
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

export interface IncomingMedia {
  mimeType: string; // ex.: image/jpeg, audio/ogg
  data: string; // base64 sem prefixo
}

export interface IncomingMessage {
  text: string; // texto ou legenda; para áudio/imagem, um rótulo curto
  media?: IncomingMedia;
}

export interface AiGenerationResult {
  replyText: string;
  aiAvailable: boolean; // false = IA não rodou (sem chave, cota estourada ou erro). Nada deve ser enviado.
  unavailableReason?: 'no_key' | 'quota' | 'error' | 'empty';
  transferToHuman: boolean;
  transferReason?: string;
  isMeetingRequested?: boolean;
}

function todayBahia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Confere e conta a cota diária. Retorna false se já estourou ou se a IA está pausada.
export async function reserveAiCall(): Promise<boolean> {
  const cfg = await db.getConfig();
  if (cfg.aiPausedUntil && Date.parse(cfg.aiPausedUntil) > Date.now()) return false;
  const day = todayBahia();
  const used = cfg.aiUsageDay === day ? cfg.aiUsageCount || 0 : 0;
  if (used >= DAILY_CALL_LIMIT) return false;
  await db.saveAiUsage({ aiUsageDay: day, aiUsageCount: used + 1 });
  return true;
}

export async function generateGirofyCommercialReply(
  contact: Contact,
  incoming: IncomingMessage,
  history: ChatMessage[]
): Promise<AiGenerationResult> {
  const fail = (reason: AiGenerationResult['unavailableReason']): AiGenerationResult => ({
    replyText: '',
    aiAvailable: false,
    unavailableReason: reason,
    transferToHuman: false,
  });

  const cfg = await db.getConfig();
  const apiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY não configurada: resposta não enviada.');
    return fail('no_key');
  }

  if (!(await reserveAiCall())) {
    console.warn('[Gemini] cota diária do agente atingida ou IA pausada: nada enviado.');
    return fail('quota');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Últimas mensagens, com as do bot marcadas para evitar repetição.
    const recent = history.slice(-12);
    const recentBot = recent.filter(m => m.from === 'bot').slice(-4).map(m => `- "${m.text}"`).join('\n');
    const transcript = recent
      .map(m => {
        const who = m.from === 'bot' ? 'Você' : m.from === 'operator' ? 'César (humano)' : 'Pessoa';
        return `${who}: ${m.text}`;
      })
      .join('\n');

    const knowledge = loadKnowledge();
    const learnings = await db.getTopLearnings(8);

    const promptText = `
${SYSTEM_PROMPT}
${knowledge ? `\nBASE DE CONHECIMENTO DA GIROFY:\n${knowledge}\n` : ''}
${learnings.length ? `\nO QUE JÁ FUNCIONOU E NÃO FUNCIONOU (aprendido de conversas anteriores, use como guia):\n${learnings.map(l => `- ${l}`).join('\n')}\n` : ''}
DADOS DA PESSOA:
- Nome: ${contact.name && !/^(lead|contato)/i.test(contact.name) ? contact.name : 'não sei o nome'}
- Negócio: ${contact.company && contact.company !== 'Em qualificação' ? contact.company : 'não sei o nome do negócio'}
- Nicho: ${contact.niche || 'não informado'}

SUAS ÚLTIMAS MENSAGENS (não repita nenhuma destas ideias):
${recentBot || '(nenhuma ainda)'}

CONVERSA RECENTE:
${transcript || '(início da conversa)'}

NOVA MENSAGEM DA PESSOA:
"${incoming.text}"

Responda só com o texto da próxima mensagem para o WhatsApp.
`;

    const parts: any[] = [];
    if (incoming.media) {
      parts.push({ inlineData: { mimeType: incoming.media.mimeType, data: incoming.media.data } });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      // Modelo: variável de ambiente manda; o valor gravado no banco só vale se não for um modelo descontinuado.
      model: resolveModel(cfg.geminiModel),
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
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
    if (directHumanPattern.test(incoming.text)) {
      transferToHuman = true;
      transferReason = 'Pedido explícito de atendimento humano pelo cliente';
      if (!rawText) rawText = 'Claro. Vou pedir para o César te responder pessoalmente. Um instante.';
    }

    if (!rawText) return fail('empty');

    const isMeetingRequested = /meet\.google\.com|reunião|15 min/i.test(rawText);

    return {
      replyText: rawText,
      aiAvailable: true,
      transferToHuman,
      transferReason,
      isMeetingRequested,
    };
  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('[Gemini AI Server Error]:', msg);
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
      // Cota da API estourou: pausa a IA por 1 hora para não ficar batendo na cota.
      await db.saveAiUsage({ aiPausedUntil: new Date(Date.now() + 60 * 60_000).toISOString() });
      return fail('quota');
    }
    return fail('error');
  }
}
