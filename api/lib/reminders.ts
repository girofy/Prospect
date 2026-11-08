// Alarmes pedidos pelo dono na conversa: "daqui a 5 minutos me avisa", "amanhã 6h30 começa a prospectar".
// A cada 30 s confere o que venceu e executa. Só faz três coisas: lembrar o dono, retomar ou pausar a prospecção.
import { db } from './db';
import { sendEvolutionText } from './evolution';
import { OWNER_PHONE } from './owner';

let running = false;
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const cfg = await db.getConfig();
    const list = cfg.ownerReminders || [];
    if (!list.length) return;
    const due = list.filter(r => Date.parse(r.at) <= Date.now());
    if (!due.length) return;

    // Tira da lista antes de executar, para um erro de envio nunca repetir o alarme.
    await db.saveConfig({ ownerReminders: list.filter(r => !due.includes(r)) });
    for (const r of due) {
      const atraso = Date.now() - Date.parse(r.at) > 10 * 60_000 ? ' (atrasado: o servidor estava dormindo)' : '';
      if (r.todo === 'retomar') {
        await db.saveConfig({ prospectorPaused: false });
        await sendEvolutionText(OWNER_PHONE, `Prospecção retomada, como você pediu${atraso}. Ela só envia dentro da janela de horário.`, 1000);
      } else if (r.todo === 'pausar') {
        await db.saveConfig({ prospectorPaused: true });
        await sendEvolutionText(OWNER_PHONE, `Prospecção pausada, como você pediu${atraso}.`, 1000);
      } else {
        await sendEvolutionText(OWNER_PHONE, `${r.message}${atraso}`, 1000);
      }
      await db.addAuditLog({ type: 'status_change', summary: `Alarme executado: ${r.todo} (${r.message.slice(0, 60)})` });
    }
  } catch (err) {
    console.error('[Alarmes] falhou:', err);
  } finally {
    running = false;
  }
}

export function startReminders(): void {
  setInterval(tick, 30_000);
  console.log('[Alarmes] ativos');
}
