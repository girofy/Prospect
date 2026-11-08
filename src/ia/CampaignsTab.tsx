import { useEffect, useState } from 'react';
import { Card, SectionTitle } from './ui';
import { Row, readList, readText } from './campaignFile';

interface Funil { enviadas: number; responderam: number; conversa: number; interesse: number; fechou: number }
interface Camp {
  id: string; name: string; mission: string; objective: string; status: 'rascunho' | 'ativa' | 'pausada';
  dailyCap: number; endHour: number; total: number; naFila: number; funil: Funil;
}
interface Contato { phone: string; empresa: string; estado: string; ultima: string; quando: string }

const MISSOES = [
  { t: 'Gerar conversa e levar à prévia', m: 'Gerar uma conversa natural. Quando a pessoa responder, mostrar por que ter um site ajuda a ser achado no Google e oferecer uma prévia do site, sem pressionar.', o: 'Conseguir um sim para ver a prévia' },
  { t: 'Observação específica da empresa', m: 'Começar a conversa com uma observação concreta e verdadeira sobre a empresa (use a pesquisa), mostrar o que isso significa para ela e só depois propor a prévia. Não faça pergunta que dê saída fácil para um não.', o: 'Despertar interesse e levar à prévia' },
  { t: 'Marcar uma ligação', m: 'Conversar de forma leve e, havendo interesse, propor uma ligação rápida de 10 minutos com o César para mostrar a ideia.', o: 'Marcar uma ligação' },
];
const pill: Record<string, string> = { ativa: 'bg-[#34C759]/15 text-[#1f8a3a]', pausada: 'bg-[#FF9500]/15 text-[#b36b00]', rascunho: 'bg-black/[0.06] text-[#6e6e73]' };
const estadoCor: Record<string, string> = {
  'na fila': 'bg-black/[0.06] text-[#6e6e73]', enviada: 'bg-[#0071E3]/12 text-[#0059b3]', respondeu: 'bg-[#34C759]/15 text-[#1f8a3a]',
  conversando: 'bg-[#34C759]/25 text-[#1f8a3a]', interesse: 'bg-[#FF9500]/20 text-[#8a5200]', fechou: 'bg-[#34C759] text-white',
  'pediu para sair': 'bg-[#FF3B30]/15 text-[#b3261e]', 'já tinha conversa': 'bg-black/[0.06] text-[#6e6e73]',
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%');
const hora = (iso: string) => (iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');

async function api(body?: any, query = '') {
  const r = await fetch('/api/campaigns' + query, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

// Escolher arquivo ou colar a lista. Funciona com CSV, TXT, planilha .xlsx ou texto solto.
function ListPicker({ onRows }: { onRows: (rows: Row[], label: string) => void }) {
  const [paste, setPaste] = useState('');
  const [info, setInfo] = useState('');
  const done = (rows: Row[], label: string) => { setInfo(rows.length ? `${rows.length} empresas lidas de ${label}.` : 'Não achei telefones. Confira se o arquivo tem uma coluna de telefone.'); onRows(rows, label); };
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="inline-block px-4 py-2.5 rounded-xl bg-[#1D1D1F] text-white text-sm font-bold">Escolher arquivo</span>
        <input type="file" className="sr-only" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { done(await readList(f), f.name); } catch { setInfo('Não consegui abrir esse arquivo. Salve como CSV e tente de novo.'); } e.target.value = ''; }} />
      </label>
      <textarea value={paste} onChange={e => { setPaste(e.target.value); done(readText(e.target.value), 'texto colado'); }} rows={3} placeholder="Ou cole aqui: um negócio por linha com o telefone" className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
      {info && <p className="text-xs text-[#1D1D1F]">{info}</p>}
    </div>
  );
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<{ campaign: Camp & { phones: string[] }; contatos: Contato[] } | null>(null);
  const [stats, setStats] = useState<Camp | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mission, setMission] = useState('');
  const [objective, setObjective] = useState('');
  const [endHour, setEndHour] = useState(18);
  const [cap, setCap] = useState(40);
  const [filtro, setFiltro] = useState('todos');
  const [extra, setExtra] = useState<Row[]>([]);

  const load = async (first = false) => {
    const r = await api(undefined, `?id=${id}`);
    if (r.ok) { setD(r.j); if (first) { setMission(r.j.campaign.mission); setObjective(r.j.campaign.objective); setEndHour(r.j.campaign.endHour); setCap(r.j.campaign.dailyCap); } }
    const s = await api(undefined, '');
    if (s.ok) setStats((s.j.campaigns as Camp[]).find(c => c.id === id) || null);
  };
  useEffect(() => { load(true); const t = setInterval(() => load(), 20_000); return () => clearInterval(t); }, [id]);

  const run = async (body: any, okMsg?: string) => {
    setBusy(true); setMsg('');
    const r = await api({ ...body, id });
    setMsg(r.ok ? (okMsg || (r.j.added != null ? `${r.j.added} entraram.${r.j.skipped?.length ? ' ' + r.j.skipped.length + ' ficaram de fora: ' + r.j.skipped.slice(0, 4).map((s: any) => `${s.phone} (${s.motivo})`).join(', ') : ''}` : 'Feito.')) : (r.j.error || 'Não deu certo.'));
    await load(); setBusy(false);
    return r.ok;
  };

  if (!d) return <Card><button onClick={onBack} className="text-sm font-bold text-[#0071E3]">Voltar</button><div className="h-24 mt-3 animate-pulse rounded-2xl bg-black/[0.04]" /></Card>;
  const c = d.campaign;
  const f = stats?.funil;
  const lista = d.contatos.filter(x => filtro === 'todos' || x.estado === filtro);
  const estados = ['todos', 'na fila', 'enviada', 'respondeu', 'conversando', 'interesse', 'fechou', 'pediu para sair'];

  return (
    <div className="space-y-4">
      <Card>
        <button onClick={onBack} className="text-sm font-bold text-[#0071E3] mb-2">Voltar às campanhas</button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-[18px] font-bold text-[#1D1D1F] break-words">{c.name}</h2>
            <p className="text-xs text-[#6e6e73]">{c.phones.length} empresas, {stats?.naFila ?? 0} na fila, até {c.endHour}h, máx. {c.dailyCap}/dia</p></div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${pill[c.status]}`}>{c.status}</span>
        </div>
        <div className="mt-3 flex gap-2">
          {c.status === 'ativa'
            ? <button disabled={busy} onClick={() => run({ action: 'pause' }, 'Campanha pausada. Nada mais sai.')} className="flex-1 py-3 rounded-xl bg-[#FF9500] text-white text-sm font-bold">Pausar</button>
            : <button disabled={busy} onClick={() => run({ action: 'activate' }, 'Campanha ativa. Os envios começam no próximo minuto, dentro do horário.')} className="flex-1 py-3 rounded-xl bg-[#34C759] text-white text-sm font-bold">Ativar</button>}
        </div>
        {msg && <p className="mt-3 text-sm text-[#1D1D1F] break-words">{msg}</p>}
      </Card>

      {f && (
        <Card>
          <SectionTitle title="Funil" />
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {([['Enviadas', f.enviadas, ''], ['Responderam', f.responderam, pct(f.responderam, f.enviadas)], ['Conversa', f.conversa, pct(f.conversa, f.responderam)], ['Interesse', f.interesse, pct(f.interesse, f.responderam)], ['Fechou', f.fechou, pct(f.fechou, f.enviadas)]] as [string, number, string][]).map(([l, v, p]) => (
              <div key={l} className="rounded-xl bg-[#F5F5F7] py-2"><div className="text-[17px] font-bold tabular-nums text-[#1D1D1F]">{v}</div><div className="text-[10px] text-[#6e6e73] leading-tight">{l}</div><div className="text-[10px] font-semibold text-[#0071E3]">{p || ' '}</div></div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="Empresas" hint="Toque num estado para filtrar." />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {estados.map(e => <button key={e} onClick={() => setFiltro(e)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filtro === e ? 'bg-[#1D1D1F] text-white' : 'bg-black/[0.06] text-[#1D1D1F]'}`}>{e}{e !== 'todos' ? ` ${d.contatos.filter(x => x.estado === e).length}` : ` ${d.contatos.length}`}</button>)}
        </div>
        <ul className="divide-y divide-black/[0.05]">
          {lista.map(x => (
            <li key={x.phone} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-[#1D1D1F] truncate">{x.empresa}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${estadoCor[x.estado] || 'bg-black/[0.06]'}`}>{x.estado}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-[12px] text-[#6e6e73] truncate">{x.ultima ? `${hora(x.quando)}: ${x.ultima}` : x.phone}</span>
                {x.estado === 'na fila' && <button disabled={busy} onClick={() => run({ action: 'removePhone', phone: x.phone }, 'Tirei da campanha.')} className="text-[12px] font-semibold text-[#FF3B30] shrink-0">Tirar</button>}
              </div>
            </li>
          ))}
          {!lista.length && <li className="py-4 text-center text-sm text-[#6e6e73]">Ninguém neste filtro.</li>}
        </ul>
      </Card>

      <Card>
        <SectionTitle title="Adicionar mais empresas" />
        <ListPicker onRows={rows => setExtra(rows)} />
        <button disabled={busy || !extra.length} onClick={async () => { if (await run({ action: 'import', rows: extra })) setExtra([]); }} className="mt-3 w-full py-3 rounded-2xl bg-[#1D1D1F] text-white text-sm font-bold disabled:opacity-40">{extra.length ? `Adicionar ${extra.length}` : 'Adicionar'}</button>
      </Card>

      <Card>
        <SectionTitle title="Missão e horário" />
        <div className="flex flex-wrap gap-1.5 mb-2">{MISSOES.map(x => <button key={x.t} onClick={() => { setMission(x.m); setObjective(x.o); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${mission === x.m ? 'bg-[#1D1D1F] text-white' : 'bg-black/[0.06] text-[#1D1D1F]'}`}>{x.t}</button>)}</div>
        <textarea value={mission} onChange={e => setMission(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
        <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objetivo em uma frase" className="w-full mt-2 px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
        <div className="grid grid-cols-2 gap-3 mt-2">
          <label className="text-xs font-bold text-[#6e6e73]">Parar às<select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]">{[12, 14, 16, 17, 18, 19].map(h => <option key={h} value={h}>{h}h</option>)}</select></label>
          <label className="text-xs font-bold text-[#6e6e73]">Máximo por dia<input type="number" min={1} max={100} value={cap} onChange={e => setCap(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]" /></label>
        </div>
        <button disabled={busy} onClick={() => run({ action: 'update', mission, objective, endHour, dailyCap: cap }, 'Salvo.')} className="mt-3 w-full py-3 rounded-2xl bg-[#0071E3] text-white text-sm font-bold">Salvar</button>
        {c.status !== 'ativa' && <button disabled={busy} onClick={async () => { if (await run({ action: 'remove' }, 'Campanha apagada.')) onBack(); }} className="mt-2 w-full py-2.5 rounded-2xl bg-black/[0.06] text-[#FF3B30] text-sm font-semibold">Apagar campanha</button>}
      </Card>
    </div>
  );
}

export default function CampaignsTab() {
  const [list, setList] = useState<Camp[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [mission, setMission] = useState(MISSOES[0].m);
  const [objective, setObjective] = useState(MISSOES[0].o);
  const [endHour, setEndHour] = useState(18);
  const [cap, setCap] = useState(40);
  const [rows, setRows] = useState<Row[]>([]);
  const [label, setLabel] = useState('');

  const load = () => api().then(r => { if (r.ok) setList(r.j.campaigns); });
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  if (sel) return <Detail id={sel} onBack={() => { setSel(null); load(); }} />;

  const create = async () => {
    setBusy(true); setMsg('');
    const r = await api({ action: 'create', name: name || label.replace(/\.[^.]+$/, '') || 'Nova campanha', mission, objective, endHour, dailyCap: cap, rows });
    setBusy(false);
    if (!r.ok) { setMsg(r.j.error || 'Não deu certo.'); return; }
    setOpen(false); setRows([]); setName(''); setLabel('');
    await load(); setSel(r.j.id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Campanhas" hint="Nada é enviado sem uma campanha ativa. Respostas a quem escreve continuam sempre ligadas." right={<button onClick={() => setOpen(o => !o)} className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-sm font-bold">{open ? 'Fechar' : 'Nova campanha'}</button>} />
        {open && (
          <div className="space-y-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da campanha" className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
            <div><p className="text-xs font-bold text-[#6e6e73] mb-1.5">1. Lista de empresas</p><ListPicker onRows={(r, l) => { setRows(r); setLabel(l); }} /></div>
            <div>
              <p className="text-xs font-bold text-[#6e6e73] mb-1.5">2. Missão do agente</p>
              <div className="flex flex-wrap gap-1.5 mb-2">{MISSOES.map(x => <button key={x.t} onClick={() => { setMission(x.m); setObjective(x.o); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${mission === x.m ? 'bg-[#1D1D1F] text-white' : 'bg-black/[0.06] text-[#1D1D1F]'}`}>{x.t}</button>)}</div>
              <textarea value={mission} onChange={e => setMission(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
              <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objetivo em uma frase" className="w-full mt-2 px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-[#6e6e73]">Parar às<select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]">{[12, 14, 16, 17, 18, 19].map(h => <option key={h} value={h}>{h}h</option>)}</select></label>
              <label className="text-xs font-bold text-[#6e6e73]">Máximo por dia<input type="number" min={1} max={100} value={cap} onChange={e => setCap(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]" /></label>
            </div>
            <p className="text-xs text-[#6e6e73]">Os envios se espalham de forma aleatória até a hora de parar. Quem já tem conversa ou abordagem é pulado.</p>
            <button disabled={busy} onClick={create} className="w-full py-3 rounded-2xl bg-[#1D1D1F] text-white text-sm font-bold disabled:opacity-50">{busy ? 'Criando...' : rows.length ? `Criar com ${rows.length} empresas` : 'Criar campanha vazia'}</button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-[#1D1D1F] break-words">{msg}</p>}
      </Card>

      {list.length === 0 && <Card><p className="text-sm text-[#6e6e73]">Nenhuma campanha ainda. Crie a primeira com a sua lista.</p></Card>}

      {list.map(c => (
        <div key={c.id}>
          <Card>
            <button onClick={() => setSel(c.id)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="text-[16px] font-bold text-[#1D1D1F] truncate">{c.name}</h3>
                  <p className="text-xs text-[#6e6e73]">{c.total} empresas, {c.naFila} na fila, até {c.endHour}h, máx. {c.dailyCap}/dia</p></div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${pill[c.status]}`}>{c.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
                {([['Enviadas', c.funil.enviadas, ''], ['Responderam', c.funil.responderam, pct(c.funil.responderam, c.funil.enviadas)], ['Conversa', c.funil.conversa, pct(c.funil.conversa, c.funil.responderam)], ['Interesse', c.funil.interesse, pct(c.funil.interesse, c.funil.responderam)], ['Fechou', c.funil.fechou, pct(c.funil.fechou, c.funil.enviadas)]] as [string, number, string][]).map(([l, v, p]) => (
                  <div key={l} className="rounded-xl bg-[#F5F5F7] py-2"><div className="text-[17px] font-bold tabular-nums text-[#1D1D1F]">{v}</div><div className="text-[10px] text-[#6e6e73] leading-tight">{l}</div><div className="text-[10px] font-semibold text-[#0071E3]">{p || ' '}</div></div>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#0071E3]">Abrir campanha</p>
            </button>
          </Card>
        </div>
      ))}
    </div>
  );
}
