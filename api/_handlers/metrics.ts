import { supabase } from '../lib/supabaseClient';

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
      allRows('contacts', 'phone, status, opt_out_detected, created_at'),
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

    return res.status(200).json({
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
      porDia: Object.entries(porDia).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30).map(([dia, v]) => ({ dia, ...v })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao calcular métricas.' });
  }
}
