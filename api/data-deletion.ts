import { db } from './lib/db';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Consulta de status de exclusão
  if (req.method === 'GET') {
    let code = req.query?.code;
    if (!code && req.url) {
      try {
        const parsed = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
        code = parsed.searchParams.get('code');
      } catch {
        // ignore
      }
    }

    if (!code) {
      return res.status(400).json({ error: 'Código de confirmação de exclusão não informado.' });
    }

    const request = await db.getDeletionRequest(String(code));
    if (!request) {
      return res.status(404).json({ error: 'Solicitação de exclusão não encontrada.' });
    }

    return res.status(200).json({
      confirmation_code: request.confirmationCode,
      status: request.status,
      requested_at: request.requestedAt,
      completed_at: request.completedAt || null,
      message: request.status === 'completed'
        ? 'Seus dados e histórico de conversas foram excluídos definitivamente dos servidores do Prospectfy.'
        : 'Solicitação recebida e em processamento conforme as diretrizes da LGPD.',
    });
  }

  // Solicitação de exclusão de dados (Meta Data Deletion Callback ou Formulário Web)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const identifier = body?.identifier || body?.phone || body?.user_id;

      if (!identifier) {
        return res.status(400).json({
          error: 'Identificador (número de telefone ou e-mail) obrigatório para exclusão.',
        });
      }

      // Registra solicitação oficial
      const deletionReq = await db.createDeletionRequest(identifier, body?.notes);

      // Executa exclusão real e definitiva no banco de dados
      const result = await db.executeDataDeletion(identifier);

      const host = req.headers?.host || 'prospectfy.vercel.app';
      const protocol = req.headers?.['x-forwarded-proto'] || 'https';
      const statusUrl = `${protocol}://${host}/data-deletion?code=${deletionReq.confirmationCode}`;

      // Formato oficial exigido pela Meta para Data Deletion Callback:
      // { url: string, confirmation_code: string }
      return res.status(200).json({
        url: statusUrl,
        confirmation_code: deletionReq.confirmationCode,
        status: 'completed',
        deleted_records: result.deletedCount,
        message: 'Dados excluídos com sucesso em cumprimento à LGPD.',
      });
    } catch (err: any) {
      console.error('[Data Deletion Error]:', err);
      return res.status(500).json({ error: err?.message || 'Falha ao processar solicitação de exclusão' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
