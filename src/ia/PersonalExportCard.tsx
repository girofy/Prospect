import { useEffect, useRef, useState } from 'react';
import { Smartphone, Download, X, RefreshCw, Copy } from 'lucide-react';
import { Card, SectionTitle, Btn, Pill, Skeleton } from './ui';

// Exportação única das conversas do seu WhatsApp pessoal. Nada é salvo no banco:
// o arquivo sai uma vez no download e a conexão é encerrada logo depois.
type View = {
  status: 'none' | 'waiting_qr' | 'connected' | 'building' | 'ready' | 'error';
  qr?: string;
  pairingCode?: string;
  chats?: number | null;
  messages?: number | null;
  error?: string;
};

async function call(method: 'GET' | 'POST', body?: unknown): Promise<View> {
  const r = await fetch('/api/personal-export', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Falha na exportação.');
  return j as View;
}

export default function PersonalExportCard() {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [number, setNumber] = useState('5574981017188');
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  const run = async (fn: () => Promise<View>) => {
    setBusy(true);
    setErr('');
    try { setV(await fn()); } catch (e: any) { setErr(e?.message || 'Falha na exportação.'); } finally { setBusy(false); }
  };

  useEffect(() => { run(() => call('GET')); }, []);

  // Enquanto espera o QR ou monta o arquivo, atualiza sozinho.
  useEffect(() => {
    if (!v || !['waiting_qr', 'building'].includes(v.status)) return;
    timer.current = window.setTimeout(() => run(() => call('GET')), 4000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [v]);

  async function download() {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/personal-export?download=1');
      if (!r.ok) throw new Error('Esse arquivo já foi baixado ou expirou. Para exportar de novo, inicie outra vez.');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'conversas-whatsapp.json';
      a.click();
      URL.revokeObjectURL(a.href);
      setDownloaded(true);
      setV({ status: 'none' });
    } catch (e: any) {
      setErr(e?.message || 'Falha no download.');
    } finally {
      setBusy(false);
    }
  }

  if (!v) return <Card><Skeleton className="h-32" /></Card>;

  return (
    <Card>
      <SectionTitle icon={<Smartphone className="w-4 h-4" />} title="Conectar outro número para exportar" hint="Liga outro WhatsApp só para baixar as conversas, uma vez. O número que já está conectado não é mexido. Depois do download, essa conexão é desfeita e nada fica guardado." />

      {err && <div className="mb-3 rounded-2xl p-3.5 bg-[#FF3B30]/8 text-[14px] text-[#c42b22] font-medium">{err}</div>}

      {v.status === 'none' && (
        <div className="space-y-3">
          {downloaded && <div className="text-[13.5px] text-[#1f8a3a] font-medium">Baixado. Conexão encerrada e arquivo apagado do servidor.</div>}
          <div>
            <label className="block text-[12.5px] font-semibold text-[#86868B] mb-1.5">Número do WhatsApp que você quer conectar</label>
            <input inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} placeholder="5574999999999" className="w-full rounded-xl bg-white border border-black/[0.08] px-3.5 py-2.5 text-[15px] tabular-nums outline-none focus:border-[#0071E3]" />
          </div>
          <Btn onClick={() => run(() => call('POST', { action: 'start', number }))} disabled={busy || number.replace(/\D/g, '').length < 12}>{busy ? 'Gerando código…' : 'Gerar código'}</Btn>
        </div>
      )}

      {v.status === 'waiting_qr' && (
        <div className="space-y-3">
          {v.pairingCode ? (
            <>
              <div className="text-[13.5px] text-[#1D1D1F] leading-relaxed">
                No WhatsApp desse número: toque em Configurações, Aparelhos conectados, Conectar aparelho, e escolha <b>Conectar com número de telefone</b>. Cole o código abaixo.
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-[24px] font-bold tracking-widest tabular-nums bg-white rounded-2xl px-4 py-3 select-all">{v.pairingCode}</div>
                <Btn kind="soft" onClick={async () => { try { await navigator.clipboard.writeText(v.pairingCode || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('Não consegui copiar. Segure o código e copie manualmente.'); } }}>
                  <span className="inline-flex items-center gap-2"><Copy className="w-4 h-4" />{copied ? 'Copiado' : 'Copiar código'}</span>
                </Btn>
              </div>
            </>
          ) : v.qr ? (
            <img src={v.qr} alt="QR code do WhatsApp" className="w-56 h-56 rounded-2xl bg-white p-2" />
          ) : null}
          <div className="text-[12.5px] text-[#86868B]">Esperando a leitura… a tela avança sozinha.</div>
          <Btn kind="soft" onClick={() => run(() => call('POST', { action: 'cancel' }))} disabled={busy}><span className="inline-flex items-center gap-2"><X className="w-4 h-4" />Cancelar</span></Btn>
        </div>
      )}

      {v.status === 'connected' && (
        <div className="space-y-3">
          <Pill tone="green">WhatsApp conectado</Pill>
          <div className="text-[13.5px] text-[#86868B]">Agora gero o arquivo com todas as conversas. Pode levar alguns minutos.</div>
          <div className="flex gap-2.5 flex-wrap">
            <Btn onClick={() => run(() => call('POST', { action: 'build' }))} disabled={busy}>Gerar arquivo</Btn>
            <Btn kind="soft" onClick={() => run(() => call('POST', { action: 'cancel' }))} disabled={busy}>Cancelar</Btn>
          </div>
        </div>
      )}

      {v.status === 'building' && (
        <div className="flex items-center gap-2 text-[13.5px] text-[#86868B]"><RefreshCw className="w-4 h-4 animate-spin" />Montando o arquivo… não feche a tela.</div>
      )}

      {v.status === 'ready' && (
        <div className="space-y-3">
          <div className="text-[14px] text-[#1D1D1F]">Pronto: {v.chats ?? 0} conversas e {v.messages ?? 0} mensagens.</div>
          <Btn onClick={download} disabled={busy}><span className="inline-flex items-center gap-2"><Download className="w-4 h-4" />Baixar agora (só uma vez)</span></Btn>
        </div>
      )}

      {v.status === 'error' && (
        <div className="space-y-3">
          <div className="text-[13.5px] text-[#c42b22]">Não consegui montar o arquivo: {v.error || 'erro desconhecido'}</div>
          <Btn kind="soft" onClick={() => run(() => call('POST', { action: 'cancel' }))} disabled={busy}>Recomeçar</Btn>
        </div>
      )}
    </Card>
  );
}
