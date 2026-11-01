import React, { useState, useEffect } from 'react';
import { Trash2, ArrowLeft, CheckCircle2, AlertTriangle, Search, ShieldAlert, Key } from 'lucide-react';

interface DataDeletionProps {
  onBack?: () => void;
}

export const DataDeletion: React.FC<DataDeletionProps> = ({ onBack }) => {
  const [identifier, setIdentifier] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    confirmationCode: string;
    deletedCount?: number;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status check tab
  const [searchCode, setSearchCode] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<{
    confirmationCode: string;
    status: string;
    requestedAt: string;
    completedAt?: string;
    message: string;
  } | null>(null);

  // Auto-check if code is passed in URL query (?code=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('code');
      if (codeParam) {
        setSearchCode(codeParam);
        handleCheckStatus(codeParam);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmitDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Por favor, informe seu número de telefone ou e-mail cadastrado.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch('/api/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), notes: notes.trim() }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erro ao processar solicitação de exclusão.');
      }

      setResult({
        confirmationCode: data.confirmation_code,
        deletedCount: data.deleted_records,
        message: data.message || 'Dados excluídos com sucesso.',
      });
      setIdentifier('');
      setNotes('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao conectar com o serviço de exclusão.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (codeToCheck?: string) => {
    const code = (codeToCheck || searchCode).trim();
    if (!code) {
      setErrorMessage('Digite o código de confirmação para consultar.');
      return;
    }

    setCheckLoading(true);
    setErrorMessage(null);
    setStatusResult(null);

    try {
      const res = await fetch(`/api/data-deletion?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Código de confirmação não encontrado.');
      }

      setStatusResult({
        confirmationCode: data.confirmation_code,
        status: data.status,
        requestedAt: data.requested_at,
        completedAt: data.completed_at,
        message: data.message,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao consultar status da solicitação.');
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 font-sans p-4 sm:p-8 max-w-4xl mx-auto selection:bg-[#25D366] selection:text-black">
      
      {/* Header Bar */}
      <header className="border-b border-zinc-800 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[#25D366]">
              LGPD & META DATA DELETION
            </span>
            <span className="font-mono text-[11px] text-zinc-500">ARTIGO 18, VI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 font-mono uppercase">
            Exclusão Definitiva de Dados Pessoais
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Canal oficial para solicitação e auditoria de eliminação de registros
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-none text-xs font-mono uppercase tracking-wider text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel</span>
          </button>
        )}
      </header>

      {/* Instruções Meta Compliance */}
      <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none mb-6 space-y-2 text-xs leading-relaxed text-zinc-300">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-[#F5B700]" />
          <span>Diretrizes e Instruções de Exclusão (Meta App Review Compliance)</span>
        </div>
        <p>
          Em cumprimento às políticas da <strong>Meta Platforms</strong> e à <strong>Lei Geral de Proteção de Dados (LGPD)</strong>, 
          você pode solicitar a eliminação imediata de suas informações de contato e de todo o histórico de conversas armazenado pelo Prospectfy.
        </p>
        <p className="text-zinc-400 font-mono text-[11px]">
          Ao confirmar a exclusão, todos os seus dados são expurgados permanentemente de nossas tabelas e backups operacionais, 
          gerando um código único de protocolo para rastreamento.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-800 rounded-none text-xs text-red-200 flex items-center gap-2 mb-6 font-mono">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid: Formulário de Solicitação + Consulta de Protocolo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Painel 1: Solicitar Exclusão */}
        <div className="p-5 bg-[#09090B] border border-zinc-800 rounded-none space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Solicitar Exclusão de Dados</span>
          </div>

          <form onSubmit={handleSubmitDeletion} className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                Telefone (com DDD) ou E-mail:
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Ex: 5574988126578 ou seu@email.com"
                required
                className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#25D366]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                Motivo ou Observação (Opcional):
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Não desejo mais receber contatos comerciais."
                className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#25D366]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Processando Exclusão...' : 'Excluir Meus Dados Definitivamente'}</span>
            </button>
          </form>

          {result && (
            <div className="mt-4 p-3 bg-zinc-950 border border-[#25D366] rounded-none space-y-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#25D366] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Exclusão Concluída</span>
              </div>
              <p className="text-zinc-300">{result.message}</p>
              <div className="p-2 bg-[#000000] border border-zinc-800 text-[11px] space-y-1">
                <div>Código de Confirmação (Protocolo):</div>
                <div className="text-white font-bold tracking-wider">{result.confirmationCode}</div>
                <div className="text-zinc-500 text-[10px]">Guarde este código para consulta pública de status.</div>
              </div>
            </div>
          )}
        </div>

        {/* Painel 2: Consultar Status de Protocolo */}
        <div className="p-5 bg-[#09090B] border border-zinc-800 rounded-none space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
            <Search className="w-4 h-4 text-[#25D366]" />
            <span>Consultar Status de Solicitação</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                Código de Confirmação (Protocolo):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchCode}
                  onChange={e => setSearchCode(e.target.value)}
                  placeholder="DEL-XXXXX-XXXX"
                  className="flex-1 bg-[#000000] border border-zinc-800 rounded-none px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#25D366]"
                />
                <button
                  type="button"
                  onClick={() => handleCheckStatus()}
                  disabled={checkLoading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold rounded-none uppercase transition-colors"
                >
                  {checkLoading ? '...' : 'Verificar'}
                </button>
              </div>
            </div>

            {statusResult && (
              <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-none space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                  <span className="text-zinc-400 text-[11px]">Protocolo:</span>
                  <span className="text-white font-bold">{statusResult.confirmationCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-[11px]">Status:</span>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold uppercase">
                    {statusResult.status === 'completed' ? 'CONCLUÍDO' : 'PENDENTE'}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Data do Pedido: {new Date(statusResult.requestedAt).toLocaleString('pt-BR')}
                </div>
                {statusResult.completedAt && (
                  <div className="text-[11px] text-emerald-400">
                    Concluído em: {new Date(statusResult.completedAt).toLocaleString('pt-BR')}
                  </div>
                )}
                <p className="text-zinc-300 text-[11px] pt-1">{statusResult.message}</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-500">
        <div>Prospectfy • Girofy Tecnologia • LGPD Art. 18</div>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="hover:text-zinc-300 transition-colors">Política de Privacidade</a>
          <span>•</span>
          <a href="mailto:jlzin2603@gmail.com" className="hover:text-zinc-300 transition-colors">Contato DPO</a>
        </div>
      </footer>
    </div>
  );
};
