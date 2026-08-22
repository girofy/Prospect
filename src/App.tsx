/**
 * [LAYOUT ARCHETYPE]: Deep Dark Neumorphic Launcher Dashboard
 * [RADIUS & BORDERS]: rounded-none to rounded-sm (max 4px borders), high-contrast tactile reliefs
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow primary accent, #D9B48F Nude secondary accents
 */

import React, { useState } from 'react';
import { 
  TabType, 
  OpenerType, 
  DispatchItem, 
  KnowledgeBook, 
  SystemPromptConfig, 
  GoogleIntegrationSettings, 
  WhatsAppSessionState, 
  DispatchLimitStats 
} from './types';
import { Navigation } from './components/Navigation';
import { BatteryWidget } from './components/BatteryWidget';
import { QuickDispatch } from './components/QuickDispatch';
import { WhatsAppConnect } from './components/WhatsAppConnect';
import { AITraining } from './components/AITraining';
import { GoogleIntegrations } from './components/GoogleIntegrations';
import { LiveActivityLogs } from './components/LiveActivityLogs';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');

  // Daily Limits & Stats
  const [stats, setStats] = useState<DispatchLimitStats>({
    dailyLimit: 10,
    sentToday: 5,
    queuedToday: 0,
    repliesToday: 3,
    conversionRate: 60,
  });

  // WhatsApp Session State
  const [waState, setWaState] = useState<WhatsAppSessionState>({
    connected: true,
    pairingStatus: 'connected',
    qrCodeSeed: 'wa-session-seed-2026',
    deviceName: 'iPhone 15 Pro Max (iOS 18)',
    batteryLevel: 92,
    networkLatencyMs: 24,
    connectedNumber: '+55 (11) 99876-5432',
    lastActive: 'Agora',
  });

  // Knowledge Base Books
  const [books, setBooks] = useState<KnowledgeBook[]>([
    {
      id: 'spin-selling',
      title: 'SPIN Selling',
      author: 'Neil Rackham',
      tagline: 'Perguntas de Situação, Problema, Implicação e Necessidade de Solução para vendas complexas.',
      active: true,
      coreFramework: 'S-P-I-N Questioning Flow',
      keyTechniques: [
        'Evitar falar de preço antes de explorar a Implicação',
        'Fazer o lead admitir a dor com perguntas de Problema',
        'Gerar valor percebido antes da demonstração técnica',
      ],
      systemWeight: 85,
    },
    {
      id: 'fanatical-prospecting',
      title: 'Prospecção Fanática',
      author: 'Jeb Blount',
      tagline: 'Técnicas de abordagem agressiva, regra dos 30 dias e consistência brutal de funil.',
      active: true,
      coreFramework: '30-Day Rule & Direct Opener',
      keyTechniques: [
        'Gatilhos secos de atenção nos primeiros 5 segundos',
        'Tratamento imediato de reflexos de rejeição',
        'Eliminação de hesitação e enrolação na mensagem',
      ],
      systemWeight: 90,
    },
    {
      id: '100m-offers',
      title: 'Ofertas de 100 Milhões',
      author: 'Alex Hormozi',
      tagline: 'Como criar Grand Slam Offers que tornam dizer não irracional para o cliente.',
      active: true,
      coreFramework: 'Value Equation: (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort)',
      keyTechniques: [
        'Empilhamento de bônus e garantia incondicional',
        'Redução drástica do esforço percebido pelo lead',
        'Urgência legítima na marcação do diagnóstico',
      ],
      systemWeight: 75,
    },
    {
      id: 'predictable-revenue',
      title: 'Receita Previsível',
      author: 'Aaron Ross',
      tagline: 'Cold Calling 2.0, segmentação especializada de SDR e máquinas de leads outbound.',
      active: false,
      coreFramework: 'Cold Outreach 2.0 & Role Specialization',
      keyTechniques: [
        'Email curto e objetivo com pergunta de direcionamento',
        'Qualificação estrita de BANT antes de passar para o Closer',
      ],
      systemWeight: 50,
    },
    {
      id: 'the-challenger-sale',
      title: 'The Challenger Sale',
      author: 'Matthew Dixon & Brent Adamson',
      tagline: 'Ensinar, customizar a mensagem e assumir o controle da conversa comercial.',
      active: false,
      coreFramework: 'Teach, Tailor, Take Control',
      keyTechniques: [
        'Desafiar as premissas prévias do prospect',
        'Apresentar insights contraintuitivos sobre o mercado',
      ],
      systemWeight: 60,
    },
  ]);

  // System Prompt Config
  const [systemPrompt, setSystemPrompt] = useState<SystemPromptConfig>({
    presetName: 'Consultor Estratégico (SPIN + Hormozi)',
    prompt: `Você é um Consultor Sênior de Vendas B2B operando via WhatsApp.
Regras fundamentais:
1. Responda SEMPRE em tom humano, natural e conciso (máximo 2 a 3 frases por mensagem).
2. Nunca envie blocos longos de texto nem PDF na primeira mensagem.
3. Se o lead perguntar preço, aplique o princípio de Implicação do SPIN Selling e a Equação de Valor de Hormozi: valide o interesse e faça uma pergunta de diagnóstico de processo antes de revelar valores.
4. Conduza o lead para agendamento de um diagnóstico rápido via Google Meet.`,
    temperature: 0.6,
    tone: 'consultivo',
    maxTokens: 300,
    includeAudioNoteTrigger: true,
    safetyCooldownSeconds: 15,
  });

  // Google Integrations Settings
  const [googleSettings, setGoogleSettings] = useState<GoogleIntegrationSettings>({
    calendarEnabled: true,
    meetEnabled: true,
    calendarId: 'primary_sales_calendar',
    calendarName: 'Agenda Comercial Principal',
    autoCreateMeetLink: true,
    meetingDurationMinutes: 30,
    bufferMinutes: 15,
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    syncedEventsCount: 8,
    lastSyncTimestamp: 'Hoje às 15:10',
  });

  // Dispatch Logs
  const [logs, setLogs] = useState<DispatchItem[]>([
    {
      id: 'dsp-101',
      phone: '5511998765432',
      name: 'Marcos Silveira',
      status: 'sent',
      opener: 'Bom Dia',
      timestamp: 'Hoje às 09:14',
      channel: 'whatsapp',
      responseReceived: true,
    },
    {
      id: 'dsp-102',
      phone: '5521987654321',
      name: 'Camila Nogueira',
      status: 'sent',
      opener: 'Bom Dia',
      timestamp: 'Hoje às 09:28',
      channel: 'whatsapp',
      responseReceived: true,
    },
    {
      id: 'dsp-103',
      phone: '5531976543210',
      status: 'sent',
      opener: 'Boa Tarde',
      timestamp: 'Hoje às 13:42',
      channel: 'whatsapp',
      responseReceived: false,
    },
    {
      id: 'dsp-104',
      phone: '5541965432109',
      status: 'sent',
      opener: 'Boa Tarde',
      timestamp: 'Hoje às 14:05',
      channel: 'whatsapp',
      responseReceived: true,
    },
    {
      id: 'dsp-105',
      phone: '5551954321098',
      status: 'sent',
      opener: 'Boa Tarde',
      timestamp: 'Hoje às 14:50',
      channel: 'whatsapp',
      responseReceived: false,
    },
  ]);

  // Dispatch Runner State
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<{
    current: number;
    total: number;
    currentPhone?: string;
  } | null>(null);

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Handlers
  const handleUpdateLimit = (newLimit: number) => {
    setStats((prev) => ({ ...prev, dailyLimit: newLimit }));
    showToast(`Meta diária atualizada para ${newLimit} disparos.`);
  };

  const handleResetCount = () => {
    setStats((prev) => ({ ...prev, sentToday: 0 }));
    showToast('Contador diário reiniciado para 0.');
  };

  const handleToggleBook = (id: string) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b))
    );
  };

  const handleUpdateBookWeight = (id: string, weight: number) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, systemWeight: weight } : b))
    );
  };

  const handleStartDispatch = (phones: string[], opener: OpenerType, isAudioNote: boolean) => {
    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: phones.length, currentPhone: phones[0] });

    let index = 0;
    const interval = setInterval(() => {
      if (index >= phones.length) {
        clearInterval(interval);
        setIsDispatching(false);
        setDispatchProgress(null);
        showToast(`Fluxo concluído: ${phones.length} disparos realizados com sucesso!`);
        return;
      }

      const phone = phones[index];
      const nowStr = 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const newLog: DispatchItem = {
        id: `dsp-${Date.now()}-${index}`,
        phone,
        status: 'sent',
        opener,
        timestamp: nowStr,
        channel: 'whatsapp',
        responseReceived: Math.random() > 0.4,
      };

      setLogs((prev) => [newLog, ...prev]);
      setStats((prev) => ({
        ...prev,
        sentToday: prev.sentToday + 1,
        repliesToday: newLog.responseReceived ? prev.repliesToday + 1 : prev.repliesToday,
      }));

      index++;
      if (index < phones.length) {
        setDispatchProgress({
          current: index,
          total: phones.length,
          currentPhone: phones[index],
        });
      }
    }, 1500);
  };

  const handleConnectWhatsApp = () => {
    setWaState((prev) => ({
      ...prev,
      connected: true,
      pairingStatus: 'connected',
      deviceName: 'iPhone 15 Pro Max (iOS 18)',
      connectedNumber: '+55 (11) 98765-4321',
      batteryLevel: 94,
    }));
    showToast('WhatsApp conectado com sucesso!');
  };

  const handleDisconnectWhatsApp = () => {
    setWaState((prev) => ({
      ...prev,
      connected: false,
      pairingStatus: 'awaiting_scan',
      deviceName: '',
      connectedNumber: '',
    }));
    showToast('Sessão do WhatsApp desconectada.');
  };

  const handleRefreshQR = () => {
    setWaState((prev) => ({
      ...prev,
      qrCodeSeed: `qr-seed-${Date.now()}`,
    }));
    showToast('QR Code atualizado.');
  };

  const handleClearLogs = () => {
    setLogs([]);
    showToast('Histórico de disparos limpo.');
  };

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col selection:bg-[#F2B705] selection:text-[#121212]">
      
      {/* 1. TOP NAVIGATION WITH CLEAN MINIMALIST ICONS */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        waState={waState}
        sentToday={stats.sentToday}
        dailyLimit={stats.dailyLimit}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* TAB 1: DASHBOARD (Includes Battery Status Widget + Quick Dispatch + Integrations overview) */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* 2. BLOCO DE STATUS (WIDGET DE BATERIA / RELÓGIO SMART LAUNCHER) */}
            <BatteryWidget
              stats={stats}
              onUpdateLimit={handleUpdateLimit}
              onResetCount={handleResetCount}
            />

            {/* 3. MÓDULO DE DISPARO RÁPIDO (PROSPECÇÃO) */}
            <QuickDispatch
              onStartDispatch={handleStartDispatch}
              isDispatching={isDispatching}
              remainingDailyLimit={Math.max(0, stats.dailyLimit - stats.sentToday)}
              dispatchProgress={dispatchProgress}
            />

            {/* Quick Link Cards to other areas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => setCurrentTab('whatsapp')}
                className="neu-card p-4 border border-[#282828] hover:border-[#383838] cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono text-[#D9B48F] uppercase block">WhatsApp Conexão</span>
                  <span className="text-xs font-bold text-white">
                    {waState.connected ? '🟢 Dispositivo Ativo' : '🔴 Aguardando Leitura'}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#F2B705] underline">Ver QR →</span>
              </div>

              <div 
                onClick={() => setCurrentTab('training')}
                className="neu-card p-4 border border-[#282828] hover:border-[#383838] cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono text-[#D9B48F] uppercase block">Engine IA</span>
                  <span className="text-xs font-bold text-white">
                    {books.filter(b => b.active).length} Frameworks Ativos
                  </span>
                </div>
                <span className="text-xs font-mono text-[#F2B705] underline">Ajustar Prompt →</span>
              </div>

              <div 
                onClick={() => setCurrentTab('integrations')}
                className="neu-card p-4 border border-[#282828] hover:border-[#383838] cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono text-[#D9B48F] uppercase block">Google Workspace</span>
                  <span className="text-xs font-bold text-white">
                    {googleSettings.calendarEnabled ? 'Calendar + Meet ON' : 'Desativado'}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#F2B705] underline">Configurar →</span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: WHATSAPP CONNECT (MÉTODO QR CODE) */}
        {currentTab === 'whatsapp' && (
          <WhatsAppConnect
            state={waState}
            onConnect={handleConnectWhatsApp}
            onDisconnect={handleDisconnectWhatsApp}
            onRefreshQR={handleRefreshQR}
          />
        )}

        {/* TAB 3: SEÇÃO DE TREINAMENTO (BASE DE CONHECIMENTO & SYSTEM PROMPT) */}
        {currentTab === 'training' && (
          <AITraining
            books={books}
            onToggleBook={handleToggleBook}
            onUpdateBookWeight={handleUpdateBookWeight}
            systemPrompt={systemPrompt}
            onUpdateSystemPrompt={(newConfig) => {
              setSystemPrompt(newConfig);
              showToast('Configurações do System Prompt atualizadas.');
            }}
          />
        )}

        {/* TAB 4: INTEGRAÇÕES GOOGLE (MEET E AGENDA) */}
        {currentTab === 'integrations' && (
          <GoogleIntegrations
            settings={googleSettings}
            onUpdateSettings={(newSettings) => {
              setGoogleSettings(newSettings);
              showToast('Configurações de integração atualizadas.');
            }}
          />
        )}

        {/* TAB 5: LOGS & HISTÓRICO */}
        {currentTab === 'history' && (
          <LiveActivityLogs
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        )}

      </main>

      {/* Persistent Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 neu-card bg-[#1a1a1a] border border-[#F2B705] text-xs font-mono text-[#F2B705] flex items-center gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.8)] animate-fade-in">
          <div className="w-2 h-2 bg-[#F2B705] animate-ping" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Footer Strip */}
      <footer className="w-full bg-[#101010] border-t border-[#202020] py-3 px-4 text-center text-[11px] font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Smart Launcher Admin • Deep Dark Neumorphic Architecture</span>
          <span className="text-[#D9B48F]">Baileys WhatsApp Web • Google Meet API • SPIN Selling Framework</span>
        </div>
      </footer>

    </div>
  );
}
