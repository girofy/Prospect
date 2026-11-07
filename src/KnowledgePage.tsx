import {useEffect, useState, ChangeEvent, FormEvent, CSSProperties} from 'react';

// Página "Girofy IA": base de conhecimento (sem deploy) e painel de aprendizado.
// Acesso: /#girofy-ia (só depois do login).

const LIMIT = 30000;

type Doc = {id: number; title: string; content: string; active: boolean; created_at: string};
type Learning = {outcome: string; worked: string; failed: string; why: string; created_at: string; contact_phone: string};

const card: CSSProperties = {background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 14};
const input: CSSProperties = {width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #d6d9e0', fontSize: 15, fontFamily: 'inherit'};
const btn: CSSProperties = {padding: '10px 14px', borderRadius: 10, border: 0, background: '#0b5cad', color: '#fff', fontWeight: 600, fontSize: 14};
const ghost: CSSProperties = {...btn, background: '#eef1f6', color: '#334'};
const danger: CSSProperties = {...btn, background: '#fbe9e9', color: '#b42318'};

export default function KnowledgePage({onBack}: {onBack: () => void}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [totalChars, setTotalChars] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [funnel, setFunnel] = useState<any>(null);
  const [byOutcome, setByOutcome] = useState<Record<string, number>>({});
  const [learnings, setLearnings] = useState<Learning[]>([]);

  const load = async () => {
    try {
      const r = await fetch('/api/knowledge');
      if (r.ok) {
        const j = await r.json();
        setDocs(j.docs || []);
        setTotalChars(j.totalChars || 0);
      }
      const l = await fetch('/api/learnings');
      if (l.ok) {
        const j = await l.json();
        setFunnel(j.funnel);
        setByOutcome(j.byOutcome || {});
        setLearnings(j.learnings || []);
      }
    } catch {
      setMsg('Sem conexão com o servidor.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setContent(text);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    if (/\.pdf$/i.test(f.name)) {
      setMsg('PDF não é lido direto. Abra o PDF, copie o texto e cole aqui, ou salve como .txt.');
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({title, content}),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || 'Não salvou.');
      } else {
        setTitle('');
        setContent('');
        setMsg('Salvo. A IA já usa esse conteúdo na próxima mensagem.');
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (d: Doc) => {
    await fetch('/api/knowledge/toggle', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: d.id, active: !d.active})});
    await load();
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Apagar "${d.title}"?`)) return;
    await fetch('/api/knowledge/delete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: d.id})});
    await load();
  };

  const pct = Math.min(100, Math.round((totalChars / LIMIT) * 100));

  return (
    <div style={{minHeight: '100dvh', background: '#f5f7fb', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#1d1d1f'}}>
      <div style={{maxWidth: 760, margin: '0 auto'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14}}>
          <h1 style={{fontSize: 22, margin: 0}}>Girofy IA</h1>
          <button style={ghost} onClick={onBack}>Voltar ao painel</button>
        </div>

        <div style={card}>
          <h2 style={{fontSize: 17, margin: '0 0 4px'}}>Base de conhecimento</h2>
          <p style={{margin: '0 0 12px', fontSize: 13, color: '#667'}}>
            O que você colocar aqui a IA lê em toda resposta. Use para oferta, preços, roteiro, objeções e exemplos de bons atendimentos.
          </p>

          <form onSubmit={save} style={{display: 'grid', gap: 10}}>
            <input style={input} placeholder="Título (ex.: Oferta landing page)" value={title} onChange={e => setTitle(e.target.value)} />
            <input type="file" accept=".md,.txt,.csv,.json" onChange={onFile} style={{fontSize: 14}} />
            <textarea style={{...input, minHeight: 160}} placeholder="Ou cole o texto aqui" value={content} onChange={e => setContent(e.target.value)} />
            <div style={{display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'}}>
              <button style={btn} type="submit" disabled={busy || !title.trim() || !content.trim()}>{busy ? 'Salvando…' : 'Salvar conhecimento'}</button>
              <span style={{fontSize: 13, color: '#667'}}>{content.length} caracteres</span>
            </div>
          </form>
          {msg && <p style={{fontSize: 14, color: msg.startsWith('Salvo') ? '#1a7f37' : '#b42318', margin: '10px 0 0'}}>{msg}</p>}
        </div>

        <div style={card}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#667', marginBottom: 6}}>
            <span>Lido pela IA a cada mensagem</span>
            <span>{totalChars} / {LIMIT} caracteres</span>
          </div>
          <div style={{height: 8, borderRadius: 999, background: '#e6e9f0', overflow: 'hidden'}}>
            <div style={{width: `${pct}%`, height: '100%', background: pct > 85 ? '#b42318' : '#0b5cad'}} />
          </div>
          {docs.length === 0 && <p style={{fontSize: 14, color: '#667'}}>Nenhum documento ainda.</p>}
          <div style={{display: 'grid', gap: 8, marginTop: 12}}>
            {docs.map(d => (
              <div key={d.id} style={{border: '1px solid #e3e6ee', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: d.active ? 1 : 0.5}}>
                <div>
                  <div style={{fontWeight: 600, fontSize: 14}}>{d.title}</div>
                  <div style={{fontSize: 12, color: '#667'}}>{d.content.length} caracteres · {d.active ? 'ativo' : 'desligado'}</div>
                </div>
                <div style={{display: 'flex', gap: 6}}>
                  <button style={ghost} onClick={() => toggle(d)}>{d.active ? 'Desligar' : 'Ligar'}</button>
                  <button style={danger} onClick={() => remove(d)}>Apagar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={{fontSize: 17, margin: '0 0 10px'}}>O que a IA aprendeu</h2>
          {funnel && (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12}}>
              {[
                ['Enviados hoje', `${funnel.sentToday} / ${funnel.dailyCap}`],
                ['Na fila', funnel.queue],
                ['Em conversa', funnel.inConversation],
                ['Responderam', funnel.replied],
                ['Reuniões', byOutcome.reuniao || 0],
                ['Pediram para sair', byOutcome.opt_out || 0],
              ].map(([k, v]) => (
                <div key={String(k)} style={{background: '#f5f7fb', borderRadius: 10, padding: 10}}>
                  <div style={{fontSize: 12, color: '#667'}}>{k}</div>
                  <div style={{fontSize: 18, fontWeight: 700}}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {learnings.length === 0 && <p style={{fontSize: 14, color: '#667'}}>Ainda não há conversas analisadas. O aprendizado roda a cada 6 horas.</p>}
          <div style={{display: 'grid', gap: 8}}>
            {learnings.slice(0, 20).map((l, i) => (
              <div key={i} style={{border: '1px solid #e3e6ee', borderRadius: 10, padding: 10, fontSize: 13}}>
                <div style={{fontWeight: 600, marginBottom: 4}}>{l.outcome}</div>
                <div><b>Funcionou:</b> {l.worked}</div>
                <div><b>Não funcionou:</b> {l.failed}</div>
                <div><b>Por quê:</b> {l.why}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
