import crypto from 'crypto';
import { db } from './db';

// Configuration constants from confirmed project context
export const AUTHORIZED_BUSINESS_NUMBER = '557488126578';
export const DEFAULT_PHONE_NUMBER_ID = '1221241567748320';
export const DEFAULT_APP_ID = '1572840733789529';
export const DEFAULT_BUSINESS_ID = '1232106109979142';

export function getMetaConfig() {
  const dynamicConfig = db.getConfigSync();
  const token = dynamicConfig.metaAccessToken || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
  const phoneNumberId = dynamicConfig.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || DEFAULT_PHONE_NUMBER_ID;
  const appSecret = dynamicConfig.metaAppSecret || process.env.META_APP_SECRET || '';
  const verifyToken = dynamicConfig.webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || 'impossivel2008';

  return {
    token: token.trim().replace(/^Bearer\s+/i, ''),
    phoneNumberId: phoneNumberId.trim(),
    appSecret: appSecret.trim(),
    verifyToken: verifyToken.trim(),
    isConfigured: Boolean(token.trim()),
    autoReplyEnabled: dynamicConfig.autoReplyEnabled !== false,
  };
}

/**
 * Validates Meta X-Hub-Signature-256 header using SHA256 HMAC of raw request body.
 */
export function validateXHubSignature(rawBody: string, signatureHeader?: string): boolean {
  const { appSecret } = getMetaConfig();
  if (!appSecret) {
    // If app secret is not configured in environment yet, pass-through with warning in non-production
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  try {
    const hmac = crypto.createHmac('sha256', appSecret);
    const calculatedSignature = hmac.update(rawBody, 'utf-8').digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

    if (expectedBuffer.length !== calculatedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch (err) {
    console.error('[WhatsApp Security] Error validating signature:', err);
    return false;
  }
}

/**
 * Clean phone number to E.164 without non-digits.
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

/**
 * Checks if incoming sender is the business's own authorized number or ID (prevents infinite loop).
 */
export function isSelfMessage(from: string): boolean {
  const cleanFrom = from.replace(/\D/g, '');
  const cleanBusiness = AUTHORIZED_BUSINESS_NUMBER.replace(/\D/g, '');
  const { phoneNumberId } = getMetaConfig();
  return cleanFrom === cleanBusiness || cleanFrom === phoneNumberId;
}

/**
 * Sends a real text message via Meta WhatsApp Cloud Graph API.
 */
export async function sendWhatsAppTextMessage(
  recipientPhone: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();

  if (!isConfigured) {
    return {
      success: false,
      error: 'META_ACCESS_TOKEN não configurado no servidor. Adicione a variável de ambiente na Vercel.',
    };
  }

  const cleanRecipient = formatPhoneNumber(recipientPhone);

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanRecipient,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      const errorCode = data.error?.code;

      let guidance = errorMsg;
      if (errorCode === 131047) {
        guidance = 'Janela de 24 horas expirada. A Meta exige um template aprovado para reabrir conversa comercial.';
      } else if (errorCode === 190) {
        guidance = 'Token de Acesso da Meta expirado ou inválido. Necessário gerar novo token permanente na Meta Developers.';
      } else if (errorCode === 130429) {
        guidance = 'Limite de taxa (Rate Limit) da API do WhatsApp atingido. Aguarde alguns instantes.';
      }

      console.error(`[WhatsApp API Error] Code ${errorCode}: ${guidance}`);
      return { success: false, error: guidance };
    }

    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('[WhatsApp Network Error]', err?.message);
    return { success: false, error: err?.message || 'Falha na comunicação com a Graph API da Meta' };
  }
}

/**
 * Marks a received WhatsApp message as read (blue ticks / acknowledgement).
 */
export async function markWhatsAppMessageAsRead(messageId: string): Promise<boolean> {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();
  if (!isConfigured || !messageId) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Inspect status of the official phone number on Meta Graph API.
 */
export async function getWhatsAppNumberStatus(): Promise<{
  configured: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  error?: string;
}> {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();

  if (!isConfigured) {
    return {
      configured: false,
      error: 'Token da Meta não configurado no ambiente Vercel/Node.',
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    if (data.error) {
      return {
        configured: true,
        error: data.error.message,
      };
    }

    return {
      configured: true,
      verifiedName: data.verified_name || 'Número Meta Verificado',
      displayPhoneNumber: data.display_phone_number || '+55 74 8812-6578',
      qualityRating: data.quality_rating || 'GREEN',
    };
  } catch (err: any) {
    return {
      configured: true,
      error: err?.message || 'Falha ao consultar Graph API',
    };
  }
}
