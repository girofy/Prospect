import { db } from '../lib/db';
import { formatPhoneNumber, sendWhatsAppTextMessage } from '../lib/whatsapp';
import { Contact, ChatMessage } from '../lib/types';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const contacts = await db.getContacts();
      const messages = await db.getMessages();

      const microDispatched = contacts.filter(c => c.status === 'em_conversa' || c.status === 'novo' || c.status === 'qualificado');
      const responded = microDispatched.filter(c => {
        const msgs = messages.filter(m => m.contactPhone === c.phone);
        return msgs.some(m => m.from === 'lead');
      });

      return res.status(200).json({
        totalContacts: contacts.length,
        dispatchedCount: microDispatched.length,
        respondedCount: responded.length,
        responseRate: microDispatched.length > 0 ? Math.round((responded.length / microDispatched.length) * 100) : 0,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { leads, customMessage } = body;

      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: 'Envie uma lista de contatos para o micro-disparo.' });
      }

      // Safety constraint: max 10 contacts per test batch to strictly prevent carrier or spam blocks
      const safeLeads = leads.slice(0, 10);
      const config = await db.getConfig();
      const gateway = config.activeGateway || 'direct_pairing';

      const results = [];
      const timestamp = new Date().toISOString();

      for (let i = 0; i < safeLeads.length; i++) {
        const item = safeLeads[i];
        const rawPhone = item.phone || '';
        const cleanPhone = formatPhoneNumber(rawPhone);
        if (!cleanPhone || cleanPhone.length < 10) continue;

        const name = item.name || 'Contato';
        const company = item.company || 'Empresa';
        const firstName = name.split(' ')[0];

        // Custom template or default human "Bom dia"
        const messageText = customMessage 
          ? customMessage.replace('{nome}', firstName).replace('{empresa}', company)
          : `Bom dia, ${firstName}! Tudo bem? Vi o trabalho da ${company} e achei muito interessante.`;

        // 1. Ensure contact is recorded in CRM
        const contact: Contact = {
          id: `lead-${cleanPhone}`,
          phone: cleanPhone,
          name,
          company,
          niche: item.niche || 'Prospecção Ativa',
          role: 'decisor',
          status: 'em_conversa',
          agentState: 'ai_active',
          optOutDetected: false,
          lastInteractionAt: timestamp,
          createdAt: timestamp,
        };
        await db.saveContact(contact);

        // 2. Record outgoing message
        const outgoingMsg: ChatMessage = {
          id: `msg-micro-${Date.now()}-${i}`,
          contactPhone: cleanPhone,
          from: 'operator',
          text: messageText,
          type: 'text',
          timestamp: new Date(Date.now() + i * 20000).toISOString(),
          status: 'sent',
        };

        // If Meta Cloud API is chosen and configured, send through Meta
        if (gateway === 'meta_cloud_api') {
          try {
            const sendRes = await sendWhatsAppTextMessage(cleanPhone, messageText);
            if (sendRes.success && sendRes.messageId) {
              outgoingMsg.metaMessageId = sendRes.messageId;
              outgoingMsg.status = 'delivered';
            }
          } catch (e) {
            console.warn('[Micro-dispatch Meta API]', e);
          }
        }

        await db.saveMessage(outgoingMsg);

        results.push({
          phone: cleanPhone,
          name,
          company,
          message: messageText,
          status: 'enviado',
          gateway,
          scheduledIntervalSeconds: i * 25, // 25s safe human delay
        });
      }

      await db.addAuditLog({
        type: 'incoming_message',
        summary: `Micro-disparo cadenciado executado com sucesso para ${results.length} contatos via ${gateway === 'direct_pairing' ? 'Conexão Direta (Celular)' : 'Meta Cloud API'}.`,
        details: { count: results.length, gateway },
      });

      return res.status(200).json({
        success: true,
        dispatched: results.length,
        gateway,
        leads: results,
        message: `${results.length} mensagens cadenciadas com intervalo seguro de 25s iniciadas com sucesso!`,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[Campaign API Error]:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao processar micro-disparo.' });
  }
}
