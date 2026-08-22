/**
 * [LAYOUT ARCHETYPE]: Mobile Launcher Dock & Header Strip
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), tactile neumorphic edges
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for active tab, #D9B48F Nude for secondary badges
 */

import React from 'react';
import { 
  LayoutDashboard, 
  QrCode, 
  Cpu, 
  Calendar, 
  History, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Layers
} from 'lucide-react';
import { TabType, WhatsAppSessionState } from '../types';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  waState: WhatsAppSessionState;
  sentToday: number;
  dailyLimit: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  waState,
  sentToday,
  dailyLimit,
}) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'whatsapp' as TabType, label: 'Conectar WhatsApp', icon: QrCode, badge: waState.connected ? 'OK' : 'OFF' },
    { id: 'training' as TabType, label: 'Treinamento IA', icon: Cpu },
    { id: 'integrations' as TabType, label: 'Agenda & Meet', icon: Calendar },
    { id: 'history' as TabType, label: 'Logs & Disparos', icon: History },
  ];

  return (
    <header className="w-full bg-[#141414] border-b border-[#222222] sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand / Title inspired by Smart Launcher Pro clean header */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 neu-sunken flex items-center justify-center border border-[#2a2a2a]">
              <Layers className="w-5 h-5 text-[#F2B705]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tracking-widest text-[#D9B48F] uppercase">Smart Prospecting</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1E1E1E] border border-[#2c2c2c] text-[#F2B705]">v2.4 PRO</span>
              </div>
              <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
                Launcher Engine
              </h1>
            </div>
          </div>

          {/* Mobile status indicator */}
          <div className="md:hidden flex items-center gap-2">
            <div className={`w-2.5 h-2.5 ${waState.connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
            <span className="text-xs font-mono text-zinc-400">{sentToday}/{dailyLimit}</span>
          </div>
        </div>

        {/* Center / Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 neu-sunken border border-[#222222]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium tracking-wide transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#F2B705] text-[#121212] font-semibold shadow-[0_2px_8px_rgba(242,183,5,0.3)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1a]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#121212]' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1 py-0.2 text-[9px] font-mono font-bold ${
                      isActive 
                        ? 'bg-[#121212] text-[#F2B705]' 
                        : tab.badge === 'OK' 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' 
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Status / Telemetry Telemetry */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1.5 neu-flat border border-[#262626]">
            {waState.connected ? (
              <>
                <div className="w-2 h-2 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-mono text-zinc-300">WhatsApp Ativo</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-mono text-zinc-400">Desconectado</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 neu-flat border border-[#262626]">
            <Smartphone className="w-3.5 h-3.5 text-[#D9B48F]" />
            <span className="text-xs font-mono text-zinc-300">{sentToday} / {dailyLimit} envios</span>
          </div>
        </div>

      </div>
    </header>
  );
};
