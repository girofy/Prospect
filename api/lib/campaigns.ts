// Campanhas: uma lista de empresas + uma missão + um horário. O prospector só envia para quem está
// numa campanha ATIVA. Sem campanha ativa, nada sai. Respostas a quem escreve continuam sempre ligadas.
import { db } from './db';
import { Contact } from './types';
import { isRealBrPhone, last8 } from './phone';

export interface Campaign {
  id: string;
  name: string;
  mission: string;
  objective: string;
  status: 'rascunho' | 'ativa' | 'pausada';
  phones: string[];
  dailyCap: number;
  endHour: number; // hora decimal em que a campanha para (ex.: 18.5 = 18h30)
  createdAt: string;
}

export const AUTO_RE = /(mensagem autom[aá]tica|resposta autom[aá]tica|no momento (n[aã]o|estamos)|estamos (descansando|fora|ausentes)|fora do (nosso )?hor[aá]rio|hor[aá]rio de (atendimento|funcionamento)|responderemos (assim|em breve|o mais)|retornaremos|agradecemos (a |sua |o seu |pelo |pela )?(sua )?(mensagem|contato)|seja (muito )?bem[- ]?vind|obrigad[oa] por (entrar em contato|sua mensagem|nos contatar|escolher)|n[aã]o estamos dispon[ií]veis|logo (te )?responderemos|em breve (retornaremos|responderemos|daremos|um de nossos))/i;
const PRICE_RE = /(quanto (custa|fica|sai|é|e)\b|pre[cç]o|valor|or[cç]amento|pr[eé]via|quero (ver|fechar|contratar)|manda (ver|a[ií])|pode (mandar|montar))/i;

export async function getCampaigns(): Promise<Campaign[]> {
  const cfg: any = await db.getConfig();
  return Array.isArray(cfg.campaigns) ? cfg.campaigns : [];
}
export async function saveCampaigns(list: Campaign[]): Promise<void> {
  await db.saveConfig({ campaigns: list } as any);
}
export function activeCampaign(list: Campaign[]): Campaign | undefined {
  return list.find(c => c.status === 'ativa');
}
export async function campaignFor(phone: string): Promise<Campaign | undefined> {
  const k = last8(phone);
  return (await getCampaigns()).find(c => c.phones.some(p => last8(p) === k));
}

function cleanPhone(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export interface ImportRow { phone: string; company?: string; name?: string; notes?: string }

export async function importRows(camp: Campaign, rows: ImportRow[]): Promise<{ added: number; skipped: { phone: string; motivo: string }[] }> {
  const skipped: { phone: string; motivo: string }[] = [];
  let added = 0;
  const existing = await db.getContacts();
  const byKey = new Map(existing.map(c => [last8(c.phone), c]));
  const base = Date.now();
  for (const r of rows) {
    const phone = cleanPhone(r.phone);
    if (!isRealBrPhone(phone)) { skipped.push({ phone: String(r.phone), motivo: 'telefone inválido' }); continue; }
    const k = last8(phone);
    if (camp.phones.some(p => last8(p) === k)) { skipped.push({ phone, motivo: 'já está nesta campanha' }); continue; }
    const found = byKey.get(k);
    if (found && found.status !== 'novo') { skipped.push({ phone, motivo: `já tem abordagem (${found.status})` }); continue; }
    if (!found && (await db.hasHistoryWith(phone))) { skipped.push({ phone, motivo: 'já existe conversa' }); continue; }
    if (!found) {
      const now = new Date(base + added).toISOString();
      await db.saveContact({
        id: `lead-${phone}`, phone, name: r.name || `Contato ${phone.slice(-4)}`, company: (r.company || 'Em qualificação').slice(0, 80),
        niche: undefined, role: 'decisor', status: 'novo', agentState: 'ai_active', optOutDetected: false,
        notes: r.notes ? r.notes.slice(0, 700) : undefined, lastInteractionAt: now, createdAt: now,
      } as Contact);
    }
    camp.phones.push(phone);
    added++;
  }
  return { added, skipped };
}

// Funil por campanha, direto das mensagens (sem IA, sem gastar cota).
export async function campaignStats() {
  const [list, contacts, messages] = await Promise.all([getCampaigns(), db.getContacts(), db.getMessages()]);
  const cfg: any = await db.getConfig();
  const byPhone = new Map<string, { bot: number; lead: number; human: number; hot: boolean }>();
  for (const m of messages) {
    const k = last8(m.contactPhone);
    const e = byPhone.get(k) || { bot: 0, lead: 0, human: 0, hot: false };
    if (m.from === 'bot') e.bot++;
    else if (m.from === 'lead') {
      e.lead++;
      if (!AUTO_RE.test(m.text || '')) e.human++;
      if (PRICE_RE.test(m.text || '')) e.hot = true;
    }
    byPhone.set(k, e);
  }
  const cbyKey = new Map(contacts.map(c => [last8(c.phone), c]));
  return {
    campaigns: list.map(c => {
      let enviadas = 0, responderam = 0, conversa = 0, interesse = 0, fechou = 0, naFila = 0;
      for (const p of c.phones) {
        const k = last8(p);
        const e = byPhone.get(k);
        const ct = cbyKey.get(k);
        if (e && e.bot > 0) enviadas++;
        else if (ct && ct.status === 'novo' && ct.agentState === 'ai_active' && !ct.optOutDetected) naFila++;
        if (e && e.human > 0) responderam++;
        if (e && e.human > 1) conversa++;
        if (e && e.hot) interesse++;
        if (ct && ct.status === 'reuniao_marcada') fechou++;
      }
      return { ...c, total: c.phones.length, naFila, funil: { enviadas, responderam, conversa, interesse, fechou } };
    }),
    hoje: { enviadas: cfg.prospectDay ? cfg.prospectSentToday || 0 : 0 },
  };
}

// Detalhe de uma campanha: cada empresa e em que ponto do funil ela está.
export async function campaignDetail(id: string) {
  const list = await getCampaigns();
  const camp = list.find(c => c.id === id);
  if (!camp) return null;
  const [contacts, messages] = await Promise.all([db.getContacts(), db.getMessages()]);
  const cbyKey = new Map(contacts.map(c => [last8(c.phone), c]));
  const info = new Map<string, { bot: number; human: number; hot: boolean; firstBot?: string; last?: string; lastText?: string }>();
  for (const m of messages) {
    const k = last8(m.contactPhone);
    const e = info.get(k) || { bot: 0, human: 0, hot: false };
    if (m.from === 'bot') { e.bot++; if (!e.firstBot) e.firstBot = m.timestamp; }
    else if (m.from === 'lead' && !AUTO_RE.test(m.text || '')) { e.human++; if (PRICE_RE.test(m.text || '')) e.hot = true; }
    if (!e.last || m.timestamp > e.last) { e.last = m.timestamp; e.lastText = (m.text || '').slice(0, 90); }
    info.set(k, e);
  }
  const rows = camp.phones.map(p => {
    const k = last8(p);
    const c = cbyKey.get(k);
    const e = info.get(k);
    let estado = 'na fila';
    if (c && (c.optOutDetected || c.status === 'bloqueado')) estado = 'pediu para sair';
    else if (c && c.status === 'reuniao_marcada') estado = 'fechou';
    else if (e && e.hot) estado = 'interesse';
    else if (e && e.human > 1) estado = 'conversando';
    else if (e && e.human > 0) estado = 'respondeu';
    else if (e && e.bot > 0) estado = 'enviada';
    else if (c && c.status !== 'novo') estado = 'já tinha conversa';
    return { phone: p, empresa: c && c.company && c.company !== 'Em qualificação' ? c.company : (c ? c.name : p), estado, ultima: e?.lastText || '', quando: e?.last || '' };
  });
  return { campaign: camp, contatos: rows };
}
