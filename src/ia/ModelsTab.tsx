import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X, Plus, Zap, Search, Eye, EyeOff, Brain } from 'lucide-react';
import { Card, SectionTitle, Btn, Pill, Dot, inputCls, Skeleton } from './ui';

type Item = { provider: 'gemini' | 'groq'; model: string };

const SUGGEST: { provider: Item['provider']; model: string; note: string }[] = [
  { provider: 'gemini', model: 'gemini-3.6-flash', note: 'Principal. Aceita áudio e imagem.' },
  { provider: 'gemini', model: 'gemini-3.1-flash-lite', note: 'Mais leve, cota própria.' },
  { provider: 'groq', model: 'qwen/qwen3.8-27b', note: 'Texto e imagem. Rápido e grátis no Groq.' },
  { provider: 'groq', model: 'openai/gpt-oss-120b', note: 'Só texto. Maior raciocínio no Groq.' },
];

type Found = {
  id: string; context: number | null; vision: boolean; audio: boolean; reasoning: boolean;
  priceIn: number | null; priceOut: number | null; kind: string; score: number;
  probe: { ok: boolean; reply: string; ms: number; problem: string | null; error?: string } | null;
};
type Reading = { provider: 'gemini' | 'groq'; total: number; models: Found[]; suggested: string[]; note: string };

function KeyField({ label, provider, masked, value, onChange, placeholder }: { label: string; provider: 'gemini' | 'groq'; masked: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState('');
  const toggle = async () => {
    if (shown) { setShown(false); setSaved(''); return; }
    try {
      const j = await fetch('/api/config?reveal=1').then(r => r.json());
      setSaved(provider === 'groq' ? j.groqApiKeyPlain || '' : j.geminiApiKeyPlain || '');
    } catch { /* sem conexão: mostra vazio */ }
    setShown(true);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold">{label}</span>
        {masked ? <Pill tone="green">{masked}</Pill> : <Pill tone="gray">não configurada</Pill>}
      </div>
      <div className="flex gap-2">
        <input
          type={shown ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          className={`${inputCls} flex-1 min-w-0`}
          placeholder={masked ? 'Em branco mantém a atual' : placeholder}
          value={value || (shown ? saved : '')}
          onChange={e => onChange(e.target.value)}
        />
        <button type="button" onClick={toggle} aria-label={shown ? 'Esconder chave' : 'Mostrar chave salva'} className="w-12 rounded-xl bg-black/[0.05] flex items-center justify-center shrink-0 active:bg-black/[0.1]">
          {shown ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
        </button>
      </div>
    </div>
  );
}

export default function ModelsTab() {
  const [chain, setChain] = useState<Item[] | null>(null);
  const [paused, setPaused] = useState<string[]>([]);
  const [groqMasked, setGroqMasked] = useState('');
  const [geminiMasked, setGeminiMasked] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [reader, setReader] = useState<'groq' | 'gemini'>('groq');
  const [reading_busy, setReadingBusy] = useState(false);
  const [readErr, setReadErr] = useState('');
  const [test, setTest] = useState<{ ok: boolean; reply: string; motivo: string | null; ms: number } | null>(null);

  const load = async () => {
    try {
      const [c, m] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/api/metrics').then(r => r.json())]);
      setChain(c.aiChain && c.aiChain.length ? c.aiChain : SUGGEST.map(({ provider, model }) => ({ provider, model })));
      setGroqMasked(c.groqApiKeyMasked || '');
      setGeminiMasked(c.geminiApiKeyMasked || '');
      setPaused(m.agente?.modelos_pausados || []);
    } catch {
      setMsg({ ok: false, text: 'Sem conexão com o servidor.' });
    }
  };
  useEffect(() => { load(); }, []);

  // Ao vivo: pausas, cota e status atualizam sozinhos (sem mexer na lista que você está editando).
  useEffect(() => {
    let alive = true;
    const tick = () => fetch('/api/metrics').then(r => r.json()).then(m => { if (alive) setPaused(m.agente?.modelos_pausados || []); }).catch(() => {});
    const id = window.setInterval(tick, 10_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  if (!chain) return <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-40" /></div>;

  const move = (i: number, d: number) => {
    const c = [...chain];
    const j = i + d;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    setChain(c);
  };
  const upd = (i: number, p: Partial<Item>) => setChain(chain.map((x, k) => (k === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true);
    setMsg(null);
    const body: any = { aiChain: chain };
    if (groqKey.trim()) body.groqApiKey = groqKey.trim();
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim();
    try {
      const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return setMsg({ ok: false, text: j.error || 'Não salvou.' });
      setGroqKey('');
      setGeminiKey('');
      setMsg({ ok: true, text: 'Salvo. Já vale na próxima mensagem, com cota zerada se a chave for nova.' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function readKey() {
    setReadingBusy(true);
    setReadErr('');
    setReading(null);
    try {
      const r = await fetch('/api/ai-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: reader, apiKey: reader === 'groq' ? groqKey.trim() : '' }) });
      const j = await r.json();
      if (!r.ok) return setReadErr(j.error || 'Não consegui ler a chave.');
      setReading(j);
    } catch {
      setReadErr('Sem conexão com o servidor.');
    } finally {
      setReadingBusy(false);
    }
  }

  const addModel = (provider: Item['provider'], model: string) => {
    if (chain.some(c => c.provider === provider && c.model === model)) return;
    setChain([...chain, { provider, model }]);
  };
  const useSuggestion = () => {
    if (!reading) return;
    const keep = chain.filter(c => c.provider !== reading.provider);
    const add = reading.suggested.map(model => ({ provider: reading.provider, model }));
    // Gemini primeiro (aceita áudio e imagem), depois os do Groq.
    setChain(reading.provider === 'groq' ? [...keep, ...add] : [...add, ...keep]);
    setMsg({ ok: true, text: 'Sugestão aplicada na lista de cima. Toque em Salvar.' });
  };

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const r = await fetch('/api/ai-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Oi, quem é?' }) });
      setTest(await r.json());
    } catch {
      setTest({ ok: false, reply: '', motivo: 'sem conexão', ms: 0 });
    } finally {
      setTesting(false);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Ordem dos modelos" hint="A IA usa o primeiro da lista. Quando a cota grátis dele acaba, passa para o próximo. Cada modelo tem cota própria." />
        <div className="space-y-2.5">
          {chain.map((it, i) => {
            const isPaused = paused.includes(`${it.provider}:${it.model}`);
            return (
              <div key={i} className="apple-card-sunken p-3">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#0071E3] text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <select value={it.provider} onChange={e => upd(i, { provider: e.target.value as Item['provider'] })} className={`${inputCls} !py-2 !w-auto`}>
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                  </select>
                  <div className="ml-auto flex items-center gap-1.5">
                    {isPaused ? <Pill tone="orange"><Dot tone="orange" />Sem cota agora</Pill> : <Pill tone="green"><Dot tone="green" />Disponível</Pill>}
                  </div>
                </div>
                <input className={`${inputCls} !py-2`} value={it.model} onChange={e => upd(i, { model: e.target.value })} spellCheck={false} />
                <div className="flex items-center justify-end gap-1.5 mt-2.5">
                  <button aria-label="Subir" onClick={() => move(i, -1)} className="w-10 h-10 rounded-xl bg-black/[0.05] flex items-center justify-center shrink-0 active:bg-black/[0.1]"><ArrowUp className="w-4 h-4" /></button>
                  <button aria-label="Descer" onClick={() => move(i, 1)} className="w-10 h-10 rounded-xl bg-black/[0.05] flex items-center justify-center shrink-0 active:bg-black/[0.1]"><ArrowDown className="w-4 h-4" /></button>
                  <button aria-label="Remover" onClick={() => setChain(chain.filter((_, k) => k !== i))} className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 text-[#c42b22] flex items-center justify-center shrink-0 active:bg-[#FF3B30]/20"><X className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="text-[12px] font-semibold text-[#86868B] mb-2">Adicionar sugestão</div>
          <div className="flex flex-wrap gap-2">
            {SUGGEST.filter(s => !chain.some(c => c.model === s.model)).map(s => (
              <button key={s.model} onClick={() => setChain([...chain, { provider: s.provider, model: s.model }])} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/[0.05] text-[13px] font-semibold text-[#1D1D1F] active:bg-black/[0.1]">
                <Plus className="w-3.5 h-3.5" />{s.model}
              </button>
            ))}
            <button onClick={() => setChain([...chain, { provider: 'groq', model: '' }])} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-black/[0.2] text-[13px] font-semibold text-[#6e6e73]"><Plus className="w-3.5 h-3.5" />Outro</button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Chaves" hint="Guardadas no servidor. O olho mostra a chave salva. Chave nova zera a cota e tira as pausas na hora." />
        <div className="space-y-4">
          <KeyField label="Gemini" provider="gemini" masked={geminiMasked} value={geminiKey} onChange={setGeminiKey} placeholder="Cole a chave do Gemini (AI Studio)" />
          <KeyField label="Groq" provider="groq" masked={groqMasked} value={groqKey} onChange={setGroqKey} placeholder="Cole a chave do Groq (grátis em console.groq.com)" />
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Btn onClick={save} disabled={busy || chain.length === 0 || chain.some(c => !c.model.trim())}>{busy ? 'Salvando…' : 'Salvar'}</Btn>
          {msg && <span className={`text-[13.5px] font-medium ${msg.ok ? 'text-[#1f8a3a]' : 'text-[#c42b22]'}`}>{msg.text}</span>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Ler chave e descobrir modelos" hint="Eu leio a chave, listo o que ela enxerga e, no Groq, testo uma resposta real em cada candidato." />
        <div className="flex gap-2 mb-3">
          {(['groq', 'gemini'] as const).map(p => (
            <button key={p} onClick={() => { setReader(p); setReading(null); setReadErr(''); }} className={`flex-1 py-2.5 rounded-xl text-[14px] font-semibold ${reader === p ? 'bg-[#0071E3] text-white' : 'bg-black/[0.05] text-[#1D1D1F]'}`}>{p === 'groq' ? 'Groq' : 'Gemini'}</button>
          ))}
        </div>
        <Btn kind="soft" onClick={readKey} disabled={reading_busy}><span className="inline-flex items-center gap-2"><Search className="w-4 h-4" />{reading_busy ? 'Lendo e testando…' : 'Ler chave salva'}</span></Btn>
        <div className="text-[12px] text-[#86868B] mt-2">{reader === 'groq' && groqKey.trim() ? 'Vai usar a chave que você colou abaixo.' : 'Usa a chave já salva no servidor.'}</div>
        {readErr && <div className="mt-3 rounded-2xl p-3.5 bg-[#FF3B30]/8 text-[14px] text-[#c42b22] font-medium">{readErr}</div>}
        {reading && (
          <div className="mt-4 space-y-2.5">
            <div className="text-[12.5px] text-[#86868B]">{reading.total} modelos encontrados. {reading.note}</div>
            {reading.suggested.length > 0 && (
              <Btn onClick={useSuggestion}>Usar a sugestão automática</Btn>
            )}
            {reading.models.filter(m => m.kind === 'chat').map(m => (
              <div key={m.id} className="apple-card-sunken p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold break-all leading-snug">{m.id}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {reading.suggested.includes(m.id) && <Pill tone="green">sugerido</Pill>}
                      {m.vision && <Pill tone="gray"><Eye className="w-3 h-3 mr-1 inline" />imagem</Pill>}
                      {m.reasoning && <Pill tone="gray"><Brain className="w-3 h-3 mr-1 inline" />raciocínio</Pill>}
                      {m.context ? <Pill tone="gray">{Math.round(m.context / 1000)}k contexto</Pill> : null}
                      {m.priceIn != null && <Pill tone="gray">US$ {m.priceIn.toFixed(2)} / {(m.priceOut ?? 0).toFixed(2)} por 1M</Pill>}
                    </div>
                  </div>
                  <button onClick={() => addModel(reading.provider, m.id)} aria-label="Adicionar" className="w-10 h-10 rounded-xl bg-black/[0.05] flex items-center justify-center shrink-0 active:bg-black/[0.1]"><Plus className="w-4 h-4" /></button>
                </div>
                {m.probe && (
                  <div className={`mt-2.5 rounded-xl p-2.5 text-[13px] leading-snug ${m.probe.ok && !m.probe.problem ? 'bg-[#34C759]/10 text-[#1D1D1F]' : 'bg-[#FF9500]/12 text-[#8a5200]'}`}>
                    {m.probe.ok ? <>“{m.probe.reply}” <span className="text-[#86868B]">· {(m.probe.ms / 1000).toFixed(1)} s{m.probe.problem ? ` · recusada: ${m.probe.problem}` : ''}</span></> : <>Falhou: {m.probe.error || 'sem resposta'}</>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Testar agora" hint="Gera uma resposta de exemplo ('Oi, quem é?'). Gasta 1 resposta da cota do dia." />
        <Btn kind="soft" onClick={runTest} disabled={testing}><span className="inline-flex items-center gap-2"><Zap className="w-4 h-4" />{testing ? 'Testando…' : 'Testar a IA'}</span></Btn>
        {test && (
          <div className={`mt-4 rounded-2xl p-4 ${test.ok ? 'bg-[#34C759]/10' : 'bg-[#FF3B30]/8'}`}>
            {test.ok ? (
              <>
                <div className="text-[12px] font-semibold text-[#1f8a3a] mb-1.5">Respondeu em {(test.ms / 1000).toFixed(1)} s</div>
                <div className="text-[15px] text-[#1D1D1F] leading-snug">“{test.reply}”</div>
              </>
            ) : (
              <div className="text-[14px] text-[#c42b22] font-medium">
                Não respondeu: {test.motivo === 'quota' ? 'todos os modelos estão sem cota agora.' : test.motivo === 'no_key' ? 'nenhuma chave configurada.' : test.motivo === 'invalid' ? 'a resposta foi recusada pelo validador.' : 'erro do modelo.'}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
