import { db } from '../lib/db';
import { formatPhoneNumber } from '../lib/whatsapp';
import { Contact } from '../lib/types';

// Disparo manual agora só ENFILEIRA. Quem envia é o agendador (prospector), com
// janela de horário, intervalo aleatório, teto diário e checagem de opt-out.
// Assim não existe mais envio "fake" nem caminho paralelo sem proteção.
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const contacts = await db.getContacts();
      const repliedPhones = await db.getRepliedPhones();

      const dispatched = contacts.filter(c => c.status !== 'novo');
      const responded = dispatched.filter(c => repliedPhones.has(c.phone));

      return res.status(200).json({
        totalContacts: contacts.length,
        dispatchedCount: dispatched.length,
        respondedCount: responded.length,
        responseRate: dispatched.length > 0 ? Math.round((responded.length / dispatched.length) * 100) : 0,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const leads: any[] = Array.isArray(body.leads) ? body.leads : [];

      if (leads.length === 0) {
        return res.status(400).json({ error: 'Envie uma lista de contatos para enfileirar.' });
      }
      if (leads.length > 500) {
        return res.status(400).json({ error: 'Máximo de 500 contatos por envio.' });
      }

      const enqueued: string[] = [];
      const skipped: { phone: string; motivo: string }[] = [];
      const now = new Date().toISOString();

      for (const item of leads) {
        const cleanPhone = formatPhoneNumber(String(item.phone || ''));
        if (!cleanPhone || cleanPhone.length < 12) {
          skipped.push({ phone: String(item.phone || ''), motivo: 'telefone inválido' });
          continue;
        }

        const existing = await db.getContactByPhone(cleanPhone);
        if (existing?.optOutDetected || existing?.status === 'bloqueado') {
          skipped.push({ phone: cleanPhone, motivo: 'opt-out (pediu para sair)' });
          continue;
        }
        if (existing && existing.status !== 'novo') {
          skipped.push({ phone: cleanPhone, motivo: `já prospectado (${existing.status})` });
          continue;
        }

        const contact: Contact = {
          id: existing?.id || `lead-${cleanPhone}`,
          phone: cleanPhone,
          name: item.name || existing?.name || '',
          company: item.company || existing?.company || 'Em qualificação',
          niche: item.niche || existing?.niche || undefined,
          role: 'decisor',
          status: 'novo',
          agentState: 'ai_active',
          optOutDetected: false,
          lastInteractionAt: now,
          createdAt: existing?.createdAt || now,
        };
        await db.saveContact(contact);
        enqueued.push(cleanPhone);
      }

      await db.addAuditLog({
        type: 'status_change',
        summary: `${enqueued.length} contatos enfileirados para prospecção; ${skipped.length} pulados.`,
        details: { enqueued: enqueued.length, skipped: skipped.length },
      });

      return res.status(200).json({
        success: true,
        enqueued: enqueued.length,
        skipped,
        message: `${enqueued.length} contatos entraram na fila. O agente envia no horário, respeitando o teto diário.`,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[Campaign API Error]:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao enfileirar contatos.' });
  }
}
