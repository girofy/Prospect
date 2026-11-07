import { db } from '../lib/db';
import { sendWhatsAppTextMessage, formatPhoneNumber } from '../lib/whatsapp';
import { sendEvolutionText } from '../lib/evolution';
import { ChatMessage } from '../lib/types';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      let phone = req.query?.phone;
      if (!phone && req.url) {
        try {
          const parsed = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
          phone = parsed.searchParams.get('phone');
        } catch {
          // ignore
        }
      }

      const messages = await db.getMessages(phone ? String(phone) : undefined);
      return res.status(200).json({ messages });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      // Aceita os dois formatos que existem no painel (text/from e message/sender)
      const phone = body.phone;
      const text = body.text ?? body.message;
      const from = body.from ?? body.sender ?? 'operator';

      if (!phone || !text || !String(text).trim()) {
        return res.status(400).json({ error: 'Telefone e texto da mensagem são obrigatórios.' });
      }

      const cleanPhone = formatPhoneNumber(phone);
      const contact = await db.getContactByPhone(cleanPhone);

      if (contact?.optOutDetected) {
        return res.status(400).json({ error: 'Este contato solicitou Opt-Out (LGPD). O envio de novas mensagens está bloqueado.' });
      }

      // If directOnly is true (sent directly via WhatsApp Web/app), record it without calling Meta Cloud API
      let sendResult: { success: boolean; messageId?: string; error?: string } = { success: true, messageId: `direct-${Date.now()}` };
      if (!body.directOnly) {
        const config = await db.getConfig();
        if ((config.activeGateway || 'direct_pairing') === 'direct_pairing') {
          sendResult = await sendEvolutionText(cleanPhone, String(text).trim(), 2000);
        } else {
          sendResult = await sendWhatsAppTextMessage(cleanPhone, String(text).trim());
        }
      }

      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        contactPhone: cleanPhone,
        from: from === 'lead' ? 'lead' : 'operator',
        text: text.trim(),
        type: 'text',
        timestamp: new Date().toISOString(),
        metaMessageId: sendResult.messageId,
        status: sendResult.success ? 'sent' : 'failed',
      };

      // O eco da Evolution (fromMe) não pode virar uma segunda cópia no histórico.
      if (sendResult.success && sendResult.messageId) await db.markMessageAsProcessed(sendResult.messageId);
      await db.saveMessage(msg);

      if (contact) {
        contact.lastInteractionAt = new Date().toISOString();
        if (from === 'operator' && !body.keepAgent) {
          // When human operator replies, switch to human_takeover to avoid bot interrupting
          contact.agentState = 'human_takeover';
        }
        await db.saveContact(contact);
      }

      await db.addAuditLog({
        type: 'human_message',
        phone: cleanPhone,
        summary: `Mensagem enviada por atendente humano para ${cleanPhone}: "${text.slice(0, 50)}..."`,
      });

      return res.status(200).json({
        success: sendResult.success,
        message: msg,
        metaError: sendResult.error,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API Messages Error]:', err);
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
