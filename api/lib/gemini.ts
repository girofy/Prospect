import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';

// Girofy Commercial Knowledge & Authorized Parameters
const GIROFY_SYSTEM_PROMPT = `
Você é o Assistente Comercial da Girofy, agência e software house focada em tecnologia, sites, sistemas web sob medida e automações de processos/WhatsApp.
Você atende contatos que responderam a abordagens enviadas pelo proprietário da Girofy.

OBJETIVO COMERCIAL:
1. Responder com naturalidade, simpatia profissional e objetividade.
2. Entender o nicho e o desafio operacional ou comercial do contato.
3. Apresentar os serviços pertinentes da Girofy:
   - Landing Pages e Sites de Alta Conversão (faixa a partir de R$ 997 a R$ 2.497).
   - Sistemas Web e Dashboards Operacionais sob medida (diagnóstico técnico prévio para escopo).
   - Automações de Atendimento, WhatsApp e Integrações (a partir de R$ 1.200 de implantação).
4. Conduzir a conversa para um alinhamento rápido de 15 minutos pelo Google Meet com o especialista humano da Girofy.

REGRAS E LIMITES RIGOROSOS:
- Nunca invente preços fora da tabela autorizada.
- Nunca dê descontos não autorizados nem invente garantias ou prazos mirabolantes.
- Nunca afirme que um serviço foi contratado ou entregue sem confirmação real.
- Máximo de 2 a 3 frases curtas por mensagem (formato ideal para WhatsApp móvel).
- Linguagem limpa, consultiva e direta. Evite clichês de vendas agressivas.
- Não use emojis excessivos (máximo 1 sutil, como 👍 ou 🤝).

CRITÉRIOS DE TRANSFERÊNCIA PARA ATENDIMENTO HUMANO:
Se o cliente pedir expressamente para falar com uma pessoa/atendente, fizer uma reclamação, solicitar orçamento complexo personalizado fora do padrão, ou pedir negociação de condições de pagamento específicas, inclua no final da resposta a tag interna: [TRANSF_HUMANO: motivo] e avise o cliente cordialmente que o especialista responsável assumirá a conversa a seguir.
`;

export interface AiGenerationResult {
  replyText: string;
  transferToHuman: boolean;
  transferReason?: string;
  isMeetingRequested?: boolean;
}

export async function generateGirofyCommercialReply(
  contact: Contact,
  incomingText: string,
  history: ChatMessage[]
): Promise<AiGenerationResult> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Fallback if Gemini key is not yet set in environment
  if (!apiKey) {
    const firstName = contact.name ? contact.name.split(' ')[0] : 'tudo bem';
    return {
      replyText: `Olá, ${firstName}! Obrigado pelo retorno. Posso te apresentar brevemente nossas soluções para a ${contact.company || 'sua empresa'} ou prefere alinharmos 15 min no Meet?`,
      transferToHuman: false,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const recentHistory = history
      .slice(-6)
      .map(m => `${m.from === 'bot' ? 'Girofy (Você)' : m.from === 'operator' ? 'Atendente Humano' : contact.name || 'Cliente'}: ${m.text}`)
      .join('\n');

    const prompt = `
${GIROFY_SYSTEM_PROMPT}

DADOS DO CONTATO:
- Nome: ${contact.name || 'Não informado'}
- Empresa: ${contact.company || 'Não informada'}
- Nicho: ${contact.niche || 'Geral'}
- Papel: ${contact.role || 'decisor'}
- Status Atual: ${contact.status}

HISTÓRICO RECENTE DA CONVERSA:
${recentHistory || '(Sem histórico anterior)'}

NOVA MENSAGEM RECEBIDA DO CONTATO:
"${incomingText}"

Gere a resposta ideal para o WhatsApp:
`;

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 220,
      },
    });

    let rawText = response.text ? response.text.trim() : '';

    // Check for human transfer trigger tag
    let transferToHuman = false;
    let transferReason: string | undefined;

    const transferMatch = rawText.match(/\[TRANSF_HUMANO:\s*([^\]]+)\]/i);
    if (transferMatch) {
      transferToHuman = true;
      transferReason = transferMatch[1].trim();
      rawText = rawText.replace(/\[TRANSF_HUMANO:[^\]]+\]/gi, '').trim();
    }

    // Direct detection of explicit human requests
    const directHumanPattern = /(falar com (humano|atendente|pessoa|alguém|proprietário|responsável)|me liga|passa para humano)/i;
    if (directHumanPattern.test(incomingText)) {
      transferToHuman = true;
      transferReason = 'Pedido explícito de atendimento humano pelo cliente';
      if (!rawText || !rawText.toLowerCase().includes('humano')) {
        rawText = 'Com certeza! Já estou transferindo nossa conversa para o nosso especialista humano da Girofy assumir agora mesmo. Um instante.';
      }
    }

    const isMeetingRequested = /meet\.google\.com|reunião|amanhã às|alinhamento de 15/i.test(rawText);

    return {
      replyText: rawText || 'Perfeito! Você teria disponibilidade amanhã para conversarmos 15 minutos no Google Meet?',
      transferToHuman,
      transferReason,
      isMeetingRequested,
    };
  } catch (err: any) {
    console.error('[Gemini AI Server Error]:', err?.message);
    const firstName = contact.name ? contact.name.split(' ')[0] : '';
    return {
      replyText: `Olá${firstName ? ` ${firstName}` : ''}! Recebemos sua mensagem e já vamos te responder com mais detalhes. Se preferir, qual o melhor horário amanhã para um diagnóstico rápido?`,
      transferToHuman: false,
    };
  }
}
