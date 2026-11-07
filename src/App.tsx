import IAHub from './ia/IAHub.tsx';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Users, 
  Cpu, 
  Settings, 
  Send, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink,
  Search,
  Plus,
  Lock,
  UserCheck,
  UserX,
  Play,
  Pause,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Shield,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  Bot,
  User,
  Activity,
  Smartphone,
  Calendar,
  Sparkles,
  X,
  FileUp,
  Upload,
  FileText,
  Globe,
  Link as LinkIcon
} from 'lucide-react';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { DataDeletion } from './components/DataDeletion';
import { parseFileForLeads, ExtractedLead, ParseResult } from './utils/fileLeadParser';

// [LAYOUT ARCHETYPE]: Mobile Modular Widget Hub / iOS Clean Curved Surface
// [RADIUS & BORDERS]: rounded-2xl (16px), rounded-3xl (24px), border-black/[0.06]
// [ACCENT LOGIC]: #0071E3 (Apple Blue) & #34C759 (WhatsApp Green)

export type AppTab = 'conversas' | 'widgets' | 'ia' | 'ajustes';

export interface ChatMessage {
  id: string;
  contactPhone: string;
  from: 'lead' | 'bot' | 'operator';
  text: string;
  type: 'text' | 'audio' | 'image' | 'document' | 'template' | 'unsupported';
  timestamp: string;
  metaMessageId?: string;
  status?: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  aiReasoning?: string;
}

export interface Contact {
  id: string;
  phone: string;
  name: string;
  company: string;
  niche?: string;
  role: 'decisor' | 'atendente_recepcao' | 'desconhecido';
  status: 'novo' | 'em_conversa' | 'qualificado' | 'reuniao_marcada' | 'aguardando_humano' | 'esfriou' | 'bloqueado';
  agentState: 'ai_active' | 'human_takeover' | 'paused';
  optOutDetected: boolean;
  optOutReason?: string;
  lastInteractionAt: string;
  unreadCount?: number;
  notes?: string;
  createdAt: string;
}

interface ServerConfig {
  metaConfigured: boolean;
  geminiConfigured: boolean;
  metaPhoneNumberId: string;
  authorizedBusinessNumber: string;
  appId: string;
  businessId: string;
  webhookVerifyToken: string;
  metaAccessTokenMasked: string;
  metaAppSecretMasked: string;
  geminiApiKeyMasked: string;
  geminiModel: string;
  autoReplyEnabled: boolean;
  activeGateway?: 'direct_pairing' | 'meta_cloud_api';
  directPairingPhone?: string;
  directPairingStatus?: 'connected' | 'pairing' | 'disconnected';
  directPairingCode?: string;
  directPairingConnectedAt?: string;
}

interface WhatsAppStatusData {
  configured: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  error?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  type: string;
  phone?: string;
  summary: string;
  details?: Record<string, any>;
}

export const getDynamicGreeting = (date: Date = new Date()): string => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export default function App() {
  // Public URL routing support for Vercel (/privacy and /data-deletion)
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [activeTab, setActiveTab] = useState<AppTab>('conversas');
  const [timeString, setTimeString] = useState('12:00');
  const [dateFormatted, setDateFormatted] = useState('');

  // Server state & credentials
  const [config, setConfig] = useState<ServerConfig>({
    metaConfigured: false,
    geminiConfigured: false,
    metaPhoneNumberId: '1221241567748320',
    authorizedBusinessNumber: '+55 74 8812-6578',
    appId: '1572840733789529',
    businessId: '1232106109979142',
    webhookVerifyToken: 'impossivel2008',
    metaAccessTokenMasked: '',
    metaAppSecretMasked: '',
    geminiApiKeyMasked: '',
    geminiModel: 'gemini-3.6-flash',
    autoReplyEnabled: true,
  });

  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatusData | null>(null);
  const [testingStatus, setTestingStatus] = useState(false);

  // Contacts and active conversation
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Mobile split view state: 'list' or 'chat'
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');

  // In-app Settings inputs
  const [inputMetaToken, setInputMetaToken] = useState('');
  const [inputPhoneId, setInputPhoneId] = useState('');
  const [inputAppSecret, setInputAppSecret] = useState('');
  const [inputVerifyToken, setInputVerifyToken] = useState('');
  const [inputGeminiKey, setInputGeminiKey] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // AI Simulator Sandbox
  const [simInput, setSimInput] = useState('');
  const [simOutput, setSimOutput] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals & Toasts
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // WhatsApp Direct Pairing (8-digit code for smartphone without QR code)
  const [pairingData, setPairingData] = useState<{
    activeGateway: 'direct_pairing' | 'meta_cloud_api';
    status: 'connected' | 'pairing' | 'disconnected';
    phoneNumber: string;
    pairingCode: string;
    connectedAt: string;
  }>({
    activeGateway: 'direct_pairing',
    status: 'connected',
    phoneNumber: '557488126578',
    pairingCode: '',
    connectedAt: '',
  });

  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingModalTab, setPairingModalTab] = useState<'direct_free' | 'cloud_free' | 'meta_official'>('direct_free');
  const [inputPairPhone, setInputPairPhone] = useState('74988126578');
  const [inputEvolutionUrl, setInputEvolutionUrl] = useState('https://evolution-zap.onrender.com');
  const [inputEvolutionKey, setInputEvolutionKey] = useState('');
  const [showEvolutionAdvanced, setShowEvolutionAdvanced] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isConfirmingPair, setIsConfirmingPair] = useState(false);

  // Micro-Cadence Cold Outreach (5 to 10 contacts test)
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignCount, setCampaignCount] = useState<5 | 10>(5);
  const [campaignCustomMsg, setCampaignCustomMsg] = useState('Bom dia, {nome}! Tudo bem? Vi a empresa de vocês e notei uma grande oportunidade de automação. Vocês já usam IA comercial?');
  const [isDispatchingCampaign, setIsDispatchingCampaign] = useState(false);
  const [campaignCountdown, setCampaignCountdown] = useState<number | null>(null);
  const [campaignDoneCount, setCampaignDoneCount] = useState<number | null>(null);

  // Universal File Import state (SVG, PDF, HTML, CSV, TXT, JSON, XML)
  const [showFileImportModal, setShowFileImportModal] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedData, setParsedData] = useState<ParseResult | null>(null);
  const [selectedLeadsToImport, setSelectedLeadsToImport] = useState<Record<string, boolean>>({});
  const [isImportingLeads, setIsImportingLeads] = useState(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);
  const [isClearingCrm, setIsClearingCrm] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyText = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast('Copiado para a área de transferência');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Clock & Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setDateFormatted(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to popstate for browser navigation (/privacy, /data-deletion)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Fetch server config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setConfig(data);
        if (data.metaPhoneNumberId && !inputPhoneId) {
          setInputPhoneId(data.metaPhoneNumberId);
        }
        if (data.webhookVerifyToken && !inputVerifyToken) {
          setInputVerifyToken(data.webhookVerifyToken);
        }
      }
    } catch (err) {
      console.warn('[Config Fetch Error]:', err);
    }
  }, [inputPhoneId, inputVerifyToken]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch('/api/contacts');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const list: Contact[] = Array.isArray(data) ? data : (data.contacts || []);
        setContacts(list);
        if (list.length > 0 && !selectedPhone) {
          setSelectedPhone(list[0].phone);
        }
      } else if (!res.ok) {
        console.warn('[Contacts Fetch Error] Response status:', res.status);
      }
    } catch (err) {
      console.error('[Contacts Fetch Error]:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  }, [selectedPhone]);

  // Fetch messages for active contact
  const fetchMessages = useCallback(async (phone: string) => {
    if (!phone) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const list: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
        setMessages(list);
      }
    } catch (err) {
      console.error('[Messages Fetch Error]:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Fetch WhatsApp live status
  const checkWhatsAppStatus = useCallback(async () => {
    setTestingStatus(true);
    try {
      const res = await fetch('/api/whatsapp-status');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setWhatsappStatus(data);
      }
    } catch (err) {
      console.warn('[Status Check Error]:', err);
    } finally {
      setTestingStatus(false);
    }
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const list: AuditLog[] = Array.isArray(data) ? data : (data.logs || []);
        setAuditLogs(list);
      }
    } catch (err) {
      console.warn('[Audit Logs Fetch Error]:', err);
    }
  }, []);

  // Fetch Pairing Info
  const fetchPairingStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pairing');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setPairingData(data);
      }
    } catch (err) {
      console.warn('[Pairing Status Fetch Error]:', err);
    }
  }, []);

  // Request 8-Digit Pairing Code
  const handleRequestPairingCode = async (phoneToUse?: string) => {
    setIsRequestingCode(true);
    try {
      const phone = phoneToUse || inputPairPhone || config.directPairingPhone || '557488126578';
      const payload: Record<string, any> = { action: 'request_code', phoneNumber: phone };
      if (inputEvolutionUrl.trim()) payload.evolutionUrl = inputEvolutionUrl.trim();
      if (inputEvolutionKey.trim()) payload.evolutionKey = inputEvolutionKey.trim();

      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setPairingData(prev => ({
          ...prev,
          status: 'pairing',
          pairingCode: data.pairingCode,
          phoneNumber: data.phoneNumber
        }));
        if (data.isRealSocketCode) {
          showToast('Código real do WhatsApp gerado com sucesso!');
        } else {
          showToast('Código gerado.');
        }
      } else {
        showToast('Erro ao gerar código de pareamento');
      }
    } catch (err: any) {
      showToast(`Falha de rede: ${err?.message}`);
    } finally {
      setIsRequestingCode(false);
    }
  };

  // Confirm that user entered the 8-digit code on their WhatsApp mobile app
  const handleConfirmPairing = async () => {
    setIsConfirmingPair(true);
    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_paired', phoneNumber: pairingData.phoneNumber })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setPairingData(prev => ({
          ...prev,
          status: 'connected',
          activeGateway: 'direct_pairing',
          connectedAt: data.connectedAt
        }));
        showToast('WhatsApp conectado com sucesso via código!');
        setShowPairingModal(false);
        fetchConfig();
      } else {
        showToast('Não foi possível confirmar conexão.');
      }
    } catch (err: any) {
      showToast(`Erro ao confirmar: ${err?.message}`);
    } finally {
      setIsConfirmingPair(false);
    }
  };

  // Switch between Direct Mobile Pairing and Official Meta Cloud API
  const handleSwitchGateway = async (targetGateway: 'direct_pairing' | 'meta_cloud_api') => {
    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch_gateway', gateway: targetGateway })
      });
      if (res.ok) {
        setPairingData(prev => ({ ...prev, activeGateway: targetGateway }));
        showToast(`Canal ativo alternado para: ${targetGateway === 'direct_pairing' ? 'WhatsApp Celular (Direto)' : 'Meta Cloud API (Oficial)'}`);
        fetchConfig();
      }
    } catch (err: any) {
      showToast(`Erro ao alternar canal: ${err?.message}`);
    }
  };

  // Trigger Safe Micro-Cadence (5 to 10 contacts with 25s delays)
  const handleStartMicroCampaign = async () => {
    setIsDispatchingCampaign(true);
    setCampaignCountdown(25);
    setCampaignDoneCount(0);

    try {
      // Pick 5 or 10 leads from CRM or fallback sample leads
      let leadsToSend = contacts.slice(0, campaignCount);
      if (leadsToSend.length < campaignCount) {
        const fallbackLeads = [
          { phone: '5574988126578', name: 'Girofy Teste', company: 'Girofy Tech' },
          { phone: '5574991122334', name: 'Marcos Imóveis', company: 'Silva Empreendimentos' },
          { phone: '5574992233445', name: 'Dra. Beatriz', company: 'Clínica Odonto Viva' },
          { phone: '5574993344556', name: 'Rodrigo Lima', company: 'Lima Advocacia' },
          { phone: '5574994455667', name: 'Juliana Fitness', company: 'Studio Fit' },
          { phone: '5574995566778', name: 'Carlos Automotivo', company: 'Centro Auto Giro' },
          { phone: '5574996677889', name: 'Fernanda Arquitetura', company: 'Studio Design' },
          { phone: '5574997788990', name: 'Lucas Restaurante', company: 'Bistrô Sabor' },
          { phone: '5574998899001', name: 'Patrícia Eventos', company: 'Viva Festas' },
          { phone: '5574999900112', name: 'Alexandre Tech', company: 'Nexsys Soluções' },
        ];
        leadsToSend = [...leadsToSend, ...fallbackLeads].slice(0, campaignCount);
      }

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: leadsToSend,
          customMessage: campaignCustomMsg
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCampaignDoneCount(data.dispatched || campaignCount);
        showToast(`${data.dispatched || campaignCount} mensagens cadenciadas enviadas com sucesso!`);
        fetchContacts();
        if (leadsToSend[0]?.phone) {
          setSelectedPhone(leadsToSend[0].phone);
          setMobilePane('chat');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Erro ao iniciar micro-disparo');
      }
    } catch (err: any) {
      showToast(`Falha no micro-disparo: ${err?.message}`);
    } finally {
      setIsDispatchingCampaign(false);
      setCampaignCountdown(null);
    }
  };

  // Handle Universal File Upload and Parse (SVG, PDF, HTML, CSV, TXT, JSON, etc.)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingFile(true);
    try {
      const res = await parseFileForLeads(file);
      setParsedData(res);
      // Select all by default
      const initialMap: Record<string, boolean> = {};
      res.leads.forEach(l => { initialMap[l.phone] = true; });
      setSelectedLeadsToImport(initialMap);
      if (res.leads.length === 0) {
        showToast('Nenhum número de WhatsApp identificado no arquivo.');
      } else {
        showToast(`${res.leads.length} contatos identificados no arquivo!`);
      }
    } catch (err: any) {
      showToast(`Erro ao analisar arquivo: ${err?.message}`);
    } finally {
      setIsParsingFile(false);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  // Commit Imported Leads to Backend CRM
  const handleCommitImport = async () => {
    if (!parsedData || parsedData.leads.length === 0) return;
    const leadsToSave = parsedData.leads.filter(l => selectedLeadsToImport[l.phone]);
    if (leadsToSave.length === 0) {
      showToast('Selecione pelo menos um contato para importar.');
      return;
    }
    setIsImportingLeads(true);
    try {
      const payloadContacts = leadsToSave.map(l => ({
        phone: l.phone,
        name: l.name,
        company: l.company,
        notes: `${l.notes || ''} ${l.link ? `| Link: ${l.link}` : ''}`.trim(),
        status: 'novo',
        agentState: 'ai_active',
      }));

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: payloadContacts })
      });

      if (res.ok) {
        showToast(`${leadsToSave.length} contatos adicionados ao CRM com sucesso!`);
        setShowFileImportModal(false);
        setParsedData(null);
        fetchContacts();
        if (leadsToSave[0]?.phone) {
          setSelectedPhone(leadsToSave[0].phone);
          setMobilePane('chat');
        }
      } else {
        showToast('Erro ao salvar contatos no servidor.');
      }
    } catch (err: any) {
      showToast(`Falha na importação: ${err?.message}`);
    } finally {
      setIsImportingLeads(false);
    }
  };

  // Clear all leads from CRM
  const handleClearAllContacts = async () => {
    setIsClearingCrm(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Todos os leads foram removidos do CRM.');
        setShowConfirmClearModal(false);
        setSelectedPhone('');
        setMessages([]);
        fetchContacts();
      } else {
        showToast('Falha ao limpar contatos.');
      }
    } catch (err: any) {
      showToast(`Erro ao limpar: ${err?.message}`);
    } finally {
      setIsClearingCrm(false);
    }
  };

  // Polling on active conversation and contacts
  useEffect(() => {
    fetchConfig();
    fetchContacts();
    checkWhatsAppStatus();
    fetchAuditLogs();
    fetchPairingStatus();

    const interval = setInterval(() => {
      fetchContacts();
      if (selectedPhone) {
        fetchMessages(selectedPhone);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchConfig, fetchContacts, fetchMessages, checkWhatsAppStatus, fetchAuditLogs, fetchPairingStatus, selectedPhone]);

  // Whenever selected phone changes, fetch messages
  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    }
  }, [selectedPhone, fetchMessages]);

  const activeContact = useMemo(() => {
    return contacts.find(c => c.phone === selectedPhone) || null;
  }, [contacts, selectedPhone]);

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (c.phone || '').includes(searchQuery) ||
                            (c.company || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'todos') return true;
      if (statusFilter === 'qualificado') return c.status === 'qualificado';
      if (statusFilter === 'humano') return c.status === 'aguardando_humano' || c.agentState === 'human_takeover';
      if (statusFilter === 'novo') return c.status === 'novo';
      return true;
    });
  }, [contacts, searchQuery, statusFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = contacts.length;
    const qualified = contacts.filter(c => c.status === 'qualificado' || c.status === 'reuniao_marcada').length;
    const humanNeeded = contacts.filter(c => c.status === 'aguardando_humano' || c.agentState === 'human_takeover').length;
    const activeAi = contacts.filter(c => c.agentState === 'ai_active').length;
    return { total, qualified, humanNeeded, activeAi };
  }, [contacts]);

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPhone || isSendingMessage) return;

    const text = inputText.trim();
    setInputText('');
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedPhone,
          message: text,
          sender: 'operator'
        })
      });

      if (res.ok) {
        showToast('Mensagem enviada com sucesso');
        fetchMessages(selectedPhone);
        fetchContacts();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Erro ao enviar: ${errData.error || 'Falha na Graph API'}`);
      }
    } catch (err: any) {
      showToast(`Erro de rede: ${err?.message || 'Falha na conexão'}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Open WhatsApp directly via wa.me protocol (100% Free, Zero API, No Tokens)
  const handleOpenWhatsAppDirect = async (overrideText?: string) => {
    if (!selectedPhone) return;
    const cleanPhone = selectedPhone.replace(/\D/g, '');
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    const encodedText = encodeURIComponent(textToSend);
    const waUrl = `https://wa.me/${cleanPhone}${textToSend ? `?text=${encodedText}` : ''}`;
    
    // Open WhatsApp in new tab / native app
    window.open(waUrl, '_blank');

    // Also record in local CRM history if text was provided
    if (textToSend) {
      try {
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            text: textToSend,
            from: 'operator',
            directOnly: true,
          })
        });
        fetchMessages(cleanPhone);
        fetchContacts();
        showToast('WhatsApp aberto. Mensagem registrada no CRM.');
        setInputText('');
      } catch {
        // ignore
      }
    } else {
      showToast('Abrindo WhatsApp do lead...');
    }
  };

  // Toggle Agent state (AI / Human)
  const handleToggleAgentState = async (newState: 'ai_active' | 'human_takeover' | 'paused') => {
    if (!selectedPhone) return;
    try {
      const res = await fetch('/api/contacts/update-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, agentState: newState })
      });
      if (res.ok) {
        showToast(newState === 'ai_active' ? 'Agente IA reativado' : 'Atendimento transferido para humano');
        fetchContacts();
      }
    } catch (err) {
      showToast('Falha ao atualizar estado do atendimento');
    }
  };

  // Toggle Global Auto-Reply
  const handleToggleAutoReply = async () => {
    const nextVal = !config.autoReplyEnabled;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReplyEnabled: nextVal })
      });
      if (res.ok) {
        setConfig(prev => ({ ...prev, autoReplyEnabled: nextVal }));
        showToast(nextVal ? 'Respostas da IA ligadas globalmente' : 'Respostas da IA pausadas globalmente');
      }
    } catch (err) {
      showToast('Erro ao atualizar configuração');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const payload: Record<string, any> = {};
      if (inputMetaToken.trim()) payload.metaAccessToken = inputMetaToken.trim();
      if (inputPhoneId.trim()) payload.metaPhoneNumberId = inputPhoneId.trim();
      if (inputAppSecret.trim()) payload.metaAppSecret = inputAppSecret.trim();
      if (inputVerifyToken.trim()) payload.webhookVerifyToken = inputVerifyToken.trim();
      if (inputGeminiKey.trim()) payload.geminiApiKey = inputGeminiKey.trim();

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Configurações salvas no servidor');
        setInputMetaToken('');
        setInputAppSecret('');
        setInputGeminiKey('');
        fetchConfig();
        checkWhatsAppStatus();
      } else {
        showToast('Erro ao salvar configurações');
      }
    } catch (err) {
      showToast('Falha na comunicação com o servidor');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create new Contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactPhone.trim()) return;

    let cleanPhone = newContactPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
      cleanPhone = `55${cleanPhone}`;
    }

    try {
      const res = await fetch('/api/contacts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          name: newContactName.trim() || 'Lead Comercial',
          company: newContactCompany.trim() || 'Empresa'
        })
      });

      if (res.ok) {
        showToast('Lead cadastrado no CRM');
        setShowAddContactModal(false);
        setNewContactPhone('');
        setNewContactName('');
        setNewContactCompany('');
        setSelectedPhone(cleanPhone);
        setMobilePane('chat');
        fetchContacts();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Erro ao cadastrar contato');
      }
    } catch (err) {
      showToast('Falha na conexão com o servidor');
    }
  };

  // Run AI Simulation
  const handleRunSimulation = async () => {
    if (!simInput.trim() || simLoading) return;
    setSimLoading(true);
    setSimOutput(null);

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          object: 'whatsapp_business_account',
          entry: [{
            id: config.businessId || '1232106109979142',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: config.authorizedBusinessNumber,
                  phone_number_id: config.metaPhoneNumberId,
                },
                contacts: [{ profile: { name: 'Lead Teste' }, wa_id: '5574999999999' }],
                messages: [{
                  from: '5574999999999',
                  id: `sim-${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: simInput }
                }]
              }
            }]
          }]
        })
      });
      if (res.ok) {
        setSimOutput('Simulação processada com sucesso no motor comercial Girofy. Verifique a resposta gerada nos registros.');
        fetchAuditLogs();
        fetchContacts();
      }
    } catch (err: any) {
      setSimOutput(`Erro na simulação: ${err?.message}`);
    } finally {
      setSimLoading(false);
    }
  };

  // Quick replies
  const QUICK_REPLIES = [
    { label: '📅 Reunião 15 min', text: 'Olá! Podemos agendar uma conversa rápida de 15 minutos via Google Meet para analisar o seu cenário e desenhar a melhor solução?' },
    { label: '🚀 Landing Page R$ 997', text: 'Nossas Landing Pages partem de R$ 997,00 em até 3x, com entrega em 5 dias úteis, design de alta conversão e copy persuasivo.' },
    { label: '⚙️ Sistemas Sob Medida', text: 'Desenvolvemos sistemas web e automações operacionais sob medida para otimizar processos de vendas e gestão da sua empresa.' },
    { label: '👤 Chamar Especialista', text: 'Compreendo perfeitamente. Estou transferindo o atendimento agora para o nosso especialista humano dar sequência.' }
  ];

  // Route: /privacy
  if (currentPath === '/privacy') {
    return <PrivacyPolicy onBack={() => navigateTo('/')} />;
  }

  // Route: /data-deletion
  if (currentPath === '/data-deletion') {
    return <DataDeletion onBack={() => navigateTo('/')} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans flex flex-col selection:bg-[#0071E3] selection:text-white pb-24 sm:pb-8">
      
      {/* Toast Notification (iOS banner style with soft curves) */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1D1D1F]/95 backdrop-blur-md text-white px-5 py-3 text-sm font-semibold tracking-tight flex items-center gap-2.5 rounded-2xl shadow-xl border border-white/10 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-[#34C759] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* APPLE FROSTED HEADER */}
      <header className="apple-header sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-[#0071E3] text-white flex items-center justify-center rounded-2xl font-bold text-sm tracking-wide shadow-sm shrink-0">
            P
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold tracking-tight text-[#1D1D1F] leading-tight">
              Prospectfy
            </span>
            <span className="text-xs text-zinc-500 font-medium leading-tight truncate">
              Girofy · WhatsApp SDR Oficial
            </span>
          </div>
        </div>

        {/* Right: Status Pill & Sync Refresh */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => setShowPairingModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-black/[0.06] text-xs text-zinc-700 hover:border-black/[0.15] transition-all shadow-xs"
            title="Gerenciar conexão do WhatsApp e Pareamento"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${pairingData.status === 'connected' ? 'bg-[#34C759]' : 'bg-[#FF9500]'} animate-pulse`} />
            <span className="font-semibold text-xs truncate max-w-[130px] sm:max-w-none">
              {pairingData.status === 'connected' 
                ? (pairingData.activeGateway === 'direct_pairing' ? 'WhatsApp Celular' : 'Meta Oficial') 
                : 'Conectar WhatsApp'}
            </span>
          </button>

          <button
            onClick={() => {
              fetchContacts();
              if (selectedPhone) fetchMessages(selectedPhone);
              fetchAuditLogs();
              checkWhatsAppStatus();
              showToast('Dados sincronizados');
            }}
            className="w-9 h-9 rounded-full bg-white border border-black/[0.06] flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all shadow-xs"
            title="Atualizar conversas e status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* DESKTOP TOP SEGMENTED BAR (Hidden on mobile) */}
      <div className="hidden sm:block px-8 py-3 bg-white/70 border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="inline-flex p-1 bg-[#E5E5EA]/80 rounded-2xl text-xs font-semibold gap-1">
            <button
              onClick={() => setActiveTab('conversas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'conversas' 
                  ? 'bg-white text-[#1D1D1F] shadow-sm font-bold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#0071E3]" />
              <span>Conversas & CRM</span>
              {contacts.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-full font-bold">
                  {contacts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('widgets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'widgets' 
                  ? 'bg-white text-[#1D1D1F] shadow-sm font-bold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#34C759]" />
              <span>Painel & Métricas</span>
            </button>

            <button
              onClick={() => setActiveTab('ia')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'ia' 
                  ? 'bg-white text-[#1D1D1F] shadow-sm font-bold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Cpu className="w-4 h-4 text-[#0071E3]" />
              <span>Motor SDR Girofy</span>
            </button>

            <button
              onClick={() => setActiveTab('ajustes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'ajustes' 
                  ? 'bg-white text-[#1D1D1F] shadow-sm font-bold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Settings className="w-4 h-4 text-zinc-700" />
              <span>Ajustes & Meta API</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
            <span className="font-bold text-zinc-800 tabular-nums">{timeString}</span>
            <span>·</span>
            <span className="text-zinc-600 capitalize">{dateFormatted}</span>
          </div>
        </div>
      </div>

      {/* MAIN VIEWPORT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 flex flex-col gap-4">
        
        {/* ========================================================================= */}
        {/* TOP MOBILE HERO & MODULAR 2x2 WIDGET HUB (Inspired by reference photos) */}
        {/* ========================================================================= */}
        {/* Only shown on main list view or when on widgets tab to keep phone organized */}
        {activeTab !== 'ia' && (activeTab !== 'conversas' || mobilePane === 'list') && (
          <section className="space-y-3.5">
            
            {/* Big Welcome Card with Clock & Date */}
            <div className="apple-widget p-5 sm:p-6 bg-gradient-to-br from-white to-[#F9FAFC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span className="capitalize">{dateFormatted || 'Hoje'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] tracking-tight">
                  {getDynamicGreeting()}, Girofy!
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium mt-0.5">
                  Atendimento oficial e qualificação comercial de leads no WhatsApp
                </p>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-3xl font-black text-[#1D1D1F] tracking-tight tabular-nums">
                    {timeString}
                  </div>
                  <div className="text-[11px] font-semibold text-[#34C759] flex items-center justify-end gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                    Sistema Operacional
                  </div>
                </div>
              </div>
            </div>

            {/* 2x2 Modular Big Action Widgets (Eliminates boxy/cramped feel) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              {/* Widget 1: Conversas & CRM */}
              <div 
                onClick={() => {
                  setActiveTab('conversas');
                  setMobilePane('list');
                }}
                className="apple-widget p-4 sm:p-5 flex flex-col justify-between cursor-pointer hover:border-[#0071E3]/40 active:scale-[0.98] transition-all bg-white"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold">
                    <MessageSquare className="w-5 h-5 stroke-[2]" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] tabular-nums">
                    {metrics.total} leads
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] leading-snug">
                    Conversas CRM
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5 line-clamp-1">
                    {metrics.activeAi} ativas com IA
                  </p>
                </div>
              </div>

              {/* Widget 2: IA SDR Autônoma Toggle */}
              <div className="apple-widget p-4 sm:p-5 flex flex-col justify-between bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                    config.autoReplyEnabled ? 'bg-[#34C759]/15 text-[#248A3D]' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    <Zap className="w-5 h-5 stroke-[2]" />
                  </div>
                  <button
                    onClick={handleToggleAutoReply}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      config.autoReplyEnabled 
                        ? 'bg-[#34C759] text-white shadow-xs' 
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {config.autoReplyEnabled ? 'Ligada' : 'Pausada'}
                  </button>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] leading-snug">
                    IA Comercial
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    {config.autoReplyEnabled ? 'Respostas autônomas' : 'Aguardando liberação'}
                  </p>
                </div>
              </div>

              {/* Widget 3: Micro-Disparos Frios (5 a 10 contatos) */}
              <div 
                onClick={() => setShowCampaignModal(true)}
                className="apple-widget p-4 sm:p-5 flex flex-col justify-between cursor-pointer hover:border-[#FF9500]/40 active:scale-[0.98] transition-all bg-white"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center font-bold shadow-xs">
                    <Send className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FF9500]/10 text-[#FF9500] flex items-center gap-1">
                    5–10 leads
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] leading-snug">
                    Micro-Disparos
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Delay seguro 25s · Grátis
                  </p>
                </div>
              </div>

              {/* Widget 4: WhatsApp Celular / Gateway Duplo */}
              <div 
                onClick={() => setShowPairingModal(true)}
                className="apple-widget p-4 sm:p-5 flex flex-col justify-between cursor-pointer hover:border-[#34C759]/40 active:scale-[0.98] transition-all bg-white"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                    pairingData.status === 'connected' ? 'bg-[#34C759]/15 text-[#248A3D]' : 'bg-[#FF9500]/15 text-[#FF9500]'
                  }`}>
                    <Smartphone className="w-5 h-5 stroke-[2]" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    pairingData.status === 'connected' ? 'bg-[#34C759]/10 text-[#248A3D]' : 'bg-[#FF9500]/10 text-[#FF9500]'
                  }`}>
                    {pairingData.status === 'connected' ? 'Pareado' : 'Conectar'}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F] leading-snug truncate">
                    {pairingData.activeGateway === 'direct_pairing' ? 'WhatsApp Celular' : 'Meta Cloud API'}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
                    {pairingData.activeGateway === 'direct_pairing' ? 'Código 8 Dígitos' : config.authorizedBusinessNumber}
                  </p>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CONVERSAS & CRM (Clean Mobile-First Master/Detail Flow) */}
        {/* ========================================================================= */}
        {activeTab === 'conversas' && (
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-[550px]">
            
            {/* Contacts Column: Visible on desktop OR on mobile when mobilePane === 'list' */}
            <div className={`w-full md:w-88 lg:w-96 flex flex-col apple-card p-4 sm:p-5 overflow-hidden gap-4 ${
              mobilePane === 'chat' ? 'hidden md:flex' : 'flex'
            }`}>
              
              {/* Header inside Contacts Card */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight">
                    Leads & Conversas
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    {contacts.length} {contacts.length === 1 ? 'lead no CRM' : 'leads no CRM'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {contacts.length > 0 && (
                    <button
                      onClick={() => setShowConfirmClearModal(true)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Limpar todos os leads do CRM"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setShowFileImportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#34C759] text-white hover:bg-[#2EB84E] shadow-xs transition-colors"
                    title="Importar contatos de SVG, PDF, HTML, Planilha, TXT"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Importar</span>
                  </button>

                  <button
                    onClick={() => setShowAddContactModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0071E3] text-white hover:bg-[#0062C4] shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Novo</span>
                  </button>
                </div>
              </div>

              {/* Big Clean Search Field */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, telefone ou empresa..."
                  className="w-full pl-11 pr-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.06] rounded-2xl text-[#1D1D1F] placeholder-zinc-400 focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all"
                />
              </div>

              {/* Filter Pills with Comfortable Touch Targets */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'qualificado', label: 'Qualificados' },
                  { id: 'humano', label: 'Humano' },
                  { id: 'novo', label: 'Novos' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      statusFilter === f.id
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'bg-black/[0.04] text-zinc-600 hover:bg-black/[0.08]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Contacts List with Big, Readable Cards */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                {isLoadingContacts && contacts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 text-zinc-400 animate-spin" />
                    Carregando contatos...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-500 flex flex-col items-center gap-3 bg-[#FAFAFC] rounded-3xl border border-dashed border-black/[0.08] my-4">
                    <div className="w-14 h-14 rounded-3xl bg-[#34C759]/15 text-[#248A3D] flex items-center justify-center">
                      <FileUp className="w-7 h-7 stroke-[2]" />
                    </div>
                    <div>
                      <p className="font-extrabold text-[#1D1D1F] text-base">CRM Pronto para Importação</p>
                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed mt-1">
                        Suba qualquer arquivo (<strong>SVG, PDF, HTML, Planilha, TXT</strong>) para filtrar números, nomes, empresas e links automaticamente.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                      <button
                        onClick={() => setShowFileImportModal(true)}
                        className="flex-1 py-3 px-4 rounded-2xl bg-[#34C759] text-white text-xs font-bold hover:bg-[#2EB84E] shadow-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <FileUp className="w-4 h-4" />
                        <span>Importar Arquivo</span>
                      </button>

                      <button
                        onClick={() => setShowAddContactModal(true)}
                        className="py-3 px-4 rounded-2xl bg-white border border-black/[0.1] text-zinc-700 text-xs font-bold hover:bg-zinc-50 transition-all"
                      >
                        + Cadastrar Manual
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredContacts.map(contact => {
                    const isSelected = contact.phone === selectedPhone;
                    const isHumanMode = contact.agentState === 'human_takeover';
                    const isQualified = contact.status === 'qualificado' || contact.status === 'reuniao_marcada';

                    return (
                      <div
                        key={contact.phone}
                        onClick={() => {
                          setSelectedPhone(contact.phone);
                          setMobilePane('chat');
                        }}
                        className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-3.5 border ${
                          isSelected 
                            ? 'bg-[#0071E3]/5 border-[#0071E3] shadow-xs' 
                            : 'bg-[#FAFAFC] border-black/[0.04] hover:bg-white hover:border-black/[0.1] hover:shadow-xs'
                        }`}
                      >
                        {/* Big Avatar */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-extrabold text-base shadow-xs ${
                          isQualified 
                            ? 'bg-[#34C759]/15 text-[#248A3D]' 
                            : isHumanMode 
                              ? 'bg-[#FF9500]/15 text-[#C97700]' 
                              : 'bg-[#0071E3]/10 text-[#0071E3]'
                        }`}>
                          {contact.name.charAt(0).toUpperCase() || 'L'}
                        </div>

                        {/* Contact Information */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className="text-sm sm:text-base font-bold text-[#1D1D1F] truncate leading-tight">
                              {contact.name}
                            </h4>
                            <span className="text-[11px] text-zinc-400 shrink-0 font-medium tabular-nums">
                              {contact.lastInteractionAt ? new Date(contact.lastInteractionAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-500 truncate mb-1.5 font-medium">
                            {contact.company ? `${contact.company} · ` : ''}{contact.phone}
                          </div>

                          {/* Status Badge Pills */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isHumanMode ? (
                              <span className="text-[11px] font-bold text-[#C97700] bg-[#FF9500]/10 px-2.5 py-0.5 rounded-full">
                                👤 Humano
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full">
                                ⚡ IA Ativa
                              </span>
                            )}

                            {isQualified && (
                              <span className="text-[11px] font-bold text-[#248A3D] bg-[#34C759]/10 px-2.5 py-0.5 rounded-full">
                                🎯 Qualificado
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-zinc-300 self-center shrink-0 md:hidden" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat Column: Visible on desktop OR on mobile when mobilePane === 'chat' */}
            <div className={`flex-1 flex flex-col apple-card overflow-hidden ${
              mobilePane === 'list' ? 'hidden md:flex' : 'flex'
            }`}>
              
              {activeContact ? (
                <>
                  {/* Chat Header with Large Touch Elements */}
                  <div className="p-4 sm:p-5 border-b border-black/[0.06] bg-white flex items-center justify-between gap-3">
                    
                    {/* Back Button (Mobile only) */}
                    <button
                      onClick={() => setMobilePane('list')}
                      className="md:hidden flex items-center gap-1.5 p-2 -ml-2 text-[#0071E3] hover:bg-black/[0.04] text-sm font-bold rounded-xl transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      <span>Voltar</span>
                    </button>

                    {/* Active Contact Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
                        {activeContact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#1D1D1F] truncate leading-tight">
                            {activeContact.name}
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                          {activeContact.company || 'Empresa em prospecção'} · {activeContact.phone}
                        </p>
                      </div>
                    </div>

                    {/* Takeover Control Switch & Direct WhatsApp */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppDirect()}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[#34C759]/15 text-[#248A3D] hover:bg-[#34C759]/25 transition-all shadow-xs"
                        title="Abrir diretamente no WhatsApp (Sem API / Grátis)"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      {activeContact.agentState === 'human_takeover' ? (
                        <button
                          onClick={() => handleToggleAgentState('ai_active')}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#0071E3] text-white hover:bg-[#0062C4] transition-all shadow-xs"
                          title="Reativar agente SDR da Girofy"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Reativar IA</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleAgentState('human_takeover')}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#FF9500] text-white hover:bg-[#E08500] transition-all shadow-xs"
                          title="Pausar IA e assumir o atendimento manualmente"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Assumir Humano</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Canned Replies Carousel */}
                  <div className="px-4 py-2.5 bg-[#F5F5F7] border-b border-black/[0.04] flex items-center gap-2 overflow-x-auto scrollbar-none">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                      Respostas:
                    </span>
                    {QUICK_REPLIES.map((qr, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInputText(qr.text)}
                        className="px-3.5 py-1.5 rounded-full bg-white border border-black/[0.08] hover:border-[#0071E3] text-zinc-700 whitespace-nowrap text-xs font-medium transition-all shadow-xs"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>

                  {/* Messages Stream (Spacious, modern bubbles) */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FBFBFD]">
                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="p-8 text-center text-sm text-zinc-400">
                        <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                        Carregando mensagens do WhatsApp...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-sm text-zinc-400 flex flex-col items-center gap-2.5">
                        <div className="w-14 h-14 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-300">
                          <MessageSquare className="w-7 h-7 stroke-[1.5]" />
                        </div>
                        <p className="font-bold text-zinc-700 text-base">Nenhuma mensagem nesta conversa ainda</p>
                        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                          Você pode enviar uma mensagem manual abaixo ou aguardar a resposta da abordagem pelo WhatsApp.
                        </p>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isLead = msg.from === 'lead';
                        const isBot = msg.from === 'bot';

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                          >
                            {/* Message Meta Info */}
                            <div className="flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400 font-medium">
                              <span>
                                {isLead ? activeContact.name : isBot ? 'Girofy IA SDR' : 'Você (Operador)'}
                              </span>
                              <span>·</span>
                              <span className="tabular-nums">
                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Bubble */}
                            <div className={`max-w-[88%] sm:max-w-md p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                              isLead
                                ? 'bg-white border border-black/[0.08] text-[#1D1D1F]'
                                : isBot
                                  ? 'bg-[#0071E3] text-white'
                                  : 'bg-[#1D1D1F] text-white'
                            }`}>
                              {msg.text}

                              {/* AI Reasoning Preview */}
                              {msg.aiReasoning && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/20 text-xs text-white/90">
                                  <span className="font-bold">Contexto comercial: </span>
                                  {msg.aiReasoning}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Send Input Form */}
                  <form 
                    onSubmit={handleSendMessage}
                    className="p-3.5 sm:p-4 border-t border-black/[0.06] bg-white flex items-center gap-2.5"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder={`Responder a ${activeContact.name} no WhatsApp...`}
                      disabled={isSendingMessage}
                      className="flex-1 px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] placeholder-zinc-400 focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenWhatsAppDirect()}
                        className="px-4 py-3 rounded-2xl bg-[#34C759] hover:bg-[#2EB84E] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        title="Abrir diretamente no WhatsApp do celular (Sem API / Grátis)"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      <button
                        type="submit"
                        disabled={!inputText.trim() || isSendingMessage}
                        className="px-5 py-3 rounded-2xl bg-[#0071E3] hover:bg-[#0062C4] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        title="Enviar via Gateway/Servidor configurado"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Enviar</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-300 mb-3">
                    <Smartphone className="w-8 h-8 stroke-[1.4]" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-800 mb-1">Nenhuma conversa selecionada</h3>
                  <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                    Selecione um contato na lista ao lado para acompanhar o histórico, responder ou transferir para atendimento humano.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WIDGETS & MÉTRICAS (Modular iOS Dashboard) */}
        {/* ========================================================================= */}
        {activeTab === 'widgets' && (
          <div className="space-y-4">
            
            {/* Header Widget */}
            <div className="apple-widget p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                  Painel de Operações Comerciais
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                  Monitoramento em tempo real do atendimento automatizado da Girofy Tecnologia
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium">Status do Sistema:</span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34C759]/15 text-[#248A3D] font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                  Operacional
                </span>
              </div>
            </div>

            {/* 4 iOS-Style Modular KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              
              {/* Card 1: Leads Totais */}
              <div className="apple-widget p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-3">
                  <span className="text-xs font-bold text-zinc-600 uppercase">Contatos CRM</span>
                  <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-[#1D1D1F] tabular-nums">
                    {metrics.total}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    Leads cadastrados
                  </div>
                </div>
              </div>

              {/* Card 2: Qualificados */}
              <div className="apple-widget p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-3">
                  <span className="text-xs font-bold text-zinc-600 uppercase">Qualificados</span>
                  <div className="w-8 h-8 rounded-xl bg-[#34C759]/15 text-[#248A3D] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-[#248A3D] tabular-nums">
                    {metrics.qualified}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    Prontos para reunião
                  </div>
                </div>
              </div>

              {/* Card 3: Aguardando Humano */}
              <div className="apple-widget p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-3">
                  <span className="text-xs font-bold text-zinc-600 uppercase">Humano</span>
                  <div className="w-8 h-8 rounded-xl bg-[#FF9500]/15 text-[#C97700] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-[#C97700] tabular-nums">
                    {metrics.humanNeeded}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    Requer intervenção
                  </div>
                </div>
              </div>

              {/* Card 4: IA Autônoma */}
              <div className="apple-widget p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-3">
                  <span className="text-xs font-bold text-zinc-600 uppercase">IA Ativa</span>
                  <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold tracking-tight text-[#0071E3] tabular-nums">
                    {metrics.activeAi}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    Conversas ativas
                  </div>
                </div>
              </div>
            </div>

            {/* Modular Detail Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Widget: Meta Cloud API Connection Box */}
              <div className="apple-widget p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-[#34C759]/15 text-[#248A3D] flex items-center justify-center font-bold">
                        <Phone className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-tight">
                        Meta WhatsApp Cloud API
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 font-medium">
                      ID: {config.metaPhoneNumberId}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">Número Comercial:</span>
                      <span className="font-bold text-zinc-800">{config.authorizedBusinessNumber}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">App Meta Oficial:</span>
                      <span className="font-bold text-zinc-800">Meuapp ({config.appId})</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">Janela 24 Horas:</span>
                      <span className="font-bold text-[#248A3D]">Ativa & Conforme</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-zinc-500 font-medium">Assinatura SHA-256:</span>
                      <span className="font-bold text-zinc-800">Validado no Webhook</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-black/[0.06] flex items-center justify-between">
                  <button
                    onClick={checkWhatsAppStatus}
                    disabled={testingStatus}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[#0071E3] text-white hover:bg-[#0062C4] transition-all shadow-xs"
                  >
                    {testingStatus ? 'Testando...' : 'Verificar Conexão Agora'}
                  </button>
                  <button
                    onClick={() => setActiveTab('ajustes')}
                    className="text-xs text-[#0071E3] hover:underline font-bold"
                  >
                    Configurar Credenciais →
                  </button>
                </div>
              </div>

              {/* Widget: Motor Comercial Girofy */}
              <div className="apple-widget p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-tight">
                        Motor de Inteligência Artificial
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 font-medium">
                      {config.geminiModel}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">Persona SDR:</span>
                      <span className="font-bold text-zinc-800">SDR B2B Girofy (PT-BR)</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">Condições Comerciais:</span>
                      <span className="font-bold text-zinc-800">Landing Pages a partir de R$ 997</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-black/[0.04]">
                      <span className="text-zinc-500 font-medium">Guarda de Negociação:</span>
                      <span className="font-bold text-[#248A3D]">Preços e Escopo Travados</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-zinc-500 font-medium">Disparos em Massa:</span>
                      <span className="font-bold text-zinc-600">Desabilitado (Apenas Resposta)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-black/[0.06] flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('ia')}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[#1D1D1F] text-white hover:bg-zinc-800 transition-all shadow-xs"
                  >
                    Abrir Sandbox de Teste
                  </button>
                  <span className="text-xs text-zinc-400 font-medium">
                    Latência: ~1.2s
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MOTOR SDR GIROFY (Prompt, Sandbox & IA Rules) */}
        {/* ========================================================================= */}
        {activeTab === 'ia' && (
          <div className="space-y-4 max-w-4xl mx-auto w-full">
            
            {/* Base de conhecimento e aprendizado */}
            <IAHub />

            {/* Guidelines Card */}
            <div className="apple-widget p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] tracking-tight mb-1 flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-[#0071E3]" />
                Diretrizes Comerciais da Girofy Tecnologia
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mb-5">
                O agente opera sob parâmetros rígidos de negociação, respondendo somente em português brasileiro natural e cordial.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="p-4 bg-[#FBFBFD] border border-black/[0.06] rounded-2xl">
                  <span className="font-bold text-[#0071E3] block mb-1 text-sm">01. Escopo Autorizado</span>
                  <p className="text-zinc-600 leading-relaxed font-medium">
                    Site para o negócio por R$ 300, pago só na entrega, com prévia gratuita antes. Automações de atendimento passam pelo César.
                  </p>
                </div>

                <div className="p-4 bg-[#FBFBFD] border border-black/[0.06] rounded-2xl">
                  <span className="font-bold text-[#248A3D] block mb-1 text-sm">02. Transferência Humana</span>
                  <p className="text-zinc-600 leading-relaxed font-medium">
                    Transfere imediatamente para o proprietário em caso de pedidos especiais, dúvidas fora do escopo ou objeções complexas.
                  </p>
                </div>

                <div className="p-4 bg-[#FBFBFD] border border-black/[0.06] rounded-2xl">
                  <span className="font-bold text-[#C97700] block mb-1 text-sm">03. Não-Alucinação</span>
                  <p className="text-zinc-600 leading-relaxed font-medium">
                    Nunca inventa preços não autorizados, prazos fantasiosos ou afirma contratações sem confirmação humana.
                  </p>
                </div>
              </div>
            </div>

            {/* Sandbox Simulator */}
            <div className="apple-widget p-5 sm:p-6">
              <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-tight mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#FF9500]" />
                Simulador de Mensagem de Lead
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mb-4">
                Envie uma mensagem simulada para verificar como a IA responde dentro da persona da Girofy.
              </p>

              <div className="space-y-3.5">
                <textarea
                  rows={3}
                  value={simInput}
                  onChange={e => setSimInput(e.target.value)}
                  placeholder="Exemplo: Vi sua mensagem. Quanto custa para fazer um site institucional para a minha empresa?"
                  className="w-full p-4 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] placeholder-zinc-400 focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      'Quanto custa uma Landing Page?',
                      'Gostaria de falar com um atendente',
                      'Vocês criam sistemas sob medida?'
                    ].map((example, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSimInput(example)}
                        className="text-xs px-3 py-1.5 rounded-full bg-black/[0.04] text-zinc-600 hover:bg-black/[0.08] font-medium"
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRunSimulation}
                    disabled={!simInput.trim() || simLoading}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#0071E3] text-white hover:bg-[#0062C4] disabled:opacity-40 transition-all shadow-xs self-end sm:self-auto"
                  >
                    {simLoading ? 'Processando IA...' : 'Testar Resposta'}
                  </button>
                </div>

                {simOutput && (
                  <div className="p-4 bg-[#34C759]/10 border border-[#34C759]/20 rounded-2xl text-xs sm:text-sm text-[#1D1D1F] mt-2">
                    <span className="font-bold text-[#248A3D] block mb-1">Resultado da Simulação:</span>
                    <p className="leading-relaxed text-zinc-700">{simOutput}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: AJUSTES & META CLOUD API (Credentials & Webhook Setup) */}
        {/* ========================================================================= */}
        {activeTab === 'ajustes' && (
          <div className="space-y-4 max-w-4xl mx-auto w-full">
            
            {/* Webhook Endpoint Instructions Card */}
            <div className="apple-widget p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] tracking-tight mb-1 flex items-center gap-2.5">
                <Phone className="w-5 h-5 text-[#34C759]" />
                Configuração do Webhook Oficial da Meta
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mb-5">
                Copie estes dados para configurar o produto WhatsApp no painel Developers da Meta (App: <b>Meuapp</b>).
              </p>

              <div className="space-y-3.5">
                {/* Callback URL */}
                <div className="p-4 bg-[#FBFBFD] border border-black/[0.06] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-500 font-semibold block">URL de Retorno de Chamada (Callback URL)</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#0071E3] select-all">
                      https://prospectfy.vercel.app/api/webhook
                    </span>
                  </div>
                  <button
                    onClick={() => copyText('https://prospectfy.vercel.app/api/webhook', 'webhook_url')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-white border border-black/[0.08] hover:border-black/[0.2] transition-all self-start sm:self-auto shadow-xs"
                  >
                    {copiedKey === 'webhook_url' ? <Check className="w-4 h-4 text-[#34C759]" /> : <Copy className="w-4 h-4 text-zinc-600" />}
                    <span>{copiedKey === 'webhook_url' ? 'Copiado' : 'Copiar URL'}</span>
                  </button>
                </div>

                {/* Verify Token */}
                <div className="p-4 bg-[#FBFBFD] border border-black/[0.06] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-500 font-semibold block">Token de Verificação (Verify Token)</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#1D1D1F] select-all">
                      {config.webhookVerifyToken || 'impossivel2008'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyText(config.webhookVerifyToken || 'impossivel2008', 'verify_token')}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-white border border-black/[0.08] hover:border-black/[0.2] transition-all self-start sm:self-auto shadow-xs"
                  >
                    {copiedKey === 'verify_token' ? <Check className="w-4 h-4 text-[#34C759]" /> : <Copy className="w-4 h-4 text-zinc-600" />}
                    <span>{copiedKey === 'verify_token' ? 'Copiado' : 'Copiar Token'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* In-App Credentials Manager */}
            <div className="apple-widget p-5 sm:p-6">
              <h3 className="text-base font-bold text-[#1D1D1F] tracking-tight mb-1 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0071E3]" />
                Credenciais Seguras no Servidor
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium mb-5">
                Tokens e chaves ficam armazenados no backend e nunca são expostos no navegador.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Meta Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={inputPhoneId}
                      onChange={e => setInputPhoneId(e.target.value)}
                      placeholder="1221241567748320"
                      className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Meta Access Token (Permanente)
                    </label>
                    <input
                      type="password"
                      value={inputMetaToken}
                      onChange={e => setInputMetaToken(e.target.value)}
                      placeholder={config.metaAccessTokenMasked || 'EAAB... (Cole aqui)'}
                      className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Meta App Secret (Para SHA-256)
                    </label>
                    <input
                      type="password"
                      value={inputAppSecret}
                      onChange={e => setInputAppSecret(e.target.value)}
                      placeholder={config.metaAppSecretMasked || 'Chave secreta do Meuapp'}
                      className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      Google Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={inputGeminiKey}
                      onChange={e => setInputGeminiKey(e.target.value)}
                      placeholder={config.geminiApiKeyMasked || 'AIzaSy... (Motor SDR)'}
                      className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] font-mono focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06]">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-6 py-3 text-sm font-bold rounded-2xl bg-[#0071E3] text-white hover:bg-[#0062C4] shadow-sm transition-all disabled:opacity-40"
                  >
                    {isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </form>
            </div>

            {/* Audit Logs Table */}
            <div className="apple-widget p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-800 uppercase tracking-tight">
                    Registro de Auditoria Recente
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">Eventos do webhook e motor de inteligência artificial</p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="text-xs text-[#0071E3] hover:underline font-bold"
                >
                  Atualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-zinc-400">
                      <th className="py-2 font-semibold">Horário</th>
                      <th className="py-2 font-semibold">Tipo</th>
                      <th className="py-2 font-semibold">Telefone</th>
                      <th className="py-2 font-semibold">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {auditLogs.slice(0, 5).map(log => (
                      <tr key={log.id} className="text-zinc-600">
                        <td className="py-2 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="py-2 font-mono text-[11px] text-zinc-500">
                          {log.type}
                        </td>
                        <td className="py-2 font-mono text-[11px]">
                          {log.phone || '—'}
                        </td>
                        <td className="py-2 truncate max-w-xs">
                          {log.summary}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-zinc-400">
                          Nenhum evento registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM DOCK (iOS Cupertino Tab Bar with Comfortable Tap Targets) */}
      {/* ========================================================================= */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 apple-dock z-40 px-3 py-2 flex items-center justify-around shadow-xl">
        
        <button
          onClick={() => {
            setActiveTab('conversas');
            setMobilePane('list');
          }}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
            activeTab === 'conversas' 
              ? 'text-[#0071E3] font-bold' 
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <MessageSquare className="w-6 h-6 stroke-[2]" />
          <span className="text-[11px] tracking-tight">Conversas</span>
        </button>

        <button
          onClick={() => setActiveTab('widgets')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
            activeTab === 'widgets' 
              ? 'text-[#0071E3] font-bold' 
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <BarChart3 className="w-6 h-6 stroke-[2]" />
          <span className="text-[11px] tracking-tight">Métricas</span>
        </button>

        <button
          onClick={() => setActiveTab('ia')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
            activeTab === 'ia' 
              ? 'text-[#0071E3] font-bold' 
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <Cpu className="w-6 h-6 stroke-[2]" />
          <span className="text-[11px] tracking-tight">Girofy IA</span>
        </button>

        <button
          onClick={() => setActiveTab('ajustes')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
            activeTab === 'ajustes' 
              ? 'text-[#0071E3] font-bold' 
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <Settings className="w-6 h-6 stroke-[2]" />
          <span className="text-[11px] tracking-tight">Ajustes</span>
        </button>
      </nav>

      {/* ADD CONTACT MODAL */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-widget bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight mb-1">
              Novo Lead Comercial
            </h3>
            <p className="text-xs text-zinc-500 font-medium mb-5">
              Cadastre um contato para iniciar atendimento ou acompanhar conversas no WhatsApp.
            </p>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Número de WhatsApp (com DDD) *
                </label>
                <input
                  type="text"
                  required
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  placeholder="Ex: 74988126578"
                  className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Nome do Prospect
                </label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Empresa / Negócio
                </label>
                <input
                  type="text"
                  value={newContactCompany}
                  onChange={e => setNewContactCompany(e.target.value)}
                  placeholder="Ex: Imobiliária Silva"
                  className="w-full px-4 py-3 text-sm bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl text-zinc-600 hover:bg-black/[0.04]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#0071E3] text-white hover:bg-[#0062C4] shadow-xs"
                >
                  Adicionar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP DUAL GATEWAY & 8-DIGIT PAIRING CODE MODAL (FOR MOBILE PHONE USE) */}
      {showPairingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="apple-widget bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#34C759]/15 text-[#248A3D] flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1D1D1F] tracking-tight">
                    Conexão WhatsApp
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    100% no celular · Sem taxas de marketing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPairingModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3-Way Mode Switcher */}
            <div className="flex p-1 bg-[#E5E5EA]/70 rounded-2xl gap-1 mb-4">
              <button
                type="button"
                onClick={() => setPairingModalTab('direct_free')}
                className={`flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pairingModalTab === 'direct_free'
                    ? 'bg-white text-[#1D1D1F] shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                <span className="truncate">Direto Celular (R$ 0)</span>
              </button>

              <button
                type="button"
                onClick={() => setPairingModalTab('cloud_free')}
                className={`flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pairingModalTab === 'cloud_free'
                    ? 'bg-white text-[#1D1D1F] shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
                <span className="truncate">Nuvem 24h Grátis</span>
              </button>

              <button
                type="button"
                onClick={() => setPairingModalTab('meta_official')}
                className={`flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  pairingModalTab === 'meta_official'
                    ? 'bg-white text-[#1D1D1F] shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                <span className="truncate">Meta Cloud</span>
              </button>
            </div>

            {/* TAB 1: 100% FREE WHATSAPP DIRECT (ZERO API / NO TOKEN / NO SERVERS) */}
            {pairingModalTab === 'direct_free' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 space-y-2">
                  <div className="text-xs font-bold text-[#248A3D] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Modo 100% Gratuito · Sem API · Sem Tokens</span>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    Você <strong>não precisa de servidor</strong>, não precisa de tokens da Meta e <strong>não paga nada</strong>.
                  </p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Ao conversar com qualquer lead ou fazer micro-disparos, toque em <strong>"WhatsApp Direto"</strong>: o app abre a conversa oficial no seu celular com o texto personalizado já preenchido. É só tocar em enviar!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-black/[0.06] space-y-2">
                  <span className="text-xs font-bold text-zinc-800 block">Vantagens deste modo:</span>
                  <ul className="text-xs text-zinc-600 space-y-1.5 list-none">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0" />
                      <span><strong>R$ 0,00 de custo:</strong> nunca é cobrado por mensagens.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0" />
                      <span><strong>Zero risco de bloqueio:</strong> o envio é feito pelo app oficial do seu aparelho.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0" />
                      <span><strong>CRM integrado:</strong> as mensagens ficam salvas no histórico do cliente.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchGateway('direct_pairing');
                    showToast('Modo WhatsApp Direto ativado! Use o botão "WhatsApp" em qualquer lead.');
                    setShowPairingModal(false);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#34C759] text-white text-sm font-bold hover:bg-[#2EB84E] shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Usar Modo Direto Grátis</span>
                </button>
              </div>
            )}

            {/* TAB 2: FREE CLOUD 24H (EVOLUTION API ON FREE CONTAINER - KOYEB/RENDER) */}
            {pairingModalTab === 'cloud_free' && (
              <div className="space-y-4">
                
                {/* Active Connection Banner if connected */}
                {pairingData.status === 'connected' && (
                  <div className="p-3.5 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-[#34C759] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1D1D1F] truncate">
                          Nuvem Conectada ao WhatsApp
                        </div>
                        <div className="text-[11px] text-zinc-600 font-mono">
                          +{pairingData.phoneNumber || config.directPairingPhone || '557488126578'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#34C759] text-white shrink-0">
                      Ativo 24h
                    </span>
                  </div>
                )}

                {/* Step-by-Step Free Cloud Guide */}
                <div className="p-3.5 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 space-y-2">
                  <div className="text-xs font-bold text-[#0071E3] flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    <span>Como ter seu WhatsApp 24h na Nuvem Grátis (R$ 0,00)</span>
                  </div>
                  <p className="text-[11px] text-zinc-700 leading-relaxed">
                    Para o robô responder sozinho na nuvem 24 horas por dia (sem precisar do seu celular ligado ou de internet), basta rodar a <strong>Evolution API (código aberto e grátis)</strong> em um servidor com plano gratuito vitalício:
                  </p>
                  <ol className="text-[11px] text-zinc-600 space-y-1.5 list-decimal pl-4">
                    <li>No <strong>render.com</strong>, toque em <strong>+ New &gt; Web Service &gt; Existing Image</strong>.</li>
                    <li>Imagem pública oficial: <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] text-[#0071E3]">evoapicloud/evolution-api:v2.2.0</code></li>
                    <li>Adicione as variáveis de ambiente:
                      <div className="mt-1 space-y-0.5 font-mono text-[10px] text-zinc-700 bg-white/70 p-1.5 rounded">
                        <div>AUTHENTICATION_API_KEY = (crie uma chave longa e aleatória)</div>
                        <div>SERVER_TYPE = http</div>
                        <div>DATABASE_ENABLED = false</div>
                      </div>
                    </li>
                    <li>Cole a URL gerada abaixo junto com a chave e gere o código real de 8 dígitos!</li>
                  </ol>
                </div>

                {/* Server URL and Key Inputs */}
                <div className="space-y-2.5 p-3.5 bg-zinc-50 border border-black/[0.06] rounded-2xl">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      URL da sua Evolution API Gratuita
                    </label>
                    <input
                      type="text"
                      value={inputEvolutionUrl}
                      onChange={e => setInputEvolutionUrl(e.target.value)}
                      placeholder="Ex: https://meu-zap.koyeb.app"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-black/[0.08] rounded-xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                      Chave API da sua Evolution (AUTHENTICATION_API_KEY)
                    </label>
                    <input
                      type="password"
                      value={inputEvolutionKey}
                      onChange={e => setInputEvolutionKey(e.target.value)}
                      placeholder="Ex: minhachave123"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-black/[0.08] rounded-xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </div>

                {/* Phone Number Input Form */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Número do seu WhatsApp (DDD + Telefone)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputPairPhone}
                      onChange={e => setInputPairPhone(e.target.value)}
                      placeholder="Ex: 74988126578"
                      className="flex-1 px-4 py-3 text-sm font-mono bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      disabled={isRequestingCode}
                      onClick={() => handleRequestPairingCode()}
                      className="px-4 py-3 rounded-2xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0062C4] transition-all shrink-0 disabled:opacity-50"
                    >
                      {isRequestingCode ? 'Gerando...' : 'Gerar Código Real'}
                    </button>
                  </div>
                </div>

                {/* 8-Digit Pairing Code Display */}
                {pairingData.pairingCode && (
                  <div className="p-4 rounded-2xl bg-zinc-900 text-white flex flex-col items-center justify-center gap-2 border border-zinc-800 shadow-inner">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                      Código de Conexão no WhatsApp
                    </span>
                    <div className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-[#34C759]">
                      {pairingData.pairingCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(pairingData.pairingCode, 'paircode')}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all mt-1"
                    >
                      {copiedKey === 'paircode' ? <Check className="w-3.5 h-3.5 text-[#34C759]" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                      <span>{copiedKey === 'paircode' ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                )}

                {/* Confirm Pairing Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isConfirmingPair}
                    onClick={handleConfirmPairing}
                    className="w-full py-3.5 rounded-2xl bg-[#34C759] text-white text-sm font-bold hover:bg-[#2EB84E] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isConfirmingPair ? 'Confirmando...' : 'Confirmar Conexão no WhatsApp'}</span>
                  </button>
                </div>

              </div>
            )}

            {/* TAB 3: OFFICIAL META CLOUD API (PRESERVED) */}
            {pairingModalTab === 'meta_official' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 space-y-2">
                  <div className="text-xs font-bold text-[#0071E3] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Configuração Meta Cloud API Preservada</span>
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1 font-mono">
                    <div>Número: <strong>+55 74 8812-6578</strong></div>
                    <div>Phone ID: <strong>{config.metaPhoneNumberId}</strong></div>
                    <div>App ID: <strong>{config.appId}</strong></div>
                    <div>Webhook: <strong>{config.webhookVerifyToken}</strong></div>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                  A Meta concede 1.000 conversas gratuitas por mês. Requer apenas colar o Token de Acesso temporário ou permanente nos Ajustes.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchGateway('meta_cloud_api');
                    showToast('Meta Cloud API selecionada como canal de envio.');
                    setShowPairingModal(false);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#0071E3] text-white text-sm font-bold hover:bg-[#0062C4] shadow-sm transition-all"
                >
                  Usar Meta Cloud API
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MICRO-CADENCE TEST DISPATCH MODAL (5 TO 10 CONTACTS) */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="apple-widget bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center font-bold">
                  <Send className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1D1D1F] tracking-tight">
                    Micro-Disparos Frios
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    5 a 10 contatos · Delay seguro de 25s
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCampaignModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              
              {/* Batch Selector (5 or 10) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Quantidade de Contatos de Teste
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCampaignCount(5)}
                    className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      campaignCount === 5
                        ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]'
                        : 'border-black/[0.08] bg-[#F5F5F7] text-zinc-600'
                    }`}
                  >
                    <span className="text-base font-extrabold">5 Contatos</span>
                    <span className="text-[10px] text-zinc-400">Recomendado para teste</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCampaignCount(10)}
                    className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      campaignCount === 10
                        ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]'
                        : 'border-black/[0.08] bg-[#F5F5F7] text-zinc-600'
                    }`}
                  >
                    <span className="text-base font-extrabold">10 Contatos</span>
                    <span className="text-[10px] text-zinc-400">Lote máximo de segurança</span>
                  </button>
                </div>
              </div>

              {/* Message Template Input */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Mensagem de Abordagem Inicial (Bom dia)
                </label>
                <textarea
                  rows={3}
                  value={campaignCustomMsg}
                  onChange={e => setCampaignCustomMsg(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-[#F5F5F7] border border-black/[0.08] rounded-2xl text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:bg-white resize-none"
                />
                <span className="text-[11px] text-zinc-400 block mt-1">
                  Variáveis suportadas: <code>{'{nome}'}</code> e <code>{'{empresa}'}</code>.
                </span>
              </div>

              {/* Human SDR AI Guarantee Note */}
              <div className="p-3.5 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 space-y-1">
                <div className="text-xs font-bold text-[#0071E3] flex items-center gap-1.5">
                  <Bot className="w-4 h-4" />
                  <span>Respostas Humanas Enxutas (10 a 15 palavras)</span>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Assim que o lead responder "Bom dia", o motor Gemini SDR assume com respostas curtas e naturais de 10 a 15 palavras, sem textos longos ou robóticos.
                </p>
              </div>

              {/* Progress Animation during Dispatch */}
              {isDispatchingCampaign && (
                <div className="p-4 rounded-2xl bg-zinc-900 text-white space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#34C759]" />
                      Cadenciando disparos...
                    </span>
                    <span className="text-[#34C759] font-mono">Intervalo de 25s</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#34C759] h-full w-2/3 rounded-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl text-zinc-600 hover:bg-black/[0.04]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDispatchingCampaign}
                  onClick={handleStartMicroCampaign}
                  className="px-5 py-3 text-xs font-bold rounded-xl bg-[#FF9500] text-white hover:bg-[#E08500] shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isDispatchingCampaign ? 'Disparando...' : `Iniciar Disparo (${campaignCount} Leads)`}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL FILE IMPORT MODAL (SVG, PDF, HTML, CSV, TXT, JSON, XML) */}
      {showFileImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="apple-widget bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#34C759]/15 text-[#248A3D] flex items-center justify-center font-bold">
                  <FileUp className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1D1D1F] tracking-tight">
                    Importar Arquivo para o CRM
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    SVG, PDF, HTML, TXT, CSV, JSON e links
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowFileImportModal(false);
                  setParsedData(null);
                }}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Area */}
            <div className="space-y-4 flex-1">
              <label className="border-2 border-dashed border-[#0071E3]/30 hover:border-[#0071E3] hover:bg-[#0071E3]/5 transition-all rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer text-center bg-[#FAFAFC]">
                <input
                  type="file"
                  accept="*/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-2.5">
                  <Upload className="w-6 h-6 stroke-[2]" />
                </div>
                <span className="text-sm font-bold text-[#1D1D1F]">
                  {isParsingFile ? 'Lendo e filtrando dados...' : 'Selecione ou solte qualquer arquivo aqui'}
                </span>
                <span className="text-xs text-zinc-400 mt-1">
                  Aceita <strong>SVG, PDF, HTML, Planilha, TXT, CSV, JSON</strong>
                </span>
                <span className="text-[11px] text-[#0071E3] font-semibold mt-2 px-3 py-1 bg-white rounded-full border border-black/[0.06] shadow-xs">
                  Extração automática de telefones, nomes, empresas e links
                </span>
              </label>

              {/* Analysis Results Display */}
              {parsedData && (
                <div className="space-y-3">
                  
                  {/* Results Banner */}
                  <div className="p-3.5 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1D1D1F]">
                        {parsedData.totalFound} {parsedData.totalFound === 1 ? 'Contato Identificado' : 'Contatos Identificados'}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-xs">
                        Arquivo: {parsedData.fileName}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#34C759] text-white">
                      Pronto para CRM
                    </span>
                  </div>

                  {/* Extracted Links Section if any */}
                  {parsedData.extractedLinks && parsedData.extractedLinks.length > 0 && (
                    <div className="p-3 bg-zinc-50 rounded-2xl border border-black/[0.06]">
                      <div className="text-[11px] font-bold text-zinc-600 mb-1.5 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3 text-[#0071E3]" />
                        <span>Links e sites extraídos ({parsedData.extractedLinks.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {parsedData.extractedLinks.map((l, idx) => (
                          <span key={idx} className="text-[10px] font-mono bg-white px-2 py-0.5 rounded-md border border-black/[0.06] text-zinc-600 truncate max-w-[200px]" title={l}>
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leads List with Checkboxes */}
                  {parsedData.leads.length > 0 ? (
                    <div className="border border-black/[0.08] rounded-2xl overflow-hidden">
                      <div className="p-2.5 bg-zinc-100/80 border-b border-black/[0.06] flex items-center justify-between text-xs font-bold text-zinc-700">
                        <span>Contatos a importar:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = parsedData.leads.every(l => selectedLeadsToImport[l.phone]);
                            const newMap: Record<string, boolean> = {};
                            parsedData.leads.forEach(l => { newMap[l.phone] = !allSelected; });
                            setSelectedLeadsToImport(newMap);
                          }}
                          className="text-[#0071E3] hover:underline"
                        >
                          {parsedData.leads.every(l => selectedLeadsToImport[l.phone]) ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-black/[0.04]">
                        {parsedData.leads.map((lead, idx) => {
                          const isChecked = selectedLeadsToImport[lead.phone] !== false;
                          return (
                            <div key={idx} className="p-2.5 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  setSelectedLeadsToImport(prev => ({
                                    ...prev,
                                    [lead.phone]: e.target.checked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-[#0071E3] focus:ring-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0 text-xs">
                                <div className="font-bold text-[#1D1D1F] truncate">
                                  {lead.name}
                                </div>
                                <div className="text-zinc-500 font-mono text-[11px] truncate">
                                  +{lead.phone} {lead.company ? `· ${lead.company}` : ''}
                                </div>
                                {lead.link && (
                                  <div className="text-[10px] text-[#0071E3] truncate">
                                    {lead.link}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      Nenhum número de telefone válido encontrado neste arquivo. Tente um arquivo com dados de contato.
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-black/[0.06] mt-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowFileImportModal(false);
                  setParsedData(null);
                }}
                className="px-4 py-2.5 text-xs font-bold rounded-xl text-zinc-600 hover:bg-black/[0.04]"
              >
                Cancelar
              </button>
              {parsedData && parsedData.leads.length > 0 && (
                <button
                  type="button"
                  disabled={isImportingLeads}
                  onClick={handleCommitImport}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#34C759] text-white hover:bg-[#2EB84E] shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isImportingLeads ? 'Importando...' : 'Adicionar ao CRM'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM CLEAR CRM MODAL */}
      {showConfirmClearModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-widget bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-extrabold text-[#1D1D1F] tracking-tight mb-1">
              Limpar Todos os Leads do CRM?
            </h3>
            <p className="text-xs text-zinc-500 font-medium mb-5 leading-relaxed">
              Esta ação removerá todos os contatos e mensagens registradas. Você poderá adicionar novos leads a qualquer momento enviando um arquivo ou cadastrando novos números.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isClearingCrm}
                onClick={() => setShowConfirmClearModal(false)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl text-zinc-600 hover:bg-black/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingCrm}
                onClick={handleClearAllContacts}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-xs disabled:opacity-50"
              >
                {isClearingCrm ? 'Limpando...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
