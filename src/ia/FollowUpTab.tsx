import { useEffect, useState } from 'react';
import { RotateCcw, Send, Wand2, X } from 'lucide-react';
import { Card, SectionTitle, Btn, Pill, Empty, Skeleton, inputCls } from './ui';

type Cand = { phone: string; name: string; company: string; last_text: string; last_from: string; horas: number; toques: number; ja_respondeu: boolean };

function ago(h: number): string {
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export default function FollowUpTab() {
  const [list, setList] = useState<Cand[] | null>(null);
  const [semNumero, setSemNumero] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/followups');
      const j = await r.json();
      setList(j.candidatos || []);
      setSemNumero(j.sem_numero || 0);
    } catch {
      setList([]);
      setMsg({ ok: false, text: 'Sem conexão com o servidor.' });
    }
  };
  useEffect(() => { load(); }, []);

  async function prepare(c: Cand) {
    setBusy(c.phone);
    setMsg(null);
    try {
      const r = await fetch('/api/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone }) });
      const j = await r.json();
      if (!r.ok) return setMsg({ ok: false, text: j.error || 'Não consegui preparar.' });
      setDrafts(d => ({ ...d, [c.phone]: j.draft }));
    } finally {
      setBusy(null);
    }
  }

  async function send(c: Cand) {
    const text = (drafts[c.phone] || '').trim();
    if (!text) return;
    setBusy(c.phone);
    setMsg(null);
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c.phone, text, keepAgent: true }) });
      const j = await r.json();
      if (!r.ok || j.success === false) return setMsg({ ok: false, text: j.error || j.metaError || 'Não enviou.' });
      setMsg({ ok: true, text: 'Enviado.' });
      setDrafts(d => { const n = { ...d }; delete n[c.phone]; return n; });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={<RotateCcw className="w-[18px] h-[18px]" />}
          title="Retomar conversas"
          hint="Conversas em que a última mensagem foi nossa e a pessoa não respondeu há mais de 24 horas. A IA prepara o texto, você revisa e envia. Nada sai sozinho."
        />
        <div className="text-[12.5px] text-[#86868B]">No máximo 3 mensagens seguidas sem resposta. Quem pediu para sair nunca aparece aqui.</div>
        {semNumero > 0 && (
          <div className="mt-3 rounded-xl bg-[#FF9500]/10 text-[#8a5300] px-3.5 py-2.5 text-[13px] leading-snug font-medium">
            {semNumero} conversas do histórico não têm telefone (o WhatsApp entregou só um identificador interno). A IA estuda essas conversas, mas não dá para escrever para elas.
          </div>
        )}
        {msg && <div className={`mt-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium ${msg.ok ? 'bg-[#34C759]/12 text-[#1f8a3a]' : 'bg-[#FF3B30]/10 text-[#c42b22]'}`}>{msg.text}</div>}
      </Card>

      {list === null ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : list.length === 0 ? (
        <Card><Empty title="Ninguém para retomar agora" hint="Quando uma conversa ficar parada por 24 horas, ela aparece aqui." /></Card>
      ) : (
        list.map(c => (
          <div key={c.phone}>
            <Card className="!p-4 sm:!p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[#1D1D1F] truncate">{c.name || `Contato …${c.phone.slice(-4)}`}</div>
                  <div className="text-[12.5px] text-[#86868B] mt-0.5">{ago(c.horas)} · {c.toques} sem resposta{c.toques > 1 ? 's' : ''}</div>
                </div>
                <Pill tone={c.ja_respondeu ? 'blue' : 'gray'}>{c.ja_respondeu ? 'já respondeu antes' : 'nunca respondeu'}</Pill>
              </div>
              <div className="mt-3 rounded-xl bg-[#FBFBFD] border border-black/[0.06] px-3.5 py-2.5 text-[13.5px] text-[#424245] leading-snug">
                <span className="text-[#86868B]">{c.last_from === 'bot' ? 'Agente: ' : 'Você: '}</span>{c.last_text}
              </div>

              {drafts[c.phone] === undefined ? (
                <div className="mt-3">
                  <Btn kind="soft" onClick={() => prepare(c)} disabled={busy === c.phone}>
                    <span className="inline-flex items-center gap-2"><Wand2 className="w-4 h-4" />{busy === c.phone ? 'Preparando…' : 'Preparar mensagem'}</span>
                  </Btn>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <textarea className={`${inputCls} min-h-[84px] resize-y`} value={drafts[c.phone]} onChange={e => setDrafts(d => ({ ...d, [c.phone]: e.target.value }))} />
                  <div className="flex gap-2.5 flex-wrap">
                    <Btn onClick={() => send(c)} disabled={busy === c.phone || !drafts[c.phone].trim()}>
                      <span className="inline-flex items-center gap-2"><Send className="w-4 h-4" />{busy === c.phone ? 'Enviando…' : 'Enviar agora'}</span>
                    </Btn>
                    <Btn kind="soft" onClick={() => setDrafts(d => { const n = { ...d }; delete n[c.phone]; return n; })}>
                      <span className="inline-flex items-center gap-2"><X className="w-4 h-4" />Descartar</span>
                    </Btn>
                  </div>
                </div>
              )}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
