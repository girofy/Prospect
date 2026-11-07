import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/db';
import { generateGirofyCommercialReply } from '../lib/gemini';
import { isRealBrPhone, last8 } from '../lib/phone';
import { AUTHORIZED_BUSINESS_NUMBER } from '../lib/whatsapp';

// Follow-up manual (Módulo 6 da Bíblia). O sistema só SUGERE quem retomar e prepara o rascunho;
// quem aprova e envia é o César. Regras: a última mensagem é nossa, passou 24h, no máximo 3 toques
// seguidos sem resposta, nunca para quem pediu para sair.
const MIN_HOURS = 24;
const MAX_TOUCHES = 3;

async function allMessages(): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase().from('messages').select('contact_phone, "from", text, "timestamp"').order('timestamp', { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const [contacts, messages] = await Promise.all([db.getContacts(), allMessages()]);
      const byPhone = new Map<string, any[]>();
      for (const m of messages) {
        const arr = byPhone.get(m.contact_phone) || [];
        arr.push(m);
        byPhone.set(m.contact_phone, arr);
      }
      const now = Date.now();
      const list = contacts
        .filter(c => c.status === 'em_conversa' && !c.optOutDetected && isRealBrPhone(c.phone) && last8(c.phone) !== last8(AUTHORIZED_BUSINESS_NUMBER))
        .map(c => {
          const msgs = byPhone.get(c.phone) || [];
          const last = msgs[msgs.length - 1];
          if (!last || last.from === 'lead') return null;
          const hours = (now - Date.parse(last.timestamp)) / 3_600_000;
          if (hours < MIN_HOURS) return null;
          let touches = 0;
          for (let i = msgs.length - 1; i >= 0 && msgs[i].from !== 'lead'; i--) touches++;
          if (touches >= MAX_TOUCHES) return null;
          return {
            phone: c.phone,
            name: c.name,
            company: c.company,
            last_text: String(last.text || '').slice(0, 140),
            last_from: last.from,
            horas: Math.round(hours),
            toques: touches,
            ja_respondeu: msgs.some(m => m.from === 'lead'),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.horas - a.horas)
        .slice(0, 50);
      // Conversas que existem mas não têm telefone utilizável (só o identificador interno do WhatsApp):
      // servem para estudo, mas não dá para escrever para elas.
      const semNumero = contacts.filter(c => c.status === 'em_conversa' && !isRealBrPhone(c.phone)).length;
      return res.status(200).json({ candidatos: list, sem_numero: semNumero, regras: { horas_minimas: MIN_HOURS, toques_maximos: MAX_TOUCHES } });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const phone = String(body.phone || '').replace(/\D/g, '');
      const contact = await db.getContactByPhone(phone);
      if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
      if (contact.optOutDetected || contact.status === 'bloqueado') return res.status(400).json({ error: 'Esse contato pediu para sair. Nada será enviado.' });
      const history = await db.getMessages(phone);
      let touches = 0;
      for (let i = history.length - 1; i >= 0 && history[i].from !== 'lead'; i--) touches++;
      if (touches >= MAX_TOUCHES) return res.status(400).json({ error: `Já são ${touches} mensagens sem resposta. Melhor parar.` });
      const r = await generateGirofyCommercialReply(contact, { text: '', followup: touches + 1 }, history);
      if (!r.aiAvailable) {
        const why = r.unavailableReason === 'quota' ? 'A cota da IA acabou por agora.' : r.unavailableReason === 'invalid' ? 'A IA gerou textos que o validador recusou. Tente de novo.' : 'A IA não respondeu.';
        return res.status(503).json({ error: why });
      }
      return res.status(200).json({ draft: r.replyText, toque: touches + 1 });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha nos follow-ups.' });
  }
}
