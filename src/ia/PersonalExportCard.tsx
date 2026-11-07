import { useEffect, useRef, useState } from 'react';
import { Smartphone, Download, X, RefreshCw } from 'lucide-react';
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
          <Btn onClick={() => run(() => call('POST', { action: 'start' }))} disabled={busy}>{busy ? 'Iniciando…' : 'Iniciar exportação'}</Btn>
        </div>
      )}

      {v.status === 'waiting_qr' && (
        <div className="space-y-3">
          <div className="text-[13.5px] text-[#1D1D1F]">No celular pessoal: WhatsApp, Configurações, Aparelhos conectados, Conectar aparelho, e aponte para o código.</div>
          {v.qr ? <img src={v.qr} alt="QR code do WhatsApp" className="w-56 h-56 rounded-2xl bg-white p-2" /> : null}
          {v.pairingCode ? <div className="text-[22px] font-bold tracking-widest tabular-nums">{v.pairingCode}</div> : null}
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
