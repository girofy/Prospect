import { db } from './db';
import { sendEvolutionText } from './evolution';

// Retomada: manda uma mensagem de cada vez para uma lista que o dono aprovou.
// Só roda entre 7h e 8h45 (Bahia), espaça de 3 a 6 minutos e respeita a pausa da prospecção.
// Não passa pela trava de histórico da prospecção: é justamente o caso em que o contato já conversou.
const JANELA_INI = 7;
const JANELA_FIM = 8.75;
let running = false;

function horaBahia(): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = Number(p.find(x => x.type === 'hour')?.value || 0);
  const m = Number(p.find(x => x.type === 'minute')?.value || 0);
  return h + m / 60;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const cfg = await db.getConfig();
    const fila = cfg.retomadaQueue || [];
    if (!fila.length) return;
    if (cfg.prospectorPaused) return;
    const h = horaBahia();
    if (h < JANELA_INI || h >= JANELA_FIM) return;
    const proximo = cfg.retomadaNextAt ? Date.parse(cfg.retomadaNextAt) : 0;
    if (Date.now() < proximo) return;

    const [item, ...resto] = fila;
    const res = await sendEvolutionText(item.phone, item.text, 2500);
    const quem = item.name || item.phone;
    await db.addAuditLog({
      type: 'status_change',
      phone: item.phone,
      summary: res.success ? `Retomada enviada para ${quem}` : `Retomada falhou para ${quem}: ${String(res.error).slice(0, 80)}`,
    });
    if (res.success) {
      await db.saveMessage({
        id: `out-retomada-${res.messageId || Date.now()}`,
        contactPhone: item.phone.split('@')[0],
        from: 'bot',
        text: item.text,
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sent',
      } as any);
    }
    const espera = (3 + Math.random() * 3) * 60_000;
    await db.saveConfig({ retomadaQueue: resto, retomadaNextAt: new Date(Date.now() + espera).toISOString() });
  } catch (err) {
    console.warn('[Retomada]', err);
  } finally {
    running = false;
  }
}

export function startRetomada() {
  setInterval(tick, 20_000);
  void tick();
}
