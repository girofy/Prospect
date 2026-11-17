import { sendEvolutionText } from './evolution';

// Aviso para o dono que NÃO depende só do WhatsApp: vai também para um push no celular (ntfy.sh).
// Configuração: env NTFY_TOPIC (um nome secreto). O conteúdo é mínimo de propósito: sem telefone e sem texto de conversa.
const TOPIC = (process.env.NTFY_TOPIC || '').trim();
const OWNER = (process.env.OWNER_PHONE || '5574981017188').replace(/\D/g, '');

export async function pushOwner(title: string, text: string, urgent = false): Promise<boolean> {
  if (!TOPIC) return false;
  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(TOPIC)}`, {
      method: 'POST',
      headers: { Title: encodeURIComponent(title).slice(0, 200), Priority: urgent ? '4' : '3', Tags: urgent ? 'rotating_light' : 'bell' },
      body: text.slice(0, 400),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Alerta] push falhou:', String((err as any)?.message || err).slice(0, 120));
    return false;
  }
}

// Push sempre; WhatsApp também, só se o texto completo for pedido (se o número estiver fora do ar, o push garante o aviso).
export async function alertOwner(opts: { title: string; push: string; whatsapp?: string; urgent?: boolean }): Promise<void> {
  const tasks: Promise<unknown>[] = [pushOwner(opts.title, opts.push, opts.urgent)];
  if (opts.whatsapp) tasks.push(sendEvolutionText(OWNER, opts.whatsapp, 800).catch(() => null));
  await Promise.allSettled(tasks);
}

// Vigia a conexão do WhatsApp: se cair, avisa uma vez (e avisa de novo quando voltar).
let lastState: string | null = null;
export function startConnectionWatch(getState: () => Promise<string | null>) {
  const tick = async () => {
    try {
      const st = await getState();
      if (!st) return;
      if (lastState !== null && st !== lastState) {
        if (st !== 'open') await pushOwner('WhatsApp caiu', 'O WhatsApp da Girofy desconectou. Nada é enviado nem recebido até reconectar.', true);
        else await pushOwner('WhatsApp voltou', 'O WhatsApp da Girofy reconectou.');
      }
      lastState = st;
    } catch { /* ignora: tenta de novo no próximo ciclo */ }
  };
  setInterval(tick, 5 * 60_000);
  void tick();
}
