import { db } from '../lib/db';
import { formatPhoneNumber } from '../lib/whatsapp';

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
        const { evolutionUrl, evolutionKey, instanceName = 'prospectfy' } = body;

        let code = '';
        let isRealSocketCode = false;
        let gatewayNotice = '';

        // If Evolution API is configured, request real WebSocket pairing code from WhatsApp servers
        if (evolutionUrl && evolutionKey) {
          try {
            const cleanUrl = evolutionUrl.replace(/\/+$/, '');

            // 1. Ensure instance exists in Evolution API
            try {
              await fetch(`${cleanUrl}/instance/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': evolutionKey,
                },
                body: JSON.stringify({
                  instanceName,
                  qrcode: false,
                  integration: 'WHATSAPP-BAILEYS',
                  number: cleanPhone,
                }),
              });
            } catch {
              // Instance may already exist
            }

            // 2. Request pairing code via GET with number param (Evolution v2 standard)
            let connectRes = await fetch(`${cleanUrl}/instance/connect/${instanceName}?number=${cleanPhone}`, {
              method: 'GET',
              headers: {
                'apikey': evolutionKey,
              },
            });

            // Fallback to POST if GET fails
            if (!connectRes.ok) {
              connectRes = await fetch(`${cleanUrl}/instance/connect/${instanceName}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': evolutionKey,
                },
                body: JSON.stringify({ number: cleanPhone }),
              });
            }

            if (connectRes.ok) {
              const data = await connectRes.json();
              const foundCode = data.pairingCode || data.code || data.pairing_code;
              if (foundCode) {
                code = foundCode;
                isRealSocketCode = true;
                gatewayNotice = 'Código real gerado via WebSocket do WhatsApp (Evolution API).';
              }
            }
          } catch (err: any) {
            console.warn('[Evolution Connect Warning]:', err?.message);
          }
        }

        if (!code) {
          code = generatePairingCode();
          gatewayNotice = 'Código local gerado. Nota: O WhatsApp exige conexão WebSocket ativa (Evolution API) ou Meta Plataforma Comercial para validar o pareamento no celular.';
        }

        const updated = await db.saveConfig({
          directPairingPhone: cleanPhone,
          directPairingCode: code,
          directPairingStatus: 'pairing',
          activeGateway: 'direct_pairing',
        });

        await db.addAuditLog({
          type: 'status_change',
          phone: cleanPhone,
          summary: `Código de pareamento solicitado: ${code}. ${gatewayNotice}`,
        });

        return res.status(200).json({
          success: true,
          status: 'pairing',
          pairingCode: code,
          phoneNumber: cleanPhone,
          isRealSocketCode,
          notice: gatewayNotice,
          message: 'Código de 8 dígitos gerado.',
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
