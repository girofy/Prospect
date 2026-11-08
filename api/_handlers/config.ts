import { db, AppConfig } from '../lib/db';
import { getMetaConfig, AUTHORIZED_BUSINESS_NUMBER, DEFAULT_APP_ID, DEFAULT_BUSINESS_ID } from '../lib/whatsapp';

function maskSecret(val?: string): string {
  if (!val || val.length < 8) return val ? '••••••••' : '';
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const cfg = await db.getConfig();
      // Só o próprio painel (rota protegida) pode pedir a chave inteira, para o olhinho mostrar.
      const reveal = new URL(req.url || '/', 'http://localhost').searchParams.get('reveal') === '1';
      const meta = getMetaConfig();
      const geminiKey = cfg.geminiApiKey || process.env.GEMINI_API_KEY || '';

      return res.status(200).json({
        metaConfigured: meta.isConfigured,
        geminiConfigured: Boolean(geminiKey.trim()),
        metaPhoneNumberId: meta.phoneNumberId,
        authorizedBusinessNumber: AUTHORIZED_BUSINESS_NUMBER,
        appId: DEFAULT_APP_ID,
        businessId: DEFAULT_BUSINESS_ID,
        webhookVerifyTokenMasked: maskSecret(meta.verifyToken),
        metaAccessTokenMasked: maskSecret(meta.token),
        metaAppSecretMasked: maskSecret(meta.appSecret),
        geminiApiKeyMasked: maskSecret(geminiKey),
        groqApiKeyMasked: maskSecret(cfg.groqApiKey || process.env.GROQ_API_KEY || ''),
        ...(reveal ? { groqApiKeyPlain: cfg.groqApiKey || process.env.GROQ_API_KEY || '', geminiApiKeyPlain: cfg.geminiApiKey || process.env.GEMINI_API_KEY || '' } : {}),
        aiChain: cfg.aiChain || null,
        geminiModel: cfg.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        autoReplyEnabled: meta.autoReplyEnabled,
        activeGateway: cfg.activeGateway || 'direct_pairing',
        directPairingPhone: cfg.directPairingPhone || '',
        directPairingStatus: cfg.directPairingStatus || 'disconnected',
        directPairingConnectedAt: cfg.directPairingConnectedAt || '',
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const updates: Partial<AppConfig> = {};
      const current = await db.getConfig();

      if (typeof body.metaAccessToken === 'string' && body.metaAccessToken.trim()) {
        updates.metaAccessToken = body.metaAccessToken.trim().replace(/^Bearer\s+/i, '');
      }
      if (typeof body.metaPhoneNumberId === 'string' && body.metaPhoneNumberId.trim()) {
        updates.metaPhoneNumberId = body.metaPhoneNumberId.trim();
      }
      if (typeof body.metaAppSecret === 'string') {
        updates.metaAppSecret = body.metaAppSecret.trim();
      }
      if (typeof body.webhookVerifyToken === 'string' && body.webhookVerifyToken.trim()) {
        updates.webhookVerifyToken = body.webhookVerifyToken.trim();
      }
      if (typeof body.geminiApiKey === 'string' && body.geminiApiKey.trim()) {
        updates.geminiApiKey = body.geminiApiKey.trim();
      }
      if (typeof body.pixKey === 'string' && body.pixKey.trim()) {
        updates.pixKey = body.pixKey.trim();
      }
      if (typeof body.groqApiKey === 'string' && body.groqApiKey.trim()) {
        updates.groqApiKey = body.groqApiKey.trim();
      }
      if (Array.isArray(body.aiChain)) {
        updates.aiChain = body.aiChain
          .filter((x: any) => x && (x.provider === 'gemini' || x.provider === 'groq') && typeof x.model === 'string' && x.model.trim())
          .slice(0, 6)
          .map((x: any) => ({ provider: x.provider, model: String(x.model).trim().slice(0, 80) }));
      }
      if (typeof body.geminiModel === 'string' && body.geminiModel.trim()) {
        updates.geminiModel = body.geminiModel.trim();
      }
      if (typeof body.autoReplyEnabled === 'boolean') {
        updates.autoReplyEnabled = body.autoReplyEnabled;
      }
      if (body.activeGateway === 'direct_pairing' || body.activeGateway === 'meta_cloud_api') {
        updates.activeGateway = body.activeGateway;
      }
      if (typeof body.directPairingPhone === 'string' && body.directPairingPhone.trim()) {
        updates.directPairingPhone = body.directPairingPhone.trim();
      }

      // Chave nova = cota nova: zera o contador do dia e tira a pausa dos modelos desse provedor,
      // na mesma hora. Salvar a mesma chave de novo não faz nada.
      const changed = (k: 'groqApiKey' | 'geminiApiKey', prefix: string) => {
        const next = updates[k];
        if (!next || next === current[k]) return;
        updates.aiPausedModels = Object.fromEntries(
          Object.entries(updates.aiPausedModels || current.aiPausedModels || {}).filter(([key]) => !key.startsWith(prefix))
        );
        updates.aiUsageCount = 0;
      };
      changed('groqApiKey', 'groq:');
      changed('geminiApiKey', 'gemini:');

      const updated = await db.saveConfig(updates);
      const meta = getMetaConfig();
      const geminiKey = updated.geminiApiKey || process.env.GEMINI_API_KEY || '';

      return res.status(200).json({
        success: true,
        message: 'Configurações atualizadas com sucesso.',
        metaConfigured: meta.isConfigured,
        geminiConfigured: Boolean(geminiKey.trim()),
        metaPhoneNumberId: meta.phoneNumberId,
        webhookVerifyToken: meta.verifyToken,
        metaAccessTokenMasked: maskSecret(meta.token),
        geminiApiKeyMasked: maskSecret(geminiKey),
        autoReplyEnabled: meta.autoReplyEnabled,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API Config Error]:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao processar configuração.' });
  }
}
