// Evolution API & Evolution Go Client Service
// Suporta instâncias locais (Docker / localhost), VPS, Railway, Render ou instâncias remotas.
// Inclui fallback automático via proxy interno para garantir 100% de compatibilidade CORS no navegador.

export interface EvolutionConnectionResponse {
  connected: boolean;
  state: 'open' | 'close' | 'connecting' | 'not_found' | 'error';
  qrCodeBase64?: string;
  pairingCode?: string;
  connectedNumber?: string;
  profileName?: string;
  message?: string;
}

export function cleanBaseUrl(url: string): string {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

export function cleanInstanceName(name: string): string {
  if (!name) return 'prospectfy';
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function cleanRecipientPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Adiciona código do país 55 se o usuário digitou número brasileiro com DDD (10 ou 11 dígitos)
  if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

// Faz requisição com fallback automático pelo proxy caso haja bloqueio de CORS
export async function fetchWithCorsFallback(
  targetUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; data: any; ok: boolean }> {
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    // 1ª Tentativa: Requisição direta
    const res = await fetch(targetUrl, {
      method,
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    });

    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return { status: res.status, data, ok: res.ok };
  } catch (directErr) {
    // 2ª Tentativa: Falha por CORS ou rede local -> Faz via Proxy Vite
    console.warn('Tentativa direta falhou (possível CORS), usando proxy interno...', directErr);
    try {
      const proxyRes = await fetch('/api/evolution/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method,
          headers,
          body: options.body
        })
      });

      let data: any = null;
      const text = await proxyRes.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      return { status: proxyRes.status, data, ok: proxyRes.ok };
    } catch (proxyErr: any) {
      throw new Error(`Falha ao conectar à Evolution API: ${proxyErr?.message || 'Servidor inacessível'}`);
    }
  }
}

// 1. Checar Estado de Conexão da Instância
export async function checkEvolutionState(
  rawUrl: string,
  rawInstance: string,
  apiKey: string
): Promise<EvolutionConnectionResponse> {
  const baseUrl = cleanBaseUrl(rawUrl);
  const instance = cleanInstanceName(rawInstance);
  if (!baseUrl || !instance) {
    return { connected: false, state: 'not_found', message: 'URL ou Nome da Instância não informados.' };
  }

  const endpoint = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`;
  const res = await fetchWithCorsFallback(endpoint, {
    method: 'GET',
    headers: { apikey: apiKey.trim() }
  });

  if (!res.ok) {
    return {
      connected: false,
      state: 'not_found',
      message: res.data?.message || res.data?.error || `Instância "${instance}" não encontrada ou desligada.`
    };
  }

  const instanceState = res.data?.instance?.state || res.data?.state || 'close';
  const isConnected = instanceState === 'open';

  return {
    connected: isConnected,
    state: isConnected ? 'open' : (instanceState === 'connecting' ? 'connecting' : 'close'),
    connectedNumber: res.data?.instance?.owner || res.data?.owner || '',
    profileName: res.data?.instance?.profileName || '',
    message: isConnected ? 'Instância WhatsApp conectada e ativa!' : 'Instância desconectada.'
  };
}

// 2. Gerar QR Code para Leitura ou Criar Instância
export async function connectEvolutionInstance(
  rawUrl: string,
  rawInstance: string,
  apiKey: string
): Promise<EvolutionConnectionResponse> {
  const baseUrl = cleanBaseUrl(rawUrl);
  const instance = cleanInstanceName(rawInstance);

  if (!baseUrl || !instance) {
    throw new Error('Informe a URL base da Evolution API e o nome da instância.');
  }

  // Primeiro checa se já está conectada
  const currentState = await checkEvolutionState(baseUrl, instance, apiKey);
  if (currentState.connected) {
    return currentState;
  }

  // Tenta solicitar o QR Code de conexão
  const connectEndpoint = `${baseUrl}/instance/connect/${encodeURIComponent(instance)}`;
  let connectRes = await fetchWithCorsFallback(connectEndpoint, {
    method: 'GET',
    headers: { apikey: apiKey.trim() }
  });

  // Se a instância não existir (404), cria ela automaticamente
  if (connectRes.status === 404) {
    const createEndpoint = `${baseUrl}/instance/create`;
    const createRes = await fetchWithCorsFallback(createEndpoint, {
      method: 'POST',
      headers: { apikey: apiKey.trim() },
      body: {
        instanceName: instance,
        token: apiKey.trim() || 'prospectfy_token',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      }
    });

    if (createRes.ok) {
      const qrFromCreate = createRes.data?.qrcode?.base64 || createRes.data?.base64 || createRes.data?.code;
      if (qrFromCreate) {
        return {
          connected: false,
          state: 'connecting',
          qrCodeBase64: qrFromCreate.startsWith('data:') ? qrFromCreate : `data:image/png;base64,${qrFromCreate}`,
          pairingCode: createRes.data?.pairingCode,
          message: 'Instância criada! Escaneie o QR Code no seu celular.'
        };
      }
    }

    // Tenta conectar novamente após criar
    connectRes = await fetchWithCorsFallback(connectEndpoint, {
      method: 'GET',
      headers: { apikey: apiKey.trim() }
    });
  }

  const qrCodeData = connectRes.data?.base64 || connectRes.data?.qrcode?.base64 || connectRes.data?.code;
  const pairingCode = connectRes.data?.pairingCode;

  if (qrCodeData) {
    const cleanBase64 = qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`;
    return {
      connected: false,
      state: 'connecting',
      qrCodeBase64: cleanBase64,
      pairingCode,
      message: 'Escaneie o QR Code abaixo com o WhatsApp do seu celular.'
    };
  }

  if (connectRes.data?.instance?.state === 'open' || connectRes.data?.state === 'open') {
    return {
      connected: true,
      state: 'open',
      connectedNumber: connectRes.data?.instance?.owner,
      message: 'Instância já está conectada!'
    };
  }

  return {
    connected: false,
    state: 'close',
    message: connectRes.data?.message || 'Aguardando geração do QR Code pela Evolution API...'
  };
}

// 3. Enviar Mensagem de Texto Livre (Sem Templates da Meta, Sem 24h, 100% Dinâmico)
export async function sendEvolutionTextMessage(
  rawUrl: string,
  rawInstance: string,
  apiKey: string,
  recipientPhone: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = cleanBaseUrl(rawUrl);
  const instance = cleanInstanceName(rawInstance);
  const number = cleanRecipientPhone(recipientPhone);

  if (!baseUrl || !instance) {
    return { success: false, error: 'URL ou Instância da Evolution API não configuradas.' };
  }

  if (!number || number.length < 8) {
    return { success: false, error: 'Número de telefone do destinatário inválido.' };
  }

  const sendEndpoint = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const res = await fetchWithCorsFallback(sendEndpoint, {
    method: 'POST',
    headers: { apikey: apiKey.trim() },
    body: {
      number,
      text,
      delay: 1200, // delay de 1.2s para humanização (digitando...)
      linkPreview: true
    }
  });

  if (!res.ok) {
    const errMsg = res.data?.response?.message || res.data?.message || res.data?.error || `Falha HTTP ${res.status}`;
    return { success: false, error: errMsg };
  }

  const messageId = res.data?.key?.id || res.data?.id || 'sent';
  return { success: true, messageId };
}

// 4. Desconectar / Fazer Logout da Instância
export async function logoutEvolutionInstance(
  rawUrl: string,
  rawInstance: string,
  apiKey: string
): Promise<boolean> {
  const baseUrl = cleanBaseUrl(rawUrl);
  const instance = cleanInstanceName(rawInstance);
  if (!baseUrl || !instance) return false;

  const endpoint = `${baseUrl}/instance/logout/${encodeURIComponent(instance)}`;
  const res = await fetchWithCorsFallback(endpoint, {
    method: 'DELETE',
    headers: { apikey: apiKey.trim() }
  });

  return res.ok;
}
