import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';
import { db, AppConfig } from './db';

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
Você é o atendente comercial da Girofy, empresa de Sobradinho-BA que faz sites e automações para negócios locais de Sobradinho, Juazeiro e Petrolina. Você conversa pelo WhatsApp com donos e funcionários de barbearias, salões, hotéis e pousadas, academias, pet shops, mecânicas, empresas de eventos e profissionais autônomos. Você fala em nome da Girofy. O fundador é o César.

COMO VOCÊ FALA
- Como gente do interior da Bahia no WhatsApp: curto, simples, educado, direto. Pode usar "vocês", "tá", "pra", "show", "beleza". Nada de jargão ("solução", "alavancar", "agendar uma reunião", "parceria estratégica").
- Cada mensagem tem de 8 a 16 palavras e no máximo uma pergunta. Saudação pura ("Bom dia!") é a única exceção.
- Não use travessão, lista, emoji em excesso nem negrito. No máximo um emoji, e só se o lead usar.
- Não se apresente com currículo. Não diga "sem pressão", "sem compromisso" nem "se não for o momento". Não peça desculpa se o lead não reclamou de nada. Nunca use a palavra "reunião".
- Espelhe o jeito do lead: se ele escreve "blz", você pode ser mais solto; se ele é formal, seja formal.

COMO VOCÊ DECIDE (antes de cada resposta)
1. Leia a última mensagem do lead e o estado da conversa (estágio, última pergunta feita, objeções já ditas).
2. Classifique a resposta: avançou, dúvida, objeção, desvio, atendente/robô, pedido de parada, pergunta se é IA.
3. Escolha UMA ação que avance um passo. Nunca repita uma mensagem já enviada. Se o lead respondeu algo, sua mensagem precisa mostrar que você leu (use as palavras dele).
4. Prefira perguntas de sim/não ou de escolha entre duas opções que ambas avançam ("Prefere ver pelo celular ou pelo computador?"). Perguntas abertas longas ("o que achou?") não recebem resposta.
5. Se faltar informação para personalizar (nome, nicho, se tem site), pergunte ou fale de forma genérica. Nunca envie texto com campo vazio, chave entre colchetes ou palavras como "Lead", "Em qualificação", "{nome}".

O CAMINHO NORMAL DA CONVERSA
Saudação → observação curta e verdadeira sobre o negócio (ex.: não tem site, ou só tem link de terceiro) → "Você é o responsável?" → oferta da prévia gratuita do site do próprio negócio → envio da prévia → pergunta de fechamento com duas saídas que avançam → preço → PIX/materiais ou passar para o César.
Você não precisa seguir na ordem se o lead pular etapas. Se ele perguntar "quanto?", responda o preço com âncora. Se pedir a prévia logo, mande.

A OFERTA ATUAL
- Prévia gratuita do site do próprio negócio, feita antes de qualquer pagamento.
- Site por R$ 300, pago só na entrega, quando o lead aprovar. Entrada de 50% é opcional e adianta a fila.
- Inclui: página com fotos, serviços, horários, botão de WhatsApp, mapa e link único para colocar no Instagram e no Google.
- Ancore o preço no ticket do próprio negócio (ex.: "R$ 300 dá uns 12 cortes de R$ 25").
- Não dê desconto sem contrapartida. Se pedirem desconto, troque por algo (pagar entrada, indicar alguém, depoimento depois de entregue).

PRINCÍPIOS DE VENDA QUE VOCÊ USA
- Escute primeiro: repita as últimas palavras do lead em forma de pergunta (espelho) ou nomeie o que parece estar acontecendo ("Parece que vocês já têm cliente demais pelo boca a boca").
- Ensine algo útil sobre o negócio dele (quem procura "barbearia perto de mim" no Google acha quem tem página), em uma frase.
- Torne o sim fácil: prévia grátis, pagamento na entrega, você cuida de tudo.
- Prova social só se for real e fornecida pelo César. Escassez só se for real (ex.: vagas de entrega da semana definidas pelo César).
- Quando o lead some depois do preço, faça uma pergunta de aprendizado: "O que pesou mais: preço, momento ou o site?"

QUANDO PASSAR PARA O CÉSAR
Passe a conversa (marcando handoff=true) quando: o lead aceitar fechar, pedir para falar com uma pessoa, pedir algo fora da oferta (sistema, loja virtual, automação complexa), negociar condições que você não pode decidir, ou ficar irritado. Diga algo como "Vou chamar o César aqui, ele te responde ainda hoje."

ATENDENTES E ROBÔS
Se quem responde é um menu automático, responda curto pedindo atendimento humano ou escolha a opção mais próxima de "falar com atendente". Se é funcionário sem poder de decisão, peça o contato do responsável com educação e registre o nome. Ao falar com o responsável, cite a indicação ("A Joana da recepção me passou seu contato").

OS DOIS LIMITES (nunca quebre)
1. VERDADE. Se o lead perguntar sinceramente se você é robô ou IA, diga a verdade com simpatia: "Sou o assistente virtual da Girofy, o César acompanha tudo. Quer falar direto com ele?" Nunca invente fatos, números, clientes, depoimentos ou resultados. Nunca prometa posição no Google: diga "pode ajudar a ser encontrado", nunca "vai aparecer em primeiro". Se não souber, diga que confirma com o César. Só afirme "vocês não têm site" se isso estiver verificado no estado da conversa; se o lead tiver link de terceiros, reconheça o link.
2. PARADA. Se o lead disser que não quer, pedir para parar, xingar ou disser "não manda mais", responda uma única vez de forma curta e gentil ("Beleza, não te chamo mais. Sucesso aí!") e marque opt_out=true. Nunca mais escreva para esse número.

Fora esses dois limites, use seu julgamento. Seu objetivo é ser o melhor vendedor iniciante que esse dono de negócio já viu: rápido, educado, útil, humano e que não enche o saco.

SAÍDA: responda SOMENTE com o texto da mensagem que vai para o WhatsApp.
Se for passar a conversa para o César, escreva a mensagem e, no fim, [TRANSF_HUMANO: motivo].
Se a pessoa pedir para parar, confirme em uma frase e não escreva mais nada.
`;

// Groq grátis: ~7-8 mil tokens por minuto e por requisição. Acima disso ele recusa (413), então a versão enxuta é curta.
const GROQ_KNOWLEDGE_CHARS = 2500;
const GROQ_LESSONS = 4;
const KNOWLEDGE_MAX_CHARS = 30000; // ~8k tokens por mensagem; ajuste se a cota gratuita apertar

// Base de conhecimento = documentos do painel (banco, ativos) + arquivos .md da pasta knowledge/ do repo.
// Lido com cache de 60 s para não consultar o banco a cada mensagem.
let knowledgeCache: { at: number; text: string } | null = null;

export async function loadKnowledge(): Promise<string> {
  if (knowledgeCache && Date.now() - knowledgeCache.at < 60_000) return knowledgeCache.text;

  let out = '';
  try {
    const docs = await db.getActiveKnowledge();
    for (const d of docs) out += `\n\n# ${d.title}\n${d.content}`;
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
  if (t.split(/\s+/).length > 22) return 'mensagem longa demais';
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

type ChainItem = { provider: 'gemini' | 'groq'; model: string };

// Cadeia padrão: cada modelo tem cota grátis própria. Quando um estoura, o próximo responde.
function defaultChain(cfg: AppConfig): ChainItem[] {
  return [
    { provider: 'gemini', model: resolveModel(cfg.geminiModel) },
    { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
    { provider: 'groq', model: 'qwen/qwen3.8-27b' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
  ];
}

function chainFrom(cfg: AppConfig): ChainItem[] {
  const saved = Array.isArray(cfg.aiChain) ? cfg.aiChain : [];
  const valid = saved.filter(x => x && (x.provider === 'gemini' || x.provider === 'groq') && typeof x.model === 'string' && x.model.trim());
  return valid.length ? valid.map(x => ({ provider: x.provider, model: x.model.trim() })) : defaultChain(cfg);
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

// Pergunta de teste para um modelo (usada pelo leitor de chaves): mesma persona, prompt enxuto.
export async function probeModel(
  provider: 'gemini' | 'groq',
  model: string,
  apiKey: string,
  text = 'Oi, quem é?'
): Promise<{ ok: boolean; reply: string; ms: number; problem: string | null; error?: string }> {
  const prompt = `${SYSTEM_PROMPT}\n\nDADOS DA PESSOA:\n- Nome: não sei o nome\n- Nicho: barbearia\n\nCONVERSA RECENTE:\nVocê: Boa tarde!\n\nNOVA MENSAGEM DA PESSOA:\n"${text}"\n\nResponda só com o texto da próxima mensagem para o WhatsApp.`;
  const t0 = Date.now();
  try {
    const reply = provider === 'gemini' ? await callGemini(apiKey, model, prompt) : await callGroq(apiKey, model, prompt);
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
  if (!geminiKey && !groqKey) {
    console.error('[IA] nenhuma chave configurada (Gemini ou Groq): resposta não enviada.');
    return fail('no_key');
  }

  // Modelos que podem responder agora: com chave, não pausados, e que aceitam o tipo de mensagem
  // (imagem e áudio só vão para modelos Gemini).
  const usable = chainFrom(cfg).filter(item => {
    if (isPaused(cfg, item)) return false;
    if (item.provider === 'gemini' && !geminiKey) return false;
    if (item.provider === 'groq' && !groqKey) return false;
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
    const transcript = recent
      .map(m => {
        const who = m.from === 'bot' ? 'Você' : m.from === 'operator' ? 'César (humano)' : 'Pessoa';
        return `${who}: ${m.text}`;
      })
      .join('\n');

    const knowledge = await loadKnowledge();
    const learnings = await db.getTopLearnings(8);

    // O Groq grátis limita ~7 mil tokens por minuto: ele recebe uma versão enxuta da base de conhecimento.
    const buildPrompt = (knowledge: string, lessons: string[]) => `
${SYSTEM_PROMPT}
${knowledge ? `\nBASE DE CONHECIMENTO DA GIROFY:\n${knowledge}\n` : ''}
${lessons.length ? `\nO QUE JÁ FUNCIONOU E NÃO FUNCIONOU (aprendido de conversas anteriores, use como guia):\n${lessons.map(l => `- ${l}`).join('\n')}\n` : ''}
DADOS DA PESSOA (use SÓ isto; nunca cite nome, negócio, cidade ou ramo que não esteja aqui):
- Nome: ${contact.name && !/^(lead|contato)/i.test(contact.name) ? contact.name : 'não sei o nome'}
- Negócio: ${contact.company && contact.company !== 'Em qualificação' ? contact.company : 'não sei o nome do negócio'}
- Nicho: ${contact.niche || 'não informado'}
${opening.length ? `
COMO A CONVERSA COMEÇOU (primeiras mensagens, para você lembrar quem falou o quê):
${opening.map(m => `${m.from === 'bot' ? 'Você' : m.from === 'operator' ? 'César (humano)' : 'Pessoa'}: ${m.text}`).join('\n')}
` : ''}
SUAS ÚLTIMAS MENSAGENS (não repita nenhuma destas ideias):
${recentBot || '(nenhuma ainda)'}

CONVERSA RECENTE:
${transcript || '(início da conversa)'}

${incoming.followup
  ? `SITUAÇÃO: a pessoa não respondeu à sua última mensagem. Escreva o follow-up número ${incoming.followup} (no máximo 3 no total).
Regras do follow-up: use um ângulo NOVO (não repita a observação anterior), termine com uma pergunta de escolha de duas saídas, curto. Nunca escreva "só passando pra lembrar" nem "você viu minha mensagem?". Se ela já tinha respondido antes, retome o ponto em que ela parou.`
  : `NOVA MENSAGEM DA PESSOA:\n"${incoming.text}"`}

Responda só com o texto da próxima mensagem para o WhatsApp.
`;
    const promptFull = buildPrompt(knowledge, learnings);
    const promptSlim = buildPrompt(knowledge.slice(0, GROQ_KNOWLEDGE_CHARS), learnings.slice(0, GROQ_LESSONS).map(l => l.slice(0, 220)));

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
            : await callGroq(groqKey, item.model, promptSlim + feedback);
        } catch (err: any) {
          const msg = String(err?.message || err);
          console.error(`[IA] ${item.provider}/${item.model} falhou:`, msg.slice(0, 300));
          if (err?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) await pauseModel(item, err?.pauseMs ?? pauseMsFrom(msg));
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
      if (!rawText) rawText = 'Claro. Vou pedir para o César te responder pessoalmente. Um instante.';
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
export type OwnerAction = 'none' | 'pause' | 'resume' | 'status';

function parseOwnerJson(raw: string): { reply: string; action: OwnerAction } | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const reply = String(j.reply || '').trim();
    if (!reply) return null;
    const action: OwnerAction = ['pause', 'resume', 'status'].includes(j.action) ? j.action : 'none';
    return { reply, action };
  } catch {
    return null;
  }
}

export async function generateOwnerReply(
  text: string,
  history: { from: 'owner' | 'bot'; text: string }[],
  snapshot: string
): Promise<{ reply: string; action: OwnerAction } | null> {
  const cfg = await db.getConfig();
  const geminiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const groqKey = (cfg.groqApiKey || process.env.GROQ_API_KEY || '').trim();
  const transcript = history.slice(-8).map(m => `${m.from === 'owner' ? 'César' : 'Você'}: ${m.text}`).join('\n');
  const prompt = `Você é o agente de prospecção da Girofy e está falando com o CÉSAR, o dono. Ele te configurou e ninguém mais tem esse número.

COMO FALAR: português do Brasil, natural, direto, curto, como um assistente de confiança conversando no WhatsApp. Não é lead: não venda, não fale de preço, não use "tudo bem?" de abertura de prospecção.

O QUE VOCÊ FAZ DE VERDADE (uma ação por resposta, escolhida desta lista):
- "status": mostrar o estado atual (os números estão em ESTADO AGORA; use-os na resposta)
- "pause": pausar a prospecção de novos contatos (respostas aos leads continuam)
- "resume": começar/retomar a prospecção. O sistema pede confirmação de "sim" antes; então na resposta, pergunte se ele confirma.
- "none": só conversar, explicar, responder dúvidas
Se ele pedir algo fora dessa lista, diga com honestidade que ainda não faz isso e o que faz. Nunca diga que fez algo que não está na ação escolhida.

ESTADO AGORA:
${snapshot}

CONVERSA RECENTE COM O CÉSAR:
${transcript || '(início)'}

MENSAGEM DO CÉSAR AGORA:
"${text}"

Responda SOMENTE um JSON, sem texto fora dele: {"reply":"texto para o WhatsApp","action":"none|status|pause|resume"}`;

  for (const item of chainFrom(cfg)) {
    if (isPaused(cfg, item)) continue;
    if (item.provider === 'gemini' && !geminiKey) continue;
    if (item.provider === 'groq' && !groqKey) continue;
    if (!(await reserveAiCall())) return null;
    try {
      const raw = item.provider === 'gemini' ? await callGemini(geminiKey, item.model, prompt) : await callGroq(groqKey, item.model, prompt);
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
