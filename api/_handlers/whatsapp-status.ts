import { getMetaConfig, getWhatsAppNumberStatus, AUTHORIZED_BUSINESS_NUMBER } from '../lib/whatsapp';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const config = getMetaConfig();
    const numberStatus = await getWhatsAppNumberStatus();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

    return res.status(200).json({
      metaConfigured: config.isConfigured,
      phoneNumberId: config.phoneNumberId,
      authorizedBusinessNumber: AUTHORIZED_BUSINESS_NUMBER,
      verifiedName: numberStatus.verifiedName || 'Girofy Tecnologia',
      displayPhoneNumber: numberStatus.displayPhoneNumber || '+55 74 8812-6578',
      qualityRating: numberStatus.qualityRating || 'UNKNOWN',
      geminiConfigured: hasGeminiKey,
      signatureValidationActive: Boolean(config.appSecret),
      metaError: numberStatus.error || null,
      environment: process.env.NODE_ENV || 'production',
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao consultar status' });
  }
}
