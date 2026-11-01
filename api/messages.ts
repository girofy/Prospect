import { db } from './lib/db';
import { sendWhatsAppTextMessage, formatPhoneNumber } from './lib/whatsapp';
import { ChatMessage } from './lib/types';

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
      const { phone, text, from = 'operator' } = body;

      if (!phone || !text || !text.trim()) {
        return res.status(400).json({ error: 'Telefone e texto da mensagem são obrigatórios.' });
      }

      const cleanPhone = formatPhoneNumber(phone);
      const contact = await db.getContactByPhone(cleanPhone);

      if (contact?.optOutDetected) {
        return res.status(400).json({ error: 'Este contato solicitou Opt-Out (LGPD). O envio de novas mensagens está bloqueado.' });
      }

      // Envia a mensagem de forma segura pela Meta Graph API usando a credencial do servidor
      const sendResult = await sendWhatsAppTextMessage(cleanPhone, text.trim());

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

      await db.saveMessage(msg);

      if (contact) {
        contact.lastInteractionAt = new Date().toISOString();
        if (from === 'operator') {
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
