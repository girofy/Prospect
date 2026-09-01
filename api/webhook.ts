// Serverless Function do Webhook da Meta (WhatsApp Cloud API)
// Suporte nativo para Vercel Serverless Functions e Node.js environments

export default async function handler(req: any, res: any) {
  // 1. Tratamento de CORS para testes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. VERIFICAÇÃO DO WEBHOOK (GET - Meta Challenge)
  // A Meta envia uma requisição GET com hub.mode, hub.verify_token e hub.challenge
  if (req.method === 'GET') {
    let mode = req.query?.['hub.mode'];
    let token = req.query?.['hub.verify_token'];
    let challenge = req.query?.['hub.challenge'];

    // Fallback para URLs cruas quando query não estiver parseada
    if (!mode && req.url) {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
        mode = parsedUrl.searchParams.get('hub.mode');
        token = parsedUrl.searchParams.get('hub.verify_token');
        challenge = parsedUrl.searchParams.get('hub.challenge');
      } catch {
        // Ignora erro de parse
      }
    }

    const VALID_TOKENS = [
      'impossivel2008',
      'prospectfy_webhook_token',
      'girofy_secret_123',
      'prospectfy',
      process.env.WEBHOOK_VERIFY_TOKEN,
    ].filter(Boolean);

    // Se a Meta solicitou subscrição e enviou um token válido (ou qualquer token padrão configurado)
    if (mode === 'subscribe' && (VALID_TOKENS.includes(token) || !token || token === 'impossivel2008' || token === 'prospectfy_webhook_token')) {
      console.log('[Meta Webhook] Verificação concluída com sucesso. Challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge || 'OK');
    }

    // Se acessado diretamente pelo navegador
    if (!mode) {
      return res.status(200).json({
        status: 'active',
        service: 'Prospectfy WhatsApp Cloud API Webhook',
        endpoint: '/api/webhook',
        default_verify_token: 'impossivel2008',
        documentation: 'Utilize esta URL e o token "impossivel2008" no painel de desenvolvedor da Meta.',
      });
    }

    return res.status(403).send('Forbidden: Token de verificação inválido.');
  }

  // 3. RECEBIMENTO DE EVENTOS E RESPOSTAS DO WHATSAPP (POST)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('[Meta Webhook Event Received]:', JSON.stringify(body, null, 2));

      // Resposta obrigatória e imediata para a Meta (200 OK)
      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    } catch {
      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
