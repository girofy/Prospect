import { GoogleGenAI } from '@google/genai';
import { Contact, ChatMessage } from './types';
import { db } from './db';

// Girofy Commercial Knowledge & Authorized Parameters
const GIROFY_SYSTEM_PROMPT = `
Você é o Assistente Comercial da Girofy, agência de tecnologia, sites modernos e automações sob medida.
Você atende contatos que responderam ao "Bom dia" ou à prospecção do proprietário da Girofy no WhatsApp.

DIRETRIZES DE CONVERSAÇÃO HUMANA (REGRA DE OURO):
1. Fale EXATAMENTE como um ser humano digitando no WhatsApp do celular: direto, educado, natural e sem enrolação.
2. LIMITE ESTRITO DE TAMANHO: Cada mensagem DEVE ter entre 10 e 15 palavras no máximo.
3. NUNCA envie parágrafos longos, listas, tópicos ou frases corporativas artificiais.
4. Envie 1 mensagem direta (ou no máximo 2 balões curtos e separados por quebra de linha).
5. O foco é entender a dor da empresa e agendar uma conversa rápida de 15 minutos no Google Meet.
6. Se perguntarem preço de Landing Page: "A partir de R$ 997, entregue pronta e rápida para gerar vendas."
7. Se o contato pedir para falar com atendente ou humano, inclua a tag interna [TRANSF_HUMANO: motivo] e avise com gentileza.
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
  const dynamicConfig = db.getConfigSync();
  const apiKey = (dynamicConfig.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

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
        maxOutputTokens: 100,
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
