/**
 * [LAYOUT ARCHETYPE]: Asymmetric Functional Prospecting Console
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), deep sunken inputs with tactile buttons
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for main CTA and selected triggers, #D9B48F Nude for secondary text
 */

import React, { useState, useMemo } from 'react';
import { 
  Send, 
  Mic, 
  Sun, 
  Sunset, 
  Moon, 
  PhoneCall, 
  Trash2, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Volume2, 
  Pause, 
  Play,
  RotateCcw
} from 'lucide-react';
import { OpenerType, DispatchItem } from '../types';

interface QuickDispatchProps {
  onStartDispatch: (phones: string[], opener: OpenerType, isAudioNote: boolean) => void;
  isDispatching: boolean;
  remainingDailyLimit: number;
  dispatchProgress: { current: number; total: number; currentPhone?: string } | null;
}

export const QuickDispatch: React.FC<QuickDispatchProps> = ({
  onStartDispatch,
  isDispatching,
  remainingDailyLimit,
  dispatchProgress,
}) => {
  const [phoneRawText, setPhoneRawText] = useState<string>(
    '5511998765432\n5521987654321\n5531976543210\n5541965432109\n5551954321098'
  );
  const [selectedOpener, setSelectedOpener] = useState<OpenerType>('Bom Dia');
  const [isAudioNote, setIsAudioNote] = useState<boolean>(true);
  const [delaySeconds, setDelaySeconds] = useState<number>(12);
  const [customDryMessage, setCustomDryMessage] = useState<string>(
    'Opa, {gatilho}! Tudo bem com você?'
  );

  // Parse phone numbers from textarea
  const parsedNumbers = useMemo(() => {
    if (!phoneRawText.trim()) return [];
    return phoneRawText
      .split(/[\n,;]+/)
      .map((item) => item.replace(/\D/g, '').trim())
      .filter((num) => num.length >= 10);
  }, [phoneRawText]);

  const handleSetSample = () => {
    setPhoneRawText(
      '5511994321098\n5511987654321\n5521998877665\n5531988776655\n5541977665544\n5551966554433'
    );
  };

  const handleClear = () => {
    setPhoneRawText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedNumbers.length === 0 || isDispatching) return;
    onStartDispatch(parsedNumbers, selectedOpener, isAudioNote);
  };

  const openers: { type: OpenerType; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { type: 'Bom Dia', icon: Sun, desc: '06:00 - 12:00 (Gatilho matinal)' },
    { type: 'Boa Tarde', icon: Sunset, desc: '12:00 - 18:00 (Gatilho vespertino)' },
    { type: 'Boa Noite', icon: Moon, desc: '18:00 - 22:00 (Gatilho noturno)' },
  ];

  return (
    <section className="neu-card p-6 bg-[#181818] border border-[#282828]">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider">Módulo de Prospecção</span>
            <span className="text-[10px] font-mono bg-[#141414] text-[#F2B705] border border-[#2c2c2c] px-1.5 py-0.2">
              DISPARO RÁPIDO
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
            Abordagem Seca & Aquecimento de Lead
          </h2>
        </div>

        {/* Counter of valid leads */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-mono text-zinc-400 block">Leads Válidos</span>
            <span className="text-sm font-mono font-bold text-[#F2B705]">
              {parsedNumbers.length} números detectados
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 1. Large Textarea for Numbers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-[#F2B705]" />
              <span>Lista de Telefones (com DDD / DDI 55)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetSample}
                className="text-[11px] font-mono text-zinc-400 hover:text-white px-2 py-0.5 neu-btn flex items-center gap-1"
              >
                <FileText className="w-3 h-3 text-[#D9B48F]" />
                Carregar Exemplo
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-mono text-zinc-400 hover:text-rose-400 px-2 py-0.5 neu-btn flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Limpar
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="textarea-phone-numbers"
              rows={4}
              value={phoneRawText}
              onChange={(e) => setPhoneRawText(e.target.value)}
              placeholder="Cole aqui os números (um por linha ou separados por vírgula):&#10;5511998765432&#10;5521987654321"
              className="w-full neu-sunken p-3.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#F2B705] border border-[#222222] transition-colors leading-relaxed"
            />
            <div className="absolute right-3 bottom-3 text-[10px] font-mono text-zinc-500 bg-[#121212] px-2 py-0.5 border border-[#262626]">
              {parsedNumbers.length} LINHAS
            </div>
          </div>
        </div>

        {/* 2. Three Large Tactile Trigger Buttons (Bom Dia | Boa Tarde | Boa Noite) */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-2.5">
            Selecione o Gatilho Seco de Abertura:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {openers.map((op) => {
              const Icon = op.icon;
              const isSelected = selectedOpener === op.type;

              return (
                <button
                  key={op.type}
                  type="button"
                  id={`btn-opener-${op.type.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setSelectedOpener(op.type)}
                  className={`p-4 flex flex-col items-start justify-between text-left transition-all border ${
                    isSelected
                      ? 'neu-sunken border-[#F2B705] bg-[#141414] shadow-[0_0_12px_rgba(242,183,5,0.2)]'
                      : 'neu-btn border-[#2a2a2a] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[#F2B705]' : 'text-white'}`}>
                      {op.type}
                    </span>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-[#F2B705]' : 'text-zinc-400'}`} />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {op.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Message Mode (Áudio Humanizado vs Texto Simples) & Delay Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          
          {/* Audio Note Simulator Toggle */}
          <div className="neu-sunken p-3.5 border border-[#222222] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${isAudioNote ? 'bg-[#F2B705] text-[#121212]' : 'bg-[#202020] text-zinc-500'}`}>
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Envio de Áudio Humanizado</span>
                <span className="text-[11px] font-mono text-zinc-400">Simula gravação de voz instantânea (PT-BR)</span>
              </div>
            </div>

            <button
              type="button"
              id="toggle-audio-note"
              onClick={() => setIsAudioNote(!isAudioNote)}
              className={`w-12 h-6 neu-pill-track p-0.5 transition-colors flex items-center ${
                isAudioNote ? 'bg-[#181818]' : 'bg-[#121212]'
              }`}
            >
              <div
                className={`w-5 h-5 transition-transform duration-200 ${
                  isAudioNote 
                    ? 'translate-x-6 bg-[#F2B705] shadow-[0_0_8px_#F2B705]' 
                    : 'translate-x-0 bg-zinc-600'
                }`}
              />
            </button>
          </div>

          {/* Delay Interval Setting (Anti-Ban Cooldown) */}
          <div className="neu-sunken p-3.5 border border-[#222222] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#202020] text-[#D9B48F]">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Intervalo Inteligente</span>
                <span className="text-[11px] font-mono text-zinc-400">Cooldown dinâmico entre disparos</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="bg-[#181818] border border-[#2a2a2a] text-xs font-mono text-[#F2B705] px-2 py-1 focus:outline-none"
              >
                <option value={8}>8 seg (Rápido)</option>
                <option value={15}>15 seg (Recomendado)</option>
                <option value={30}>30 seg (Ultra Seguro)</option>
                <option value={45}>45 seg (Alta Proteção)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Live Preview Box of the Opener */}
        <div className="p-3 bg-[#131313] border border-[#222222]">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
            <span className="text-[#D9B48F]">PREVIEW DA PRIMEIRA MENSAGEM:</span>
            <span>Tipo: {isAudioNote ? '🎙️ Mensagem de Voz Gravada' : '💬 Texto Simples'}</span>
          </div>
          <div className="text-xs font-mono text-zinc-200 bg-[#181818] p-2.5 border-l-2 border-[#F2B705]">
            "{selectedOpener}! Tudo bem? Vi seu contato aqui na prospecção comercial e gostaria de fazer uma pergunta rápida."
          </div>
        </div>

        {/* 4. Main Highlight Yellow Action Button */}
        <div>
          <button
            type="submit"
            id="btn-start-dispatch-flow"
            disabled={parsedNumbers.length === 0 || isDispatching}
            className={`w-full py-4 px-6 neu-btn-accent flex items-center justify-center gap-3 text-sm font-extrabold uppercase tracking-wider transition-all ${
              parsedNumbers.length === 0 || isDispatching
                ? 'opacity-50 cursor-not-allowed filter grayscale'
                : 'hover:scale-[1.005] cursor-pointer'
            }`}
          >
            {isDispatching ? (
              <>
                <div className="w-5 h-5 border-2 border-[#121212] border-t-transparent animate-spin" />
                <span>Processando Fila de Disparo...</span>
              </>
            ) : (
              <>
                {isAudioNote ? (
                  <Mic className="w-5 h-5 text-[#121212]" />
                ) : (
                  <Send className="w-5 h-5 text-[#121212]" />
                )}
                <span>Iniciar Fluxo de Prospecção ({parsedNumbers.length} Contatos)</span>
              </>
            )}
          </button>

          {parsedNumbers.length > remainingDailyLimit && (
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-amber-400 justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Atenção: A lista ({parsedNumbers.length}) excede a cota diária restante ({remainingDailyLimit}).</span>
            </div>
          )}
        </div>

        {/* Active Dispatch Live Status Indicator */}
        {isDispatching && dispatchProgress && (
          <div className="p-4 bg-[#141414] border border-[#F2B705] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#F2B705] font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-[#F2B705] animate-ping" />
                DISPARANDO: {dispatchProgress.currentPhone}
              </span>
              <span className="text-zinc-400">
                Progresso: {dispatchProgress.current} de {dispatchProgress.total}
              </span>
            </div>

            <div className="w-full h-2 neu-sunken p-0.5 overflow-hidden">
              <div 
                className="h-full bg-[#F2B705] transition-all duration-300"
                style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

      </form>

    </section>
  );
};
