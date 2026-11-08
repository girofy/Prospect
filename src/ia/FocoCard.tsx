import { useEffect, useState } from 'react';
import { Card } from './ui';

// Sistema mental: uma coisa só para hoje, checklist que se marca sozinho com os dados reais,
// a cobrinha do calendário (dias seguidos com prospecção) e o pote de biscoito (cada resposta é uma vitória guardada).

interface Dia { dia: string; enviadas: number; respostas: number; abordagens: number }
interface Vitoria { quando: string; quem: string; tipo: string }
interface Metrics {
  agente: { enviados_hoje: number; teto_diario: number; na_fila: number; dentro_da_janela: boolean; whatsapp: string };
  porDia: Dia[];
  vitorias: Vitoria[];
  vitorias_total: number;
  aguardando_voce: number;
}

const TZ = 'America/Bahia';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const shortDay = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: 'numeric' }).format(new Date(iso)).replace('.', '');

export default function FocoCard() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/metrics').then(r => (r.ok ? r.json() : null)).then(j => { if (alive && j) setM(j); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!m) return <Card><div className="h-40 animate-pulse rounded-2xl bg-black/[0.04]" /></Card>;

  const byDay = new Map<string, Dia>(m.porDia.map(d => [d.dia, d]));
  const today = dayKey(new Date());
  const hoje = byDay.get(today);
  const respostasHoje = hoje?.respostas || 0;

  // Últimos 28 dias, do mais antigo ao de hoje
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86_400_000);
    const k = dayKey(d);
    const v = byDay.get(k);
    return { k, ab: v?.abordagens || 0, resp: v?.respostas || 0, isToday: k === today };
  });
  // Cobrinha: dias seguidos com prospecção, contando de hoje para trás (hoje ainda vazio não quebra a sequência)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].ab > 0) streak++;
    else if (days[i].isToday) continue;
    else break;
  }

  // Semana corrente (segunda a domingo)
  const dow = (new Date(new Date().toLocaleString('en-US', { timeZone: TZ })).getDay() + 6) % 7;
  const semana = days.slice(days.length - 1 - dow);
  const abSemana = semana.reduce((a, d) => a + d.ab, 0);
  const respSemana = semana.reduce((a, d) => a + d.resp, 0);
  const metaSemana = m.agente.teto_diario * 5;
  const pctSemana = Math.min(100, Math.round((abSemana / Math.max(1, metaSemana)) * 100));

  const unica =
    m.aguardando_voce > 0 ? `Responder ${m.aguardando_voce} ${m.aguardando_voce === 1 ? 'lead que pediu' : 'leads que pediram'} você.`
    : m.agente.whatsapp !== 'open' ? 'Reconectar o WhatsApp. Sem ele, nada sai.'
    : m.agente.na_fila === 0 ? 'Colocar mais empresas na fila.'
    : 'Nada além de olhar as respostas. O agente está prospectando por você.';

  const checks = [
    { ok: m.agente.whatsapp === 'open', t: 'WhatsApp conectado' },
    { ok: m.agente.enviados_hoje > 0, t: 'Prospecção rodou hoje' },
    { ok: respostasHoje > 0, t: 'Alguém respondeu hoje' },
    { ok: m.aguardando_voce === 0, t: 'Ninguém esperando você' },
    { ok: m.agente.enviados_hoje >= m.agente.teto_diario, t: `Meta do dia (${m.agente.teto_diario})` },
  ];
  const feitos = checks.filter(c => c.ok).length;

  const jar = Math.min(m.vitorias_total, 40);

  return (
    <div className="space-y-4">
      {/* A única coisa */}
      <Card>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6e6e73]">A única coisa de hoje</p>
        <p className="text-[20px] leading-snug font-bold text-[#1D1D1F] mt-1 [text-wrap:balance]">{unica}</p>
      </Card>

      {/* Checklist */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-[#1D1D1F]">Checklist do dia</h2>
          <span className="text-[13px] font-bold tabular-nums text-[#1D1D1F]">{feitos} de {checks.length}</span>
        </div>
        <ul className="space-y-2">
          {checks.map(c => (
            <li key={c.t} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-black transition-colors ${c.ok ? 'bg-[#34C759] text-white' : 'border-2 border-black/15 text-transparent'}`} aria-hidden>✓</span>
              <span className={`text-[15px] ${c.ok ? 'text-[#1D1D1F] font-semibold' : 'text-[#6e6e73]'}`}>{c.t}</span>
              <span className="sr-only">{c.ok ? 'feito' : 'pendente'}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-[#6e6e73] mt-3">Os itens se marcam sozinhos com o que o sistema fez.</p>
      </Card>

      {/* Cobrinha + meta da semana */}
      <Card>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">Sequência</h2>
            <p className="text-[12px] text-[#6e6e73]">Cada quadrado verde é um dia com prospecção.</p>
          </div>
          <div className="text-right">
            <div className="text-[28px] leading-none font-black tabular-nums text-[#1D1D1F]">{streak}</div>
            <div className="text-[11px] text-[#6e6e73]">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Últimos 28 dias, ${streak} dias seguidos com prospecção`}>
          {days.map(d => (
            <div
              key={d.k}
              title={`${d.k}: ${d.ab} abordagens, ${d.resp} respostas`}
              className={`aspect-square rounded-md ${d.ab === 0 ? 'bg-black/[0.06]' : d.resp > 0 ? 'bg-[#34C759]' : 'bg-[#34C759]/45'} ${d.isToday ? 'ring-2 ring-[#0071E3] ring-offset-1' : ''}`}
            />
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-[#1D1D1F]">Meta da semana</span>
            <span className="tabular-nums text-[#6e6e73]">{abSemana} de {metaSemana} abordagens · {respSemana} respostas</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-black/[0.06] overflow-hidden" role="progressbar" aria-label="Meta da semana" aria-valuenow={pctSemana} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#0071E3] transition-[width] duration-700" style={{ width: `${pctSemana}%` }} />
          </div>
        </div>
      </Card>

      {/* Pote de biscoito */}
      <Card>
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 64 80" className="w-16 h-20 shrink-0" aria-hidden>
            <rect x="14" y="2" width="36" height="8" rx="3" fill="#C7A27A" />
            <path d="M10 14 h44 a4 4 0 0 1 4 4 v52 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 v-52 a4 4 0 0 1 4 -4z" fill="#EAF4FF" stroke="#0071E3" strokeOpacity=".35" strokeWidth="2" />
            {Array.from({ length: jar }, (_, i) => {
              const row = Math.floor(i / 5), col = i % 5;
              return <circle key={i} cx={17 + col * 7.5 + (row % 2) * 3} cy={72 - row * 7} r="3.2" fill="#C7843F" />;
            })}
          </svg>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6e6e73]">Pote de biscoito</p>
            <div className="text-[28px] leading-none font-black tabular-nums text-[#1D1D1F] mt-1">{m.vitorias_total}</div>
            <p className="text-[13px] text-[#6e6e73]">pessoas responderam a você. Cada uma é prova de que funciona.</p>
          </div>
        </div>
        {m.vitorias.length > 0 && (
          <ul className="mt-4 divide-y divide-black/[0.05]">
            {m.vitorias.slice(0, 5).map((v, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3 text-[14px]">
                <span className="truncate text-[#1D1D1F]">{v.tipo === 'reuniao' ? 'Reunião: ' : ''}{v.quem}</span>
                <span className="shrink-0 text-[12px] text-[#6e6e73] capitalize">{shortDay(v.quando)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
