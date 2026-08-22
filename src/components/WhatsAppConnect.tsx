/**
 * [LAYOUT ARCHETYPE]: Monospace Technical Console & QR Chamber
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), high-contrast neumorphic container
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for QR frame accents, Green/Red for status indicators
 */

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  BatteryCharging, 
  Wifi, 
  Unlink, 
  ShieldCheck,
  Send,
  Zap,
  Info
} from 'lucide-react';
import { WhatsAppSessionState } from '../types';

interface WhatsAppConnectProps {
  state: WhatsAppSessionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefreshQR: () => void;
}

export const WhatsAppConnect: React.FC<WhatsAppConnectProps> = ({
  state,
  onConnect,
  onDisconnect,
  onRefreshQR,
}) => {
  const [countdown, setCountdown] = useState<number>(25);
  const [testMsgSent, setTestMsgSent] = useState<boolean>(false);

  // Auto-refresh countdown for QR code
  useEffect(() => {
    if (state.connected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefreshQR();
          return 25;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.connected, onRefreshQR]);

  const handleTestPing = () => {
    setTestMsgSent(true);
    setTimeout(() => setTestMsgSent(false), 3000);
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Banner / Header */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider">Instância WhatsApp Web</span>
            <span className="text-[10px] font-mono bg-[#141414] text-[#F2B705] border border-[#2c2c2c] px-1.5 py-0.2">
              BAILEYS ENGINE v6.4
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Conexão e Pareamento
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Sincronização em tempo real com seu número para automação de envios e respostas.
          </p>
        </div>

        {/* Status Pill Indicator */}
        <div className="flex items-center gap-3">
          <div className="neu-sunken px-4 py-2.5 border border-[#222222] flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-none ${
                state.connected
                  ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
              }`}
            />
            <span className="text-xs font-mono font-bold tracking-wide text-white uppercase">
              {state.connected ? 'Conectado' : 'Aguardando Celular'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: QR Code Chamber + Telemetry / Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Authentic Clean Dark QR Code Container */}
        <div className="md:col-span-6 neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col items-center justify-center text-center">
          
          <div className="text-xs font-mono text-zinc-400 mb-4 flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-[#F2B705]" />
            <span>{state.connected ? 'SESSÃO AUTORIZADA' : `EXPIRA EM: 00:${String(countdown).padStart(2, '0')}s`}</span>
          </div>

          {/* Centralized Clean & Dark QR Code Square */}
          <div className="relative w-64 h-64 p-4 neu-sunken border border-[#262626] flex items-center justify-center bg-[#101010]">
            
            {state.connected ? (
              // Connected State Visualizer
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">WhatsApp Pareado</span>
                  <span className="text-xs font-mono text-[#D9B48F] block mt-0.5">{state.connectedNumber}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 border border-emerald-800/40">
                  Sessão Criptografada (E2EE)
                </span>
              </div>
            ) : (
              // Authentic Stylized QR Code Matrix
              <div className="relative w-full h-full flex items-center justify-center">
                {/* SVG Rendered Precision QR Matrix */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full text-white fill-current opacity-90 p-2"
                >
                  {/* Outer corner finders */}
                  <rect x="5" y="5" width="26" height="26" fill="#F2B705" />
                  <rect x="9" y="9" width="18" height="18" fill="#101010" />
                  <rect x="13" y="13" width="10" height="10" fill="#F2B705" />

                  <rect x="69" y="5" width="26" height="26" fill="#F2B705" />
                  <rect x="73" y="9" width="18" height="18" fill="#101010" />
                  <rect x="77" y="13" width="10" height="10" fill="#F2B705" />

                  <rect x="5" y="69" width="26" height="26" fill="#F2B705" />
                  <rect x="9" y="73" width="18" height="18" fill="#101010" />
                  <rect x="13" y="77" width="10" height="10" fill="#F2B705" />

                  {/* QR Matrix Dots */}
                  <rect x="36" y="8" width="4" height="4" fill="#ffffff" />
                  <rect x="44" y="8" width="4" height="4" fill="#ffffff" />
                  <rect x="52" y="8" width="4" height="4" fill="#ffffff" />
                  <rect x="60" y="8" width="4" height="4" fill="#ffffff" />

                  <rect x="36" y="16" width="4" height="4" fill="#ffffff" />
                  <rect x="48" y="16" width="4" height="4" fill="#ffffff" />
                  <rect x="56" y="16" width="4" height="4" fill="#ffffff" />

                  <rect x="8" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="16" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="24" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="36" y="36" width="8" height="8" fill="#F2B705" />
                  <rect x="48" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="56" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="64" y="36" width="8" height="8" fill="#ffffff" />
                  <rect x="76" y="36" width="4" height="4" fill="#ffffff" />
                  <rect x="88" y="36" width="4" height="4" fill="#ffffff" />

                  <rect x="8" y="44" width="4" height="4" fill="#ffffff" />
                  <rect x="20" y="44" width="4" height="4" fill="#ffffff" />
                  <rect x="36" y="48" width="4" height="4" fill="#ffffff" />
                  <rect x="44" y="48" width="8" height="8" fill="#F2B705" />
                  <rect x="60" y="48" width="4" height="4" fill="#ffffff" />
                  <rect x="72" y="48" width="4" height="4" fill="#ffffff" />
                  <rect x="84" y="48" width="4" height="4" fill="#ffffff" />

                  <rect x="8" y="56" width="4" height="4" fill="#ffffff" />
                  <rect x="16" y="56" width="4" height="4" fill="#ffffff" />
                  <rect x="24" y="56" width="4" height="4" fill="#ffffff" />
                  <rect x="36" y="60" width="4" height="4" fill="#ffffff" />
                  <rect x="48" y="60" width="4" height="4" fill="#ffffff" />
                  <rect x="56" y="60" width="8" height="8" fill="#ffffff" />
                  <rect x="72" y="60" width="4" height="4" fill="#ffffff" />
                  <rect x="88" y="60" width="4" height="4" fill="#ffffff" />

                  <rect x="36" y="72" width="4" height="4" fill="#ffffff" />
                  <rect x="44" y="72" width="4" height="4" fill="#ffffff" />
                  <rect x="52" y="72" width="4" height="4" fill="#ffffff" />
                  <rect x="64" y="72" width="4" height="4" fill="#ffffff" />
                  <rect x="76" y="72" width="4" height="4" fill="#ffffff" />
                  <rect x="84" y="72" width="4" height="4" fill="#ffffff" />

                  <rect x="36" y="84" width="8" height="8" fill="#F2B705" />
                  <rect x="48" y="84" width="4" height="4" fill="#ffffff" />
                  <rect x="56" y="84" width="4" height="4" fill="#ffffff" />
                  <rect x="68" y="84" width="4" height="4" fill="#ffffff" />
                  <rect x="76" y="84" width="8" height="8" fill="#ffffff" />
                </svg>

                {/* Laser scan line animation */}
                <div className="absolute inset-x-0 h-0.5 bg-[#F2B705] shadow-[0_0_12px_#F2B705] animate-[bounce_2.5s_infinite] pointer-events-none opacity-80" />
              </div>
            )}

          </div>

          {/* Controls Below QR Code */}
          <div className="w-full mt-5 flex items-center gap-2">
            {!state.connected ? (
              <>
                <button
                  type="button"
                  id="btn-simulate-qr-scan"
                  onClick={onConnect}
                  className="flex-1 py-2.5 px-3 neu-btn-accent text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Simular Leitura QR Code</span>
                </button>

                <button
                  type="button"
                  id="btn-refresh-qr"
                  onClick={onRefreshQR}
                  className="p-2.5 neu-btn text-zinc-300 hover:text-white"
                  title="Atualizar QR Code"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-test-ping"
                  onClick={handleTestPing}
                  className="flex-1 py-2.5 px-3 neu-btn text-xs font-mono text-white flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-[#F2B705]" />
                  <span>{testMsgSent ? 'Ping OK (18ms)' : 'Testar Conexão'}</span>
                </button>

                <button
                  type="button"
                  id="btn-disconnect-session"
                  onClick={onDisconnect}
                  className="py-2.5 px-4 neu-btn text-xs font-mono text-rose-400 hover:bg-rose-950/40 border-rose-900/40 flex items-center gap-1.5"
                >
                  <Unlink className="w-4 h-4" />
                  <span>Desconectar</span>
                </button>
              </>
            )}
          </div>

        </div>

        {/* Right Column: Instructions & Device Telemetry */}
        <div className="md:col-span-6 space-y-4 flex flex-col justify-between">
          
          {/* Instructions Step Card */}
          <div className="neu-card p-5 bg-[#181818] border border-[#282828] space-y-3">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#F2B705]" />
              Instruções de Emparelhamento
            </span>

            <ol className="space-y-3 text-xs text-zinc-300 font-sans">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 neu-sunken border border-[#2c2c2c] text-[#F2B705] font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <span>Abra o <strong>WhatsApp</strong> no seu smartphone principal.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 neu-sunken border border-[#2c2c2c] text-[#F2B705] font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <span>Toque em <strong>Configurações</strong> ou <strong>Aparelhos Conectados</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 neu-sunken border border-[#2c2c2c] text-[#F2B705] font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <span>Toque em <strong>Conectar um Aparelho</strong> e aponte a câmera para o QR Code ao lado.</span>
              </li>
            </ol>
          </div>

          {/* Telemetry & Device Health Card */}
          <div className="neu-card p-5 bg-[#181818] border border-[#282828] space-y-3">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#F2B705]" />
              Telemetria do Aparelho
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="neu-sunken p-2.5 border border-[#222222]">
                <span className="text-[10px] text-zinc-500 block">Dispositivo</span>
                <span className="text-white font-bold truncate block">
                  {state.connected ? state.deviceName : 'Nenhum Pareado'}
                </span>
              </div>

              <div className="neu-sunken p-2.5 border border-[#222222]">
                <span className="text-[10px] text-zinc-500 block">Bateria do Celular</span>
                <span className="text-white font-bold flex items-center gap-1">
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  {state.connected ? `${state.batteryLevel}%` : '--'}
                </span>
              </div>

              <div className="neu-sunken p-2.5 border border-[#222222]">
                <span className="text-[10px] text-zinc-500 block">Latência WebSocket</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" />
                  {state.connected ? `${state.networkLatencyMs}ms` : '--'}
                </span>
              </div>

              <div className="neu-sunken p-2.5 border border-[#222222]">
                <span className="text-[10px] text-zinc-500 block">Protocolo</span>
                <span className="text-[#D9B48F] font-bold">Multi-Device 2.0</span>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-[#131313] border border-[#222222] flex items-center gap-2.5 text-[11px] font-mono text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-[#F2B705] shrink-0" />
            <span>As chaves de sessão permanecem isoladas na instância local sem compartilhamento externo.</span>
          </div>

        </div>

      </div>

    </section>
  );
};
