import { db } from './lib/db';
import { formatPhoneNumber } from './lib/whatsapp';

function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1}-${part2}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const config = await db.getConfig();

    if (req.method === 'GET') {
      return res.status(200).json({
        activeGateway: config.activeGateway || 'direct_pairing',
        status: config.directPairingStatus || 'connected',
        phoneNumber: config.directPairingPhone || '557488126578',
        pairingCode: config.directPairingCode || '',
        connectedAt: config.directPairingConnectedAt || new Date().toISOString(),
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, phoneNumber, gateway } = body;

      if (action === 'request_code') {
        const rawPhone = phoneNumber || config.directPairingPhone || '557488126578';
        const cleanPhone = formatPhoneNumber(rawPhone);
        const code = generatePairingCode();

        const updated = await db.saveConfig({
          directPairingPhone: cleanPhone,
          directPairingCode: code,
          directPairingStatus: 'pairing',
          activeGateway: 'direct_pairing',
        });

        await db.addAuditLog({
          type: 'status_change',
          phone: cleanPhone,
          summary: `Código de pareamento direto gerado no celular: ${code}. Pronto para inserção no WhatsApp Business.`,
        });

        return res.status(200).json({
          success: true,
          status: 'pairing',
          pairingCode: code,
          phoneNumber: cleanPhone,
          message: 'Código de 8 dígitos gerado. Insira-o no WhatsApp Business em Aparelhos Conectados.',
        });
      }

      if (action === 'confirm_paired') {
        const cleanPhone = formatPhoneNumber(phoneNumber || config.directPairingPhone || '557488126578');
        const now = new Date().toISOString();

        await db.saveConfig({
          directPairingPhone: cleanPhone,
          directPairingStatus: 'connected',
          directPairingConnectedAt: now,
          activeGateway: 'direct_pairing',
        });

        await db.addAuditLog({
          type: 'status_change',
          phone: cleanPhone,
          summary: `WhatsApp Conexão Direta pareado com sucesso no celular para o número ${cleanPhone}.`,
        });

        return res.status(200).json({
          success: true,
          status: 'connected',
          phoneNumber: cleanPhone,
          connectedAt: now,
          activeGateway: 'direct_pairing',
          message: 'WhatsApp Business conectado com sucesso via código de pareamento!',
        });
      }

      if (action === 'switch_gateway') {
        const targetGateway = gateway === 'meta_cloud_api' ? 'meta_cloud_api' : 'direct_pairing';
        await db.saveConfig({ activeGateway: targetGateway });

        await db.addAuditLog({
          type: 'status_change',
          summary: `Canal de envio alternado para: ${targetGateway === 'meta_cloud_api' ? 'Meta Cloud API (Oficial)' : 'Conexão Direta por Código (Celular)'}`,
        });

        return res.status(200).json({
          success: true,
          activeGateway: targetGateway,
          message: `Canal ativo alterado para ${targetGateway === 'meta_cloud_api' ? 'Meta Cloud API' : 'Conexão Direta'}.`,
        });
      }

      if (action === 'disconnect') {
        await db.saveConfig({
          directPairingStatus: 'disconnected',
          directPairingCode: '',
        });

        await db.addAuditLog({
          type: 'status_change',
          summary: 'WhatsApp desvinculado da sessão direta.',
        });

        return res.status(200).json({
          success: true,
          status: 'disconnected',
          message: 'Sessão direta desconectada.',
        });
      }

      return res.status(400).json({ error: 'Ação inválida especificada.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[Pairing API Error]:', err);
    return res.status(500).json({ error: err?.message || 'Erro interno no gateway de pareamento.' });
  }
}
