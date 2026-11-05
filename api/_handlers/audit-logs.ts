import { db } from '../lib/db';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const logs = await db.getAuditLogs(100);
    return res.status(200).json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao consultar logs de auditoria' });
  }
}
