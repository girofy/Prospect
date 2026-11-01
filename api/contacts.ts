import { db } from './lib/db';
import { Contact } from './lib/types';
import { formatPhoneNumber } from './lib/whatsapp';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const contacts = await db.getContacts();
      return res.status(200).json({ contacts });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { phone, name, company, niche, role, status, agentState, notes } = body;

      if (!phone) {
        return res.status(400).json({ error: 'Telefone é obrigatório.' });
      }

      const cleanPhone = formatPhoneNumber(phone);
      let existing = await db.getContactByPhone(cleanPhone);

      const contactData: Contact = {
        id: existing?.id || `contact-${cleanPhone}`,
        phone: cleanPhone,
        name: name !== undefined ? name : (existing?.name || `Contato ${cleanPhone.slice(-4)}`),
        company: company !== undefined ? company : (existing?.company || 'Empresa'),
        niche: niche !== undefined ? niche : (existing?.niche || 'Geral'),
        role: role !== undefined ? role : (existing?.role || 'decisor'),
        status: status !== undefined ? status : (existing?.status || 'novo'),
        agentState: agentState !== undefined ? agentState : (existing?.agentState || 'ai_active'),
        optOutDetected: existing?.optOutDetected || false,
        optOutReason: existing?.optOutReason,
        notes: notes !== undefined ? notes : existing?.notes,
        lastInteractionAt: new Date().toISOString(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      const saved = await db.saveContact(contactData);
      return res.status(200).json({ contact: saved });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API Contacts Error]:', err);
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
