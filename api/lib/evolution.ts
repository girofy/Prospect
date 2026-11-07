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

export const OPT_OUT_REGEX = /(não tenho interesse|nao tenho interesse|pare de mandar|para de mandar|remove meu contato|remover contato|tirar da lista|não me mande|nao me mande|denunciar|spam|desinscrever|bloqueado|nunca mais)/i;
