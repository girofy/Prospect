import { generateGirofyCommercialReply } from '../lib/gemini';

// Teste rápido da IA pelo painel: gera uma resposta de exemplo e diz o que aconteceu.
// Protegida pelo login. Gasta 1 chamada da cota do dia.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = String(body.text || 'Oi, quem é?').slice(0, 300);
  const contact: any = { phone: '000', name: '', company: 'Em qualificação', niche: String(body.niche || 'barbearia'), status: 'novo', agentState: 'ai_active', optOutDetected: false };
  const t0 = Date.now();
  const r = await generateGirofyCommercialReply(contact, { text }, []);
  return res.status(200).json({
    ok: r.aiAvailable,
    reply: r.replyText,
    motivo: r.aiAvailable ? null : r.unavailableReason,
    ms: Date.now() - t0,
  });
}
