import { useEffect, useRef, useState, DragEvent } from 'react';
import { UploadCloud, FileText, Trash2, ChevronDown, Check } from 'lucide-react';
import { Card, SectionTitle, Switch, Btn, Empty, Pill, Skeleton, inputCls, COLORS } from './ui';

type Doc = { id: number; title: string; content: string; active: boolean; created_at: string };

const LIMIT = 30000; // caracteres lidos pela IA a cada mensagem
const SUGGESTIONS = ['Oferta e preços', 'Objeções e respostas', 'Perguntas frequentes', 'Tom de voz', 'Casos reais', 'Roteiro por nicho'];
const ACCEPT = '.pdf,.docx,.md,.markdown,.txt,.csv,.json,.html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json,text/html';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error('Não consegui abrir o arquivo.'));
    fr.readAsDataURL(file);
  });
}

export default function KnowledgeTab() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/knowledge');
      const j = await r.json();
      setDocs(j.docs || []);
      setTotal(j.totalChars || 0);
    } catch {
      setMsg({ kind: 'err', text: 'Sem conexão com o servidor.' });
    }
  };
  useEffect(() => { load(); }, []);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setMsg(null);
    setReading(true);
    try {
      const data = await toBase64(file);
      const r = await fetch('/api/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ kind: 'err', text: j.error || 'Não consegui ler o arquivo.' });
        return;
      }
      setTitle(t => t || j.title);
      setText(j.text);
      setMsg({ kind: 'info', text: `Li ${j.chars.toLocaleString('pt-BR')} caracteres de ${file.name}.${j.truncated ? ' O arquivo era maior, então cortei no limite.' : ''} Revise e salve.` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || 'Falha ao enviar.' });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content: text }) });
      const j = await r.json();
      if (!r.ok) return setMsg({ kind: 'err', text: j.error || 'Não salvou.' });
      setTitle('');
      setText('');
      setMsg({ kind: 'ok', text: 'Salvo. A IA já usa isso na próxima mensagem.' });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(d: Doc, active: boolean) {
    setDocs(prev => prev && prev.map(x => (x.id === d.id ? { ...x, active } : x)));
    await fetch('/api/knowledge/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, active }) });
    load();
  }

  async function remove(d: Doc) {
    if (!confirm(`Apagar "${d.title}"?`)) return;
    await fetch('/api/knowledge/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
    load();
  }

  const pct = Math.min(100, Math.round((total / LIMIT) * 100));
  const barColor = pct > 90 ? COLORS.red : pct > 70 ? COLORS.orange : COLORS.blue;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Ensinar a IA" hint="Tudo que você colocar aqui a IA lê antes de cada resposta." />

        <label
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${drag ? 'border-[#0071E3] bg-[#0071E3]/5' : 'border-black/[0.12] bg-[#FBFBFD] active:bg-black/[0.03]'}`}
        >
          <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="text-[15px] font-bold text-[#1D1D1F]">{reading ? 'Lendo o arquivo…' : 'Toque para escolher um arquivo'}</div>
          <div className="text-[13px] text-[#86868B] mt-1">PDF, Word, .md, .txt, .csv, .json, .html · até 8 MB</div>
        </label>

        <div className="flex flex-wrap gap-2 mt-4">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setTitle(s)} className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold bg-black/[0.05] text-[#1D1D1F] active:bg-black/[0.1]">{s}</button>
          ))}
        </div>

        <div className="space-y-3 mt-4">
          <input className={inputCls} placeholder="Título (ex.: Oferta e preços)" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          <textarea className={`${inputCls} min-h-[150px] resize-y leading-relaxed`} placeholder="Ou cole o texto aqui" value={text} onChange={e => setText(e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <Btn onClick={save} disabled={saving || !title.trim() || !text.trim()}>{saving ? 'Salvando…' : 'Salvar na base'}</Btn>
            <span className="text-[12.5px] text-[#86868B] tabular-nums">{text.length.toLocaleString('pt-BR')} caracteres</span>
          </div>
          {msg && (
            <div className={`rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium flex items-start gap-2 ${msg.kind === 'ok' ? 'bg-[#34C759]/12 text-[#1f8a3a]' : msg.kind === 'err' ? 'bg-[#FF3B30]/10 text-[#c42b22]' : 'bg-[#0071E3]/8 text-[#0058b0]'}`}>
              {msg.kind === 'ok' && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Base atual" right={<Pill tone={pct > 90 ? 'red' : 'blue'}>{pct}% do limite</Pill>} hint="O limite é o quanto a IA consegue ler por mensagem." />
        <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden mb-1.5">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <div className="text-[12px] text-[#86868B] tabular-nums mb-4">{total.toLocaleString('pt-BR')} de {LIMIT.toLocaleString('pt-BR')} caracteres ativos</div>

        {docs === null ? <Skeleton className="h-20" /> : docs.length === 0 ? (
          <Empty title="Nenhum documento ainda" hint="Envie um arquivo ou cole um texto acima." />
        ) : (
          <div className="divide-y divide-black/[0.06] -mx-1">
            {docs.map(d => (
              <div key={d.id} className="py-3 px-1">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${d.active ? 'bg-[#0071E3]/10 text-[#0071E3]' : 'bg-black/[0.05] text-[#a1a1a6]'}`}><FileText className="w-[18px] h-[18px]" /></div>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === d.id ? null : d.id)}>
                    <div className={`text-[14.5px] font-semibold leading-snug line-clamp-2 ${d.active ? 'text-[#1D1D1F]' : 'text-[#a1a1a6]'}`}>{d.title}</div>
                    <div className="text-[12px] text-[#86868B] tabular-nums">{d.content.length.toLocaleString('pt-BR')} caracteres</div>
                  </button>
                  <ChevronDown className={`w-4 h-4 text-[#a1a1a6] transition-transform ${open === d.id ? 'rotate-180' : ''}`} />
                  <Switch on={d.active} onChange={v => toggle(d, v)} label={`Usar "${d.title}"`} />
                </div>
                {open === d.id && (
                  <div className="mt-3 ml-12">
                    <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#424245] bg-[#FBFBFD] border border-black/[0.06] rounded-xl p-3 max-h-56 overflow-auto font-sans">{d.content.slice(0, 1500)}{d.content.length > 1500 ? '\n…' : ''}</pre>
                    <button onClick={() => remove(d)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#c42b22]"><Trash2 className="w-3.5 h-3.5" />Apagar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
