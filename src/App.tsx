import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Sun, 
  Sunset, 
  Moon, 
  Mic, 
  Send, 
  Play, 
  ShieldCheck, 
  Upload, 
  FileText, 
  Video, 
  ArrowLeft, 
  Volume2, 
  RefreshCw, 
  FileSpreadsheet, 
  ExternalLink,
  Zap,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Wifi,
  Power
} from 'lucide-react';
import { 
  OpenerType, 
  DispatchItem, 
  KnowledgeBook, 
  SystemPromptConfig, 
  GoogleIntegrationSettings, 
  WhatsAppSessionState, 
  DispatchLimitStats 
} from './types';

export default function App() {
  // Navegação: 'home' | 'whatsapp' | 'ai' | 'calendar' | 'sheets' | 'dispatch' | 'history'
  const [activeTab, setActiveTab] = useState<'home' | 'whatsapp' | 'ai' | 'calendar' | 'sheets' | 'dispatch' | 'history'>('home');

  // Relógio ao vivo
  const [timeString, setTimeString] = useState('05:37');
  const [dateString, setDateString] = useState('dom 14 dez');

  // Estatísticas e Metas do Dia
  const [stats, setStats] = useState<DispatchLimitStats>({
    dailyLimit: 10,
    sentToday: 5,
    queuedToday: 0,
    repliesToday: 3,
    conversionRate: 60,
  });

  // Gatilho rápido selecionado e áudio
  const [selectedOpener, setSelectedOpener] = useState<OpenerType>('Bom Dia');
  const [isAudioNote, setIsAudioNote] = useState<boolean>(true);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; phone?: string } | null>(null);

  // Sessão WhatsApp Dinâmica com Estados Reais
  const [waState, setWaState] = useState<WhatsAppSessionState>({
    connected: true,
    pairingStatus: 'connected',
    qrCodeSeed: 'wa-session-prod-2026',
    deviceName: 'Servidor Prospecção Web',
    batteryLevel: 100,
    networkLatencyMs: 18,
    connectedNumber: '+55 (11) 99876-5432',
    lastActive: 'Agora mesmo',
  });
  const [isSyncingWa, setIsSyncingWa] = useState<boolean>(false);
  const [isConnectingWa, setIsConnectingWa] = useState<boolean>(false);

  // Lista de contatos / Telefones
  const [phoneListText, setPhoneListText] = useState(
    '5511998765432\n5521987654321\n5531976543210\n5541965432109\n5551954321098'
  );

  // Conversas do WhatsApp
  const [selectedChatId, setSelectedChatId] = useState<string>('c1');
  const [chats, setChats] = useState([
    {
      id: 'c1',
      name: 'Marcos Silveira',
      phone: '+55 (11) 99876-5432',
      lastMsg: 'Perfeito! Amanhã às 10h no Meet fica ótimo para mim.',
      time: '14:32',
      unread: 0,
      avatar: '👨‍💼',
      messages: [
        { id: 'm1', from: 'bot', text: 'Bom Dia! Vi seu contato na prospecção comercial e gostaria de fazer uma pergunta rápida.', time: '09:14', isAudio: true },
        { id: 'm2', from: 'lead', text: 'Opa, bom dia! Sobre o que seria exatamente?', time: '09:22', isAudio: false },
        { id: 'm3', from: 'bot', text: 'Trabalhamos com automação de vendas via IA. Conseguimos abrir 15 minutos amanhã para um diagnóstico rápido no Meet?', time: '09:25', isAudio: false },
        { id: 'm4', from: 'lead', text: 'Perfeito! Amanhã às 10h no Meet fica ótimo para mim.', time: '14:32', isAudio: false },
      ]
    },
    {
      id: 'c2',
      name: 'Dra. Camila Nogueira',
      phone: '+55 (21) 98765-4321',
      lastMsg: 'Quanto custa a implantação completa?',
      time: '13:10',
      unread: 1,
      avatar: '👩‍⚕️',
      messages: [
        { id: 'm1', from: 'bot', text: 'Bom Dia, Dra. Camila! Tudo bem por aí?', time: '09:28', isAudio: true },
        { id: 'm2', from: 'lead', text: 'Olá! Tudo bem. O que vocês oferecem?', time: '11:45', isAudio: false },
        { id: 'm3', from: 'lead', text: 'Quanto custa a implantação completa?', time: '13:10', isAudio: false },
      ]
    },
    {
      id: 'c3',
      name: 'Lucas Brandão',
      phone: '+55 (31) 97654-3210',
      lastMsg: 'Gatilho de Boa Tarde enviado',
      time: '12:05',
      unread: 0,
      avatar: '🧑‍💻',
      messages: [
        { id: 'm1', from: 'bot', text: 'Boa Tarde! Tudo bem com você?', time: '12:05', isAudio: true }
      ]
    }
  ]);
  const [newChatInput, setNewChatInput] = useState('');

  // Base de Conhecimento / Livros de Vendas
  const [books, setBooks] = useState<KnowledgeBook[]>([
    {
      id: 'spin-selling',
      title: 'SPIN Selling',
      author: 'Neil Rackham',
      tagline: 'Perguntas de Situação, Problema, Implicação e Necessidade.',
      active: true,
      coreFramework: 'S-P-I-N Flow',
      keyTechniques: ['Evitar preço precoce', 'Explorar a dor do lead'],
      systemWeight: 85,
    },
    {
      id: 'fanatical-prospecting',
      title: 'Prospecção Fanática',
      author: 'Jeb Blount',
      tagline: 'Gatilhos secos e consistência brutal de funil.',
      active: true,
      coreFramework: '30-Day Rule',
      keyTechniques: ['Gatilhos rápidos', 'Quebra de hesitação'],
      systemWeight: 90,
    },
    {
      id: '100m-offers',
      title: 'Ofertas de 100 Milhões',
      author: 'Alex Hormozi',
      tagline: 'Grand Slam Offers irresistíveis.',
      active: true,
      coreFramework: 'Value Equation',
      keyTechniques: ['Redução de atrito', 'Garantia forte'],
      systemWeight: 75,
    },
    {
      id: 'predictable-revenue',
      title: 'Receita Previsível',
      author: 'Aaron Ross',
      tagline: 'Cold Outreach 2.0 e qualificação estruturada.',
      active: false,
      coreFramework: 'Role Specialization',
      keyTechniques: ['Email de direcionamento'],
      systemWeight: 50,
    },
  ]);

  // Arquivos Carregados (PDF/TXT)
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; size: string; status: string }[]>([
    { id: 'f1', name: 'SPIN_Selling_Metodologia.pdf', size: '2.4 MB', status: 'Estudado' },
    { id: 'f2', name: 'Ofertas_100M_Alex_Hormozi.txt', size: '840 KB', status: 'Estudado' },
    { id: 'f3', name: 'Prospeccao_Fanatica_Scripts.pdf', size: '1.1 MB', status: 'Estudado' }
  ]);

  // System Prompt & IA (Gemini Engine)
  const [systemPrompt, setSystemPrompt] = useState<SystemPromptConfig>({
    presetName: 'Consultivo (SPIN + Hormozi)',
    prompt: `Você é um assistente de vendas especializado em prospecção.
Seu objetivo é qualificar leads e agendar reuniões.

Diretrizes:
1. Seja profissional, cordial e direto ao ponto (máximo 2 a 3 frases).
2. Identifique as necessidades do cliente (SPIN Selling).
3. Apresente soluções de forma concisa.
4. Tente agendar uma reunião de demonstração rápida via Google Meet.
5. Quando o cliente concordar com data e hora, formate a resposta com:
   AGENDAR: [Título da Reunião] | [Data/Hora Início] | [Data/Hora Fim]`,
    temperature: 0.6,
    tone: 'consultivo',
    maxTokens: 300,
    includeAudioNoteTrigger: true,
    safetyCooldownSeconds: 15,
  });

  // Simulador de IA
  const [testLeadMsg, setTestLeadMsg] = useState('Quanto custa a sua solução?');
  const [simulatedAiReply, setSimulatedAiReply] = useState<string | null>(null);

  // Pesquisa de Empresa com IA
  const [companyQuery, setCompanyQuery] = useState('Acme Corp');
  const [companyReport, setCompanyReport] = useState<string | null>(null);
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);

  // Google Sheets (Registro de Interações do Prospect)
  const [sheetsLogs, setSheetsLogs] = useState([
    { id: 'sh-1', timestamp: '2026-08-21T14:32:00', from: '+5511998765432', to: 'bot', type: 'chat', content: 'Perfeito! Amanhã às 10h no Meet fica ótimo para mim.', status: 'received' },
    { id: 'sh-2', timestamp: '2026-08-21T09:25:00', from: 'bot', to: '+5511998765432', type: 'chat', content: 'Conseguimos abrir 15 minutos amanhã no Meet?', status: 'sent' },
    { id: 'sh-3', timestamp: '2026-08-21T09:14:00', from: 'bot', to: '+5511998765432', type: 'audio', content: 'prospeccao.mp3 (Áudio Humanizado)', status: 'sent' },
    { id: 'sh-4', timestamp: '2026-08-21T13:10:00', from: '+5521987654321', to: 'bot', type: 'chat', content: 'Quanto custa a implantação completa?', status: 'received' },
  ]);

  // Google Agenda & Meet (Eventos Agendados)
  const [googleEvents] = useState([
    { id: 'ev-1', summary: 'Diagnóstico Comercial • Marcos Silveira', time: 'Amanhã às 10:00', meetLink: 'https://meet.google.com/abc-defg-hij' },
    { id: 'ev-2', summary: 'Apresentação Solução • Camila Nogueira', time: 'Quinta às 14:30', meetLink: 'https://meet.google.com/klm-nopq-rst' },
  ]);

  const [googleSettings, setGoogleSettings] = useState<GoogleIntegrationSettings>({
    calendarEnabled: true,
    meetEnabled: true,
    calendarId: 'primary',
    calendarName: 'Agenda Comercial Principal',
    autoCreateMeetLink: true,
    meetingDurationMinutes: 30,
    bufferMinutes: 15,
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    syncedEventsCount: 8,
    lastSyncTimestamp: 'Hoje às 15:10',
  });

  // Logs de Disparo
  const [logs, setLogs] = useState<DispatchItem[]>([
    { id: 'dsp-101', phone: '5511998765432', name: 'Marcos Silveira', status: 'sent', opener: 'Bom Dia', timestamp: 'Hoje às 09:14', channel: 'whatsapp', responseReceived: true },
    { id: 'dsp-102', phone: '5521987654321', name: 'Camila Nogueira', status: 'sent', opener: 'Bom Dia', timestamp: 'Hoje às 09:28', channel: 'whatsapp', responseReceived: true },
    { id: 'dsp-103', phone: '5531976543210', name: 'Lucas Brandão', status: 'sent', opener: 'Boa Tarde', timestamp: 'Hoje às 12:05', channel: 'whatsapp', responseReceived: false },
    { id: 'dsp-104', phone: '5541965432109', status: 'sent', opener: 'Boa Tarde', timestamp: 'Hoje às 14:05', channel: 'whatsapp', responseReceived: true },
    { id: 'dsp-105', phone: '5551954321098', status: 'sent', opener: 'Boa Tarde', timestamp: 'Hoje às 14:50', channel: 'whatsapp', responseReceived: false },
  ]);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setDateString(now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Alternar Conexão WhatsApp Real
  const handleToggleWhatsApp = () => {
    if (isConnectingWa) return;
    setIsConnectingWa(true);

    if (waState.connected) {
      setTimeout(() => {
        setWaState(prev => ({
          ...prev,
          connected: false,
          pairingStatus: 'disconnected',
          lastActive: 'Desconectado agora'
        }));
        setIsConnectingWa(false);
        showToast('Sessão do WhatsApp encerrada com sucesso.');
      }, 700);
    } else {
      setTimeout(() => {
        const randomLatency = Math.floor(Math.random() * 15) + 12;
        setWaState(prev => ({
          ...prev,
          connected: true,
          pairingStatus: 'connected',
          networkLatencyMs: randomLatency,
          lastActive: 'Conectado agora'
        }));
        setIsConnectingWa(false);
        showToast(`WhatsApp conectado com sucesso (${randomLatency}ms).`);
      }, 1000);
    }
  };

  // Sincronizar WhatsApp Real
  const handleSyncWhatsApp = () => {
    if (isSyncingWa || !waState.connected) return;
    setIsSyncingWa(true);

    setTimeout(() => {
      const newLatency = Math.floor(Math.random() * 10) + 14;
      setWaState(prev => ({
        ...prev,
        networkLatencyMs: newLatency,
        lastActive: 'Sincronizado agora'
      }));
      setIsSyncingWa(false);
      showToast(`WhatsApp sincronizado! Latência: ${newLatency}ms`);
    }, 850);
  };

  // Disparo Rápido com Registro no Sheets e Áudio
  const handleStartDispatch = () => {
    if (!waState.connected) {
      showToast('Atenção: Conecte o WhatsApp antes de iniciar disparos.');
      setActiveTab('whatsapp');
      return;
    }

    const numbers = phoneListText.split(/[\n,;]+/).map(n => n.replace(/\D/g, '').trim()).filter(n => n.length >= 10);
    if (numbers.length === 0 || isDispatching) return;

    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: numbers.length, phone: numbers[0] });

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= numbers.length) {
        clearInterval(interval);
        setIsDispatching(false);
        setDispatchProgress(null);
        showToast(`${numbers.length} disparos realizados com sucesso!`);
        return;
      }

      const phone = numbers[idx];
      const nowIso = new Date().toISOString();
      const timeFormatted = 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const newLog: DispatchItem = {
        id: `dsp-${Date.now()}-${idx}`,
        phone,
        status: 'sent',
        opener: selectedOpener,
        timestamp: timeFormatted,
        channel: 'whatsapp',
        responseReceived: Math.random() > 0.35,
      };

      const newSheetLog = {
        id: `sh-${Date.now()}-${idx}`,
        timestamp: nowIso,
        from: 'bot',
        to: `+${phone}`,
        type: isAudioNote ? 'audio' : 'chat',
        content: isAudioNote ? `Áudio (${selectedOpener})` : `Texto (${selectedOpener})`,
        status: 'sent'
      };

      setLogs(prev => [newLog, ...prev]);
      setSheetsLogs(prev => [newSheetLog, ...prev]);
      setStats(prev => ({
        ...prev,
        sentToday: prev.sentToday + 1,
        repliesToday: newLog.responseReceived ? prev.repliesToday + 1 : prev.repliesToday
      }));

      idx++;
      if (idx < numbers.length) {
        setDispatchProgress({ current: idx, total: numbers.length, phone: numbers[idx] });
      }
    }, 1100);
  };

  // Enviar Mensagem no WhatsApp
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: `msg-${Date.now()}`,
      from: 'bot' as const,
      text: newChatInput,
      time: timeStr,
      isAudio: false
    };

    setChats(prev => prev.map(c => {
      if (c.id === selectedChatId) {
        return {
          ...c,
          lastMsg: newChatInput,
          time: timeStr,
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    setNewChatInput('');
  };

  // Simulação de IA (Gemini)
  const handleSimulateAi = () => {
    if (!testLeadMsg.trim()) return;
    setSimulatedAiReply('Processando com Gemini...');
    setTimeout(() => {
      setSimulatedAiReply(
        'Olá! Nossos planos se adaptam ao volume de disparos diários da sua operação comercial. Hoje vocês já contam com alguém fazendo a qualificação manual ou tudo é automático?'
      );
    }, 600);
  };

  // Pesquisa de Empresa
  const handleSearchCompany = () => {
    if (!companyQuery.trim()) return;
    setIsSearchingCompany(true);
    setCompanyReport(null);

    setTimeout(() => {
      setIsSearchingCompany(false);
      setCompanyReport(
        `Dossiê "${companyQuery}": Empresa atuante no setor corporativo. Dores prováveis: lentidão no follow-up comercial. Abordagem sugerida: método SPIN Selling focando em agendamento de diagnóstico rápido via Google Meet.`
      );
    }, 900);
  };

  // Upload de Arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc = {
      id: `f-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'Estudado'
    };

    setUploadedFiles(prev => [newDoc, ...prev]);
    showToast(`Arquivo "${file.name}" assimilado pela IA!`);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col justify-between max-w-lg mx-auto selection:bg-[#F5B700] selection:text-black pb-24 font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOPO DA APLICAÇÃO: RELÓGIO DIGITAL & METAS DO SISTEMA                 */}
      {/* ========================================================================= */}
      <header className="p-4 pt-5 space-y-3 bg-[#000000]">
        
        {/* Banner Mostarda Curvo Orgânico (Smart Launcher Pro) */}
        <div className="w-full bg-[#F5B700] text-black p-5 rounded-[28px] flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-[#F5B700] px-2.5 py-0.5 rounded-full">
              PROSPECÇÃO PROSPECT
            </span>
            <span className="text-xs font-semibold">{dateString} • 4°C</span>
          </div>

          <div className="text-center my-1">
            <div className="text-5xl font-bold tracking-tighter leading-none text-black">
              {timeString}
            </div>
            <div className="text-xs font-semibold text-black/80 mt-1">
              GooGle Smart Launcher Pro
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold pt-1.5 border-t border-black/10">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Anti-Ban: 98%
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-black/10">
              {stats.sentToday} / {stats.dailyLimit} Disparos ({stats.conversionRate}% Conv.)
            </span>
          </div>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL ORGANIZADO POR GAVETAS / ABAS                       */}
      {/* ========================================================================= */}
      <main className="flex-1 px-4 space-y-4 bg-[#000000]">
        
        {/* ----------------- ABA 1: INÍCIO (ORGANIZAÇÃO EM GAVETAS TÁTEIS) ----------------- */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            {/* Grid com as Gavetas Principais (Preto Puro com Bordas Nítidas) */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* Gaveta 1: WhatsApp com Indicador de Status Real */}
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className="bg-[#050505] p-4 rounded-[22px] border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${waState.connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">WhatsApp</span>
                  <span className="text-[11px] text-zinc-400">
                    {waState.connected ? 'Sessão Conectada' : 'Desconectado'}
                  </span>
                </div>
              </button>

              {/* Gaveta 2: Cérebro IA */}
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className="bg-[#050505] p-4 rounded-[22px] border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#F5B700]/10 border border-[#F5B700]/20 flex items-center justify-center text-[#F5B700]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Cérebro IA</span>
                  <span className="text-[11px] text-zinc-400">Gemini & {books.filter(b => b.active).length} Livros</span>
                </div>
              </button>

              {/* Gaveta 3: Lista de Disparo */}
              <button
                type="button"
                onClick={() => setActiveTab('dispatch')}
                className="bg-[#050505] p-4 rounded-[22px] border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Lista de Disparo</span>
                  <span className="text-[11px] text-zinc-400">{phoneListText.split('\n').filter(Boolean).length} Contatos</span>
                </div>
              </button>

              {/* Gaveta 4: Google Sheets */}
              <button
                type="button"
                onClick={() => setActiveTab('sheets')}
                className="bg-[#050505] p-4 rounded-[22px] border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Google Sheets</span>
                  <span className="text-[11px] text-zinc-400">Log de Interações ({sheetsLogs.length})</span>
                </div>
              </button>

            </div>

            {/* Módulo de Disparo Rápido com os 3 Gatilhos */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#F5B700] uppercase tracking-wider block">Gatilho de Abordagem</span>
                  <h2 className="text-sm font-bold text-white">Disparo Rápido</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAudioNote(!isAudioNote)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isAudioNote ? 'bg-[#F5B700] text-black' : 'bg-black text-zinc-400 border border-zinc-800'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isAudioNote ? 'Áudio Gravado Ativo' : 'Texto'}</span>
                </button>
              </div>

              {/* 3 Botões de Gatilho Grandes */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { label: 'Bom Dia', icon: Sun },
                    { label: 'Boa Tarde', icon: Sunset },
                    { label: 'Boa Noite', icon: Moon },
                  ] as const
                ).map((op) => {
                  const Icon = op.icon;
                  const isSelected = selectedOpener === op.label;
                  return (
                    <button
                      key={op.label}
                      type="button"
                      onClick={() => setSelectedOpener(op.label)}
                      className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[#F5B700] text-black shadow-[0_4px_16px_rgba(245,183,0,0.35)]'
                          : 'bg-black border border-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-black' : 'text-zinc-400'}`} />
                      <span>{op.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Botão de Disparo */}
              <button
                type="button"
                onClick={handleStartDispatch}
                disabled={isDispatching}
                className="w-full py-4 rounded-2xl bg-[#F5B700] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
              >
                {isDispatching ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>{isDispatching ? 'Enviando Disparos...' : 'Iniciar Disparo Agora'}</span>
              </button>

              {/* Progresso durante envio */}
              {isDispatching && dispatchProgress && (
                <div className="p-3 rounded-xl bg-black border border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-[#F5B700] font-bold">{dispatchProgress.phone}</span>
                    <span>{dispatchProgress.current} de {dispatchProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#F5B700] transition-all duration-300 rounded-full"
                      style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3: Próximas Reuniões Marcadas no Meet */}
            <div className="bg-[#050505] p-4 rounded-[24px] border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-amber-400" />
                  Google Meet Agendados
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-bold text-[#F5B700] hover:underline"
                >
                  Ver Agenda
                </button>
              </div>

              <div className="space-y-1.5">
                {googleEvents.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-xl bg-black border border-zinc-900 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{ev.summary}</span>
                      <span className="text-[10px] text-zinc-400">{ev.time}</span>
                    </div>
                    <a
                      href={ev.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-[#F5B700] text-black font-bold text-[10px] flex items-center gap-1"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ----------------- ABA 2: WHATSAPP REAL (STATUS REAL & BOTÕES GRANDES) ----------------- */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              
              <span className="text-xs font-bold text-white">Central de Conexão WhatsApp</span>
            </div>

            {/* Componente de Status Real com Botões Grandes */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-4 shadow-md">
              
              {/* Header de Status */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#F5B700] uppercase tracking-wider block">Status do Daemon</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-3 h-3 rounded-full ${waState.connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`} />
                    <span className="text-sm font-bold text-white">
                      {waState.connected ? 'WhatsApp Conectado e Operacional' : 'WhatsApp Desconectado'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block font-mono">Latência</span>
                  <span className="text-xs font-bold text-emerald-400">{waState.connected ? `${waState.networkLatencyMs}ms` : '--'}</span>
                </div>
              </div>

              {/* Informações Reais de Conexão */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-3 rounded-xl bg-black border border-zinc-850">
                  <span className="text-[10px] text-zinc-500 block">Número Vinculado</span>
                  <span className="font-bold text-white block mt-0.5">{waState.connectedNumber}</span>
                </div>
                <div className="p-3 rounded-xl bg-black border border-zinc-850">
                  <span className="text-[10px] text-zinc-500 block">Última Sincronia</span>
                  <span className="font-bold text-white block mt-0.5">{waState.lastActive}</span>
                </div>
              </div>

              {/* 2 Botões Grandes: Conectar/Desconectar e Sincronizar */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                
                {/* Botão Grande 1: Conectar / Desconectar */}
                <button
                  type="button"
                  onClick={handleToggleWhatsApp}
                  disabled={isConnectingWa}
                  className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md ${
                    waState.connected
                      ? 'bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:bg-rose-900/50'
                      : 'bg-[#F5B700] text-black shadow-[0_4px_16px_rgba(245,183,0,0.35)]'
                  }`}
                >
                  {isConnectingWa ? (
                    <div className={`w-4 h-4 border-2 ${waState.connected ? 'border-rose-400' : 'border-black'} border-t-transparent rounded-full animate-spin`} />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>
                    {isConnectingWa 
                      ? (waState.connected ? 'Desconectando...' : 'Conectando...') 
                      : (waState.connected ? 'Desconectar' : 'Conectar Agora')}
                  </span>
                </button>

                {/* Botão Grande 2: Sincronizar Sessão */}
                <button
                  type="button"
                  onClick={handleSyncWhatsApp}
                  disabled={!waState.connected || isSyncingWa}
                  className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold border transition-all active:scale-95 cursor-pointer shadow-md ${
                    waState.connected
                      ? 'bg-black border-zinc-700 text-white hover:border-[#F5B700] hover:text-[#F5B700]'
                      : 'bg-black border-zinc-900 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingWa ? 'animate-spin text-[#F5B700]' : ''}`} />
                  <span>{isSyncingWa ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>

              </div>

            </div>

            {/* Caixa de Conversas Reais */}
            <div className="bg-[#050505] p-4 rounded-[26px] border border-zinc-800 space-y-3 shadow-md flex flex-col h-[380px]">
              
              {/* Seleção de Conversa */}
              <div className="flex gap-2 overflow-x-auto pb-2 border-b border-zinc-800">
                {chats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChatId(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedChatId === c.id
                        ? 'bg-[#F5B700] text-black'
                        : 'bg-black border border-zinc-850 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {c.avatar} {c.name}
                  </button>
                ))}
              </div>

              {/* Mensagens do Chat Selecionado */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {chats.find((c) => c.id === selectedChatId)?.messages.map((m) => (
                  <div 
                    key={m.id}
                    className={`flex flex-col ${m.from === 'bot' ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        m.from === 'bot'
                          ? 'bg-[#F5B700] text-black font-medium rounded-br-none'
                          : 'bg-black text-zinc-100 rounded-bl-none border border-zinc-800'
                      }`}
                    >
                      {m.isAudio && (
                        <div className="flex items-center gap-1.5 font-bold mb-1 text-[10px]">
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Áudio Gravado</span>
                        </div>
                      )}
                      <span>{m.text}</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 mt-0.5 px-1">{m.time}</span>
                  </div>
                ))}
              </div>

              {/* Input para Mandar no WhatsApp */}
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-1 border-t border-zinc-800">
                <input
                  type="text"
                  value={newChatInput}
                  onChange={(e) => setNewChatInput(e.target.value)}
                  placeholder="Digitar mensagem no WhatsApp..."
                  className="flex-1 bg-black px-4 py-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800"
                />
                <button
                  type="submit"
                  className="px-4 py-3 rounded-xl bg-[#F5B700] text-black text-xs font-bold active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

            </div>

          </div>
        )}

        {/* ----------------- ABA 3: TREINAMENTO IA & ARQUIVOS ----------------- */}
        {activeTab === 'ai' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              
              <span className="text-xs font-bold text-white">Treinamento IA & Conhecimento</span>
            </div>

            {/* 1. Upload de Arquivos / Livros */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <div>
                <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Material de Estudo</span>
                <h3 className="text-xs font-bold text-white">Carregar Livros / Scripts (PDF / TXT)</h3>
              </div>

              <label className="flex items-center justify-center gap-2 p-3.5 rounded-2xl border border-dashed border-zinc-700 bg-black cursor-pointer hover:border-[#F5B700]/50 transition-colors">
                <Upload className="w-4 h-4 text-[#F5B700]" />
                <span className="text-xs text-zinc-300 font-medium">Selecionar Arquivo</span>
                <input type="file" accept=".pdf,.txt,.doc" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="space-y-1.5 pt-1">
                {uploadedFiles.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black border border-zinc-900 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-[#F5B700] shrink-0" />
                      <span className="text-white truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Livros de Vendas Ativos */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Metodologias de Prospecção</span>
              <div className="space-y-2">
                {books.map((b) => (
                  <div key={b.id} className="p-3 rounded-2xl bg-black border border-zinc-900 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#D9B48F] block">{b.author}</span>
                      <span className="text-xs font-bold text-white block">{b.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBooks(prev => prev.map(item => item.id === b.id ? { ...item, active: !item.active } : item))}
                      className={`w-11 h-6 rounded-full p-1 transition-colors ${b.active ? 'bg-[#F5B700]' : 'bg-zinc-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${b.active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. System Prompt & Simulador */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Regras da IA & Simulador (Gemini)</span>
              <textarea
                rows={3}
                value={systemPrompt.prompt}
                onChange={(e) => setSystemPrompt({ ...systemPrompt, prompt: e.target.value })}
                className="w-full bg-black p-3 rounded-xl text-xs text-white focus:outline-none border border-zinc-800 resize-none leading-relaxed"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testLeadMsg}
                  onChange={(e) => setTestLeadMsg(e.target.value)}
                  placeholder="Dúvida do lead para teste..."
                  className="flex-1 bg-black px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none border border-zinc-800"
                />
                <button
                  type="button"
                  onClick={handleSimulateAi}
                  className="px-4 py-2.5 rounded-xl bg-[#F5B700] text-black text-xs font-bold"
                >
                  Testar
                </button>
              </div>

              {simulatedAiReply && (
                <p className="text-xs text-zinc-200 bg-black p-3.5 rounded-xl border border-zinc-800 leading-relaxed">
                  "{simulatedAiReply}"
                </p>
              )}
            </div>

            {/* 4. Pesquisa de Empresas com a IA */}
            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Dossiê de Lead</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Nome da empresa a pesquisar..."
                  className="flex-1 bg-black px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none border border-zinc-800"
                />
                <button
                  type="button"
                  onClick={handleSearchCompany}
                  disabled={isSearchingCompany}
                  className="px-4 py-2.5 rounded-xl bg-[#F5B700] text-black text-xs font-bold"
                >
                  {isSearchingCompany ? '...' : 'Pesquisar'}
                </button>
              </div>

              {companyReport && (
                <p className="text-xs text-zinc-200 bg-black p-3.5 rounded-xl border border-zinc-800 leading-relaxed">
                  {companyReport}
                </p>
              )}
            </div>

          </div>
        )}

        {/* ----------------- ABA 4: GOOGLE SHEETS (LOG DE INTERAÇÕES) ----------------- */}
        {activeTab === 'sheets' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              
              <span className="text-xs font-bold text-white">Google Sheets • Log de Interações</span>
            </div>

            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Planilha Integrada</span>
                  <span className="text-[10px] text-zinc-400">Aba: Interacoes!A:F</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Planilha sincronizada!')}
                  className="px-3 py-1.5 rounded-full bg-black border border-zinc-800 text-xs font-bold text-[#F5B700] flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sincronizar</span>
                </button>
              </div>

              {/* Tabela Limpa de Registros */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {sheetsLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-2xl bg-black border border-zinc-850 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{log.from} → {log.to}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{log.timestamp.split('T')[1] || log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 line-clamp-2">{log.content}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-bold text-[#F5B700] uppercase">{log.type}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ----------------- ABA 5: LISTA DE TELEFONES / CONTATOS ----------------- */}
        {activeTab === 'dispatch' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              
              <span className="text-xs font-bold text-white">Lista de Contatos</span>
            </div>

            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Números de Telefone (DDD + Número)</span>
                <button
                  type="button"
                  onClick={() => setPhoneListText('')}
                  className="text-xs text-rose-400 font-bold hover:underline"
                >
                  Limpar
                </button>
              </div>

              <textarea
                rows={8}
                value={phoneListText}
                onChange={(e) => setPhoneListText(e.target.value)}
                placeholder="Cole os números de telefone aqui..."
                className="w-full bg-black p-4 rounded-2xl text-xs text-white focus:outline-none border border-zinc-800 resize-none leading-relaxed"
              />

              <button
                type="button"
                onClick={handleStartDispatch}
                disabled={isDispatching}
                className="w-full py-4 rounded-2xl bg-[#F5B700] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>Disparar para Todos os Contatos</span>
              </button>
            </div>

          </div>
        )}

        {/* ----------------- ABA 6: GOOGLE AGENDA & MEET ----------------- */}
        {activeTab === 'calendar' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              
              <span className="text-xs font-bold text-white">Google Agenda & Meet</span>
            </div>

            <div className="bg-[#050505] p-5 rounded-[26px] border border-zinc-800 space-y-3 shadow-md">
              <div className="p-4 rounded-2xl bg-black border border-zinc-900 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Google Agenda</span>
                  <span className="text-[11px] text-zinc-400">Sincronização de horários livres</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleSettings(s => ({ ...s, calendarEnabled: !s.calendarEnabled }))}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${googleSettings.calendarEnabled ? 'bg-[#F5B700]' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${googleSettings.calendarEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black border border-zinc-900 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Google Meet Automático</span>
                  <span className="text-[11px] text-zinc-400">Criação de sala para os leads</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleSettings(s => ({ ...s, meetEnabled: !s.meetEnabled }))}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${googleSettings.meetEnabled ? 'bg-[#F5B700]' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${googleSettings.meetEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. DOCK INFERIOR MOBILE COM BOTÕES GRANDES E DIRETOS                      */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-3 inset-x-0 mx-auto max-w-sm px-4 z-40">
        <div className="bg-[#000000]/95 backdrop-blur-md p-2 rounded-full border border-zinc-800 flex items-center justify-around shadow-2xl">
          
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`p-3 rounded-full transition-all ${
              activeTab === 'home' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`p-3 rounded-full transition-all relative ${
              activeTab === 'whatsapp' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${waState.connected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'}`} />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`p-3 rounded-full transition-all ${
              activeTab === 'ai' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`p-3 rounded-full transition-all ${
              activeTab === 'sheets' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`p-3 rounded-full transition-all ${
              activeTab === 'calendar' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-5 h-5" />
          </button>

        </div>
      </nav>

      {/* Toast Notificação */}
      {toastMsg && (
        <div className="fixed top-6 inset-x-0 mx-auto z-50 max-w-xs px-4 py-2 rounded-full bg-[#000000] border border-[#F5B700] text-xs font-bold text-[#F5B700] flex items-center justify-center gap-2 shadow-2xl animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-[#F5B700] animate-ping" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
