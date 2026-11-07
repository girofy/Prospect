import { checkPassword, issueToken } from '../lib/auth';

// Rate limit simples por processo: 10 tentativas por IP a cada 15 min.
const attempts = new Map<string, { count: number; reset: number }>();

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur || cur.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 60_000 });
    return false;
  }
  cur.count += 1;
  return cur.count > 10;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    // Sessão: o painel usa para saber se o token guardado ainda vale.
    const token = issueToken();
    const ok = !!token && String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim() === token;
    return res.status(ok ? 200 : 401).json({ authenticated: ok, configured: !!token });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const token = issueToken();
  if (!token) {
    return res.status(503).json({ error: 'Painel sem senha configurada (ADMIN_PASSWORD no servidor).' });
  }
  if (!checkPassword(String(body.password || ''))) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  return res.status(200).json({ token });
}
