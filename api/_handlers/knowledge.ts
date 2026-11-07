import { db } from '../lib/db';
import { clearKnowledgeCache } from '../lib/gemini';

// Base de conhecimento do painel. Protegida pelo login (ver api/index.ts).
// Rotas: GET lista · POST cria · POST /toggle ativa/desativa · POST /delete remove.
const MAX_DOC_CHARS = 60_000;

function body(req: any): any {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

export default async function handler(req: any, res: any) {
  const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
  try {
    if (req.method === 'GET') {
      const docs = await db.listKnowledge();
      const totalChars = docs.filter(d => d.active).reduce((n, d) => n + d.content.length, 0);
      return res.status(200).json({ docs, totalChars });
    }

    if (req.method === 'POST' && path === '/api/knowledge') {
      const b = body(req);
      const title = String(b.title || '').trim().slice(0, 120);
      const content = String(b.content || '').trim();
      if (!title || !content) return res.status(400).json({ error: 'Dê um título e cole ou envie o conteúdo.' });
      if (content.length > MAX_DOC_CHARS) {
        return res.status(400).json({ error: `Documento muito grande (máximo ${MAX_DOC_CHARS} caracteres). Divida em partes.` });
      }
      await db.saveKnowledge(title, content);
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && path === '/api/knowledge/toggle') {
      const b = body(req);
      await db.setKnowledgeActive(Number(b.id), Boolean(b.active));
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && path === '/api/knowledge/delete') {
      const b = body(req);
      await db.deleteKnowledge(Number(b.id));
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[Knowledge API]', err);
    return res.status(500).json({ error: err?.message || 'Falha na base de conhecimento.' });
  }
}
