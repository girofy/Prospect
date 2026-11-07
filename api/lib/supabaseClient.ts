import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

// Lança erro só quando algo tenta usar o banco sem as variáveis configuradas,
// nunca na importação do módulo (evitaria o processo inteiro de subir).
export function supabase(): SupabaseClient {
  if (client) return client;

  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();

  if (!url || !key) {
    throw new Error(
      '[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados. Defina as duas variáveis de ambiente.'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
