// Backup das mensagens e do resto no Cloudflare (banco D1 "girofy-backup", plano grátis).
// O servidor manda só o que mudou, de hora em hora. Se o Supabase falhar, as conversas estão guardadas fora dele.
// Variáveis: BACKUP_URL (Worker) e BACKUP_KEY (senha do Worker). Sem elas, não faz nada.
import { supabase } from './supabaseClient';
import { db } from './db';

const URL_ = (process.env.BACKUP_URL || '').trim().replace(/\/+$/, '');
const KEY = (process.env.BACKUP_KEY || '').trim();
const EVERY_MS = Number(process.env.BACKUP_EVERY_MIN ?? 60) * 60_000;
const BATCH = 100;

type Spec = { table: string; id: string; since?: string };
const SPECS: Spec[] = [
  { table: 'messages', id: 'id', since: 'timestamp' },
  { table: 'audit_logs', id: 'id', since: 'timestamp' },
  { table: 'learnings', id: 'id', since: 'created_at' },
  { table: 'knowledge_docs', id: 'id' }, // poucos documentos: sempre inteiros
  { table: 'contacts', id: 'phone' },     // mudam o tempo todo: sempre inteiros (centenas de linhas)
];

async function send(table: string, rows: { id: string; data: unknown }[]): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-girofy-key': KEY },
      body: JSON.stringify({ table, rows: rows.slice(i, i + BATCH) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`backup ${table}: HTTP ${res.status}`);
  }
}

async function fetchRows(spec: Spec, since: string | null): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase().from(spec.table).select('*').range(from, from + 999);
    if (spec.since) {
      q = q.order(spec.since, { ascending: true });
      if (since) q = q.gt(spec.since, since);
    }
    const { data, error } = await q;
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

// Config sem nenhuma chave, token ou senha.
function cleanConfig(cfg: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(cfg).filter(([k]) => !/key|token|secret|password|pix/i.test(k)));
}

let running = false;
export async function runBackup(): Promise<{ saved: Record<string, number> } | null> {
  if (!URL_ || !KEY || running) return null;
  running = true;
  const saved: Record<string, number> = {};
  try {
    const cfg: any = await db.getConfig();
    const marks: Record<string, string> = { ...(cfg.backupMarks || {}) };
    for (const spec of SPECS) {
      const rows = await fetchRows(spec, marks[spec.table] || null);
      if (!rows.length) { saved[spec.table] = 0; continue; }
      await send(spec.table, rows.map(r => ({ id: String(r[spec.id]), data: r })));
      saved[spec.table] = rows.length;
      if (spec.since) marks[spec.table] = String(rows[rows.length - 1][spec.since]);
    }
    await send('app_config', [{ id: 'config', data: cleanConfig(cfg) }]);
    await db.saveConfig({ backupMarks: marks, backupAt: new Date().toISOString() } as any);
    console.log('[Backup] ok', JSON.stringify(saved));
    return { saved };
  } catch (err) {
    console.warn('[Backup] falhou:', err);
    return null;
  } finally {
    running = false;
  }
}

export function startBackup() {
  if (!URL_ || !KEY) { console.log('[Backup] desligado (BACKUP_URL/BACKUP_KEY ausentes)'); return; }
  setTimeout(() => void runBackup(), 60_000); // 1 min depois de subir
  setInterval(() => void runBackup(), EVERY_MS);
  console.log(`[Backup] ativo, a cada ${EVERY_MS / 60_000} min`);
}
