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

    const knowledge = await loadKnowledge();
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

    const recentBotTexts = recent.filter(m => m.from === 'bot').slice(-4).map(m => m.text);
    const mediaPart: any[] = incoming.media ? [{ inlineData: { mimeType: incoming.media.mimeType, data: incoming.media.data } }] : [];

    // Até duas tentativas: se a primeira falhar no validador, a segunda recebe o motivo.
    let rawText = '';
    let lastProblem = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const feedback = lastProblem
        ? `\n\nSUA TENTATIVA ANTERIOR FOI RECUSADA: ${lastProblem}. Escreva outra mensagem, com outras palavras, seguindo as regras.`
        : '';
      const response = await ai.models.generateContent({
        // Modelo: variável de ambiente manda; o valor gravado no banco só vale se não for um modelo descontinuado.
        model: resolveModel(cfg.geminiModel),
        contents: [{ role: 'user', parts: [...mediaPart, { text: promptText + feedback }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 200,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const candidate = response.text ? response.text.trim() : '';
      const problem = validateReply(candidate, recentBotTexts);
      if (!problem) {
        rawText = candidate;
        break;
      }
      lastProblem = problem;
      console.warn('[Gemini] resposta recusada pelo validador:', problem, '|', candidate);
    }
    if (!rawText) return fail('invalid');

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
