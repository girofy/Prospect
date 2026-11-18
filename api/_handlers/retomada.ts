import { db } from '../lib/db';

// Fila da retomada. Protegida pelo login (ver api/index.ts).
// GET: mostra o que falta. POST {items:[{phone,text,name}]}: troca a fila (só números brasileiros válidos). POST {action:'clear'}: esvazia.
export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const cfg = await db.getConfig();
      const fila = cfg.retomadaQueue || [];
      return res.status(200).json({ pendentes: fila.length, proximoEm: cfg.retomadaNextAt || null, fila: fila.map(i => ({ phone: i.phone, name: i.name || '' })) });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (b.action === 'clear') {
        await db.saveConfig({ retomadaQueue: [], retomadaNextAt: undefined });
        return res.status(200).json({ ok: true, pendentes: 0 });
      }
      const items = (Array.isArray(b.items) ? b.items : [])
        .map((i: any) => ({ phone: String(i.phone || '').replace(/\D/g, ''), text: String(i.text || '').trim().slice(0, 400), name: String(i.name || '').slice(0, 60) }))
        .filter((i: any) => /^55\d{10,11}$/.test(i.phone) && i.text);
      await db.saveConfig({ retomadaQueue: items });
      return res.status(200).json({ ok: true, colocados: items.length });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha na retomada' });
  }
}
