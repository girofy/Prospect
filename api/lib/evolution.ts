// Cliente server-side da Evolution API (instância conectada no celular).
// Variáveis: EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE

export interface EvolutionCfg {
  url: string;
  apiKey: string;
  instance: string;
}

export function getEvolutionCfg(): EvolutionCfg | null {
  const url = (process.env.EVOLUTION_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.EVOLUTION_API_KEY || '').trim();
  const instance = (process.env.EVOLUTION_INSTANCE || 'prospectfy').trim();
  if (!url || !apiKey) return null;
  return { url, apiKey, instance };
}

export async function sendEvolutionText(
  phone: string,
  text: string,
  delayMs = 3000
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg = getEvolutionCfg();
  if (!cfg) {
    return { success: false, error: 'EVOLUTION_URL / EVOLUTION_API_KEY não configurados' };
  }

  try {
    const res = await fetch(`${cfg.url}/message/sendText/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
      body: JSON.stringify({ number: phone, text, delay: delayMs, linkPreview: false }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` };
    }
    return { success: true, messageId: data?.key?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha de rede na Evolution' };
  }
}

// Estado real da conexão do WhatsApp na Evolution ('open' = conectado). Nunca lança erro.
export async function getEvolutionState(): Promise<'open' | 'connecting' | 'close' | 'unknown'> {
  const cfg = getEvolutionCfg();
  if (!cfg) return 'unknown';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${cfg.url}/instance/connectionState/${encodeURIComponent(cfg.instance)}`, { headers: { apikey: cfg.apiKey }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return 'unknown';
    const j: any = await res.json();
    const st = j?.instance?.state;
    return st === 'open' || st === 'connecting' || st === 'close' ? st : 'unknown';
  } catch {
    return 'unknown';
  }
}

// Baixa a mídia (imagem/áudio) de uma mensagem recebida, em base64.
// Endpoint: POST /chat/getBase64FromMediaMessage/{instance} (Evolution v2).
export async function fetchEvolutionMedia(
  messageKey: { id: string; remoteJid: string; fromMe: boolean },
  message: any
): Promise<{ mimeType: string; data: string } | null> {
  const cfg = getEvolutionCfg();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(cfg.instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
      body: JSON.stringify({ message: { key: messageKey, message }, convertToMp4: false }),
    });
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    if (!json?.base64) return null;
    const mimeType = String(json.mimetype || '').split(';')[0] || (message?.audioMessage ? 'audio/ogg' : 'image/jpeg');
    // Remove prefixo data: se vier
    const data = String(json.base64).replace(/^data:[^;]+;base64,/, '');
    return { mimeType, data };
  } catch {
    return null;
  }
}

// Pedido de saída (LGPD). Frases claras; "sair" e "parar" só entram como pedido completo, não como palavra solta.
export const OPT_OUT_REGEX = /(não tenho interesse|nao tenho interesse|pare de (me )?mandar|para de (me )?mandar|pare de (me )?enviar|para de (me )?enviar|remove (meu|o meu) (contato|número|numero)|remover (meu )?contato|tirar (me|meu contato) da lista|não me (mande|envie|chame)|nao me (mande|envie|chame)|denunciar|desinscrever|me (tira|tire|remove) (daí|daqui|da lista)|nunca mais|^\s*(parar|stop|sair|cancelar)\s*[.!]*\s*$)/i;
