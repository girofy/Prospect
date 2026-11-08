import { supabase } from '../lib/supabaseClient';
import { db } from '../lib/db';
import { getEvolutionState } from '../lib/evolution';
import { getProspectStats } from '../lib/prospector';

// Métricas do painel, calculadas direto no banco. Não usa IA, então não gasta cota.
// Protegida pelo login (ver api/index.ts).

function bahiaHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bahia', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  return Number(h);
}

function bahiaDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

async function allRows(table: string, cols: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const [contacts, messages, learnings] = await Promise.all([
      allRows('contacts', 'phone, name, company, status, opt_out_detected, created_at, last_interaction_at'),
      allRows('messages', 'contact_phone, "from", type, "timestamp"'),
      allRows('learnings', 'outcome, created_at'),
    ]);

    const byPhone = new Map<string, { bot: number; operator: number; lead: number; audio: number; image: number; first: string; last: string; firstFrom: string }>();
    for (const m of messages) {
      const c = byPhone.get(m.contact_phone) || { bot: 0, operator: 0, lead: 0, audio: 0, image: 0, first: m.timestamp, last: m.timestamp, firstFrom: m.from };
      if (m.from === 'bot') c.bot++;
      else if (m.from === 'operator') c.operator++;
      else c.lead++;
      if (m.type === 'audio') c.audio++;
      if (m.type === 'image') c.image++;
      if (m.timestamp < c.first) { c.first = m.timestamp; c.firstFrom = m.from; }
      if (m.timestamp > c.last) c.last = m.timestamp;
      byPhone.set(m.contact_phone, c);
    }

    // Pote de biscoito: cada lead que respondeu a uma conversa nossa é uma vitória, com a data da primeira resposta.
    const firstLead = new Map<string, string>();
    for (const m of messages) {
      if (m.from !== 'lead') continue;
      const f = firstLead.get(m.contact_phone);
      if (!f || m.timestamp < f) firstLead.set(m.contact_phone, m.timestamp);
    }
    const contactBy = new Map(contacts.map((c: any) => [c.phone, c]));
    const label = (c: any, phone: string) => {
      const company = c?.company && c.company !== 'Em qualificação' ? c.company : '';
      const name = c?.name && !/^contato /i.test(c.name) ? c.name : '';
      return company || name || `final ${phone.slice(-4)}`;
    };
    const vitorias: { quando: string; quem: string; tipo: string }[] = [];
    for (const [phone, c] of byPhone) {
      if (c.firstFrom === 'lead' || c.lead === 0) continue;
      const when = firstLead.get(phone);
      if (when) vitorias.push({ quando: when, quem: label(contactBy.get(phone), phone), tipo: 'respondeu' });
    }
    for (const c of contacts as any[]) {
      if (c.status === 'reuniao_marcada') vitorias.push({ quando: c.last_interaction_at || c.created_at, quem: label(c, c.phone), tipo: 'reuniao' });
    }
    vitorias.sort((a, b) => (a.quando < b.quando ? 1 : -1));
    // Abordagens por dia: conversas que nós começamos, contadas no dia da primeira mensagem.
    const aberturas: Record<string, number> = {};
    for (const c of byPhone.values()) {
      if (c.firstFrom === 'lead') continue;
      const d = bahiaDay(c.first);
      aberturas[d] = (aberturas[d] || 0) + 1;
    }

    const conversas = [...byPhone.values()];
    const comTroca = conversas.filter(c => c.lead > 0 && (c.bot > 0 || c.operator > 0));
    // Taxa de resposta correta: só conversas que NÓS começamos (primeira mensagem nossa), e quantas tiveram resposta do lead
    const iniciadasPorNos = conversas.filter(c => c.firstFrom !== 'lead' && (c.bot > 0 || c.operator > 0)).length;
    const responderam = conversas.filter(c => c.firstFrom !== 'lead' && c.lead > 0).length;

    // Respostas de leads por hora do dia (horário de Bahia): onde a conversa "pega"
    const porHora: number[] = Array(24).fill(0);
    const porDia: Record<string, { enviadas: number; respostas: number }> = {};
    for (const m of messages) {
      const dia = bahiaDay(m.timestamp);
      porDia[dia] = porDia[dia] || { enviadas: 0, respostas: 0 };
      if (m.from === 'lead') {
        porHora[bahiaHour(m.timestamp)]++;
        porDia[dia].respostas++;
      } else {
        porDia[dia].enviadas++;
      }
    }

    // Separação: o agente (mensagem 'bot') começou vs. você começou à mão ('operator' como primeira mensagem)
    const agenteIniciou = conversas.filter(c => c.firstFrom === 'bot').length;
    const agenteRespondido = conversas.filter(c => c.firstFrom === 'bot' && c.lead > 0).length;
    const manualIniciou = conversas.filter(c => c.firstFrom === 'operator').length;

    const status: Record<string, number> = {};
    for (const c of contacts) status[c.status] = (status[c.status] || 0) + 1;

    const desfechos: Record<string, number> = {};
    for (const l of learnings) desfechos[l.outcome] = (desfechos[l.outcome] || 0) + 1;

    // Tempo até a primeira resposta de cada lead (só quando há mensagem nossa antes dela)
    const porTelefone = new Map<string, any[]>();
    for (const m of messages) {
      const arr = porTelefone.get(m.contact_phone) || [];
      arr.push(m);
      porTelefone.set(m.contact_phone, arr);
    }
    const tempos: number[] = [];
    for (const arr of porTelefone.values()) {
      arr.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
      const primeiraNossa = arr.find(m => m.from !== 'lead');
      if (!primeiraNossa) continue;
      const primeiraResposta = arr.find(m => m.from === 'lead' && m.timestamp > primeiraNossa.timestamp);
      if (primeiraResposta) {
        tempos.push((Date.parse(primeiraResposta.timestamp) - Date.parse(primeiraNossa.timestamp)) / 60000);
      }
    }
    tempos.sort((a, b) => a - b);
    const mediana = tempos.length ? Math.round(tempos[Math.floor(tempos.length / 2)]) : null;

    const audios = messages.filter(m => m.type === 'audio' && m.from === 'lead').length;
    const imagens = messages.filter(m => m.type === 'image' && m.from === 'lead').length;

    // Estado do agente: WhatsApp, cota da IA e prospecção do dia
    const [whatsapp, cfg, stats] = await Promise.all([getEvolutionState(), db.getConfig(), getProspectStats()]);
    const hoje = bahiaDay(new Date().toISOString());
    const limite = Number(process.env.GEMINI_DAILY_CALL_LIMIT ?? 200);
    const pausados = Object.entries(cfg.aiPausedModels || {})
      .filter(([, until]) => Date.parse(String(until)) > Date.now())
      .map(([k]) => k);
    const cadeia = (cfg.aiChain && cfg.aiChain.length ? cfg.aiChain : null);

    return res.status(200).json({
      agente: {
        whatsapp,
        ia_usadas_hoje: cfg.aiUsageDay === hoje ? cfg.aiUsageCount || 0 : 0,
        ia_limite: limite,
        modelos_pausados: pausados,
        modelos: cadeia,
        enviados_hoje: stats.sentToday,
        teto_diario: stats.dailyCap,
        na_fila: stats.queue,
        dentro_da_janela: stats.inWindow,
      },
      resumo: {
        contatos: contacts.length,
        conversas_iniciadas: iniciadasPorNos,
        conversas_com_resposta: responderam,
        taxa_de_resposta: iniciadasPorNos ? Math.round((responderam / iniciadasPorNos) * 100) : 0,
        conversas_com_troca: comTroca.length,
        mensagens_totais: messages.length,
        opt_outs: contacts.filter(c => c.opt_out_detected).length,
        iniciadas_pelo_agente: agenteIniciou,
        respostas_ao_agente: agenteRespondido,
        taxa_do_agente: agenteIniciou ? Math.round((agenteRespondido / agenteIniciou) * 100) : 0,
        iniciadas_manualmente: manualIniciou,
        mediana_minutos_ate_resposta: mediana,
        audios_recebidos: audios,
        imagens_recebidas: imagens,
      },
      status,
      desfechos,
      porHora,
      vitorias: vitorias.slice(0, 60),
      vitorias_total: vitorias.length,
      aguardando_voce: (contacts as any[]).filter(c => c.status === 'aguardando_humano').length,
      porDia: Object.entries(porDia).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-35).map(([dia, v]) => ({ dia, ...v, abordagens: aberturas[dia] || 0 })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao calcular métricas.' });
  }
}
