import { supabase } from '../lib/supabaseClient';

// Download de todas as conversas (CSV ou JSON). Protegido pelo login.
// Uma linha por mensagem. Horário em America/Bahia.

const LABEL: Record<string, string> = { lead: 'Contato', bot: 'Agente IA', operator: 'César' };

function bahia(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

async function allRows(table: string, cols: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();

    const [contacts, messages] = await Promise.all([
      allRows('contacts', 'phone, name, company, niche, status, created_at'),
      allRows('messages', 'contact_phone, "from", type, text, "timestamp"'),
    ]);
    const byPhone = new Map(contacts.map(c => [c.phone, c]));

    // ?since=AAAA-MM-DD: só mensagens a partir desse dia (dia de Salvador, BA)
    const since = url.searchParams.get('since');
    const sinceMs = since ? Date.parse(`${since}T00:00:00-03:00`) : 0;
    const scoped = sinceMs ? messages.filter(m => Date.parse(m.timestamp) >= sinceMs) : messages;

    const rows = scoped
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
      .map(m => {
        const c: any = byPhone.get(m.contact_phone) || {};
        return {
          contato: c.name || '',
          empresa: c.company || '',
          nicho: c.niche || '',
          telefone: m.contact_phone,
          status_atual: c.status || '',
          quem_falou: LABEL[m.from] || m.from,
          tipo: m.type || 'text',
          quando: bahia(m.timestamp),
          texto: m.text || '',
        };
      });

    const stamp = since ? `${since}` : new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="conversas-girofy-${stamp}.json"`);
      return res.status(200).end(JSON.stringify(rows, null, 2));
    }

    const header = Object.keys(rows[0] || { contato: '', telefone: '', quem_falou: '', quando: '', texto: '' });
    const lines = [header.join(';'), ...rows.map(r => header.map(h => csvCell((r as any)[h])).join(';'))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="conversas-girofy-${stamp}.csv"`);
    // BOM para o Excel abrir com acentos certos
    return res.status(200).end('﻿' + lines.join('\r\n'));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao exportar.' });
  }
}
