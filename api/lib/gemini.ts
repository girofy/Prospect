import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';
import { db, AppConfig } from './db';
import { campaignFor } from './campaigns';

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
Você é o atendimento da Girofy no WhatsApp, estúdio de Sobradinho-BA que cria sites para negócios locais. Fale sempre em primeira pessoa, como quem atende e resolve. Nunca cite o nome de ninguém da equipe nem fale de alguém "que vai" fazer ou responder: você é quem atende.

O TREINAMENTO que vem abaixo, na base de conhecimento, é a sua regra principal: oferta, preço, prazo, fluxo, objeções, follow-up e tom. Siga o treinamento acima de qualquer outra coisa. Preço, prazo e condições são só os que estão nele; fora disso, diga que vai confirmar e já responde.

COMO ESCREVER (vale sempre)
- Uma bolha por turno, curta (10 a 25 palavras), uma pergunta só, texto puro de WhatsApp. Sem lista, sem negrito, sem travessão, no máximo um emoji.
- Responda primeiro o que a pessoa perguntou. Espelhe o jeito dela.
- Nada de termo técnico (SEO, landing page, funil, domínio, hospedagem). Fale do que ela ganha.
- Não use as frases "como posso ajudar", "tudo certo com você", "sem compromisso", "sem pressão".

O QUE VOCÊ NÃO FAZ
- Você não consegue enviar link, imagem, captura ou arquivo, e nunca inventa endereço de site. Quando precisar entregar a prévia, passar proposta ou resolver algo que só uma pessoa resolve, avise o que vai acontecer ("já te mando por aqui") e termine a resposta com [TRANSF_HUMANO: motivo curto].
- Se quem responde for outro robô ou assistente automático (menu, "mensagem automática", "agradece seu contato"), não converse: no máximo uma resposta curta pedindo uma pessoa, ou nenhuma. Despedida (obrigado, até mais) não se responde.

OS DOIS LIMITES (nunca quebre)
1. VERDADE. Se perguntarem sinceramente se você é robô ou pessoa, diga que é o assistente digital da Girofy, sem enrolar. Nunca invente fato, número, cliente, depoimento, preço ou resultado. Nunca prometa posição no Google.
2. PARADA. Se a pessoa disser que não quer, pedir para parar ou xingar, responda uma única vez, curto e gentil, e nunca mais escreva para esse número.

SAÍDA: responda SOMENTE com o texto da mensagem para o WhatsApp. Se precisar de ajuda humana, escreva a mensagem e termine com [TRANSF_HUMANO: motivo curto].
`;

// Groq grátis: ~7-8 mil tokens por minuto e por requisição. Acima disso ele recusa (413), então a versão enxuta é curta.
const GROQ_KNOWLEDGE_CHARS = 12000;
const GROQ_LESSONS = 2;
const HISTORY_CHARS_FULL = 9000; // histórico que vai para modelos Gemini
const HISTORY_CHARS_GROQ = 1500; // histórico que vai para o Groq (limite por minuto)
const KNOWLEDGE_MAX_CHARS = 30000; // a base inteira vai para o Gemini; o Groq recebe só um pedaço (limite por minuto) // ~8k tokens por mensagem; ajuste se a cota gratuita apertar

// Base de conhecimento = documentos do painel (banco, ativos) + arquivos .md da pasta knowledge/ do repo.
// Lido com cache de 60 s para não consultar o banco a cada mensagem.
let knowledgeCache: { at: number; text: string } | null = null;

export async function loadKnowledge(): Promise<string> {
  if (knowledgeCache && Date.now() - knowledgeCache.at < 60_000) return knowledgeCache.text;

  let out = '';
  try {
    const docs = await db.getActiveKnowledge();
    // Documentos de regras primeiro; a biblioteca longa de frases prontas vai por último (é a que o limite corta).
    const ordered = [...docs].sort((a, b) => Number(/biblioteca/i.test(a.title)) - Number(/biblioteca/i.test(b.title)));
    for (const d of ordered) out += `\n\n# ${d.title}\n${d.content}`;
  } catch (err) {
    console.warn('[Knowledge] falha ao ler documentos do banco:', err);
  }
  try {
    const dir = path.resolve(process.cwd(), 'knowledge');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.md')).sort();
      for (const f of files) out += `\n\n# ${f}\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`;
    }
  } catch (err) {
    console.warn('[Knowledge] falha ao ler knowledge/:', err);
  }

  const text = out.slice(0, KNOWLEDGE_MAX_CHARS).trim();
  knowledgeCache = { at: Date.now(), text };
  return text;
}

// Chamado pelo painel ao salvar conhecimento, para a IA usar já na próxima mensagem.
export function clearKnowledgeCache() {
  knowledgeCache = null;
}

// Validador antes de qualquer envio. Recusa o que a Bíblia proíbe (campos vazios, rótulos internos,
// frases proibidas, mais de uma pergunta, mensagem longa e texto parecido com o que já foi enviado).
export function validateReply(text: string, recentBot: string[]): string | null {
  const t = text.replace(/\[TRANSF_HUMANO:[^\]]*\]/gi, '').trim();
  if (!t) return 'mensagem vazia';
  if (/[{}\[\]]|\bnull\b|undefined/i.test(t)) return 'tem chave, colchete ou campo vazio';
  if (/\bLead\b|Em qualificação/.test(t)) return 'usou rótulo interno no lugar do nome';
  if (/reunião|sem pressão|sem compromisso|se não for o momento|só passando/i.test(t)) return 'usou frase proibida';
  if (/perdendo cliente|vai perder|está perdendo|como posso ajudar|tudo certo com você|procurei (você|vocês) no google|quem (é|cuida|decide|resolve|responde)|você é (o|a) respons|quem é o respons/i.test(t)) return 'usou frase que trava a conversa';
  if (/https?:\/\/|www\./i.test(t)) return 'tem link (nunca inventar link)';
  if (/\bc[eé]sar\b/i.test(t)) return 'citou o nome do dono';
  if (/\b(seo|landing|responsiv\w*|convers[aã]o|funil|cta|layout|dom[ií]nio|hospedagem|template)\b/i.test(t)) return 'usou termo técnico';
  if (/(vou|vamos) (te )?(mandar|enviar|reenviar)[^.?!]{0,40}(captura|imagem|print|foto|arquivo|link|pdf)|segue o link|te mando o link|vou enviar agora/i.test(t)) return 'prometeu enviar algo que não pode enviar';
  const bubbles = t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (bubbles.length > 2) return 'mais de duas mensagens';
  if (bubbles.some(b => b.split(/\s+/).length > 34)) return 'mensagem longa demais';
  if (t.split(/\s+/).length > 55) return 'mensagem longa demais';
  if ((t.match(/\?/g) || []).length > 1) return 'mais de uma pergunta';
  const norm = (x: string) =>
    new Set(x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  const a = norm(t);
  for (const b of recentBot) {
    const bs = norm(b);
    const inter = [...a].filter(w => bs.has(w)).length;
    const uni = new Set([...a, ...bs]).size;
    if (uni > 0 && inter / uni > 0.6) return 'parecida demais com mensagem já enviada';
  }
  return null;
}

export interface IncomingMedia {
  mimeType: string; // ex.: image/jpeg, audio/ogg
  data: string; // base64 sem prefixo
}

export interface IncomingMessage {
  text: string; // texto ou legenda; para áudio/imagem, um rótulo curto
  media?: IncomingMedia;
  followup?: number; // se definido: a pessoa NÃO respondeu; escrever o follow-up de número N
}

export interface AiGenerationResult {
  replyText: string;
  aiAvailable: boolean; // false = IA não rodou (sem chave, cota estourada ou erro). Nada deve ser enviado.
  unavailableReason?: 'no_key' | 'quota' | 'error' | 'empty' | 'invalid';
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

type ChainItem = { provider: 'gemini' | 'groq' | 'cf'; model: string };

// Cadeia padrão: cada modelo tem cota grátis própria. Quando um estoura, o próximo responde.
function defaultChain(cfg: AppConfig): ChainItem[] {
  return [
    { provider: 'gemini', model: resolveModel(cfg.geminiModel) },
    { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
    { provider: 'cf', model: 'gpt-oss-120b' },
    { provider: 'groq', model: 'qwen/qwen3.8-27b' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
  ];
}

function chainFrom(cfg: AppConfig): ChainItem[] {
  const saved = Array.isArray(cfg.aiChain) ? cfg.aiChain : [];
  const valid = saved.filter(x => x && (x.provider === 'gemini' || x.provider === 'groq' || x.provider === 'cf') && typeof x.model === 'string' && x.model.trim() && !/^(gsk_|AIza|AQ\.|sk-)/.test(x.model.trim()));
  const chain: ChainItem[] = valid.length ? valid.map(x => ({ provider: x.provider, model: x.model.trim() })) : defaultChain(cfg);
  // Cloudflare (Workers AI, grátis) entra sempre antes do Groq: lê a base inteira, sem o corte do Groq.
  if (!chain.some(x => x.provider === 'cf')) {
    const i = chain.findIndex(x => x.provider === 'groq');
    chain.splice(i < 0 ? chain.length : i, 0, { provider: 'cf', model: 'gpt-oss-120b' });
  }
  return chain;
}

function pauseKey(item: ChainItem): string {
  return `${item.provider}:${item.model}`;
}

function isPaused(cfg: AppConfig, item: ChainItem): boolean {
  const until = cfg.aiPausedModels?.[pauseKey(item)];
  return !!until && Date.parse(until) > Date.now();
}

// Quanto tempo pausar um modelo que bateu no limite. O Groq diz "try again in 7.5s" (limite por minuto):
// nesse caso pausa só esse tempo. Sem essa dica (cota do dia), pausa 1 hora.
function pauseMsFrom(msg: string): number {
  const m = msg.match(/try again in\s+(?:(\d+)m)?\s*(\d+(?:\.\d+)?)(ms|s)\b/i);
  if (!m) return 60 * 60_000;
  const mins = m[1] ? Number(m[1]) : 0;
  const n = Number(m[2]);
  const ms = (m[3].toLowerCase() === 'ms' ? n : n * 1000) + mins * 60_000;
  return Math.min(60 * 60_000, Math.max(5_000, ms + 1_000));
}

async function pauseModel(item: ChainItem, ms = 60 * 60_000): Promise<void> {
  const cfg = await db.getConfig();
  const until = new Date(Date.now() + ms).toISOString();
  await db.saveAiUsage({ aiPausedModels: { ...(cfg.aiPausedModels || {}), [pauseKey(item)]: until } });
}

async function callGemini(apiKey: string, model: string, text: string, media?: IncomingMedia): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const parts: any[] = [];
  if (media) parts.push({ inlineData: { mimeType: media.mimeType, data: media.data } });
  parts.push({ text });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { temperature: 0.7, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
  });
  return response.text ? response.text.trim() : '';
}

// Groq usa o mesmo formato da OpenAI (chat/completions).
// Modelos de raciocínio (gpt-oss, qwen3) precisam de ajuste para não gastar o limite "pensando".
function groqExtras(model: string): Record<string, unknown> {
  if (/gpt-oss/i.test(model)) return { reasoning_effort: 'low', include_reasoning: false };
  if (/qwen3/i.test(model)) return { reasoning_effort: 'none' };
  return {};
}

async function callGroq(apiKey: string, model: string, text: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: text }], temperature: 0.7, max_tokens: 300, ...groqExtras(model) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`groq ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    err.pauseMs = pauseMsFrom(body); // a dica "try again in Xs" vem depois dos 200 primeiros caracteres
    throw err;
  }
  const j: any = await res.json();
  return String(j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Cloudflare Workers AI pelo Worker girofy-ia (grátis até 10 mil neurons por dia, contexto grande).
function cfConfigured(): boolean {
  return !!(process.env.IA_URL && process.env.IA_KEY);
}
async function callCf(text: string): Promise<string> {
  const res = await fetch(`${process.env.IA_URL!.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-girofy-key': process.env.IA_KEY! },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }], max_tokens: 2500 }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await res.text();
  if (!res.ok) {
    const err: any = new Error(`cf ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const j: any = JSON.parse(body);
  return String(j.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Pergunta de teste para um modelo (usada pelo leitor de chaves): mesma persona, prompt enxuto.
export async function probeModel(
  provider: 'gemini' | 'groq' | 'cf',
  model: string,
  apiKey: string,
  text = 'Oi, quem é?'
): Promise<{ ok: boolean; reply: string; ms: number; problem: string | null; error?: string }> {
  const prompt = `${SYSTEM_PROMPT}\n\nDADOS DA PESSOA:\n- Nome: não sei o nome\n- Nicho: barbearia\n\nCONVERSA RECENTE:\nVocê: Boa tarde!\n\nNOVA MENSAGEM DA PESSOA:\n"${text}"\n\nResponda só com o texto da próxima mensagem para o WhatsApp.`;
  const t0 = Date.now();
  try {
    const reply = provider === 'gemini' ? await callGemini(apiKey, model, prompt) : provider === 'cf' ? await callCf(prompt) : await callGroq(apiKey, model, prompt);
    return { ok: !!reply, reply, ms: Date.now() - t0, problem: reply ? validateReply(reply, []) : 'vazio' };
  } catch (err: any) {
    return { ok: false, reply: '', ms: Date.now() - t0, problem: null, error: String(err?.message || err).slice(0, 160) };
  }
}

// Se todos os modelos estão só esperando o limite por minuto (poucos segundos), espera e tenta de novo
// em vez de largar o lead. Pausa longa (cota do dia) continua falhando na hora.
export async function generateGirofyCommercialReply(
  contact: Contact,
  incoming: IncomingMessage,
  history: ChatMessage[]
): Promise<AiGenerationResult> {
  const first = await generateOnce(contact, incoming, history);
  if (first.aiAvailable || (first.unavailableReason !== 'quota' && first.unavailableReason !== 'error')) return first;
  const cfg = await db.getConfig();
  const waits = chainFrom(cfg)
    .map(it => Date.parse(cfg.aiPausedModels?.[pauseKey(it)] || '') - Date.now())
    .filter(ms => ms > 0);
  const shortest = waits.length ? Math.min(...waits) : Infinity;
  if (shortest > 20_000) return first;
  await new Promise(r => setTimeout(r, shortest + 500));
  return generateOnce(contact, incoming, history);
}

async function generateOnce(
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
  const geminiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const groqKey = (cfg.groqApiKey || process.env.GROQ_API_KEY || '').trim();
  if (!geminiKey && !groqKey && !cfConfigured()) {
    console.error('[IA] nenhuma chave configurada (Gemini ou Groq): resposta não enviada.');
    return fail('no_key');
  }

  // Modelos que podem responder agora: com chave, não pausados, e que aceitam o tipo de mensagem
  // (imagem e áudio só vão para modelos Gemini).
  const usable = chainFrom(cfg).filter(item => {
    if (isPaused(cfg, item)) return false;
    if (item.provider === 'gemini' && !geminiKey) return false;
    if (item.provider === 'groq' && !groqKey) return false;
    if (item.provider === 'cf' && !cfConfigured()) return false;
    if (incoming.media && item.provider !== 'gemini') return false;
    return true;
  });
  if (usable.length === 0) return fail('quota');

  if (!(await reserveAiCall())) {
    console.warn('[IA] cota diária do agente atingida: nada enviado.');
    return fail('quota');
  }

  try {
    // Últimas mensagens, com as do bot marcadas para evitar repetição.
    const recent = history.slice(-12);
    const opening = history.length > 12 ? history.slice(0, 3) : [];
    const recentBot = recent.filter(m => m.from === 'bot').slice(-4).map(m => `- "${m.text}"`).join('\n');
    // Histórico com orçamento de caracteres: pega as mensagens mais recentes que cabem, em ordem.
    const transcriptFor = (budget: number) => {
      const lines: string[] = [];
      let used = 0;
      for (let i = history.length - 1; i >= 0 && lines.length < 80; i--) {
        const m = history[i];
        const who = m.from === 'bot' ? 'Você' : m.from === 'operator' ? 'Você (digitado à mão)' : 'Pessoa';
        const line = `${who}: ${m.text}`;
        if (used + line.length > budget) break;
        lines.unshift(line);
        used += line.length + 1;
      }
      return lines.join('\n');
    };
    const transcriptFull = transcriptFor(HISTORY_CHARS_FULL);
    const transcriptSlim = transcriptFor(HISTORY_CHARS_GROQ);

    const knowledge = await loadKnowledge();
    const learnings = await db.getTopLearnings(8);
    const camp = await campaignFor(contact.phone).catch(() => undefined);

    // O Groq grátis limita ~7 mil tokens por minuto: ele recebe uma versão enxuta da base de conhecimento.
    const buildPrompt = (knowledge: string, lessons: string[], transcriptText: string) => `
${SYSTEM_PROMPT}
${cfg.pixKey && cfg.pixEnabled ? `\nCHAVE PIX DA GIROFY (use só quando a pessoa disser que quer pagar agora): ${cfg.pixKey}\n` : ''}${knowledge ? `\nBASE DE CONHECIMENTO DA GIROFY:\n${knowledge}\n` : ''}
${lessons.length ? `\nO QUE JÁ FUNCIONOU E NÃO FUNCIONOU (aprendido de conversas anteriores, use como guia):\n${lessons.map(l => `- ${l}`).join('\n')}\n` : ''}
DADOS DA PESSOA (use SÓ isto; nunca cite nome, negócio, cidade ou ramo que não esteja aqui):
- Nome: ${contact.name && !/^(lead|contato)/i.test(contact.name) ? contact.name : 'não sei o nome'}
- Negócio: ${contact.company && contact.company !== 'Em qualificação' ? contact.company : 'não sei o nome do negócio'}
- Nicho: ${contact.niche || 'não informado'}
${camp && camp.mission ? `- Missão desta campanha (o que você quer conseguir; sem pressionar, e se a pessoa disser não, encerre com educação): ${camp.mission}${camp.objective ? ' | Objetivo: ' + camp.objective : ''}\n` : ''}${contact.notes ? `- Pesquisa sobre a empresa (fatos para você saber; a proposta é só uma ideia, nunca um fato; nunca cite avaliações, nota, fotos nem endereço; respeite o que diz "não fazer"): ${contact.notes.slice(0, 700)}\n` : ''}${opening.length ? `
COMO A CONVERSA COMEÇOU (primeiras mensagens, para você lembrar quem falou o quê):
${opening.map(m => `${m.from === 'bot' ? 'Você' : m.from === 'operator' ? 'Você (digitado à mão)' : 'Pessoa'}: ${m.text}`).join('\n')}
` : ''}
SUAS ÚLTIMAS MENSAGENS (não repita nenhuma destas ideias):
${recentBot || '(nenhuma ainda)'}

CONVERSA RECENTE:
${transcriptText || '(início da conversa)'}

${incoming.followup
  ? `SITUAÇÃO: a pessoa não respondeu à sua última mensagem. Escreva o follow-up número ${incoming.followup} (no máximo 3 no total).
Regras do follow-up: use um ângulo NOVO (não repita a observação anterior), termine com uma pergunta de escolha de duas saídas, curto. Nunca escreva "só passando pra lembrar" nem "você viu minha mensagem?". Se ela já tinha respondido antes, retome o ponto em que ela parou.`
  : `NOVA MENSAGEM DA PESSOA:\n"${incoming.text}"`}

Responda só com o texto da próxima mensagem para o WhatsApp.
`;
    const promptFull = buildPrompt(knowledge, learnings, transcriptFull);
    const promptSlim = buildPrompt(knowledge.slice(0, GROQ_KNOWLEDGE_CHARS), learnings.slice(0, GROQ_LESSONS).map(l => l.slice(0, 220)), transcriptSlim);

    const recentBotTexts = recent.filter(m => m.from === 'bot').slice(-4).map(m => m.text);

    // Percorre a cadeia. Em cada modelo: até duas tentativas (a segunda recebe o motivo da recusa).
    // Erro de cota pausa só aquele modelo; erro comum passa para o próximo.
    let rawText = '';
    let lastProblem = '';
    for (const item of usable) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const feedback = lastProblem
          ? `\n\nSUA TENTATIVA ANTERIOR FOI RECUSADA: ${lastProblem}. Escreva outra mensagem, com outras palavras, seguindo as regras.`
          : '';
        let candidate = '';
        try {
          candidate = item.provider === 'gemini'
            ? await callGemini(geminiKey, item.model, promptFull + feedback, incoming.media)
            : item.provider === 'cf'
            ? await callCf(promptFull + feedback)
            : await callGroq(groqKey, item.model, promptSlim + feedback);
        } catch (err: any) {
          const msg = String(err?.message || err);
          console.error(`[IA] ${item.provider}/${item.model} falhou:`, msg.slice(0, 300));
          // 413 = pedido grande demais para o modelo: não é limite de uso, então não pausa o modelo.
          if (err?.status !== 413 && (err?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg))) await pauseModel(item, err?.pauseMs ?? pauseMsFrom(msg));
          break; // próximo modelo da cadeia
        }
        const problem = validateReply(candidate, recentBotTexts);
        if (!problem) {
          rawText = candidate;
          break;
        }
        lastProblem = problem;
        console.warn(`[IA] ${item.model} recusado pelo validador:`, problem, '|', candidate);
      }
      if (rawText) break;
    }
    if (!rawText) return fail(lastProblem ? 'invalid' : 'error');

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
      if (!rawText) rawText = 'Claro. Deixa eu confirmar isso aqui e já te respondo.';
    }
    if (!rawText) return fail('empty');

    const isMeetingRequested = /meet\.google\.com|reunião|15 min/i.test(rawText);
    return { replyText: rawText, aiAvailable: true, transferToHuman, transferReason, isMeetingRequested };
  } catch (err: any) {
    console.error('[IA] erro inesperado:', String(err?.message || err).slice(0, 300));
    return fail('error');
  }
}

// Conversa com o dono (seu WhatsApp pessoal). O modelo responde em linguagem natural e escolhe UMA ação
// de uma lista fixa. Quem executa é o código (api/lib/owner.ts), nunca o modelo.
export type OwnerAction = 'none' | 'status' | 'pause' | 'resume' | 'summarize' | 'list' | 'send' | 'read' | 'schedule';
export type OwnerOut = { reply: string; action: OwnerAction; target: string; message: string; when: string; todo: string };

function parseOwnerJson(raw: string): OwnerOut | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const reply = String(j.reply || '').trim();
    if (!reply) return null;
    const actions: OwnerAction[] = ['status', 'pause', 'resume', 'summarize', 'list', 'send', 'read', 'schedule'];
    const action: OwnerAction = actions.includes(j.action) ? j.action : 'none';
    return { reply, action, target: String(j.target || '').trim(), message: String(j.message || '').trim(), when: String(j.when || '').trim(), todo: String(j.todo || '').trim() };
  } catch {
    return null;
  }
}

export async function generateOwnerReply(
  text: string,
  history: { from: 'owner' | 'bot'; text: string }[],
  snapshot: string,
  context = ''
): Promise<OwnerOut | null> {
  const cfg = await db.getConfig();
  const geminiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const groqKey = (cfg.groqApiKey || process.env.GROQ_API_KEY || '').trim();
  const transcript = history.slice(-8).map(m => `${m.from === 'owner' ? 'César' : 'Você'}: ${m.text}`).join('\n');
  const prompt = `Você é o agente de prospecção da Girofy e está falando com o CÉSAR, o dono. Ele te configurou e ninguém mais tem esse número.

COMO FALAR: português do Brasil, natural, direto, como um assistente de confiança no WhatsApp. Não é lead: não venda, não fale de preço com ele. Não invente número, nome nem resultado: use só o que está nos dados abaixo.

AÇÕES (escolha UMA por resposta e preencha os campos certos):
- "status": mostrar o estado (use os números de ESTADO AGORA)
- "pause": pausar a prospecção de novos contatos
- "resume": retomar a prospecção (o sistema pede um "sim" antes; pergunte se ele confirma)
- "list": listar leads. Em "target" coloque o filtro: "quentes" (responderam), "travados", "reuniao", "saida" (pediram para sair) ou "todos"
- "summarize": resumir a conversa de um lead. Em "target" coloque o nome ou o número como ele disse
- "send": mandar mensagem para um lead. Em "target" o nome ou número; em "message" o texto exato a enviar. O sistema pede confirmação antes de enviar.
- "read": ler uma página da internet (site, landing page, preço) e analisar o que ele pediu. Em "target" coloque o link completo.
- "schedule": agendar para um horário. Em "when" coloque a data e a hora ISO com fuso da Bahia (ex.: 2026-11-09T06:30:00-03:00; use a HORA EM SALVADOR do ESTADO AGORA para calcular "daqui a 5 minutos" ou "amanhã às 6h30"). Em "todo" escolha: "lembrar" (te manda uma mensagem no horário, com o texto em "message"), "retomar" (liga a prospecção no horário) ou "pausar" (desliga no horário).
- "none": só conversar, explicar, responder dúvidas
Quando ele faz perguntas para você montar um plano ou um consultor, conduza em conversa: faça uma pergunta por vez e espere a resposta.
Se ele pedir algo fora dessas ações, diga com honestidade que ainda não faz e o que faz. Nunca diga que fez algo que não está na ação escolhida. Você NÃO muda horário, janela, teto, intervalo nem configuração: se ele pedir ou corrigir algo disso, não diga "ajustei"; confirme o valor que está no ESTADO AGORA e diga que mudanças assim são feitas no código.

ESTADO AGORA:
${snapshot}
${context ? `\nDADOS PARA ESTA RESPOSTA:\n${context}\n` : ''}
CONVERSA RECENTE COM O CÉSAR:
${transcript || '(início)'}

MENSAGEM DO CÉSAR AGORA:
"${text}"

Responda SOMENTE um JSON, sem texto fora dele:
{"reply":"texto para o WhatsApp","action":"none|status|pause|resume|list|summarize|send|read|schedule","target":"","message":"","when":"","todo":""}`;

  for (const item of chainFrom(cfg)) {
    if (isPaused(cfg, item)) continue;
    if (item.provider === 'gemini' && !geminiKey) continue;
    if (item.provider === 'groq' && !groqKey) continue;
    if (item.provider === 'cf' && !cfConfigured()) continue;
    if (!(await reserveAiCall())) return null;
    try {
      const raw = item.provider === 'gemini' ? await callGemini(geminiKey, item.model, prompt) : item.provider === 'cf' ? await callCf(prompt) : await callGroq(groqKey, item.model, prompt);
      const parsed = parseOwnerJson(raw);
      if (parsed) return parsed;
      console.warn('[Dono] resposta sem JSON válido:', raw.slice(0, 160));
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.error(`[Dono] ${item.model} falhou:`, msg.slice(0, 200));
      if (err?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(msg)) await pauseModel(item, err?.pauseMs ?? pauseMsFrom(msg));
    }
  }
  return null;
}
