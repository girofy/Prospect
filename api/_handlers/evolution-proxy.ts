export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { targetUrl, method = 'GET', headers = {}, body: payloadBody } = body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing targetUrl' });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (payloadBody && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof payloadBody === 'string' ? payloadBody : JSON.stringify(payloadBody);
    }

    const proxyRes = await fetch(targetUrl, fetchOptions);
    const contentType = proxyRes.headers.get('content-type') || 'application/json';
    const textData = await proxyRes.text();

    res.status(proxyRes.status);
    res.setHeader('Content-Type', contentType);
    return res.end(textData);
  } catch (err: any) {
    console.error('[Evolution Proxy Error]:', err);
    return res.status(500).json({ error: err?.message || 'Proxy error' });
  }
}
