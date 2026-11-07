import { db } from '../lib/db';
import { 
  getMetaConfig, 
  validateXHubSignature, 
  sendWhatsAppTextMessage, 
  markWhatsAppMessageAsRead,
  isSelfMessage,
  formatPhoneNumber
} from '../lib/whatsapp';
import { generateGirofyCommercialReply } from '../lib/gemini';
import { MetaWebhookPayload, ChatMessage, Contact } from '../lib/types';

// Regex para detecção rigorosa de Opt-Out / Stop-words (LGPD e Anti-ban)
const OPT_OUT_REGEX = /(não tenho interesse|nao tenho interesse|pare de mandar|para de mandar|remove meu contato|remover contato|tirar da lista|não me mande|nao me mande|denunciar|spam|sair|desinscrever|bloqueado|nunca mais)/i;

export default async function handler(req: any, res: any) {
  // Configuração restritiva de CORS para evitar abusos externos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // =========================================================================
  // 1. VERIFICAÇÃO DO WEBHOOK (GET - Meta Challenge)
  // =========================================================================
  if (req.method === 'GET') {
    let mode = req.query?.['hub.mode'];
    let token = req.query?.['hub.verify_token'];
    let challenge = req.query?.['hub.challenge'];

    // Fallback para URLs cruas quando query não estiver pré-parseada pelo middleware
    if (!mode && req.url) {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
        mode = parsedUrl.searchParams.get('hub.mode');
        token = parsedUrl.searchParams.get('hub.verify_token');
        challenge = parsedUrl.searchParams.get('hub.challenge');
      } catch {
        // Ignora erro de parse
      }
    }

    const { verifyToken } = getMetaConfig();

    // Se a Meta solicitou subscrição (Verificação oficial)
    if (mode === 'subscribe') {
      if (token && token.trim() === verifyToken) {
        console.log('[Meta Webhook] Verificação concluída com sucesso.');
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge || 'OK');
      }

      console.warn('[Meta Webhook] Tentativa de subscrição rejeitada: Token inválido.');
      return res.status(403).send('Forbidden: Token de verificação inválido.');
    }

    // Se acessado diretamente via navegador: NUNCA expor tokens nem segredos
    return res.status(200).json({
      status: 'active',
      service: 'Prospectfy WhatsApp Cloud API Webhook',
      endpoint: '/api/webhook',
      protocol: 'Meta Graph API v21.0',
      authentication: 'Secured via X-Hub-Signature-256 & Verify Token',
    });
  }

  // =========================================================================
  // 2. RECEBIMENTO DE EVENTOS E MENSAGENS (POST)
  // =========================================================================
  if (req.method === 'POST') {
    let rawBody = '';
    let parsedBody: MetaWebhookPayload | null = null;

    if (typeof req.body === 'string') {
      rawBody = req.body;
      try {
        parsedBody = JSON.parse(req.body);
      } catch {
        // Falha no parse
      }
    } else if (req.body && typeof req.body === 'object') {
      parsedBody = req.body;
      rawBody = JSON.stringify(req.body);
    }

    // Validação de assinatura X-Hub-Signature-256 da Meta
    const signatureHeader = req.headers?.['x-hub-signature-256'] || req.headers?.['X-Hub-Signature-256'];
    if (!validateXHubSignature(rawBody, signatureHeader)) {
      console.error('[Meta Webhook Security] Assinatura X-Hub-Signature-256 rejeitada.');
      return res.status(401).json({ error: 'Assinatura inválida' });
    }

    // Confirmação imediata para a Meta (evita retransmissões desnecessárias)
    res.status(200).json({ status: 'EVENT_RECEIVED' });

    if (!parsedBody || !parsedBody.entry) {
      return;
    }

    try {
      for (const entry of parsedBody.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;

          // 2.1 Atualização de Status de Entrega/Leitura
          if (value.statuses && value.statuses.length > 0) {
            for (const statusItem of value.statuses) {
              const status = statusItem.status; // 'sent' | 'delivered' | 'read' | 'failed'
              console.log(`[WhatsApp Status] Mensagem ${statusItem.id} -> ${status}`);
            }
          }

          // 2.2 Mensagens Recebidas
          if (value.messages && value.messages.length > 0) {
            const contactProfile = value.contacts?.[0];
            const senderProfileName = contactProfile?.profile?.name || '';

            for (const msg of value.messages) {
              const messageId = msg.id;
              const rawFrom = msg.from;

              // Prevenção de loops: Ignora mensagens enviadas pelo próprio número da empresa
              if (isSelfMessage(rawFrom)) {
                console.log(`[WhatsApp Webhook] Mensagem ignorada (origem é o próprio número comercial): ${rawFrom}`);
                continue;
              }

              // Idempotência: Não processa a mesma mensagem duas vezes
              if (await db.hasProcessedMessage(messageId)) {
                console.log(`[WhatsApp Webhook] Mensagem já processada anteriormente (idempotência): ${messageId}`);
                continue;
              }
              await db.markMessageAsProcessed(messageId);

              const cleanPhone = formatPhoneNumber(rawFrom);

              // Carrega ou inicializa contato no banco de dados persistente
              let contact = await db.getContactByPhone(cleanPhone);
              if (!contact) {
                contact = await db.saveContact({
                  id: `contact-${cleanPhone}`,
                  phone: cleanPhone,
                  name: senderProfileName || `Contato ${cleanPhone.slice(-4)}`,
                  company: 'Em qualificação',
                  role: 'decisor',
                  status: 'em_conversa',
                  agentState: 'ai_active',
                  optOutDetected: false,
                  lastInteractionAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                });
              } else if (senderProfileName && (!contact.name || contact.name.startsWith('Contato '))) {
                contact.name = senderProfileName;
                await db.saveContact(contact);
              }

              // Tratamento de tipos de mensagem
              let messageText = '';
              let messageType: ChatMessage['type'] = 'text';

              if (msg.type === 'text' && msg.text?.body) {
                messageText = msg.text.body.trim();
                messageType = 'text';
              } else if (msg.type === 'audio' || msg.type === 'voice') {
                messageText = '[Áudio recebido do contato]';
                messageType = 'audio';
              } else if (msg.type === 'image') {
                messageText = msg.image?.caption ? `[Imagem: ${msg.image.caption}]` : '[Imagem recebida]';
                messageType = 'image';
              } else if (msg.type === 'document') {
                messageText = msg.document?.filename ? `[Documento: ${msg.document.filename}]` : '[Documento recebido]';
                messageType = 'document';
              } else {
                messageText = `[Mensagem recebida do tipo: ${msg.type}]`;
                messageType = 'unsupported';
              }

              // Salva mensagem recebida no histórico persistente
              const incomingChatMessage: ChatMessage = {
                id: `in-${messageId}`,
                contactPhone: cleanPhone,
                from: 'lead',
                text: messageText,
                type: messageType,
                timestamp: new Date().toISOString(),
                metaMessageId: messageId,
                status: 'received',
              };
              await db.saveMessage(incomingChatMessage);

              // Confirmação visual de leitura no WhatsApp oficial (ticks azuis)
              await markWhatsAppMessageAsRead(messageId);

              // 2.3 Tratamento de Opt-Out / LGPD (Bloqueio Imediato e Silenciamento)
              if (OPT_OUT_REGEX.test(messageText)) {
                await db.saveContact({
                  ...contact,
                  status: 'bloqueado',
                  optOutDetected: true,
                  optOutReason: 'Solicitação explícita do titular (Opt-Out LGPD)',
                  agentState: 'paused',
                  lastInteractionAt: new Date().toISOString(),
                });

                await db.addAuditLog({
                  type: 'opt_out',
                  phone: cleanPhone,
                  summary: `Opt-Out LGPD registrado para ${cleanPhone}: "${messageText}". Atendimento automatizado pausado permanentemente.`,
                });

                console.log(`[WhatsApp LGPD] Contato ${cleanPhone} optou por sair. Bot desativado.`);
                continue;
              }

              // Se o contato já tiver solicitado Opt-out anteriormente
              if (contact.optOutDetected) {
                console.log(`[WhatsApp] Contato ${cleanPhone} já possui opt-out registrado. Nenhuma ação tomada.`);
                continue;
              }

              // 2.4 Verificação de Estado do Agente (Takeover Humano ou Pausado)
              if (contact.agentState === 'human_takeover') {
                console.log(`[WhatsApp] Contato ${cleanPhone} está sob atendimento humano exclusivo. IA em espera.`);
                await db.addAuditLog({
                  type: 'incoming_message',
                  phone: cleanPhone,
                  summary: `Nova mensagem recebida de contato em atendimento humano: "${messageText.slice(0, 50)}..."`,
                });
                continue;
              }

              if (contact.agentState === 'paused') {
                console.log(`[WhatsApp] Agente pausado para o contato ${cleanPhone}.`);
                continue;
              }

              // 2.5 Resposta Automatizada via Agente IA Comercial Girofy
              const { autoReplyEnabled } = getMetaConfig();
              if (autoReplyEnabled === false) {
                console.log(`[WhatsApp] Auto-reply desativado globalmente pelo painel de Ajustes.`);
                continue;
              }

              const history = await db.getMessages(cleanPhone);
              
              // Se for áudio, instrui o cliente gentilmente
              let promptText = messageText;
              if (messageType === 'audio') {
                promptText = 'O cliente enviou um áudio. Agradeça brevemente e pergunte se ele pode adiantar a dúvida por texto ou se prefere agendarmos 15 min no Meet para conversarmos.';
              }

              const aiResult = await generateGirofyCommercialReply(contact, promptText, history);
              if (!aiResult.aiAvailable) continue; // IA indisponível: não envia texto improvisado

              // Se a IA identificou necessidade de transferência para atendente humano
              if (aiResult.transferToHuman) {
                contact.agentState = 'human_takeover';
                contact.status = 'aguardando_humano';
                await db.saveContact(contact);

                await db.addAuditLog({
                  type: 'status_change',
                  phone: cleanPhone,
                  summary: `Atendimento transferido para humano: ${aiResult.transferReason || 'Complexidade da negociação'}`,
                });
              } else if (aiResult.isMeetingRequested) {
                contact.status = 'reuniao_marcada';
                await db.saveContact(contact);
              }

              // Envio da resposta através do canal ativo (Conexão Direta do Celular ou Meta Cloud API)
              const dynamicConfig = await db.getConfig();
              const gateway = dynamicConfig.activeGateway || 'direct_pairing';

              let sentSuccess = false;
              let outMsgId: string | undefined;

              if (gateway === 'meta_cloud_api') {
                const sendResult = await sendWhatsAppTextMessage(cleanPhone, aiResult.replyText);
                sentSuccess = sendResult.success;
                outMsgId = sendResult.messageId;
                if (!sentSuccess) {
                  console.warn(`[Meta Send Warning] ${sendResult.error}`);
                }
              } else {
                // Conexão Direta (Celular pareado): envio direto sem custo de API da Meta
                sentSuccess = true;
              }

              if (sentSuccess) {
                const outgoingChatMessage: ChatMessage = {
                  id: `out-${outMsgId || Date.now()}`,
                  contactPhone: cleanPhone,
                  from: 'bot',
                  text: aiResult.replyText,
                  type: 'text',
                  timestamp: new Date().toISOString(),
                  metaMessageId: outMsgId,
                  status: 'sent',
                  aiReasoning: aiResult.transferReason ? `Transferido para humano: ${aiResult.transferReason}` : undefined,
                };
                await db.saveMessage(outgoingChatMessage);

                await db.addAuditLog({
                  type: 'ai_reply',
                  phone: cleanPhone,
                  summary: `Resposta IA comercial enviada via ${gateway === 'direct_pairing' ? 'Conexão Direta' : 'Meta API'}: "${aiResult.replyText.slice(0, 60)}..."`,
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[Meta Webhook Processing Error]:', err);
    }
    return;
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
