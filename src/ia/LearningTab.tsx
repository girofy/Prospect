import { useEffect, useState } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { Card, SectionTitle, Btn, Pill, Empty, Skeleton } from './ui';

type Learning = { outcome: string; worked: string; failed: string; why: string; opener_style?: string; created_at: string; contact_phone: string };

const OUTCOME: Record<string, { label: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'gray' }> = {
  reuniao: { label: 'Reunião', tone: 'green' },
  passou_para_humano: { label: 'Passou para você', tone: 'orange' },
  esfriou: { label: 'Esfriou', tone: 'gray' },
  sem_resposta: { label: 'Sem resposta', tone: 'gray' },
  opt_out: { label: 'Pediu para sair', tone: 'red' },
};

const clean = (s?: string) => (s && s.trim() && s.trim() !== '-' ? s.trim() : '');

export default function LearningTab() {
  const [items, setItems] = useState<Learning[] | null>(null);
  const [by, setBy] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/learnings');
      const j = await r.json();
      setItems(j.learnings || []);
      setBy(j.byOutcome || {});
    } catch {
      setItems([]);
      setMsg('Sem conexão com o servidor.');
    }
  };
  useEffect(() => { load(); }, []);

  async function analyze() {
    setRunning(true);
    setMsg('');
    try {
      const r = await fetch('/api/learnings', { method: 'POST' });
      const j = await r.json();
      setMsg(r.ok ? (j.saved > 0 ? `${j.saved} conversa(s) analisada(s).` : 'Nada novo para analisar, ou a cota da IA acabou por hoje.') : j.error || 'Falhou.');
      await load();
    } finally {
      setRunning(false);
    }
  }

  const byEntries = Object.entries(by) as [string, number][];
  const total = byEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={<Sparkles className="w-[18px] h-[18px]" />}
          title="O que a IA aprendeu"
          hint="Cada conversa é lida para achar onde travou, o que a pessoa respondeu e por quê. Essas lições voltam para o prompt nas próximas conversas."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Btn onClick={analyze} disabled={running}>{running ? 'Analisando…' : 'Analisar mais conversas'}</Btn>
          <span className="text-[12.5px] text-[#86868B]">Cada análise gasta 1 resposta da cota de IA.</span>
        </div>
        {msg && <div className="mt-3 text-[13.5px] text-[#424245] font-medium">{msg}</div>}
        {total > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {byEntries.map(([k, v]) => <span key={k}><Pill tone={OUTCOME[k]?.tone || 'gray'}>{OUTCOME[k]?.label || k} · {v}</Pill></span>)}
          </div>
        )}
      </Card>

      {items === null ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : items.length === 0 ? (
        <Card><Empty title="Ainda não há conversas analisadas" hint="Toque em “Analisar mais conversas” para começar." /></Card>
      ) : (
        items.slice(0, 30).map((l, i) => {
          const o = OUTCOME[l.outcome] || { label: l.outcome, tone: 'gray' as const };
          return (
            <div key={i}><Card className="!p-4 sm:!p-5">
              <div className="flex items-center justify-between mb-3">
                <Pill tone={o.tone}>{o.label}</Pill>
                <span className="text-[12px] text-[#86868B] tabular-nums">…{l.contact_phone?.slice(-4)}</span>
              </div>
              <div className="space-y-2.5 text-[14px] leading-snug">
                {clean(l.worked) && <p className="flex gap-2.5"><ThumbsUp className="w-4 h-4 mt-0.5 shrink-0 text-[#34C759]" /><span><b>Funcionou.</b> {clean(l.worked)}</span></p>}
                {clean(l.failed) && <p className="flex gap-2.5"><ThumbsDown className="w-4 h-4 mt-0.5 shrink-0 text-[#FF3B30]" /><span><b>Travou.</b> {clean(l.failed)}</span></p>}
                {clean(l.why) && <p className="flex gap-2.5"><HelpCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#86868B]" /><span className="text-[#6e6e73]">{clean(l.why)}</span></p>}
              </div>
            </Card></div>
          );
        })
      )}
    </div>
  );
}
