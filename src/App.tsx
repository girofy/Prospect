import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Sparkles, 
  Sun, 
  Sunset, 
  Moon, 
  Send, 
  ShieldCheck, 
  FileText, 
  RefreshCw, 
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Power,
  Key,
  ShieldAlert,
  UserCheck,
  UserX,
  Clock,
  ThumbsUp,
  Edit3,
  Search,
  Plus,
  Trash2,
  Sliders,
  BookOpen,
  Copy,
  Check,
  Terminal,
  Server,
  Lock,
  Eye,
  Info
} from 'lucide-react';
import { 
  TabType,
  OpenerType, 
  Lead,
  LeadStatus,
  AgentState,
  ContactRole,
  ChatMessage,
  KnowledgeBook, 
  SystemPromptConfig, 
  HealthScoreSignals,
  ExperienceMemory
} from './types';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { DataDeletion } from './components/DataDeletion';

// [LAYOUT ARCHETYPE]: Monospace Technical Console & Asymmetric Split Lead Manager
// [RADIUS & BORDERS]: rounded-none (0px), rounded-sm (2px), rounded (4px), border border-zinc-800
// [ACCENT LOGIC]: #25D366 (WhatsApp Official Terminal Green) & #F5B700 (Girofy Industrial Gold)

// Saudação Dinâmica Inteligente baseada no horário local real
export const getDynamicGreeting = (date: Date = new Date()): string => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

interface ServerWhatsAppStatus {
  metaConfigured: boolean;
  phoneNumberId: string;
  authorizedBusinessNumber: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating: string;
  geminiConfigured: boolean;
  signatureValidationActive: boolean;
  metaError?: string | null;
  serverTimestamp?: string;
}

interface ServerAuditLog {
  id: string;
  timestamp: string;
  type: string;
  phone?: string;
  summary: string;
  details?: Record<string, any>;
}

export default function App() {
  // Navegação e Roteamento Público (Suporte a /privacy e /data-deletion na Vercel)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Relógio ao vivo
  const [timeString, setTimeString] = useState('12:00');
  const [dateString, setDateString] = useState('');

  // Status de Servidor e Credenciais Protegidas
  const [serverStatus, setServerStatus] = useState<ServerWhatsAppStatus>({
    metaConfigured: false,
    phoneNumberId: '1221241567748320',
    authorizedBusinessNumber: '+55 74 8812-6578',
    verifiedName: 'Girofy Tecnologia',
    displayPhoneNumber: '+55 74 8812-6578',
    qualityRating: 'UNKNOWN',
    geminiConfigured: false,
    signatureValidationActive: false,
  });

  // Lista de Contatos Reais e Conversas
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [selectedContactPhone, setSelectedContactPhone] = useState<string>('');
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<ServerAuditLog[]>([]);

  // Estados de Carregamento e Envio
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatInputText, setChatInputText] = useState('');

  // Modal para Cadastrar Novo Contato Manual
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [newContactNiche, setNewContactNiche] = useState('');
  const [newContactRole, setNewContactRole] = useState<ContactRole>('decisor');

  // Modal de Abordagem Inicial Manual
  const [showInitialOutreachModal, setShowInitialOutreachModal] = useState(false);
  const [outreachMessagePreview, setOutreachMessagePreview] = useState('');

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filtro de Busca
  const [searchFilter, setSearchFilter] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
    showToast(`Copiado: ${label}`);
  };

  // Sincronização de Roteamento Browser History
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Relógio do Console
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

  // 1. Carregar Status do WhatsApp e Configurações de Servidor
  const fetchServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // 2. Carregar Contatos do Banco Persistente
  const fetchContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        const serverContacts: Lead[] = (data.contacts || []).map((c: any) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
          company: c.company || 'Empresa',
          niche: c.niche || 'Geral',
          role: c.role || 'decisor',
          status: c.status || 'novo',
          agentState: c.agentState || 'ai_active',
          optOutDetected: c.optOutDetected || false,
          optOutReason: c.optOutReason,
          lastInteractionTime: c.lastInteractionAt ? new Date(c.lastInteractionAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Sem histórico',
          followUpDays: 0,
          dossier: null,
          messages: [],
          notes: c.notes,
        }));
        setContacts(serverContacts);

        // Auto-seleciona o primeiro contato caso nenhum esteja selecionado
        if (!selectedContactPhone && serverContacts.length > 0) {
          setSelectedContactPhone(serverContacts[0].phone);
        }
      }
    } catch (err) {
      console.warn('[Contacts Load Warning]:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [selectedContactPhone]);

  // 3. Carregar Histórico de Mensagens do Contato Ativo
  const fetchMessagesForContact = useCallback(async (phone: string) => {
    if (!phone) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveChatMessages(data.messages || []);
      }
    } catch (err) {
      console.warn('[Messages Load Warning]:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // 4. Carregar Logs de Auditoria
  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Polling Periódico para Atualizações em Tempo Real (Webhook, Mensagens, Status)
  useEffect(() => {
    fetchServerStatus();
    fetchContacts();
    fetchAuditLogs();

    const interval = setInterval(() => {
      fetchContacts();
      fetchAuditLogs();
      if (selectedContactPhone) {
        fetchMessagesForContact(selectedContactPhone);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchServerStatus, fetchContacts, fetchAuditLogs, selectedContactPhone, fetchMessagesForContact]);

  // Sempre que mudar de contato selecionado, busca suas mensagens
  useEffect(() => {
    if (selectedContactPhone) {
      fetchMessagesForContact(selectedContactPhone);
    }
  }, [selectedContactPhone, fetchMessagesForContact]);

  const selectedContact = useMemo(() => {
    return contacts.find(c => c.phone === selectedContactPhone) || contacts[0];
  }, [contacts, selectedContactPhone]);

  // Contatos Filtrados por Busca
  const filteredContacts = useMemo(() => {
    if (!searchFilter.trim()) return contacts;
    const term = searchFilter.toLowerCase();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.company.toLowerCase().includes(term)
    );
  }, [contacts, searchFilter]);

  // Cálculo de Métricas Reais do Funil
  const healthSignals: HealthScoreSignals = useMemo(() => {
    const totalSent = contacts.length;
    const blockedCount = contacts.filter(c => c.optOutDetected || c.status === 'bloqueado').length;
    const totalReplies = contacts.filter(c => ['respondeu', 'em_conversa', 'qualificado', 'reuniao_marcada'].includes(c.status)).length;
    const undeliveredCount = activeChatMessages.filter(m => m.status === 'failed').length;

    let score = 100;
    score -= blockedCount * 25;
    score -= undeliveredCount * 5;

    const clampedScore = Math.max(10, Math.min(100, score));
    const isProtection = clampedScore < 75;

    return {
      undeliveredCount,
      blockedCount,
      spamReports: blockedCount > 0 ? 1 : 0,
      totalSent,
      totalReplies,
      healthScore: clampedScore,
      protectionModeActive: isProtection,
      safeDailyLimit: isProtection ? 5 : 20,
      baseDailyLimit: 20
    };
  }, [contacts, activeChatMessages]);

  // Ação: Assumir Atendimento Manualmente (Humano)
  const handleTakeoverHuman = async (phone: string) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, agentState: 'human_takeover', status: 'em_conversa' }),
      });
      if (res.ok) {
        showToast('Atendimento assumido pelo operador humano. IA pausada para este contato.');
        fetchContacts();
      }
    } catch (err: any) {
      showToast(`Erro ao assumir atendimento: ${err?.message}`);
    }
  };

  // Ação: Reativar IA para o Contato
  const handleResumeAi = async (phone: string) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, agentState: 'ai_active' }),
      });
      if (res.ok) {
        showToast('Agente IA reativado para este contato.');
        fetchContacts();
      }
    } catch (err: any) {
      showToast(`Erro ao reativar IA: ${err?.message}`);
    }
  };

  // Ação: Pausar Atendimento do Contato
  const handlePauseContact = async (phone: string) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, agentState: 'paused' }),
      });
      if (res.ok) {
        showToast('Atendimento pausado para este contato.');
        fetchContacts();
      }
    } catch (err: any) {
      showToast(`Erro ao pausar contato: ${err?.message}`);
    }
  };

  // Ação: Alterar Status Comercial do Lead
  const handleUpdateStatus = async (phone: string, status: LeadStatus) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, status }),
      });
      if (res.ok) {
        showToast(`Status atualizado para: ${status.replace('_', ' ').toUpperCase()}`);
        fetchContacts();
      }
    } catch (err: any) {
      showToast(`Erro ao atualizar status: ${err?.message}`);
    }
  };

  // Ação: Enviar Mensagem Manual do Atendente Humano
  const handleSendManualMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactPhone || !chatInputText.trim()) return;

    if (selectedContact?.optOutDetected) {
      showToast('Bloqueado: Contato solicitou Opt-Out (LGPD).');
      return;
    }

    setIsSendingMessage(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedContactPhone,
          text: chatInputText.trim(),
          from: 'operator',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha ao enviar mensagem.');
      }

      setChatInputText('');
      fetchMessagesForContact(selectedContactPhone);
      fetchContacts();
      showToast(data.success ? 'Mensagem enviada via WhatsApp Oficial!' : `Gravada no painel (${data.metaError || 'Aguardando entrega'})`);
    } catch (err: any) {
      showToast(`Falha no envio: ${err?.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Ação: Cadastrar Novo Contato Manual
  const handleAddNewContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newContactPhone.replace(/\D/g, '');
    if (!newContactName.trim() || clean.length < 8) {
      showToast('Preencha o nome e um telefone válido com DDD (ex: 74988126578).');
      return;
    }

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName.trim(),
          phone: clean,
          company: newContactCompany.trim() || 'Empresa Própria',
          niche: newContactNiche.trim() || 'Geral',
          role: newContactRole,
          status: 'novo',
          agentState: 'ai_active',
        }),
      });

      if (res.ok) {
        showToast(`Contato "${newContactName.trim()}" cadastrado com sucesso!`);
        setNewContactName('');
        setNewContactPhone('');
        setNewContactCompany('');
        setNewContactNiche('');
        setShowAddContactModal(false);
        fetchContacts();
        setSelectedContactPhone(clean.startsWith('55') ? clean : `55${clean}`);
      }
    } catch (err: any) {
      showToast(`Erro ao cadastrar contato: ${err?.message}`);
    }
  };

  // Preparar Abordagem Inicial Manual 1-a-1
  const handlePrepareOutreach = (contact: Lead) => {
    const greeting = getDynamicGreeting();
    const firstName = contact.name.split(' ')[0] || contact.company;
    const initialText = `${greeting}, ${firstName}! Vi a atuação da ${contact.company} no mercado e gostaria de fazer uma pergunta rápida sobre a operação de vocês.`;
    setOutreachMessagePreview(initialText);
    setShowInitialOutreachModal(true);
  };

  // Disparar Abordagem Inicial Manual 1-a-1
  const handleSendOutreachMessage = async () => {
    if (!selectedContact || !outreachMessagePreview.trim()) return;

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedContact.phone,
          text: outreachMessagePreview.trim(),
          from: 'operator',
        }),
      });

      if (res.ok) {
        await handleUpdateStatus(selectedContact.phone, 'disparado');
        setShowInitialOutreachModal(false);
        fetchMessagesForContact(selectedContact.phone);
        showToast(`Abordagem inicial enviada para ${selectedContact.name}!`);
      }
    } catch (err: any) {
      showToast(`Erro ao enviar abordagem: ${err?.message}`);
    }
  };

  // Renderização de Rotas Públicas
  if (currentPath === '/privacy') {
    return <PrivacyPolicy onBack={() => navigateTo('/')} />;
  }

  if (currentPath === '/data-deletion') {
    return <DataDeletion onBack={() => navigateTo('/')} />;
  }

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col justify-between max-w-5xl mx-auto selection:bg-[#25D366] selection:text-black font-sans antialiased">
      
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO CONSOLE TÉCNICO BRUTALISTA                                  */}
      {/* ========================================================================= */}
      <header className="p-3 sm:p-4 bg-[#000000] border-b border-zinc-800 space-y-3">
        
        {/* Barra de Status e Roteamento Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[#25D366]">
              PROSPECTFY • ENGINE COMERCIAL
            </span>
            <span className="font-mono text-[10px] text-zinc-500">
              GIROFY TECNOLOGIA
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <button
              type="button"
              onClick={() => navigateTo('/privacy')}
              className="text-zinc-400 hover:text-zinc-200 transition-colors underline decoration-zinc-700"
            >
              /privacy
            </button>
            <span className="text-zinc-700">•</span>
            <button
              type="button"
              onClick={() => navigateTo('/data-deletion')}
              className="text-zinc-400 hover:text-zinc-200 transition-colors underline decoration-zinc-700"
            >
              /data-deletion
            </button>
          </div>
        </div>

        {/* Console Box de Alta Densidade */}
        <div className="w-full bg-[#09090B] border border-zinc-800 p-4 rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-none ${serverStatus.metaConfigured ? 'bg-[#25D366]' : 'bg-rose-500'}`} />
              <span className="font-mono text-xs uppercase tracking-wider text-white font-bold">
                WhatsApp API Oficial: {serverStatus.metaConfigured ? 'Conectado (Meta Graph v21.0)' : 'Credencial Pendente na Vercel'}
              </span>
            </div>
            <div className="font-mono text-[11px] text-zinc-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Número Autorizado: <strong className="text-zinc-200">{serverStatus.displayPhoneNumber}</strong></span>
              <span>Phone ID: <strong className="text-zinc-200">{serverStatus.phoneNumberId}</strong></span>
              <span>Qualidade: <strong className="text-[#25D366]">{serverStatus.qualityRating}</strong></span>
            </div>
          </div>

          {/* Relógio e Saúde Operacional */}
          <div className="flex items-center gap-4 self-end md:self-auto border-t md:border-t-0 border-zinc-800 pt-2 md:pt-0">
            <div className="text-right">
              <div className="font-mono text-xl font-bold tracking-tight text-white leading-none">
                {timeString}
              </div>
              <div className="font-mono text-[10px] text-zinc-500 uppercase mt-0.5">
                {dateString}
              </div>
            </div>

            <div className="p-2 bg-[#000000] border border-zinc-800 text-right font-mono text-[11px]">
              <div className="text-zinc-400">Motor IA (Gemini):</div>
              <div className={serverStatus.geminiConfigured ? 'text-[#25D366] font-bold' : 'text-amber-500 font-bold'}>
                {serverStatus.geminiConfigured ? 'Ativo (Backend)' : 'Aguardando Chave'}
              </div>
            </div>
          </div>

        </div>

        {/* Navegação por Abas Industriais */}
        <nav className="flex items-center gap-1 border-b border-zinc-800 pt-1 font-mono text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1.5 border-b-2 font-bold uppercase transition-colors whitespace-nowrap ${activeTab === 'home' ? 'border-[#25D366] text-white bg-zinc-900/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            01. Central & Leads ({contacts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3 py-1.5 border-b-2 font-bold uppercase transition-colors whitespace-nowrap ${activeTab === 'whatsapp' ? 'border-[#25D366] text-white bg-zinc-900/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            02. WhatsApp & Webhook
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 border-b-2 font-bold uppercase transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'border-[#25D366] text-white bg-zinc-900/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            03. Agente IA Girofy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 border-b-2 font-bold uppercase transition-colors whitespace-nowrap ${activeTab === 'analytics' ? 'border-[#25D366] text-white bg-zinc-900/60' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
          >
            04. Auditoria & Logs ({auditLogs.length})
          </button>
        </nav>

      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL (SPLIT-SCREEN OU ABAS TÉCNICAS)                     */}
      {/* ========================================================================= */}
      <main className="flex-1 p-3 sm:p-4 bg-[#000000]">

        {/* ----------------- ABA 1: CENTRAL DE CONVERSAS E LEADS ----------------- */}
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Coluna Esquerda: Lista de Contatos & Filtro (5 Colunas) */}
            <div className="md:col-span-5 bg-[#09090B] border border-zinc-800 p-3 rounded-none flex flex-col h-[650px]">
              
              {/* Topo da Lista: Busca & Botão Novo Contato */}
              <div className="space-y-2 pb-3 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    Contatos ({filteredContacts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddContactModal(true)}
                    className="px-2.5 py-1 bg-[#25D366] text-black font-mono text-[11px] font-bold uppercase rounded-none hover:bg-[#20ba59] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Novo</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Buscar nome, empresa ou telefone..."
                    className="w-full bg-[#000000] border border-zinc-800 rounded-none pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#25D366]"
                  />
                </div>
              </div>

              {/* Feed de Contatos */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 mt-2 pr-1 space-y-1">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 font-mono text-xs">
                    Nenhum contato encontrado. Cadastre um contato ou aguarde mensagens no WhatsApp.
                  </div>
                ) : (
                  filteredContacts.map(contact => {
                    const isSelected = selectedContactPhone === contact.phone;
                    return (
                      <div
                        key={contact.id}
                        onClick={() => setSelectedContactPhone(contact.phone)}
                        className={`p-2.5 cursor-pointer rounded-none border transition-colors ${isSelected ? 'bg-zinc-900 border-[#25D366]/60' : 'bg-[#000000] border-transparent hover:border-zinc-800'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white truncate max-w-[170px]">
                            {contact.name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            {contact.lastInteractionTime}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                          <span className="truncate max-w-[140px]">{contact.company}</span>
                          <span className="font-mono text-[10px] text-zinc-500">+{contact.phone}</span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2">
                          {/* Badge de Status Comercial */}
                          <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-300 font-mono text-[9px] uppercase border border-zinc-700">
                            {contact.status}
                          </span>

                          {/* Badge de Estado do Agente */}
                          <span className={`px-1.5 py-0.2 font-mono text-[9px] uppercase border ${contact.agentState === 'human_takeover' ? 'bg-amber-950 text-amber-300 border-amber-800' : contact.agentState === 'paused' ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
                            {contact.agentState === 'human_takeover' ? 'Humano' : contact.agentState === 'paused' ? 'Pausado' : 'IA Ativa'}
                          </span>

                          {contact.optOutDetected && (
                            <span className="px-1.5 py-0.2 bg-red-950 text-red-400 font-mono text-[9px] uppercase border border-red-800">
                              Opt-Out
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Coluna Direita: Conversa & Controles do Atendente (7 Colunas) */}
            <div className="md:col-span-7 bg-[#09090B] border border-zinc-800 p-3 rounded-none flex flex-col h-[650px]">
              
              {selectedContact ? (
                <>
                  {/* Barra do Contato Selecionado & Comandos de Transição */}
                  <div className="pb-3 border-b border-zinc-800 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-white font-mono uppercase">
                            {selectedContact.name}
                          </h2>
                          <span className="font-mono text-xs text-zinc-400">
                            ({selectedContact.company})
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500">
                          +{selectedContact.phone} • Nicho: {selectedContact.niche} • Papel: {selectedContact.role}
                        </div>
                      </div>

                      {/* Botão de Abordagem Inicial 1-a-1 se for novo */}
                      {selectedContact.status === 'novo' && (
                        <button
                          type="button"
                          onClick={() => handlePrepareOutreach(selectedContact)}
                          className="px-2.5 py-1 bg-[#F5B700] text-black font-mono text-[11px] font-bold uppercase rounded-none hover:bg-[#e0a600] transition-colors"
                        >
                          Abordar Contato
                        </button>
                      )}
                    </div>

                    {/* Botões de Ação Rápida de Atendimento */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {selectedContact.agentState === 'human_takeover' ? (
                        <button
                          type="button"
                          onClick={() => handleResumeAi(selectedContact.phone)}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-800 text-[10px] font-mono uppercase rounded-none transition-colors"
                        >
                          Reativar Agente IA
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTakeoverHuman(selectedContact.phone)}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-700 text-[10px] font-mono uppercase rounded-none transition-colors"
                        >
                          Assumir (Humano)
                        </button>
                      )}

                      {selectedContact.agentState !== 'paused' ? (
                        <button
                          type="button"
                          onClick={() => handlePauseContact(selectedContact.phone)}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[10px] font-mono uppercase rounded-none transition-colors"
                        >
                          Pausar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleResumeAi(selectedContact.phone)}
                          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[10px] font-mono uppercase rounded-none transition-colors"
                        >
                          Despausar
                        </button>
                      )}

                      {/* Seletor de Status Comercial */}
                      <select
                        value={selectedContact.status}
                        onChange={e => handleUpdateStatus(selectedContact.phone, e.target.value as LeadStatus)}
                        className="bg-[#000000] border border-zinc-800 text-zinc-300 font-mono text-[10px] uppercase px-2 py-1 rounded-none focus:outline-none focus:border-[#25D366]"
                      >
                        <option value="novo">Novo</option>
                        <option value="em_conversa">Em Conversa</option>
                        <option value="qualificado">Qualificado</option>
                        <option value="reuniao_marcada">Reunião Marcada (Meet)</option>
                        <option value="aguardando_humano">Aguardando Humano</option>
                        <option value="esfriou">Esfriou</option>
                        <option value="bloqueado">Bloqueado</option>
                      </select>
                    </div>
                  </div>

                  {/* Feed de Mensagens Reais */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-3 bg-[#000000] border border-zinc-900 my-2">
                    {isLoadingMessages ? (
                      <div className="p-4 text-center font-mono text-xs text-zinc-500">
                        Carregando histórico...
                      </div>
                    ) : activeChatMessages.length === 0 ? (
                      <div className="p-8 text-center font-mono text-xs text-zinc-600">
                        Nenhuma mensagem trocada ainda com este contato.
                      </div>
                    ) : (
                      activeChatMessages.map(msg => {
                        const isLead = msg.from === 'lead';
                        const isOperator = msg.from === 'operator';

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 font-mono text-[9px] text-zinc-500">
                              <span>
                                {isLead ? selectedContact.name : isOperator ? 'Atendente Humano' : 'Girofy Assistente (IA)'}
                              </span>
                              <span>•</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.status && (
                                <span className={`uppercase font-bold ${msg.status === 'failed' ? 'text-red-400' : 'text-[#25D366]'}`}>
                                  [{msg.status}]
                                </span>
                              )}
                            </div>

                            <div
                              className={`p-3 max-w-[85%] text-xs leading-relaxed font-sans rounded-none border ${isLead ? 'bg-[#09090B] border-zinc-800 text-zinc-200' : isOperator ? 'bg-zinc-900 border-[#F5B700]/50 text-white' : 'bg-zinc-950 border-[#25D366]/40 text-zinc-100'}`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Campo de Envio de Mensagem Manual */}
                  <form onSubmit={handleSendManualMessage} className="pt-1 flex gap-2">
                    <input
                      type="text"
                      value={chatInputText}
                      onChange={e => setChatInputText(e.target.value)}
                      placeholder={selectedContact.optOutDetected ? 'Contato bloqueado por Opt-Out LGPD' : 'Digitar resposta manual como operador...'}
                      disabled={selectedContact.optOutDetected || isSendingMessage}
                      className="flex-1 bg-[#000000] border border-zinc-800 rounded-none px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-[#25D366] disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={selectedContact.optOutDetected || isSendingMessage || !chatInputText.trim()}
                      className="px-4 py-2 bg-[#25D366] hover:bg-[#20ba59] disabled:opacity-40 text-black font-mono text-xs font-bold uppercase rounded-none transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingMessage ? 'Enviando...' : 'Enviar'}</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-500">
                  Selecione um contato na lista para visualizar o histórico de conversas.
                </div>
              )}

            </div>

          </div>
        )}

        {/* ----------------- ABA 2: WHATSAPP CLOUD API & WEBHOOK ----------------- */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4 max-w-3xl">
            
            <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
                <Server className="w-4 h-4 text-[#25D366]" />
                <span>Configuração de Infraestrutura Meta WhatsApp Cloud API</span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Todas as operações sensíveis da Meta Graph API são executadas exclusivamente no backend serverless. 
                Nenhum token ou segredo de aplicativo é exposto no navegador.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs pt-1">
                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">App ID Homologado:</span>
                  <div className="text-white font-bold">1572840733789529 (Meuapp)</div>
                </div>

                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Business ID:</span>
                  <div className="text-white font-bold">1232106109979142</div>
                </div>

                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Phone Number ID:</span>
                  <div className="text-white font-bold">1221241567748320</div>
                </div>

                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Número Autorizado:</span>
                  <div className="text-[#25D366] font-bold">+55 74 8812-6578</div>
                </div>
              </div>
            </div>

            {/* Parâmetros de Webhook para Configuração no Painel da Meta */}
            <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
                <Terminal className="w-4 h-4 text-[#F5B700]" />
                <span>Parâmetros de Webhook (Meta for Developers)</span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>URL DE RETORNO DE CHAMADA (CALLBACK URL):</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://prospectfy.vercel.app/api/webhook', 'URL do Webhook')}
                      className="text-[#25D366] hover:underline"
                    >
                      {copiedField === 'URL do Webhook' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="p-2.5 bg-[#000000] border border-zinc-800 text-white font-mono text-xs select-all">
                    https://prospectfy.vercel.app/api/webhook
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>TOKEN DE VERIFICAÇÃO (VERIFY TOKEN):</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('impossivel2008', 'Verify Token')}
                      className="text-[#25D366] hover:underline"
                    >
                      {copiedField === 'Verify Token' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="p-2.5 bg-[#000000] border border-zinc-800 text-white font-mono text-xs select-all">
                    impossivel2008
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    * O endpoint valida o token no handshake GET sem revelar o segredo ao público.
                  </p>
                </div>
              </div>
            </div>

            {/* Variáveis de Ambiente Necessárias na Vercel */}
            <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Variáveis de Ambiente na Vercel (Segurança):</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-[11px]">
                <li><code className="text-zinc-200">META_ACCESS_TOKEN</code>: Token permanente de sistema do App Meuapp.</li>
                <li><code className="text-zinc-200">META_PHONE_NUMBER_ID</code>: 1221241567748320</li>
                <li><code className="text-zinc-200">META_APP_SECRET</code>: Chave secreta para validação X-Hub-Signature-256.</li>
                <li><code className="text-zinc-200">META_WEBHOOK_VERIFY_TOKEN</code>: impossivel2008</li>
                <li><code className="text-zinc-200">GEMINI_API_KEY</code>: Chave de API Google Gemini (para o agente comercial).</li>
              </ul>
            </div>

          </div>
        )}

        {/* ----------------- ABA 3: AGENTE IA COMERCIAL GIROFY ----------------- */}
        {activeTab === 'ai' && (
          <div className="space-y-4 max-w-3xl">
            
            <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
                <Sparkles className="w-4 h-4 text-[#F5B700]" />
                <span>Diretrizes Comerciais do Agente Girofy</span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                O assistente responde automaticamente no WhatsApp com base no catálogo de serviços da Girofy, 
                qualificando o lead e conduzindo para agendamento de diagnóstico rápido via Google Meet.
              </p>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <div className="text-white font-bold uppercase">1. Sites & Landing Pages de Alta Conversão</div>
                  <div className="text-zinc-400 text-[11px]">Faixa de investimento: R$ 997 a R$ 2.497. Prazo: 5 a 7 dias úteis.</div>
                </div>

                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <div className="text-white font-bold uppercase">2. Sistemas Web & Dashboards Operacionais</div>
                  <div className="text-zinc-400 text-[11px]">Sob medida. Diagnóstico prévio obrigatório de escopo via Meet de 15 min.</div>
                </div>

                <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1">
                  <div className="text-white font-bold uppercase">3. Automações de Atendimento & WhatsApp</div>
                  <div className="text-zinc-400 text-[11px]">A partir de R$ 1.200 de implantação + sustentação operacional.</div>
                </div>
              </div>
            </div>

            {/* Regras e Limites Rígidos */}
            <div className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2 text-xs font-mono">
              <div className="text-white font-bold uppercase tracking-wider">
                Gatilhos de Transferência Imediata para Atendente Humano:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400 text-[11px]">
                <li>Solicitação expressa do lead para falar com humano / pessoa / atendente.</li>
                <li>Reclamações ou discordâncias operacionais.</li>
                <li>Pedidos de desconto fora da tabela ou condições de parcelamento especiais.</li>
                <li>Dúvidas técnicas fora do escopo homologado da Girofy.</li>
              </ul>
            </div>

          </div>
        )}

        {/* ----------------- ABA 4: AUDITORIA & LOGS TÉCNICOS ----------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-[#25D366]" />
                <span>Trilha de Auditoria & Eventos Técnicos (Tempo Real)</span>
              </div>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[11px] rounded-none uppercase transition-colors"
              >
                Atualizar Logs
              </button>
            </div>

            <div className="bg-[#09090B] border border-zinc-800 p-3 rounded-none overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase">
                    <th className="pb-2">Timestamp</th>
                    <th className="pb-2">Tipo de Evento</th>
                    <th className="pb-2">Contato</th>
                    <th className="pb-2">Resumo da Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-600">
                        Nenhum evento registrado ainda. Logs de webhook e IA aparecerão aqui.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-900/50">
                        <td className="py-2 text-zinc-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 border text-[9px] uppercase ${log.type === 'opt_out' ? 'bg-red-950 text-red-400 border-red-800' : log.type === 'ai_reply' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : log.type === 'status_change' ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-zinc-900 text-zinc-300 border-zinc-800'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-2 text-zinc-300">
                          {log.phone ? `+${log.phone}` : '-'}
                        </td>
                        <td className="py-2 text-zinc-200">
                          {log.summary}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. RODAPÉ DE CONFORMIDADE E NAVEGAÇÃO                                    */}
      {/* ========================================================================= */}
      <footer className="p-3 sm:p-4 border-t border-zinc-800 bg-[#000000] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-500">
        <div>
          Prospectfy Commercial Engine • Girofy Tecnologia © 2026
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigateTo('/privacy')}
            className="hover:text-zinc-300 transition-colors"
          >
            Política de Privacidade
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => navigateTo('/data-deletion')}
            className="hover:text-zinc-300 transition-colors"
          >
            Exclusão de Dados (LGPD)
          </button>
          <span>•</span>
          <a
            href="mailto:jlzin2603@gmail.com"
            className="hover:text-zinc-300 transition-colors"
          >
            Contato DPO
          </a>
        </div>
      </footer>

      {/* Modal: Cadastrar Novo Contato Manual */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#09090B] border border-zinc-800 p-5 rounded-none max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Cadastrar Contato Manual
              </span>
              <button
                type="button"
                onClick={() => setShowAddContactModal(false)}
                className="text-zinc-500 hover:text-white font-mono text-xs"
              >
                [X]
              </button>
            </div>

            <form onSubmit={handleAddNewContact} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 uppercase text-[10px]">Nome Completo:</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  required
                  className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-1.5 text-white focus:outline-none focus:border-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 uppercase text-[10px]">WhatsApp (com DDD):</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  placeholder="Ex: 74988126578"
                  required
                  className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-1.5 text-white focus:outline-none focus:border-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 uppercase text-[10px]">Empresa:</label>
                <input
                  type="text"
                  value={newContactCompany}
                  onChange={e => setNewContactCompany(e.target.value)}
                  placeholder="Ex: Clínica Sorrir"
                  className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-1.5 text-white focus:outline-none focus:border-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 uppercase text-[10px]">Nicho de Atuação:</label>
                <input
                  type="text"
                  value={newContactNiche}
                  onChange={e => setNewContactNiche(e.target.value)}
                  placeholder="Ex: Saúde, Varejo, Logística..."
                  className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-1.5 text-white focus:outline-none focus:border-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 uppercase text-[10px]">Papel do Contato:</label>
                <select
                  value={newContactRole}
                  onChange={e => setNewContactRole(e.target.value as ContactRole)}
                  className="w-full bg-[#000000] border border-zinc-800 rounded-none px-3 py-1.5 text-white focus:outline-none focus:border-[#25D366]"
                >
                  <option value="decisor">Decisor / Sócio</option>
                  <option value="atendente_recepcao">Recepção / Atendente</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase rounded-none transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#25D366] hover:bg-[#20ba59] text-black font-bold uppercase rounded-none transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enviar Abordagem Inicial Manual 1-a-1 */}
      {showInitialOutreachModal && selectedContact && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#09090B] border border-zinc-800 p-5 rounded-none max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Abordagem Inicial Manual • {selectedContact.name}
              </span>
              <button
                type="button"
                onClick={() => setShowInitialOutreachModal(false)}
                className="text-zinc-500 hover:text-white font-mono text-xs"
              >
                [X]
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-mono">
              Envio individual de abordagem direta. A saudação é ajustada de acordo com o horário real:
            </p>

            <textarea
              rows={4}
              value={outreachMessagePreview}
              onChange={e => setOutreachMessagePreview(e.target.value)}
              className="w-full bg-[#000000] border border-zinc-800 rounded-none p-3 text-xs font-mono text-white focus:outline-none focus:border-[#25D366]"
            />

            <div className="flex gap-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowInitialOutreachModal(false)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase rounded-none transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendOutreachMessage}
                className="flex-1 py-2 bg-[#F5B700] hover:bg-[#e0a600] text-black font-bold uppercase rounded-none transition-colors"
              >
                Confirmar & Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifier */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-zinc-950 border border-zinc-700 text-zinc-100 px-4 py-2.5 rounded-none text-xs font-mono shadow-2xl flex items-center gap-2 z-50">
          <Info className="w-3.5 h-3.5 text-[#25D366]" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
