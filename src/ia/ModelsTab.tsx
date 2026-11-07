import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X, Plus, Zap } from 'lucide-react';
import { Card, SectionTitle, Btn, Pill, Dot, inputCls, Skeleton } from './ui';

type Item = { provider: 'gemini' | 'groq'; model: string };

const SUGGEST: { provider: Item['provider']; model: string; note: string }[] = [
  { provider: 'gemini', model: 'gemini-3.6-flash', note: 'Principal. Aceita áudio e imagem.' },
  { provider: 'gemini', model: 'gemini-3.1-flash-lite', note: 'Mais leve, cota própria.' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', note: 'Só texto. Grátis no Groq.' },
];

export default function ModelsTab() {
  const [chain, setChain] = useState<Item[] | null>(null);
  const [paused, setPaused] = useState<string[]>([]);
  const [groqMasked, setGroqMasked] = useState('');
  const [geminiMasked, setGeminiMasked] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
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
    try {
      const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return setMsg({ ok: false, text: j.error || 'Não salvou.' });
      setGroqKey('');
      setMsg({ ok: true, text: 'Salvo. Vale já na próxima mensagem.' });
      await load();
    } finally {
      setBusy(false);
    }
  }

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
        <SectionTitle title="Chaves" hint="As chaves ficam guardadas no servidor. Depois de salvas, só aparece o começo e o fim." />
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5"><span className="text-[13px] font-semibold">Gemini</span>{geminiMasked ? <Pill tone="green">{geminiMasked}</Pill> : <Pill tone="red">sem chave</Pill>}</div>
            <div className="text-[12.5px] text-[#86868B]">Configurada no servidor (variável de ambiente).</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5"><span className="text-[13px] font-semibold">Groq</span>{groqMasked ? <Pill tone="green">{groqMasked}</Pill> : <Pill tone="gray">não configurada</Pill>}</div>
            <input type="password" autoComplete="off" className={inputCls} placeholder={groqMasked ? 'Em branco mantém a atual' : 'Cole a chave (grátis em console.groq.com)'} value={groqKey} onChange={e => setGroqKey(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Btn onClick={save} disabled={busy || chain.length === 0 || chain.some(c => !c.model.trim())}>{busy ? 'Salvando…' : 'Salvar'}</Btn>
          {msg && <span className={`text-[13.5px] font-medium ${msg.ok ? 'text-[#1f8a3a]' : 'text-[#c42b22]'}`}>{msg.text}</span>}
        </div>
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
