// Modo dono: você conversa com o agente pelo seu WhatsApp pessoal.
// - Quem é você: pelo número. Só o número tem essa função; a conversa não muda isso.
// - O modelo conversa e escolhe UMA ação de uma lista fixa. Quem executa é este código.
// - Começar a prospecção exige um "sim" seu logo depois do pedido (confirmação de 10 min), sem senha.
import { db } from './db';
import { getProspectStats } from './prospector';
import { last8 } from './phone';
import { generateOwnerReply, OwnerAction } from './gemini';

export const OWNER_PHONE = (process.env.OWNER_PHONE || '5574981017188').replace(/\D/g, '');
const CONFIRM_MIN = 10;
const MAX_TURNS = 8;

// Memória curta da conversa com você (some ao reiniciar o servidor; é só para contexto imediato).
const ownerTurns: { from: 'owner' | 'bot'; text: string }[] = [];

export function isOwner(phone: string): boolean {
  return last8(phone) === last8(OWNER_PHONE);
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function snapshot(): Promise<string> {
  const s = await getProspectStats();
  const bahia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' });
  return [
    `- Hora em Salvador: ${bahia}`,
    `- Prospecção: ${s.paused ? 'PAUSADA' : 'ativa'}`,
    `- Janela de envio (8h-19h): ${s.inWindow ? 'dentro' : 'fora'}`,
    `- Hoje: ${s.sentToday} de ${s.dailyCap} abordagens enviadas`,
    `- Fila com telefone válido: ${s.queue}${s.queue === 0 ? ' (vazia: falta lista com telefone)' : ''}`,
    `- Leads em conversa: ${s.inConversation}; responderam: ${s.replied}`,
  ].join('\n');
}

export async function handleOwnerMessage(raw: string): Promise<string> {
  const text = raw.trim();
  const n = norm(text);
  const cfg = await db.getConfig();

  // Confirmação pendente (ex.: "começar a prospecção"): só um sim/não resolve.
  const pendingOk = cfg.ownerPending === 'resume' && Date.parse(cfg.ownerPendingUntil || '') > Date.now();
  if (pendingOk) {
    if (/^(sim|s|pode|confirma|confirmo|isso|bora|manda|vai|claro|ok|beleza)\b/.test(n)) {
      await db.saveConfig({ prospectorPaused: false, ownerPending: '', ownerPendingUntil: '' });
      await db.addAuditLog({ type: 'status_change', summary: 'Dono confirmou: prospecção retomada.' });
      return 'Feito. Prospecção retomada, dentro do horário e do limite do dia.';
    }
    if (/^(nao|não|cancela|deixa|para|nem)\b/.test(n)) {
      await db.saveConfig({ ownerPending: '', ownerPendingUntil: '' });
      return 'Ok, a prospecção continua pausada.';
    }
  }

  const ai = await generateOwnerReply(text, ownerTurns, await snapshot());
  if (!ai) return 'Não consegui pensar agora (IA indisponível ou sem cota). Tenta de novo daqui a pouco.';

  const action: OwnerAction = ai.action;
  if (action === 'pause') {
    await db.saveConfig({ prospectorPaused: true, ownerPending: '', ownerPendingUntil: '' });
    await db.addAuditLog({ type: 'status_change', summary: 'Dono pediu pausa da prospecção (conversa).' });
  } else if (action === 'resume') {
    await db.saveConfig({ ownerPending: 'resume', ownerPendingUntil: new Date(Date.now() + CONFIRM_MIN * 60_000).toISOString() });
    await db.addAuditLog({ type: 'status_change', summary: 'Dono pediu retomada da prospecção: aguardando "sim".' });
  }

  ownerTurns.push({ from: 'owner', text }, { from: 'bot', text: ai.reply });
  while (ownerTurns.length > MAX_TURNS * 2) ownerTurns.shift();
  return ai.reply;
}
