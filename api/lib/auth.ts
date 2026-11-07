import crypto from 'crypto';

// Login simples por senha do painel. A senha fica só no servidor (ADMIN_PASSWORD).
// O token é um HMAC da senha: o navegador guarda o token, nunca a senha.
// Se ADMIN_PASSWORD não existir, as rotas protegidas recusam tudo (falha fechada).

function secret(): string | null {
  const pwd = (process.env.ADMIN_PASSWORD || '').trim();
  return pwd.length >= 8 ? pwd : null;
}

export function issueToken(): string | null {
  const s = secret();
  if (!s) return null;
  return crypto.createHmac('sha256', s).update('painel-girofy-v1').digest('hex');
}

export function checkPassword(candidate: string): boolean {
  const s = secret();
  if (!s || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthorized(req: any): boolean {
  const token = issueToken();
  if (!token) return false;
  const header = String(req.headers?.authorization || '');
  const bearer = header.replace(/^Bearer\s+/i, '').trim();
  return bearer.length > 0 && bearer.length === token.length && crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(token));
}
