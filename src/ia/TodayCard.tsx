import { useEffect, useState } from 'react';
import { Card } from './ui';

interface Stats {
  enabled: boolean;
  inWindow: boolean;
  window: string;
  sentToday: number;
  paused: boolean;
  dailyCap: number;
  queue: number;
  inConversation: number;
  replied: number;
  totalContacts: number;
}

// Placar do dia: um número que enche, um que sobe quando alguém responde e uma frase dizendo o que acontece agora.
export default function TodayCard() {
  const [s, setS] = useState<Stats | null>(null);
  const [bump, setBump] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let last = -1;
    const load = () =>
      fetch('/api/prospector')
        .then(r => (r.ok ? r.json() : null))
        .then((j: Stats | null) => {
          if (!alive) return;
          if (!j) { setFailed(true); return; }
          setFailed(false);
          if (last >= 0 && j.replied > last) { setBump(true); setTimeout(() => setBump(false), 1800); }
          last = j.replied;
          setS(j);
        })
        .catch(() => { if (alive) setFailed(true); });
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!s) {
    return (
      <Card>
        {failed
          ? <p className="text-[14px] text-[#6e6e73]">Não consegui carregar o placar. Tentando de novo a cada 20 segundos.</p>
          : <div className="h-24 animate-pulse rounded-2xl bg-black/[0.04]" />}
      </Card>
    );
  }

  const pct = Math.min(100, Math.round((s.sentToday / Math.max(1, s.dailyCap)) * 100));
  const rate = s.totalContacts ? Math.round((s.replied / s.totalContacts) * 100) : 0;
  const state = !s.enabled ? 'Desligada' : s.paused ? 'Pausada' : s.inWindow ? 'Enviando agora' : `Espera a janela (${s.window.replace(' (America/Bahia)', '')})`;
  const dot = !s.enabled || s.paused ? 'bg-[#FF9500]' : s.inWindow ? 'bg-[#34C759]' : 'bg-[#86868B]';
  const goal = pct >= 100 ? 'Meta do dia batida.' : pct >= 75 ? 'Falta pouco para a meta.' : pct >= 50 ? 'Passou da metade.' : pct >= 25 ? 'Primeiro quarto feito.' : s.sentToday ? 'Começou.' : 'Nada enviado ainda hoje.';

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[17px] font-bold tracking-tight text-[#1D1D1F]">Hoje</h2>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6e6e73]">
          <span className={`w-2 h-2 rounded-full ${dot} ${s.inWindow && s.enabled && !s.paused ? 'animate-pulse' : ''}`} />
          {state}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[40px] leading-none font-black tracking-tight tabular-nums text-[#1D1D1F]">
            {s.sentToday}<span className="text-[20px] font-bold text-[#6e6e73]"> / {s.dailyCap}</span>
          </div>
          <div className="text-[13px] text-[#6e6e73] mt-1">abordagens enviadas</div>
        </div>
        <div className={`text-right transition-transform duration-500 ${bump ? 'scale-110' : ''}`}>
          <div className={`text-[32px] leading-none font-black tabular-nums ${bump ? 'text-[#34C759]' : 'text-[#0071E3]'}`}>{s.replied}</div>
          <div className="text-[13px] text-[#6e6e73] mt-1">responderam no total</div>
        </div>
      </div>

      <div className="mt-4 h-3 rounded-full bg-black/[0.06] overflow-hidden" role="progressbar" aria-label="Abordagens enviadas hoje" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#34C759] transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] font-semibold text-[#1D1D1F] mt-2">{goal}</p>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        {[
          ['Na fila', s.queue],
          ['Conversando', s.inConversation],
          ['Taxa de resposta', `${rate}%`],
        ].map(([label, v]) => (
          <div key={String(label)} className="rounded-2xl bg-[#F5F5F7] py-2.5">
            <div className="text-[18px] font-bold tabular-nums text-[#1D1D1F]">{v}</div>
            <div className="text-[11px] text-[#6e6e73] font-medium">{label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
