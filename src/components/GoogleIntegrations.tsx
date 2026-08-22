/**
 * [LAYOUT ARCHETYPE]: Tactile Switch Deck & Calendar Scheduler Matrix
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), large neumorphic pill toggles
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for active toggles & action CTA, #D9B48F Nude for secondary metrics
 */

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Video, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon, 
  ExternalLink, 
  RefreshCw, 
  Users, 
  Layers,
  Sparkles
} from 'lucide-react';
import { GoogleIntegrationSettings } from '../types';

interface GoogleIntegrationsProps {
  settings: GoogleIntegrationSettings;
  onUpdateSettings: (newSettings: GoogleIntegrationSettings) => void;
}

export const GoogleIntegrations: React.FC<GoogleIntegrationsProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncedNotice, setSyncedNotice] = useState(false);

  const handleSyncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncedNotice(true);
      onUpdateSettings({
        ...settings,
        lastSyncTimestamp: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        syncedEventsCount: settings.syncedEventsCount + 1,
      });
      setTimeout(() => setSyncedNotice(false), 3000);
    }, 1200);
  };

  // Mock upcoming synced meetings
  const upcomingMeetings = [
    {
      id: '1',
      title: 'Diagnóstico Comercial • Lead Marcos Silveira (Tech)',
      time: 'Amanhã, 10:00 - 10:30',
      meetLink: 'https://meet.google.com/abc-wxyz-qrs',
      status: 'Confirmado',
      source: 'Disparo WhatsApp #1042',
    },
    {
      id: '2',
      title: 'Apresentação de Proposta • Dra. Camila Nogueira',
      time: 'Amanhã, 15:30 - 16:00',
      meetLink: 'https://meet.google.com/def-uvwx-lmn',
      status: 'Confirmado',
      source: 'Disparo WhatsApp #1039',
    },
    {
      id: '3',
      title: 'Alinhamento SDR • Rodada Qualificação',
      time: 'Quarta, 14:00 - 14:30',
      meetLink: 'https://meet.google.com/ghi-opqr-stu',
      status: 'Aguardando Aceite',
      source: 'Disparo WhatsApp #1035',
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Card */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider">Google Workspace Sync</span>
            <span className="text-[10px] font-mono bg-[#141414] text-[#F2B705] border border-[#2c2c2c] px-1.5 py-0.2">
              MEET & CALENDAR API
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Integrações Google Calendar & Meet
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Agendamento autônomo diretamente nas conversas do WhatsApp com criação de salas no Google Meet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing}
            className="px-3.5 py-2 neu-btn text-xs font-mono text-white flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F2B705] ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
          </button>
        </div>
      </div>

      {syncedNotice && (
        <div className="p-3 bg-[#131313] border border-emerald-500/40 text-xs font-mono text-emerald-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Agenda sincronizada com sucesso! 4 horários livres detectados para amanhã.
          </span>
          <span className="text-[10px] text-zinc-500">Google Calendar v3</span>
        </div>
      )}

      {/* 1. Large Tactile Pill Switches Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Switch Card 1: Google Calendar Sync */}
        <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 neu-sunken border border-[#262626] ${settings.calendarEnabled ? 'text-[#F2B705]' : 'text-zinc-500'}`}>
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Google Calendar
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400 block">
                    {settings.calendarEnabled ? 'Sincronização Ativa' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Large Tactile Pill Toggle Switch */}
              <button
                type="button"
                id="toggle-google-calendar"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    calendarEnabled: !settings.calendarEnabled,
                  })
                }
                className={`w-14 h-8 neu-pill-track p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                  settings.calendarEnabled ? 'bg-[#181818]' : 'bg-[#121212]'
                }`}
              >
                <div
                  className={`w-6 h-6 transition-transform duration-200 ${
                    settings.calendarEnabled 
                      ? 'translate-x-6 bg-[#F2B705] shadow-[0_0_10px_#F2B705]' 
                      : 'translate-x-0 bg-zinc-600'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Permite que o robô consulte automaticamente os slots disponíveis na sua agenda principal e reserve reuniões sem conflito.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-[#262626] flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500">Agenda Conectada:</span>
            <span className="text-white font-bold">{settings.calendarName}</span>
          </div>
        </div>

        {/* Switch Card 2: Google Meet Automation */}
        <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-3 neu-sunken border border-[#262626] ${settings.meetEnabled ? 'text-[#F2B705]' : 'text-zinc-500'}`}>
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Links do Google Meet
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400 block">
                    {settings.meetEnabled ? 'Geração Automática Ativa' : 'Desativado'}
                  </span>
                </div>
              </div>

              {/* Large Tactile Pill Toggle Switch */}
              <button
                type="button"
                id="toggle-google-meet"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    meetEnabled: !settings.meetEnabled,
                  })
                }
                className={`w-14 h-8 neu-pill-track p-1 transition-colors flex items-center shrink-0 cursor-pointer ${
                  settings.meetEnabled ? 'bg-[#181818]' : 'bg-[#121212]'
                }`}
              >
                <div
                  className={`w-6 h-6 transition-transform duration-200 ${
                    settings.meetEnabled 
                      ? 'translate-x-6 bg-[#F2B705] shadow-[0_0_10px_#F2B705]' 
                      : 'translate-x-0 bg-zinc-600'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Gera uma sala única e segura do Google Meet automaticamente no momento em que o prospect concorda com a data e horário.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-[#262626] flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500">Convite Automático:</span>
            <span className="text-[#D9B48F] font-bold">Email + WhatsApp</span>
          </div>
        </div>

      </div>

      {/* 2. Meeting Rules & Schedule Calibration */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] space-y-4">
        <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#F2B705]" />
          Regras de Disponibilidade e Horários
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="neu-sunken p-3.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-400 block mb-1.5">DURAÇÃO DO SLOT</span>
            <select
              value={settings.meetingDurationMinutes}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  meetingDurationMinutes: Number(e.target.value),
                })
              }
              className="w-full bg-[#181818] border border-[#2c2c2c] text-xs font-mono text-[#F2B705] p-1.5 focus:outline-none"
            >
              <option value={15}>15 minutos (Diagnóstico Rápido)</option>
              <option value={30}>30 minutos (Apresentação Padrão)</option>
              <option value={45}>45 minutos (Demo Completa)</option>
            </select>
          </div>

          <div className="neu-sunken p-3.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-400 block mb-1.5">INTERVALO ENTRE CALLS (BUFFER)</span>
            <select
              value={settings.bufferMinutes}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  bufferMinutes: Number(e.target.value),
                })
              }
              className="w-full bg-[#181818] border border-[#2c2c2c] text-xs font-mono text-white p-1.5 focus:outline-none"
            >
              <option value={10}>10 minutos</option>
              <option value={15}>15 minutos (Recomendado)</option>
              <option value={30}>30 minutos</option>
            </select>
          </div>

          <div className="neu-sunken p-3.5 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-400 block mb-1.5">JANELA DE ATENDIMENTO</span>
            <div className="flex items-center gap-2 text-xs font-mono text-[#D9B48F]">
              <input
                type="text"
                value={settings.businessHoursStart}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    businessHoursStart: e.target.value,
                  })
                }
                className="w-16 bg-[#181818] border border-[#2c2c2c] px-2 py-1 text-center"
              />
              <span>até</span>
              <input
                type="text"
                value={settings.businessHoursEnd}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    businessHoursEnd: e.target.value,
                  })
                }
                className="w-16 bg-[#181818] border border-[#2c2c2c] px-2 py-1 text-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Scheduled Meetings Table */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#F2B705]" />
              Próximas Reuniões Agendadas pelo Robô
            </span>
            <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
              Fila de Apresentações
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {upcomingMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="p-3.5 neu-sunken border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#333333] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{meeting.title}</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                    {meeting.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1 text-[#F2B705]">
                    <Clock className="w-3 h-3" />
                    {meeting.time}
                  </span>
                  <span>•</span>
                  <span>{meeting.source}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={meeting.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 neu-btn text-xs font-mono text-[#D9B48F] hover:text-white flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-[#F2B705]" />
                  <span>Entrar Meet</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
