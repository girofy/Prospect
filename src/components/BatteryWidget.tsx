/**
 * [LAYOUT ARCHETYPE]: Mobile Launcher Clock & Battery Widget Grid
 * [RADIUS & BORDERS]: rounded-none to rounded-sm (max 4px borders), high-contrast tactile reliefs
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow primary hero & solid status gauge
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle, 
  Sliders, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { DispatchLimitStats } from '../types';

interface BatteryWidgetProps {
  stats: DispatchLimitStats;
  onUpdateLimit: (newLimit: number) => void;
  onResetCount: () => void;
}

export const BatteryWidget: React.FC<BatteryWidgetProps> = ({
  stats,
  onUpdateLimit,
  onResetCount,
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [dateString, setDateString] = useState<string>('');
  const [isEditingLimit, setIsEditingLimit] = useState<boolean>(false);
  const [tempLimit, setTempLimit] = useState<number>(stats.dailyLimit);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setTimeString(`${hours}:${minutes}`);

      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      };
      setDateString(now.toLocaleDateString('pt-BR', options));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const percentage = Math.min(100, Math.round((stats.sentToday / stats.dailyLimit) * 100));
  const remaining = Math.max(0, stats.dailyLimit - stats.sentToday);

  // Chip temperature health indicator
  const isHealthy = percentage < 90;

  return (
    <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
      
      {/* Hero Smart Launcher Style Clock & Date Widget (Inspired by Reference 1 Top Half) */}
      <div className="lg:col-span-5 bg-[#F2B705] text-[#121212] p-6 neu-card flex flex-col justify-between relative overflow-hidden border border-[#e0a700]">
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-black tracking-widest uppercase bg-[#121212] text-[#F2B705] px-2 py-0.5">
              PROSPECTION ENGINE
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-[#121212]/10 px-2 py-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span>AO VIVO</span>
          </div>
        </div>

        <div className="my-4 z-10">
          <div className="text-5xl lg:text-6xl font-extrabold tracking-tighter text-[#121212] font-mono leading-none">
            {timeString || '05:37'}
          </div>
          <div className="text-sm font-semibold tracking-wide text-[#121212]/80 mt-1 capitalize flex items-center gap-2">
            <span>{dateString || 'dom 14 dez'}</span>
            <span className="w-1 h-1 bg-[#121212] rounded-full inline-block"></span>
            <span className="text-xs font-mono font-bold">Fuso SP (GMT-3)</span>
          </div>
        </div>

        {/* Bottom Banner inside Mustard Yellow Card */}
        <div className="pt-3 border-t border-[#121212]/15 flex items-center justify-between text-xs font-bold z-10">
          <span className="font-mono text-[#121212]/90 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#121212]" />
            Anti-Ban Safety: 98%
          </span>
          <span className="bg-[#121212] text-white px-2 py-0.5 text-[11px] font-mono font-bold">
            CHIP AQUECIDO
          </span>
        </div>

        {/* Abstract subtle aesthetic background contour */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#ffc524] rounded-none opacity-40 pointer-events-none" />
      </div>

      {/* Battery / Daily Limit Meter (Gauge Card) */}
      <div className="lg:col-span-7 neu-card p-6 flex flex-col justify-between bg-[#181818] border border-[#282828]">
        
        {/* Header with Title and Limit Settings */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 neu-sunken border border-[#262626]">
              <Zap className="w-4 h-4 text-[#F2B705]" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider block">Status do Limite</span>
              <h2 className="text-sm font-bold text-white tracking-tight">Capacidade Diária de Disparos</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditingLimit ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={tempLimit}
                  onChange={(e) => setTempLimit(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-xs font-mono bg-[#141414] border border-[#F2B705] text-[#F2B705] text-center focus:outline-none"
                />
                <button
                  onClick={() => {
                    onUpdateLimit(tempLimit);
                    setIsEditingLimit(false);
                  }}
                  className="px-2 py-1 text-xs font-bold bg-[#F2B705] text-[#121212]"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <button
                id="btn-edit-daily-limit"
                onClick={() => {
                  setTempLimit(stats.dailyLimit);
                  setIsEditingLimit(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono neu-btn text-zinc-300 hover:text-white"
                title="Ajustar Meta Diária"
              >
                <Sliders className="w-3 h-3 text-[#F2B705]" />
                <span>Meta: {stats.dailyLimit}</span>
              </button>
            )}

            <button
              onClick={onResetCount}
              className="p-1.5 neu-btn text-zinc-400 hover:text-zinc-200"
              title="Resetar contador de hoje"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Status & Large Visual Meter */}
        <div className="my-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-mono text-white tracking-tight">
                {stats.sentToday}
              </span>
              <span className="text-lg font-mono text-zinc-500">
                / {stats.dailyLimit} Disparos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#141414] border border-[#2a2a2a] text-[#F2B705]">
                {percentage}% CONSUMIDO
              </span>
            </div>
          </div>

          {/* Solid Neumorphic Yellow Battery Bar */}
          <div className="w-full h-5 neu-sunken p-0.5 overflow-hidden flex items-center">
            <div
              className="h-full bg-[#F2B705] transition-all duration-500 ease-out flex items-center justify-end px-2"
              style={{ width: `${Math.max(percentage, 3)}%` }}
            >
              {percentage > 20 && (
                <span className="text-[10px] font-mono font-extrabold text-[#121212]">
                  {percentage}%
                </span>
              )}
            </div>
          </div>

          {/* Progress Segments (Battery segments) */}
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {[20, 40, 60, 80, 100].map((step, idx) => (
              <div 
                key={idx}
                className={`h-1.5 transition-colors ${
                  percentage >= step 
                    ? 'bg-[#F2B705]' 
                    : percentage >= step - 10 
                      ? 'bg-[#F2B705]/50' 
                      : 'bg-[#222222]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Micro Telemetry Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#262626]">
          <div className="neu-sunken p-2.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Restantes</span>
            <span className="text-sm font-mono font-bold text-white">{remaining} disparos</span>
          </div>

          <div className="neu-sunken p-2.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Taxa Resposta</span>
            <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {stats.conversionRate}%
            </span>
          </div>

          <div className="neu-sunken p-2.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Respostas</span>
            <span className="text-sm font-mono font-bold text-[#D9B48F]">{stats.repliesToday} leads</span>
          </div>
        </div>

      </div>

    </section>
  );
};
