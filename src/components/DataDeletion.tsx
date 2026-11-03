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
      if (res.ok) {
        setResult(data);
        setIdentifier('');
        setNotes('');
      } else {
        setErrorMessage(data.error || 'Erro ao processar a solicitação de exclusão.');
      }
    } catch (err: any) {
      setErrorMessage(`Falha na comunicação com o servidor: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (codeToCheck?: string) => {
    const code = (codeToCheck || searchCode).trim();
    if (!code) return;

    setCheckLoading(true);
    setStatusResult(null);

    try {
      const res = await fetch(`/api/data-deletion?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok) {
        setStatusResult(data);
      } else {
        setStatusResult({
          confirmationCode: code,
          status: 'nao_encontrado',
          requestedAt: new Date().toISOString(),
          message: data.error || 'Código de confirmação não encontrado no sistema.',
        });
      }
    } catch (err: any) {
      setStatusResult({
        confirmationCode: code,
        status: 'erro',
        requestedAt: new Date().toISOString(),
        message: 'Erro ao consultar o status. Verifique sua conexão.',
      });
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans p-4 sm:p-8 max-w-3xl mx-auto selection:bg-[#0071E3] selection:text-white">
      
      {/* Header */}
      <header className="border-b border-black/[0.08] pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded">
              Direito de Eliminação de Dados (Art. 18 LGPD)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Exclusão de Dados — Prospectfy
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Canal oficial para revogação de consentimento e eliminação de histórico de atendimento WhatsApp
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-black/[0.08] rounded text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel</span>
          </button>
        )}
      </header>

      <div className="space-y-6">
        
        {/* Informative Card */}
        <div className="p-4 bg-white border border-black/[0.08] rounded shadow-xs text-xs sm:text-sm text-zinc-600 space-y-2">
          <p>
            De acordo com os requisitos da <strong>Meta Platforms</strong> e os direitos fundamentais garantidos pela 
            <strong> LGPD (Lei nº 13.709/2018)</strong>, qualquer pessoa física que tenha interagido com o número comercial 
            da Girofy Tecnologia pode solicitar a eliminação imediata dos seus dados cadastrais e mensagens.
          </p>
          <div className="p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded text-xs text-zinc-500">
            <strong>O que é excluído:</strong> Seu número de telefone, mensagens trocadas, status de qualificação e histórico comercial. 
            A exclusão é irreversível no banco de dados operacional.
          </div>
        </div>

        {/* Form Deletion Card */}
        <div className="p-5 bg-white border border-black/[0.08] rounded shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider mb-4">
            <Trash2 className="w-4 h-4 text-[#FF3B30]" />
            <span>Solicitar Exclusão Imediata</span>
          </div>

          {result ? (
            <div className="p-4 bg-[#34C759]/10 border border-[#34C759]/30 rounded space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#248A3D]">
                <CheckCircle2 className="w-5 h-5 text-[#34C759]" />
                <span>Solicitação Processada com Sucesso</span>
              </div>
              <p className="text-xs text-zinc-700">{result.message}</p>
              
              <div className="p-3 bg-white border border-[#34C759]/20 rounded">
                <span className="text-[11px] text-zinc-500 font-semibold block">Código de Confirmação Oficial:</span>
                <span className="font-mono text-sm font-bold text-[#0071E3] select-all">
                  {result.confirmationCode}
                </span>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Guarde este código para consultar o comprovante da exclusão a qualquer momento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="mt-2 px-3 py-1.5 bg-[#1D1D1F] text-white text-xs font-medium rounded hover:bg-zinc-800 transition-colors shadow-xs"
              >
                Fazer Nova Solicitação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitDeletion} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded text-xs text-[#FF3B30] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-800 mb-1">
                  Telefone WhatsApp (com DDD) ou E-mail Cadastrado *
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Ex: 5574988126578 ou seu@email.com"
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F7] border border-black/[0.08] rounded text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800 mb-1">
                  Motivo da Solicitação (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Não tenho interesse nos serviços ou não desejo mais ser contatado."
                  className="w-full px-3 py-2 text-xs bg-[#F5F5F7] border border-black/[0.08] rounded text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-zinc-400">
                  Processamento imediato e registro em log de conformidade.
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#FF3B30] hover:bg-[#E0352B] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors shadow-xs"
                >
                  {loading ? 'Processando Exclusão...' : 'Excluir Meus Dados'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Check Status Card */}
        <div className="p-5 bg-white border border-black/[0.08] rounded shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider mb-2">
            <Key className="w-4 h-4 text-[#0071E3]" />
            <span>Consultar Comprovante de Exclusão (Callback Meta)</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Se você já possui um código de exclusão fornecido pela Meta ou por esta página, verifique o status aqui:
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              placeholder="Ex: del-1730389100000-abc12"
              className="flex-1 px-3 py-2 text-xs font-mono bg-[#F5F5F7] border border-black/[0.08] rounded text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white"
            />
            <button
              type="button"
              onClick={() => handleCheckStatus()}
              disabled={checkLoading || !searchCode.trim()}
              className="px-4 py-2 bg-[#1D1D1F] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{checkLoading ? 'Consultando...' : 'Consultar'}</span>
            </button>
          </div>

          {statusResult && (
            <div className="mt-3 p-3 bg-[#F5F5F7] border border-black/[0.06] rounded text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-700">Status:</span>
                <span className={`font-mono uppercase px-2 py-0.5 rounded text-[10px] font-bold ${
                  statusResult.status === 'concluido' 
                    ? 'bg-[#34C759]/20 text-[#248A3D]' 
                    : 'bg-[#FF9500]/20 text-[#C97700]'
                }`}>
                  {statusResult.status}
                </span>
              </div>
              <p className="text-zinc-600 pt-1">{statusResult.message}</p>
              <div className="text-[10px] text-zinc-400 font-mono pt-1">
                Data do Registro: {new Date(statusResult.requestedAt).toLocaleString('pt-BR')}
              </div>
            </div>
          )}
        </div>

      </div>

      <footer className="mt-8 pt-4 border-t border-black/[0.08] text-center text-xs text-zinc-500">
        Prospectfy • Encarregado DPO: jlzin2603@gmail.com • Girofy Tecnologia
      </footer>
    </div>
  );
};
