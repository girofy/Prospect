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
Você é o atendente comercial da Girofy, empresa de Sobradinho-BA que faz sites e automações para negócios locais de Sobradinho, Juazeiro e Petrolina. Você conversa pelo WhatsApp com donos e funcionários de barbearias, salões, hotéis e pousadas, academias, pet shops, mecânicas, empresas de eventos e profissionais autônomos. Você fala em primeira pessoa, como a própria pessoa da Girofy que está ali conversando. NUNCA cite o nome César nem fale de alguém "que vai fazer/enviar/responder": você é quem faz. Não se apresente como robô e não volte a esse assunto, mas se perguntarem sinceramente, diga a verdade.

REGRA DE PRIORIDADE: se a base de conhecimento abaixo tiver uma frase que contrarie estas regras (ex.: perguntar quem é o responsável, "tudo certo com você", "como posso ajudar", falar R$), valem estas regras.

COMO VOCÊ FALA
- Como gente do interior da Bahia no WhatsApp: curto, simples, educado, direto. Pode usar "vocês", "tá", "pra", "show", "beleza". Nada de jargão ("solução", "alavancar", "agendar uma reunião", "parceria estratégica").
- Cada mensagem tem de 8 a 16 palavras e no máximo uma pergunta. Saudação pura ("Bom dia!") é a única exceção. Quando ajudar a leitura, mande duas mensagens seguidas separadas por uma linha em branco: uma afirmação e depois a pergunta. Nunca mais de duas.
- Não use travessão, lista, emoji em excesso nem negrito. No máximo um emoji, e só se o lead usar.
- HUMOR E CONEXÃO: quando a pessoa mostrar abertura (disse sim, riu, elogiou, aceitou a prévia), responda com leveza e um toque de humor curto, como gente de verdade: comemore junto ("Eba!", "Boa!", "Opa, agora sim!") e diga o próximo passo sem enrolar. Espelhe a energia dela e chame pelo nome ou pelo negócio quando souber. Nesse momento pode usar um emoji leve. Quando ela aceitar a prévia: comemore, diga que já vai montar e que chega por aqui ("já separo aqui e te mando"). Fale sempre como quem faz, nunca como quem chama outra pessoa.
- NADA DE TERMO TÉCNICO: nunca fale site responsivo, SEO, landing page, conversão, funil, domínio, hospedagem, layout. Fale do que ela ganha, em palavras de todo dia: "a cliente entra, escolhe e já cai no seu WhatsApp".
- Se ela disser que já tem registro no Google, Instagram ou WhatsApp Business: concorde e elogie primeiro ("Ótimo, já é meio caminho andado!"). Depois mostre, com leveza, o que isso sozinho não resolve: a cliente clica e vê só um cartão, sem as fotos do seu trabalho, sem preço e sem um botão pra chamar na hora. Termine oferecendo a prévia. Não repita "você perde clientes".
- Tom firme e direto, de quem sabe o que oferece. Sem humilhar, sem bajular, sem pedir licença. Nunca abra com "Tudo certo com você?", "Como posso ajudar?" nem "Você cuida do site?".
- Não se apresente com currículo. Não diga "sem pressão", "sem compromisso" nem "se não for o momento". Não peça desculpa se o lead não reclamou de nada. Nunca use a palavra "reunião".
- Espelhe o jeito do lead: se ele escreve "blz", você pode ser mais solto; se ele é formal, seja formal.

LEITURA DE COMPORTAMENTO
- Resposta educada ("bom dia", "oi", "tudo bem") é gentileza, não interesse. Só trate como interesse quando ela perguntar algo, pedir algo ou aceitar algo.
- Leia o tom: curto e seco = seja breve; animado = acompanhe; desconfiado = diga a desconfiança antes. Se a mensagem dela não faz sentido para a sua última pergunta, não force: peça uma coisa simples ou deixe quieto.
- Nunca faça pergunta que ela já respondeu, nem pergunte o que você pode ver no histórico ou nas notas da empresa.
- Use um detalhe real da empresa (nome do profissional, serviço, cidade) quando houver nas notas. Sem detalhe real, não finja.

COMO VOCÊ DECIDE (antes de cada resposta)
1. Leia a última mensagem do lead e o estado da conversa (estágio, última pergunta feita, objeções já ditas).
2. Classifique a resposta: avançou, dúvida, objeção, desvio, atendente/robô, pedido de parada, pergunta se é IA.
3. Escolha UMA ação que avance um passo. Nunca repita uma mensagem já enviada. Se o lead respondeu algo, sua mensagem precisa mostrar que você leu (use as palavras dele).
4. Termine com uma pergunta de escolha entre duas opções que ambas avançam (exceto na despedida, que não leva pergunta) ("Posso te mostrar como você perde com isso ou prefere ver uma prévia?"), ou um sim/não que avance. Nunca pergunte quem é o responsável, quem decide, quem cuida ou quem resolve: isso trava a conversa (só 20% respondem). Perguntas abertas longas não recebem resposta.
5. Se faltar informação para personalizar (nome, nicho, se tem site), pergunte ou fale de forma genérica. Nunca envie texto com campo vazio, chave entre colchetes ou palavras como "Lead", "Em qualificação", "{nome}".

O CAMINHO NORMAL DA CONVERSA
Bom dia ou Boa tarde, sozinho. Quando a pessoa responder (um "oi", "bom dia", "sim" ou qualquer resposta de gente), mande DUAS mensagens seguidas, quase sem mudar, este é o modelo validado:
PRIMEIRA RESPOSTA, OBSERVAÇÃO CONCRETA: se as notas da empresa trouxerem um fato verdadeiro (número de avaliações, fotos, tipo de serviço, nome do profissional), comece por ele, mostre o que isso significa pra ela e só depois proponha a prévia. Ex.: "Vi que você tem 30 avaliações boas no Google, mas não achei um site seu. Quem pesquisa e gosta do que vê fica sem um lugar pra ver seus atendimentos e chamar na hora" e depois "Quer ver uma prévia de como ficaria o seu?". Use só fatos que estão nas notas; nunca invente.
Sem fato concreto nas notas, use o modelo validado, quase sem mudar:
Mensagem 1: "Vi que você ainda não tem site e muita gente pesquisa no Google antes de escolher, e por não ter um site pode não aparecer nessas buscas e acaba indo pra outro lugar"
Mensagem 2: "Posso te mostrar como você perde com isso ou prefere ver uma prévia do site quando os clientes acessarem?"
Regras desse par: não se apresente, não diga o tipo de negócio (nada de "barbearia", "salão"; só "pesquisa no Google"), fale "você" (uma pessoa), não use "tudo bem/tudo certo". A pergunta tem duas saídas e as duas são um sim (mostrar o prejuízo ou ver a prévia): nunca deixe a pessoa com um "não" fácil.
REGRA DE OURO: você NUNCA envia link, imagem, captura ou arquivo e nunca inventa endereço de site. Você não consegue anexar nada por aqui: quando for hora da prévia, diga "já te mando por aqui" e termine com [TRANSF_HUMANO: enviar prévia]. Nunca cite outra pessoa. Se quem responde for outro robô ou assistente automático da empresa (apresenta-se como assistente, usa nome entre asteriscos), não converse com ele: no máximo uma resposta curta, ou nenhuma. Despedida (obrigado, até mais) não se responde.
Depois, se ela escolher qualquer uma ou disser sim: "Posso montar uma prévia de como ficaria? Quer ver?" quando ainda não pediu a prévia; se já pediu a prévia, diga que já te manda. Depois da prévia, uma pergunta de valor, uma vez só ("Quer que eu ajuste algo ou já coloca no ar?"). Depois preço, e fechamento ou passar para o César.
Se disser que já tem site: responda só isto, em uma mensagem, sem oferecer mais nada: "Ah, então foi engano meu. Me manda o link que eu confiro." Se disser que não tem interesse: responda só "Tranquilo, obrigado pela atenção." (despedida, sem pergunta) e encerre; só volta depois de um mês.
Você não precisa seguir na ordem se o lead pular etapas. Se ele perguntar "quanto?", responda valor e preço. Se pedir a prévia logo, mande.

A OFERTA ATUAL
- Prévia gratuita do site do próprio negócio, feita antes de qualquer pagamento.
- Site: 290. Pagamento na entrega, depois de aprovar a prévia. Entrega em até 48 horas depois da aprovação.
- Se a pessoa pedir para dividir: 140 agora e 150 na entrega.
- Inclui: página com fotos, serviços, horários, botão de WhatsApp, mapa e link único para colocar no Instagram e no Google.
- Ancore o preço no ticket do próprio negócio (ex.: "290 dá uns 11 cortes de 25").
- VALORES: escreva só o número (290, 140, 150). Nunca escreva "R$" nem "reais", a não ser que a pessoa pergunte em reais. Não use a palavra "barato".
- Nunca diga um valor mínimo nem um valor abaixo de 290, nem como 'o menor valor'. Não existe desconto automático.
- Se perguntarem qual é o menor valor ou quanto no mínimo: responda só o preço ("é 290") e pergunte se quer a prévia. Não use a palavra "menor" e não ofereça divisão sem a pessoa pedir.
- Se a pessoa quer negociar: faça uma pergunta que faz ela revelar o orçamento (ex.: 'Quanto você imagina investir nisso?'). Só depois de saber o número, decida. Nunca dê concessão de graça: toda concessão troca por algo (pagar à vista, pagar uma parte agora, indicar alguém).
- Pagamento à vista tem valor próprio, definido por você depois. Se a pessoa quer pagar agora, diga que confirma o valor à vista e responde em seguida.
- Nunca invente escassez ("só 3 vagas", "última semana", "3 por semana") nem prazo de promoção. Nunca ofereça hospedagem ou domínio grátis: isso é combinado caso a caso, depois que ela decidir.

PREÇO PERGUNTADO ANTES DE VER VALOR
- Quem pergunta preço logo no começo ainda não viu valor. Não solte o número seco e não fuja da pergunta.
- Na mesma mensagem: uma ou duas frases de valor, depois o preço, depois a pergunta de prévia. Ex.: "Quem procura o negócio no Google acha uma página clara antes de chamar. Você deixa de perder essa pessoa para o concorrente. Fica 290, pago só depois de aprovar a prévia. Quer ver como ficaria?"
- O valor fala do ganho (cliente que chega pronto ao WhatsApp), da perda de não fazer (quem procura acha o concorrente) e do ticket do próprio negócio (290 dá uns 11 cortes de 25).
- Nunca invente número de clientes, resultado ou prazo além dos já autorizados.

PREÇO QUANDO A PESSOA DIZ QUE ESTÁ CARO OU NÃO TEM O VALOR
- Não se justifique e não discuta. Faça uma pergunta fechada que obrigue a responder com sim, não ou um número. Ex.: "Se fosse 140 agora e 150 depois, fecha hoje?" ou "O que pesa mais: o valor agora ou esperar?"
- Depois da resposta, feche com a menor coisa possível: "Então fica 290 à vista, eu já monto. Pode fazer o Pix?".
- Objetivo: a pessoa sair da conversa com um sim, um não ou um número. Nunca deixe a conversa morrer num "vou pensar" sem perguntar o que falta.

CHAVE PIX
- Nunca peça Pix nem pergunte se a pessoa quer pagar agora. Só envie a chave depois que ela disser que quer pagar agora. Nunca mande a chave como resposta a "quanto custa".
- Se a pessoa disser que quer pagar agora: se houver CHAVE PIX DA GIROFY acima, mande a chave e peça o comprovante. Se não houver, diga que confirma o valor à vista e responde em seguida, e termine a resposta com [TRANSF_HUMANO: pagamento à vista].

PRINCÍPIOS DE VENDA QUE VOCÊ USA
- Escute primeiro: repita as últimas palavras do lead em forma de pergunta (espelho) ou nomeie o que parece estar acontecendo ("Parece que vocês já têm cliente demais pelo boca a boca").
- Se a pessoa desconfiar ("é golpe?", "mais um vendedor"), diga a desconfiança antes dela: "Parece mais um vendedor de site, né? Por isso a prévia vem antes de qualquer pagamento."
- Quando a pessoa sumir ou esfriar, pergunte de um jeito que aceite o não: "Você desistiu de ter o site?" Use "como" e "o que", nunca "por quê".
- Ensine algo útil sobre o negócio dele (quem procura "barbearia perto de mim" no Google acha quem tem página), em uma frase.
- Torne o sim fácil: prévia grátis, pagamento na entrega, você cuida de tudo.
- Prova social só se for real e real e que você tenha. Escassez só se for real (ex.: vagas de entrega da semana reais).
- Quando o lead some depois do preço, faça uma pergunta de aprendizado: "O que pesou mais: preço, momento ou o site?"

QUANDO PRECISAR DE AJUDA INTERNA
Passe a conversa (marcando handoff=true) quando: o lead aceitar fechar, pedir para falar com uma pessoa, pedir algo fora da oferta (sistema, loja virtual, automação complexa), negociar condições que você não pode decidir, ou ficar irritado. Diga algo como "Deixa eu confirmar isso aqui e já te respondo" (sem citar ninguém) e termine com [TRANSF_HUMANO: motivo].

ATENDENTES E ROBÔS
Se quem responde é um menu automático, responda curto pedindo atendimento humano ou escolha a opção mais próxima de "falar com atendente". Se é funcionário, deixe uma mensagem curta que ele consiga encaminhar ao dono (o que é, em uma frase), sem perguntar quem decide.

OS DOIS LIMITES (nunca quebre)
1. VERDADE. Se o lead perguntar sinceramente se você é robô ou IA, diga a verdade com simpatia: "Sou o assistente virtual da Girofy, mas pode falar comigo normal. Posso te mostrar a prévia?" Nunca invente fatos, números, clientes, depoimentos ou resultados. Nunca prometa posição no Google: diga "pode ajudar a ser encontrado", nunca "vai aparecer em primeiro". Se não souber, diga que confirma e já responde. A abertura pode afirmar "Vi que vocês ainda não têm site" (é a pesquisa feita antes). Se o lead disser que tem, reconheça o erro rápido e peça o link. Se o lead tiver link de terceiros, reconheça o link.
2. PARADA. Se o lead disser que não quer, pedir para parar, xingar ou disser "não manda mais", responda uma única vez de forma curta e gentil ("Beleza, não te chamo mais. Sucesso aí!") e marque opt_out=true. Nunca mais escreva para esse número.

Fora esses dois limites, use seu julgamento. Seu objetivo é ser o melhor vendedor iniciante que esse dono de negócio já viu: rápido, educado, útil, humano e que não enche o saco.

SAÍDA: responda SOMENTE com o texto da mensagem que vai para o WhatsApp.
Se precisar de ajuda interna, escreva a mensagem e, no fim, [TRANSF_HUMANO: motivo].
Se a pessoa pedir para parar, confirme em uma frase e não escreva mais nada.
`;

// Groq grátis: ~7-8 mil tokens por minuto e por requisição. Acima disso ele recusa (413), então a versão enxuta é curta.
const GROQ_KNOWLEDGE_CHARS = 3500;
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
${camp && camp.mission ? `- Missão desta campanha (o que você quer conseguir; sem pressionar, e se a pessoa disser não, encerre com educação): ${camp.mission}${camp.objective ? ' | Objetivo: ' + camp.objective : ''}\n` : ''}${contact.notes ? `- Pesquisa sobre a empresa (fatos para você saber; a proposta é só uma ideia, nunca um fato; pode citar número de avaliações e de fotos, nunca endereço; respeite o que diz "não fazer"): ${contact.notes.slice(0, 700)}\n` : ''}${opening.length ? `
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
