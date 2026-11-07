// Modo dono: você controla o agente pelo seu WhatsApp pessoal. Comandos fixos, nunca texto livre.
// - pausar / status: livres (são ações seguras e de leitura).
// - começar a prospecção: só depois de mandar a senha (OWNER_PIN), liberada por 30 minutos.
// O modelo de IA nunca executa nada: a mensagem é lida aqui, por regras fixas.
import { db } from './db';
import { getProspectStats } from './prospector';
import { last8 } from './phone';

export const OWNER_PHONE = (process.env.OWNER_PHONE || '5574981017188').replace(/\D/g, '');
const UNLOCK_MIN = 30;

export function isOwner(phone: string): boolean {
  return last8(phone) === last8(OWNER_PHONE);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const HELP = 'Comandos: "status", "pausa" (para a prospecção), "senha 123456" (libera 30 min), "começa" (retoma a prospecção, precisa de senha), "trava" (fecha o modo dono).';

export async function handleOwnerMessage(raw: string): Promise<string> {
  const n = norm(raw);
  const cfg = await db.getConfig();
  const unlocked = !!cfg.ownerUnlockedUntil && Date.parse(cfg.ownerUnlockedUntil) > Date.now();

  const pin = n.match(/(?:senha|pin)\D{0,3}(\d{4,8})/);
  if (pin) {
    const expected = (process.env.OWNER_PIN || '').trim();
    if (!expected) return 'Modo dono desligado: falta a variável OWNER_PIN no Render.';
    if (pin[1] !== expected) {
      await db.addAuditLog({ type: 'error', phone: OWNER_PHONE, summary: 'Senha errada no modo dono.' });
      return 'Senha errada.';
    }
    await db.saveConfig({ ownerUnlockedUntil: new Date(Date.now() + UNLOCK_MIN * 60_000).toISOString() });
    return `Liberado por ${UNLOCK_MIN} minutos. Pode mandar "começa" ou "pausa".`;
  }

  if (/\b(trava|travar|fecha|bloqueia)\b/.test(n)) {
    await db.saveConfig({ ownerUnlockedUntil: '' });
    return 'Travado. Para começar a prospecção de novo, mande a senha.';
  }

  if (/^(ajuda|comandos|help)\b/.test(n)) return HELP;

  if (/\b(status|resumo|como esta|quantos)\b/.test(n)) {
    const s = await getProspectStats();
    const prosp = s.paused ? 'PAUSADA' : 'ativa';
    const fila = s.queue === 0 ? 'fila vazia (nada para prospectar; falta lista com telefone)' : `${s.queue} na fila`;
    return `Prospecção ${prosp}. Hoje: ${s.sentToday}/${s.dailyCap} abordagens. ${fila}. Em conversa: ${s.inConversation}. Responderam: ${s.replied}. Janela: ${s.window}${s.inWindow ? ' (dentro do horário)' : ' (fora do horário)'}.`;
  }

  if (/\b(pausa|pausar|pausa tudo|para tudo|para a prospeccao|para prospeccao|para de prospectar)\b/.test(n)) {
    await db.saveConfig({ prospectorPaused: true });
    return 'Prospecção pausada. As respostas aos leads continuam normais.';
  }

  if (/\b(comeca|inicia|iniciar|retoma|retomar|continua|roda|liga)\b/.test(n)) {
    if (!unlocked) return 'Pra começar a prospecção, mande a senha primeiro.';
    await db.saveConfig({ prospectorPaused: false });
    return 'Prospecção retomada. Ela só envia dentro da janela de horário e respeitando o limite do dia.';
  }

  return `Não entendi. ${HELP}`;
}
