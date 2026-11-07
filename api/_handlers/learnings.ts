import { db } from '../lib/db';
import { getProspectStats } from '../lib/prospector';
import { runLearningPass } from '../lib/learning';

// Painel de aprendizado: funil atual + últimas lições gravadas. Protegida pelo login.
export default async function handler(req: any, res: any) {
  // Análise sob demanda: lê algumas conversas encerradas e grava as lições. Gasta cota da IA.
  if (req.method === 'POST') {
    try {
      const saved = await runLearningPass();
      return res.status(200).json({ saved });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Falha na análise.' });
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const [learnings, stats] = await Promise.all([db.getRecentLearnings(50), getProspectStats()]);
    const byOutcome: Record<string, number> = {};
    for (const l of learnings) byOutcome[l.outcome] = (byOutcome[l.outcome] || 0) + 1;
    return res.status(200).json({ funnel: stats, byOutcome, learnings });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao ler aprendizado.' });
  }
}
