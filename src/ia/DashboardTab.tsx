import { useEffect, useState, ReactNode } from 'react';
import { Users, MessageCircle, Reply, Clock, Mic, Image as ImageIcon, ShieldOff, Download, Wifi, WifiOff, Bot, Send } from 'lucide-react';
import { Card, SectionTitle, Pill, Dot, Ring, Btn, Skeleton, Empty, COLORS } from './ui';

type Metrics = {
  agente: {
    whatsapp: 'open' | 'connecting' | 'close' | 'unknown';
    ia_usadas_hoje: number; ia_limite: number; modelos_pausados: string[];
    enviados_hoje: number; teto_diario: number; na_fila: number; dentro_da_janela: boolean;
  };
  resumo: {
    contatos: number; conversas_iniciadas: number; conversas_com_resposta: number; taxa_de_resposta: number;
    iniciadas_pelo_agente: number; respostas_ao_agente: number; taxa_do_agente: number; iniciadas_manualmente: number;
    mediana_minutos_ate_resposta: number | null; audios_recebidos: number; imagens_recebidas: number; opt_outs: number;
    mensagens_totais: number; conversas_com_troca: number;
  };
  status: Record<string, number>;
  porHora: number[];
  porDia: { dia: string; enviadas: number; respostas: number }[];
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  novo: { label: 'Na fila', color: '#C7C7CC' },
  em_conversa: { label: 'Em conversa', color: COLORS.blue },
  aguardando_humano: { label: 'Precisa de você', color: COLORS.orange },
  reuniao_marcada: { label: 'Reunião marcada', color: COLORS.green },
  qualificado: { label: 'Qualificado', color: '#5E5CE6' },
  esfriou: { label: 'Esfriou', color: '#8E8E93' },
  bloqueado: { label: 'Pediu para sair', color: COLORS.red },
};

function fmtMin(m: number | null): string {
  if (m === null) return '—';
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}

async function download(format: 'csv' | 'json') {
  const res = await fetch(`/api/export?format=${format}`);
  if (!res.ok) return alert('Não foi possível baixar agora.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `conversas-girofy.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Kpi({ icon, label, value, sub, tone = COLORS.blue }: { icon: ReactNode; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="apple-card-sunken p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#86868B]">
        <span style={{ color: tone }} className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-[26px] leading-none font-bold tracking-tight text-[#1D1D1F] mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-[12px] text-[#86868B] mt-1.5 truncate">{sub}</div>}
    </div>
  );
}

export default function DashboardTab() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/metrics')
      .then(async r => {
        const j = await r.json();
        if (!alive) return;
        if (r.ok) setM(j);
        else setErr(j.error || 'Falha ao carregar.');
      })
      .catch(() => alive && setErr('Sem conexão com o servidor.'));
    return () => { alive = false; };
  }, []);

  if (err) return <Card><Empty title="Não consegui carregar" hint={err} /></Card>;
  if (!m) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-56" /><Skeleton className="h-48" /></div>;

  const { agente: a, resumo: r } = m;
  const wa = a.whatsapp === 'open' ? { tone: 'green' as const, text: 'WhatsApp conectado', icon: <Wifi className="w-3.5 h-3.5" /> }
    : a.whatsapp === 'connecting' ? { tone: 'orange' as const, text: 'Conectando…', icon: <Wifi className="w-3.5 h-3.5" /> }
    : a.whatsapp === 'close' ? { tone: 'red' as const, text: 'WhatsApp desconectado', icon: <WifiOff className="w-3.5 h-3.5" /> }
    : { tone: 'gray' as const, text: 'WhatsApp: sem leitura', icon: <WifiOff className="w-3.5 h-3.5" /> };
  const quotaUsed = a.ia_limite ? a.ia_usadas_hoje / a.ia_limite : 0;
  const iaTone = a.modelos_pausados.length ? 'orange' : 'green';

  // Funil
  const funil = [
    { label: 'Contatos', value: r.contatos, color: '#C7C7CC' },
    { label: 'Conversas iniciadas', value: r.conversas_iniciadas, color: COLORS.blue },
    { label: 'Responderam', value: r.conversas_com_resposta, color: '#5E5CE6' },
    { label: 'Reunião marcada', value: m.status.reuniao_marcada || 0, color: COLORS.green },
  ];
  const topFunil = Math.max(1, funil[0].value);

  // Horários
  const maxHora = Math.max(1, ...m.porHora);
  const pico = m.porHora.indexOf(Math.max(...m.porHora));
  const totalHora = m.porHora.reduce((x, y) => x + y, 0);

  // Últimos 14 dias
  const dias = m.porDia.slice(-14);
  const maxDia = Math.max(1, ...dias.flatMap(d => [d.enviadas, d.respostas]));

  // Status
  const stEntries = (Object.entries(m.status) as [string, number][]).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const stTotal = Math.max(1, stEntries.reduce((s, [, v]) => s + v, 0));

  return (
    <div className="space-y-4">
      {/* Estado do agente */}
      <Card>
        <div className="flex items-center gap-4">
          <Ring value={quotaUsed} size={64} stroke={8} color={quotaUsed > 0.85 ? COLORS.red : COLORS.blue}>
            {Math.round(quotaUsed * 100)}%
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-[#1D1D1F] flex items-center gap-2"><Bot className="w-4 h-4 text-[#0071E3]" /> Agente de IA</div>
            <div className="text-[13px] text-[#86868B] mt-0.5">Cota de hoje: {a.ia_usadas_hoje} de {a.ia_limite} respostas</div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              <Pill tone={wa.tone}>{wa.icon}{wa.text}</Pill>
              <Pill tone={iaTone}><Dot tone={iaTone} />{a.modelos_pausados.length ? `${a.modelos_pausados.length} modelo(s) sem cota` : 'Modelos disponíveis'}</Pill>
              <Pill tone={a.dentro_da_janela ? 'blue' : 'gray'}><Send className="w-3.5 h-3.5" />{a.enviados_hoje}/{a.teto_diario} abordagens hoje</Pill>
            </div>
          </div>
        </div>
        {a.whatsapp === 'close' && (
          <div className="mt-4 rounded-xl bg-[#FF3B30]/8 px-3.5 py-3 text-[13px] text-[#c42b22] font-medium">
            O WhatsApp está desconectado. Nada é enviado nem recebido até reconectar em Ajustes.
          </div>
        )}
      </Card>

      {/* Indicadores */}
      <Card>
        <SectionTitle title="Números principais" hint="Calculados das conversas guardadas. Não gastam cota de IA." />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi icon={<Users className="w-4 h-4" />} label="Contatos" value={r.contatos} sub={`${a.na_fila} na fila`} />
          <Kpi icon={<MessageCircle className="w-4 h-4" />} label="Iniciadas" value={r.conversas_iniciadas} sub={`${r.iniciadas_pelo_agente} pelo agente`} />
          <Kpi icon={<Reply className="w-4 h-4" />} label="Taxa de resposta" value={`${r.taxa_de_resposta}%`} sub={`${r.conversas_com_resposta} responderam`} tone={COLORS.green} />
          <Kpi icon={<Clock className="w-4 h-4" />} label="1ª resposta" value={fmtMin(r.mediana_minutos_ate_resposta)} sub="tempo mediano" tone={COLORS.orange} />
          <Kpi icon={<Mic className="w-4 h-4" />} label="Áudios" value={r.audios_recebidos} sub="o agente escuta" tone="#5E5CE6" />
          <Kpi icon={<ImageIcon className="w-4 h-4" />} label="Imagens" value={r.imagens_recebidas} sub="o agente enxerga" tone="#5E5CE6" />
        </div>
        {r.iniciadas_pelo_agente === 0 && (
          <p className="text-[12.5px] text-[#86868B] mt-3 leading-snug">
            Todas as conversas até aqui foram começadas por você, à mão. A taxa do agente aparece sozinha quando ele começar a prospectar.
          </p>
        )}
      </Card>

      {/* Funil */}
      <Card>
        <SectionTitle title="Funil" hint="Do contato até a reunião." />
        <div className="space-y-3.5">
          {funil.map((f, i) => {
            const prev = i === 0 ? null : funil[i - 1].value;
            const pct = prev ? Math.round((f.value / prev) * 100) : null;
            return (
              <div key={f.label}>
                <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                  <span className="font-semibold text-[#1D1D1F]">{f.label}</span>
                  <span className="tabular-nums text-[#1D1D1F] font-bold">{f.value}{pct !== null && <span className="text-[#86868B] font-medium ml-1.5">{pct}%</span>}</span>
                </div>
                <div className="h-3 rounded-full bg-black/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, (f.value / topFunil) * 100)}%`, background: f.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Horários */}
      <Card>
        <SectionTitle
          title="Quando respondem"
          hint={totalHora ? `Pico às ${pico}h (horário da Bahia).` : 'Ainda sem respostas para medir.'}
        />
        {totalHora > 0 ? (
          <>
            <div className="flex items-end gap-[3px] h-28">
              {m.porHora.map((v, h) => (
                <div key={h} className="flex-1 flex flex-col justify-end h-full" title={`${h}h: ${v} respostas`}>
                  <div
                    className="rounded-t-[4px] transition-all duration-700"
                    style={{ height: `${Math.max(v ? 4 : 0, (v / maxHora) * 100)}%`, background: h === pico ? COLORS.blue : 'rgba(0,113,227,0.28)' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-[#86868B] mt-2 tabular-nums"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
          </>
        ) : <Empty title="Sem dados ainda" />}
      </Card>

      {/* Dias */}
      <Card>
        <SectionTitle title="Últimos 14 dias" right={
          <div className="flex items-center gap-3 text-[12px] text-[#86868B]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.blue }} />Enviadas</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.green }} />Respostas</span>
          </div>
        } />
        {dias.length ? (
          <>
            <div className="flex items-end gap-1.5 h-32">
              {dias.map(d => (
                <div key={d.dia} className="flex-1 flex items-end justify-center gap-[2px] h-full" title={`${d.dia}: ${d.enviadas} enviadas, ${d.respostas} respostas`}>
                  <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(d.enviadas ? 3 : 0, (d.enviadas / maxDia) * 100)}%`, background: COLORS.blue }} />
                  <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(d.respostas ? 3 : 0, (d.respostas / maxDia) * 100)}%`, background: COLORS.green }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-[#86868B] mt-2 tabular-nums">
              <span>{dias[0].dia.slice(8)}/{dias[0].dia.slice(5, 7)}</span>
              <span>{dias[dias.length - 1].dia.slice(8)}/{dias[dias.length - 1].dia.slice(5, 7)}</span>
            </div>
          </>
        ) : <Empty title="Sem dados ainda" />}
      </Card>

      {/* Situação dos contatos */}
      <Card>
        <SectionTitle title="Situação dos contatos" />
        <div className="flex h-4 rounded-full overflow-hidden bg-black/[0.06]">
          {stEntries.map(([k, v]) => (
            <div key={k} title={`${STATUS_LABEL[k]?.label || k}: ${v}`} style={{ width: `${(v / stTotal) * 100}%`, background: STATUS_LABEL[k]?.color || '#C7C7CC' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4">
          {stEntries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[13.5px]">
              <span className="flex items-center gap-2 text-[#1D1D1F] min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_LABEL[k]?.color || '#C7C7CC' }} />
                <span className="truncate">{STATUS_LABEL[k]?.label || k}</span>
              </span>
              <b className="tabular-nums">{v}</b>
            </div>
          ))}
        </div>
        {r.opt_outs > 0 && <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[#86868B]"><ShieldOff className="w-3.5 h-3.5" /> {r.opt_outs} pediram para não receber mais mensagens.</div>}
      </Card>

      {/* Exportar */}
      <Card>
        <SectionTitle title="Baixar conversas" hint={`${r.mensagens_totais} mensagens. Abre no Excel, com acentos corretos.`} />
        <div className="flex gap-2.5 flex-wrap">
          <Btn onClick={() => download('csv')}><span className="inline-flex items-center gap-2"><Download className="w-4 h-4" />Planilha (CSV)</span></Btn>
          <Btn kind="soft" onClick={() => download('json')}>JSON</Btn>
        </div>
      </Card>
    </div>
  );
}
