import { getCampaigns, saveCampaigns, campaignStats, campaignDetail, companyProfile, importRows, Campaign } from '../lib/campaigns';
import { db } from '../lib/db';

// Agenda da campanha: início, fim, intervalo mínimo e máximo entre envios (segundos). Limites seguros.
function schedule(b: any, cur?: Partial<Campaign>) {
  const pick = (k: string, fb: number | undefined) => (b[k] != null && b[k] !== '' ? Number(b[k]) : fb);
  const startHour = Math.max(6, Math.min(12, pick('startHour', cur?.startHour ?? 8) as number));
  let minGapS = Math.max(60, Math.min(1800, pick('minGapS', cur?.minGapS ?? 240) as number));
  let maxGapS = Math.max(60, Math.min(3600, pick('maxGapS', cur?.maxGapS ?? 540) as number));
  if (maxGapS < minGapS) maxGapS = minGapS;
  return { startHour, minGapS, maxGapS };
}

// Painel de campanhas. Protegido pelo login (ver api/index.ts).
export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const sp = new URL(req.url || '/', 'http://localhost').searchParams;
      const prof = sp.get('profile');
      if (prof) {
        const d = await companyProfile(prof);
        return d ? res.status(200).json(d) : res.status(404).json({ error: 'Empresa não encontrada' });
      }
      const id = sp.get('id');
      if (id) {
        const d = await campaignDetail(id);
        return d ? res.status(200).json(d) : res.status(404).json({ error: 'Campanha não encontrada' });
      }
      return res.status(200).json(await campaignStats());
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const list = await getCampaigns();
    const find = (id: string) => list.find(c => c.id === id);

    if (b.action === 'create') {
      const camp: Campaign = {
        id: `camp-${Date.now()}`,
        name: String(b.name || 'Nova campanha').slice(0, 60),
        mission: String(b.mission || '').slice(0, 500),
        objective: String(b.objective || '').slice(0, 200),
        status: 'rascunho',
        phones: [],
        dailyCap: Math.max(1, Math.min(100, Number(b.dailyCap) || 40)),
        endHour: Math.max(8, Math.min(21, Number(b.endHour) || 18)),
        ...schedule(b),
        createdAt: new Date().toISOString(),
      };
      const result = Array.isArray(b.rows) && b.rows.length ? await importRows(camp, b.rows) : { added: 0, skipped: [] };
      list.push(camp);
      await saveCampaigns(list);
      return res.status(200).json({ ok: true, id: camp.id, ...result });
    }

    const camp = find(String(b.id || ''));
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

    if (b.action === 'import') {
      const result = await importRows(camp, Array.isArray(b.rows) ? b.rows : []);
      await saveCampaigns(list);
      return res.status(200).json({ ok: true, ...result });
    }
    if (b.action === 'update') {
      if (b.name != null) camp.name = String(b.name).slice(0, 60);
      if (b.mission != null) camp.mission = String(b.mission).slice(0, 500);
      if (b.objective != null) camp.objective = String(b.objective).slice(0, 200);
      if (b.dailyCap != null) camp.dailyCap = Math.max(1, Math.min(100, Number(b.dailyCap) || 40));
      if (b.endHour != null) camp.endHour = Math.max(8, Math.min(21, Number(b.endHour) || 18));
      Object.assign(camp, schedule(b, camp));
      await saveCampaigns(list);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'activate') {
      const contacts = await db.getContacts();
      const keys = new Set(camp.phones.map(p => p.slice(-8)));
      const fila = contacts.filter(c => keys.has(c.phone.slice(-8)) && c.status === 'novo' && c.agentState === 'ai_active' && !c.optOutDetected).length;
      if (!fila) return res.status(400).json({ error: 'Esta campanha não tem ninguém na fila. Adicione a lista primeiro.' });
      if (!camp.mission.trim()) return res.status(400).json({ error: 'Dê uma missão para o agente antes de ativar.' });
      for (const c of list) if (c.status === 'ativa') c.status = 'pausada'; // uma campanha ativa por vez
      camp.status = 'ativa';
      await saveCampaigns(list);
      // Ativar a campanha é pedir para enviar: tira a pausa e liga o turbo nos primeiros 15 envios.
      await db.saveConfig({ prospectorPaused: false, prospectorBoost: 15 });
      return res.status(200).json({ ok: true, fila });
    }
    if (b.action === 'removePhone') {
      const k = String(b.phone || '').slice(-8);
      camp.phones = camp.phones.filter(p => p.slice(-8) !== k);
      await saveCampaigns(list);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'pause') {
      camp.status = 'pausada';
      await saveCampaigns(list);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'remove') {
      await saveCampaigns(list.filter(c => c.id !== camp.id));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (err: any) {
    console.error('[Campanhas]', err);
    return res.status(500).json({ error: err?.message || 'Falha nas campanhas' });
  }
}
