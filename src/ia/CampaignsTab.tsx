import { useEffect, useRef, useState } from 'react';
import { Card, SectionTitle } from './ui';

interface Funil { enviadas: number; responderam: number; conversa: number; interesse: number; fechou: number }
interface Camp {
  id: string; name: string; mission: string; objective: string; status: 'rascunho' | 'ativa' | 'pausada';
  dailyCap: number; endHour: number; total: number; naFila: number; funil: Funil;
}
interface Row { phone: string; company?: string; notes?: string }

const MISSOES = [
  { t: 'Gerar conversa e levar à prévia', m: 'Gerar uma conversa natural. Quando a pessoa responder, mostrar por que ter um site ajuda a ser achado no Google e oferecer uma prévia do site, sem pressionar.', o: 'Conseguir um sim para ver a prévia' },
  { t: 'Observação específica da empresa', m: 'Começar a conversa com uma observação concreta e verdadeira sobre a empresa (use a pesquisa), mostrar o que isso significa para ela e só depois propor a prévia. Não faça pergunta que dê saída fácil para um não.', o: 'Despertar interesse e levar à prévia' },
  { t: 'Marcar uma ligação', m: 'Conversar de forma leve e, havendo interesse, propor uma ligação rápida de 10 minutos com o César para mostrar a ideia.', o: 'Marcar uma ligação' },
];

// Lê CSV simples (aceita aspas e vírgula ou ponto e vírgula). Procura a coluna de telefone sozinho.
function parseCsv(text: string): Row[] {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let cur: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { cur.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; cur.push(cell); cell = ''; if (cur.some(x => x.trim())) rows.push(cur); cur = []; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); if (cur.some(x => x.trim())) rows.push(cur); }
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/^﻿/, ''));
  const iPhone = head.findIndex(h => /(telefone|phone|whats|celular|fone|numero|número)/.test(h) && !/link|wa\.me/.test(h));
  const iName = head.findIndex(h => /(negocio|negócio|empresa|nome|name)/.test(h));
  if (iPhone < 0) return [];
  return rows.slice(1).map(r => {
    const notes = r.map((v, i) => (i !== iPhone && i !== iName && v.trim() && !/^https?:/.test(v.trim()) ? `${rows[0][i].trim()}: ${v.trim()}` : '')).filter(Boolean).join('. ');
    return { phone: r[iPhone] || '', company: iName >= 0 ? r[iName] : undefined, notes };
  }).filter(r => r.phone.trim());
}

const pill: Record<string, string> = {
  ativa: 'bg-[#34C759]/15 text-[#1f8a3a]', pausada: 'bg-[#FF9500]/15 text-[#b36b00]', rascunho: 'bg-black/[0.06] text-[#6e6e73]',
};

export default function CampaignsTab() {
  const [list, setList] = useState<Camp[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [mission, setMission] = useState(MISSOES[0].m);
  const [objective, setObjective] = useState(MISSOES[0].o);
  const [endHour, setEndHour] = useState(18);
  const [cap, setCap] = useState(40);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch('/api/campaigns').then(r => (r.ok ? r.json() : null)).then(j => { if (j) setList(j.campaigns); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  const post = async (body: any) => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || 'Não deu certo.');
      else if (body.action === 'create' || body.action === 'import') setMsg(`${j.added} contatos entraram. ${j.skipped?.length ? j.skipped.length + ' ficaram de fora: ' + j.skipped.slice(0, 4).map((s: any) => `${s.phone} (${s.motivo})`).join(', ') : ''}`);
      await load();
      return r.ok ? j : null;
    } finally { setBusy(false); }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setFileName(f.name);
    const parsed = parseCsv(await f.text());
    setRows(parsed);
    setMsg(parsed.length ? `${parsed.length} linhas lidas.` : 'Não achei a coluna de telefone. Ela precisa se chamar Telefone, Celular ou WhatsApp.');
  };

  const create = async () => {
    const j = await post({ action: 'create', name: name || fileName.replace(/\.[^.]+$/, '') || 'Nova campanha', mission, objective, endHour, dailyCap: cap, rows });
    if (j) { setOpen(false); setRows([]); setFileName(''); setName(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%');

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Campanhas" hint="Nada é enviado sem uma campanha ativa. Respostas a quem escreve continuam sempre ligadas." right={
          <button onClick={() => setOpen(o => !o)} className="px-4 py-2 rounded-xl bg-[#0071E3] text-white text-sm font-bold">{open ? 'Fechar' : 'Nova campanha'}</button>} />
        {open && (
          <div className="space-y-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da campanha (ex.: Estética Barreiras)" className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
            <div>
              <p className="text-xs font-bold text-[#6e6e73] mb-1.5">1. Lista de empresas (CSV com uma coluna Telefone)</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} className="block w-full text-sm" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#6e6e73] mb-1.5">2. Missão do agente</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MISSOES.map(x => (
                  <button key={x.t} onClick={() => { setMission(x.m); setObjective(x.o); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${mission === x.m ? 'bg-[#1D1D1F] text-white' : 'bg-black/[0.06] text-[#1D1D1F]'}`}>{x.t}</button>
                ))}
              </div>
              <textarea value={mission} onChange={e => setMission(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
              <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objetivo em uma frase" className="w-full mt-2 px-4 py-3 rounded-2xl bg-[#F5F5F7] text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-[#6e6e73]">Parar às
                <select value={endHour} onChange={e => setEndHour(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]">
                  {[12, 14, 16, 17, 18, 19].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-[#6e6e73]">Máximo por dia
                <input type="number" min={1} max={100} value={cap} onChange={e => setCap(Number(e.target.value))} className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#F5F5F7] text-sm text-[#1D1D1F]" />
              </label>
            </div>
            <p className="text-xs text-[#6e6e73]">Os envios são espalhados de forma aleatória entre o início e a hora de parar. Quem já tem conversa ou abordagem é pulado automaticamente.</p>
            <button disabled={busy} onClick={create} className="w-full py-3 rounded-2xl bg-[#1D1D1F] text-white text-sm font-bold disabled:opacity-50">{busy ? 'Criando...' : 'Criar campanha'}</button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-[#1D1D1F] break-words">{msg}</p>}
      </Card>

      {list.length === 0 && <Card><p className="text-sm text-[#6e6e73]">Nenhuma campanha ainda. Crie a primeira com a sua lista.</p></Card>}

      {list.map(c => (
        <div key={c.id}><Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold text-[#1D1D1F] truncate">{c.name}</h3>
              <p className="text-xs text-[#6e6e73]">{c.total} empresas, {c.naFila} na fila, até {c.endHour}h, máx. {c.dailyCap}/dia</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${pill[c.status]}`}>{c.status}</span>
          </div>
          <p className="text-[13px] text-[#1D1D1F] mt-2 line-clamp-3">{c.mission || 'Sem missão.'}</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
            {([['Enviadas', c.funil.enviadas, ''], ['Responderam', c.funil.responderam, pct(c.funil.responderam, c.funil.enviadas)], ['Conversa', c.funil.conversa, pct(c.funil.conversa, c.funil.responderam)], ['Interesse', c.funil.interesse, pct(c.funil.interesse, c.funil.responderam)], ['Fechou', c.funil.fechou, pct(c.funil.fechou, c.funil.enviadas)]] as [string, number, string][]).map(([l, v, p]) => (
              <div key={l} className="rounded-xl bg-[#F5F5F7] py-2">
                <div className="text-[17px] font-bold tabular-nums text-[#1D1D1F]">{v}</div>
                <div className="text-[10px] text-[#6e6e73] leading-tight">{l}</div>
                <div className="text-[10px] font-semibold text-[#0071E3]">{p || ' '}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {c.status === 'ativa'
              ? <button disabled={busy} onClick={() => post({ action: 'pause', id: c.id })} className="flex-1 py-2.5 rounded-xl bg-[#FF9500] text-white text-sm font-bold">Pausar</button>
              : <button disabled={busy} onClick={() => post({ action: 'activate', id: c.id })} className="flex-1 py-2.5 rounded-xl bg-[#34C759] text-white text-sm font-bold">Ativar</button>}
            {c.status !== 'ativa' && <button disabled={busy} onClick={() => post({ action: 'remove', id: c.id })} className="px-4 py-2.5 rounded-xl bg-black/[0.06] text-[#6e6e73] text-sm font-semibold">Apagar</button>}
          </div>
        </Card></div>
      ))}
    </div>
  );
}
