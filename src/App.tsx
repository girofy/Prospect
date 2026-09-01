import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
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
  Download,
  Sliders,
  TrendingUp,
  BookOpen,
  HelpCircle,
  QrCode,
  Globe,
  Copy,
  Check,
  Terminal,
  Server
} from 'lucide-react';
import { 
  TabType,
  OpenerType, 
  Lead,
  LeadStatus,
  ContactRole,
  ChatMessage,
  KnowledgeBook, 
  SystemPromptConfig, 
  GoogleIntegrationSettings, 
  WhatsAppSessionState, 
  WhatsAppCloudApiConfig,
  HealthScoreSignals,
  ExperienceMemory,
  GoogleSheetsLog
} from './types';

// [LAYOUT ARCHETYPE]: Monospace Technical Console & WhatsApp Cloud API Setup
// [RADIUS & BORDERS]: rounded-2xl buttons & cards / border border-zinc-800
// [ACCENT LOGIC]: #25D366 (WhatsApp Official Green) & #F5B700 (Industrial Mustard)

// Sanitização rigorosa para cabeçalhos HTTP (garante estritamente caracteres válidos ASCII / ISO-8859-1)
const toIso88591Header = (val: string): string => {
  if (!val || typeof val !== 'string') return '';
  // Converte ou descarta qualquer caractere não-ASCII (fora de 32 a 126)
  let clean = '';
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      clean += val[i];
    }
  }
  return clean.replace(/^Bearer\s+/i, '').trim();
};

const sanitizePhoneOrId = (val: string): string => {
  if (!val || typeof val !== 'string') return '';
  return val
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .trim();
};

const createSafeHeaders = (token: string, extraHeaders: Record<string, string> = {}) => {
  const safeToken = toIso88591Header(token);
  const headers: Record<string, string> = {};
  if (safeToken) {
    headers['Authorization'] = `Bearer ${safeToken}`;
  }
  headers['Accept'] = 'application/json';
  for (const [key, value] of Object.entries(extraHeaders)) {
    const cleanKey = toIso88591Header(key);
    const cleanVal = toIso88591Header(value);
    if (cleanKey && cleanVal) {
      headers[cleanKey] = cleanVal;
    }
  }
  return headers;
};

// Regex para detecção rigorosa de Opt-Out / Stop-words (Proteção LGPD & Anti-ban)
const OPT_OUT_REGEX = /(não tenho interesse|nao tenho interesse|pare de mandar|para de mandar|remove meu contato|remover contato|tirar da lista|não me mande|nao me mande|denunciar|spam|sair|desinscrever|vai se foder|palhaçada|bloqueado|nunca mais)/i;

// 100% ZERADO POR PADRÃO: Sem contatos falsos, sem mensagens simuladas
const EMPTY_LEADS: Lead[] = [];
const EMPTY_SHEETS_LOGS: GoogleSheetsLog[] = [];

const INITIAL_BOOKS: KnowledgeBook[] = [
  {
    id: 'spin-selling',
    title: 'SPIN Selling',
    author: 'Neil Rackham',
    tagline: 'Perguntas de Situação, Problema, Implicação e Necessidade.',
    active: true,
    coreFramework: 'S-P-I-N Flow',
    keyTechniques: ['Evitar preço precoce', 'Explorar a implicação do problema', 'Fazer o lead concluir a necessidade'],
    systemWeight: 85,
  },
  {
    id: 'fanatical-prospecting',
    title: 'Prospecção Fanática',
    author: 'Jeb Blount',
    tagline: 'Gatilhos secos e consistência brutal de funil.',
    active: true,
    coreFramework: '30-Day Rule',
    keyTechniques: ['Gatilhos rápidos', 'Quebra de hesitação', 'Nunca pedir desculpas por prospectar'],
    systemWeight: 90,
  },
  {
    id: '100m-offers',
    title: 'Ofertas de 100 Milhões',
    author: 'Alex Hormozi',
    tagline: 'Grand Slam Offers irresistíveis.',
    active: true,
    coreFramework: 'Value Equation',
    keyTechniques: ['Redução de esforço percebido', 'Aumento de probabilidade de conquista', 'Garantia condicional'],
    systemWeight: 75,
  },
  {
    id: 'challenger-sale',
    title: 'A Venda Desafiadora',
    author: 'Matthew Dixon',
    tagline: 'Ensine, adapte e assuma o controle da conversa comercial.',
    active: true,
    coreFramework: 'Teach-Tailor-Take Control',
    keyTechniques: ['Provocar desconforto construtivo', 'Apresentar dados contra-intuitivos'],
    systemWeight: 80,
  },
];

const INITIAL_MEMORY: ExperienceMemory = {
  openerStats: {
    'Bom Dia': { sent: 0, replies: 0 },
    'Boa Tarde': { sent: 0, replies: 0 },
    'Boa Noite': { sent: 0, replies: 0 },
  },
  successfulPhrases: [
    'Como vocês lidam com os leads fora do horário comercial?',
    'Abre 15 min amanhã no Meet para um diagnóstico rápido?'
  ],
  ignoredPhrases: [
    'Gostaria de apresentar nossa empresa de tecnologia.',
    'Temos os melhores preços do mercado.'
  ],
  sectorRules: [
    {
      id: 'sr-1',
      niche: 'Saúde & Clínicas',
      rule: 'Tratar a recepcionista como aliada e facilitadora essencial.',
      bestTime: '08:30 às 10:30',
      avoidDays: ['Sexta-feira à tarde']
    },
    {
      id: 'sr-2',
      niche: 'Logística & Transportes',
      rule: 'Focar no tempo de resposta a motoristas e orçamentos noturnos.',
      bestTime: '07:30 às 09:00',
      avoidDays: ['Sábado']
    }
  ],
  operatorApprovalCount: 0,
  operatorEditCount: 0,
  autonomyLevel: 100,
};

export default function App() {
  // Navegação
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Relógio ao vivo
  const [timeString, setTimeString] = useState('05:37');
  const [dateString, setDateString] = useState('dom 14 dez');

  // 1. Chave de API e Modelos (Gemini Real)
  const [apiKey, setApiKey] = useState<string>(() => {
    return toIso88591Header(localStorage.getItem('girofy_gemini_api_key') || '');
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isKeyValid, setIsKeyValid] = useState<boolean>(() => {
    return Boolean(toIso88591Header(localStorage.getItem('girofy_gemini_api_key') || ''));
  });
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('girofy_selected_model') || 'gemini-2.5-flash';
  });
  const [availableModels] = useState<string[]>([
    'gemini-2.5-flash',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
    'gemini-flash-latest'
  ]);

  // 2. Leads 100% Zerados por padrão (persistência limpa)
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('girofy_leads_data_v2');
    return saved ? JSON.parse(saved) : EMPTY_LEADS;
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || leads[0], [leads, selectedLeadId]);

  // 3. Memória de Aprendizado
  const [memory, setMemory] = useState<ExperienceMemory>(() => {
    const saved = localStorage.getItem('girofy_experience_memory_v2');
    return saved ? JSON.parse(saved) : INITIAL_MEMORY;
  });

  // 4. Livros & Metodologias
  const [books, setBooks] = useState<KnowledgeBook[]>(() => {
    const saved = localStorage.getItem('girofy_knowledge_books_v2');
    return saved ? JSON.parse(saved) : INITIAL_BOOKS;
  });

  // 5. System Prompt & Configuração
  const [systemPrompt, setSystemPrompt] = useState<SystemPromptConfig>(() => {
    const saved = localStorage.getItem('girofy_system_prompt_v2');
    return saved ? JSON.parse(saved) : {
      presetName: 'Consultivo & Desafiador (Girofy Master)',
      prompt: `Você é o assistente comercial de prospecção da Girofy.
Seu objetivo é qualificar leads pelo WhatsApp e agendar demonstrações de 15 minutos via Google Meet.

Diretrizes Críticas:
1. NUNCA fale como um vendedor genérico ou use frases clichês.
2. Seja direto, conciso (máximo 2 a 3 frases curtas por mensagem).
3. Adapte a linguagem ao papel do contato:
   - Se falar com RECEPÇÃO: tom colaborativo e focado em facilitar o trabalho dela.
   - Se falar com DECISOR: direto, focado em ROI e perdas operacionais silenciosas.
4. Quando o lead aceitar agendar, responda formatando:
   AGENDAR: [Título da Reunião] | [Data/Hora Início] | [Data/Hora Fim]`,
      temperature: 0.5,
      tone: 'consultivo',
      maxTokens: 250,
      includeAudioNoteTrigger: true,
      safetyCooldownSeconds: 20,
    };
  });

  // 6. Conexão Real WhatsApp Cloud API (Oficial Meta)
  const [waState, setWaState] = useState<WhatsAppSessionState>(() => {
    try {
      const saved = localStorage.getItem('girofy_whatsapp_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.config) {
          parsed.config.accessToken = toIso88591Header(parsed.config.accessToken || '');
          parsed.config.phoneNumberId = sanitizePhoneOrId(parsed.config.phoneNumberId || '');
          parsed.config.wabaId = sanitizePhoneOrId(parsed.config.wabaId || '');
          parsed.config.connectedNumber = toIso88591Header(parsed.config.connectedNumber || '');
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar sessão salva do WhatsApp:', e);
    }
    return {
      connected: false,
      pairingStatus: 'disconnected',
      gatewayType: 'meta_cloud_api',
      config: {
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        connectedNumber: '',
        verifiedName: '',
        qualityRating: 'UNKNOWN',
      },
      lastActive: 'Nunca conectado',
    };
  });

  // Inputs para credenciais do WhatsApp Meta Cloud API
  const [waInputPhoneNumberId, setWaInputPhoneNumberId] = useState(() => sanitizePhoneOrId(waState.config.phoneNumberId));
  const [waInputWabaId, setWaInputWabaId] = useState(() => sanitizePhoneOrId(waState.config.wabaId));
  const [waInputToken, setWaInputToken] = useState(() => toIso88591Header(waState.config.accessToken));
  const [waInputConnectedNumber, setWaInputConnectedNumber] = useState(() => toIso88591Header(waState.config.connectedNumber));
  const [testRecipientPhone, setTestRecipientPhone] = useState('');
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 7. Google Sheets Log Zerado
  const [sheetsLogs, setSheetsLogs] = useState<GoogleSheetsLog[]>(() => {
    const saved = localStorage.getItem('girofy_sheets_logs_v2');
    return saved ? JSON.parse(saved) : EMPTY_SHEETS_LOGS;
  });

  // 8. Google Calendar Settings
  const [googleSettings] = useState<GoogleIntegrationSettings>({
    calendarEnabled: true,
    meetEnabled: true,
    calendarId: 'primary',
    calendarName: 'Agenda Comercial Principal',
    autoCreateMeetLink: true,
    meetingDurationMinutes: 30,
    bufferMinutes: 15,
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    syncedEventsCount: 0,
    lastSyncTimestamp: 'Pronto para sincronizar',
  });

  // Gatilho de disparo selecionado
  const [selectedOpener, setSelectedOpener] = useState<OpenerType>('Bom Dia');
  const [isAudioNote, setIsAudioNote] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; leadName?: string } | null>(null);

  // Estados de entrada manual
  const [chatTextInput, setChatTextInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [editingProposalText, setEditingProposalText] = useState('');
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // Adicionar lead individual
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadNiche, setNewLeadNiche] = useState('');
  const [newLeadRole, setNewLeadRole] = useState<ContactRole>('decisor');

  // Importador em massa
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Persistência automática em localStorage
  useEffect(() => {
    localStorage.setItem('girofy_leads_data_v2', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('girofy_experience_memory_v2', JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    localStorage.setItem('girofy_knowledge_books_v2', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem('girofy_sheets_logs_v2', JSON.stringify(sheetsLogs));
  }, [sheetsLogs]);

  useEffect(() => {
    localStorage.setItem('girofy_system_prompt_v2', JSON.stringify(systemPrompt));
  }, [systemPrompt]);

  useEffect(() => {
    localStorage.setItem('girofy_whatsapp_session_v2', JSON.stringify(waState));
  }, [waState]);

  // Relógio
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
    setTimeout(() => setToastMsg(null), 4000);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
    showToast(`Copiado: ${fieldName}`);
  };

  // Zerar todos os dados do aplicativo
  const handleResetAllData = () => {
    if (window.confirm('Tem certeza que deseja zerar TODOS os dados e contatos? O app começará 100% limpo.')) {
      setLeads([]);
      setSheetsLogs([]);
      setSelectedLeadId('');
      localStorage.removeItem('girofy_leads_data_v2');
      localStorage.removeItem('girofy_sheets_logs_v2');
      showToast('Aplicativo zerado com sucesso. Nenhum contato ou mensagem restante.');
    }
  };

  // Cálculo Real de Health Score do Número de WhatsApp
  const healthSignals: HealthScoreSignals = useMemo(() => {
    const totalSent = leads.filter(l => l.status !== 'novo').length;
    const blockedCount = leads.filter(l => l.optOutDetected || l.status === 'bloqueado').length;
    const totalReplies = leads.filter(l => ['respondeu', 'em_conversa', 'reuniao_marcada'].includes(l.status)).length;
    const undeliveredCount = leads.filter(l => l.messages.some(m => m.status === 'pending_approval' && m.from === 'lead')).length;

    let score = 100;
    score -= blockedCount * 25;
    score -= undeliveredCount * 5;

    const clampedScore = Math.max(10, Math.min(100, score));
    const isProtection = clampedScore < 75;
    const baseDailyLimit = 15;
    const safeDailyLimit = isProtection ? (clampedScore < 50 ? 3 : 5) : baseDailyLimit;

    return {
      undeliveredCount,
      blockedCount,
      spamReports: blockedCount > 0 ? 1 : 0,
      totalSent,
      totalReplies,
      healthScore: clampedScore,
      protectionModeActive: isProtection,
      safeDailyLimit,
      baseDailyLimit
    };
  }, [leads]);

  // Validar Chave de API Gemini Real
  const handleActivateApiKey = async () => {
    const cleanKey = toIso88591Header(apiKeyInput);
    if (!cleanKey) {
      showToast('Por favor, cole sua chave de API Gemini.');
      return;
    }

    setIsTestingKey(true);
    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: 'Teste de conexão com a API. Responda apenas "OK".',
      });

      if (response && response.text) {
        setApiKey(cleanKey);
        setIsKeyValid(true);
        localStorage.setItem('girofy_gemini_api_key', cleanKey);
        localStorage.setItem('girofy_selected_model', selectedModel);
        setApiKeyInput('');
        showToast(`Chave de API Gemini ativada com sucesso (${selectedModel})!`);
      } else {
        throw new Error('Resposta vazia da API.');
      }
    } catch (err: any) {
      console.error('Erro de validação de chave:', err);
      showToast(`Falha na chave Gemini: ${err?.message || 'Verifique se a chave é válida'}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleDisconnectKey = () => {
    setApiKey('');
    setIsKeyValid(false);
    localStorage.removeItem('girofy_gemini_api_key');
    showToast('Chave de API removida.');
  };

  // =========================================================================
  // CONEXÃO REAL WHATSAPP CLOUD API (META / FACEBOOK FOR DEVELOPERS)
  // =========================================================================
  const handleSaveWhatsAppConfig = async (testNow: boolean = false) => {
    const cleanPhoneId = sanitizePhoneOrId(waInputPhoneNumberId);
    const cleanToken = toIso88591Header(waInputToken);
    const cleanWaba = sanitizePhoneOrId(waInputWabaId);
    const cleanNumber = toIso88591Header(waInputConnectedNumber);

    if (!cleanPhoneId || !cleanToken) {
      showToast('Preencha ao menos o "Phone Number ID" e o "Token de Acesso (Bearer)".');
      return;
    }

    setIsTestingWhatsApp(true);

    try {
      // 1. Testar consulta real de status do número na Meta Graph API com headers 100% seguros
      const safeHeaders = createSafeHeaders(cleanToken);
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cleanPhoneId)}`, {
        method: 'GET',
        headers: safeHeaders,
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message || 'Erro de autenticação na Meta API.');
      }

      const verifiedName = data.verified_name || data.display_phone_number || 'Número Meta Verificado';
      const qualityRating = data.quality_rating || 'GREEN';

      // 2. Se o usuário pediu para enviar um ping de teste
      let testMsgFeedback = 'Conexão validada com a Meta Graph API com sucesso!';
      if (testNow && testRecipientPhone.trim()) {
        const cleanRecipient = testRecipientPhone.replace(/\D/g, '');
        if (cleanRecipient.length < 8) {
          throw new Error('Informe um número de telefone com DDD válido para o teste.');
        }

        const sendHeaders = createSafeHeaders(cleanToken, {
          'Content-Type': 'application/json'
        });

        const sendRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cleanPhoneId)}/messages`, {
          method: 'POST',
          headers: sendHeaders,
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanRecipient,
            type: 'text',
            text: { body: '🟢 [Girofy Prospect] Teste de conexão direta com a API Oficial do WhatsApp concluído com sucesso!' },
          }),
        });

        const sendData = await sendRes.json();
        if (sendData.error) {
          throw new Error(`Conectado, mas falha ao enviar mensagem de teste: ${sendData.error.message}`);
        }
        testMsgFeedback = `Conectado e mensagem de teste enviada com sucesso para +${cleanRecipient}!`;
      }

      const updatedState: WhatsAppSessionState = {
        connected: true,
        pairingStatus: 'connected',
        gatewayType: 'meta_cloud_api',
        config: {
          phoneNumberId: cleanPhoneId,
          wabaId: cleanWaba,
          accessToken: cleanToken,
          connectedNumber: cleanNumber || data.display_phone_number || cleanPhoneId,
          verifiedName,
          qualityRating,
        },
        lastTestStatus: 'success',
        lastTestMessage: testMsgFeedback,
        lastActive: 'Agora mesmo',
      };

      setWaState(updatedState);
      showToast(testMsgFeedback);
    } catch (err: any) {
      console.error('Erro de conexão WhatsApp:', err);
      const errMsg = err?.message || 'Erro ao conectar à API do WhatsApp.';
      setWaState(prev => ({
        ...prev,
        connected: false,
        pairingStatus: 'disconnected',
        lastTestStatus: 'error',
        lastTestMessage: errMsg,
      }));
      showToast(`Falha no WhatsApp: ${errMsg}`);
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleDisconnectWhatsApp = () => {
    setWaState({
      connected: false,
      pairingStatus: 'disconnected',
      gatewayType: 'meta_cloud_api',
      config: {
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        connectedNumber: '',
        verifiedName: '',
        qualityRating: 'UNKNOWN',
      },
      lastActive: 'Desconectado',
    });
    setWaInputPhoneNumberId('');
    setWaInputToken('');
    setWaInputWabaId('');
    setWaInputConnectedNumber('');
    showToast('WhatsApp desconectado.');
  };

  // Enviar Mensagem Real via WhatsApp Cloud API
  const sendRealWhatsAppMessage = async (recipientPhone: string, text: string): Promise<boolean> => {
    const cleanPhoneId = sanitizePhoneOrId(waState.config.phoneNumberId);
    const cleanToken = toIso88591Header(waState.config.accessToken);

    if (!waState.connected || !cleanPhoneId || !cleanToken) {
      console.warn('WhatsApp não conectado via Cloud API.');
      return false;
    }

    try {
      const cleanTo = recipientPhone.replace(/\D/g, '');
      const sendHeaders = createSafeHeaders(cleanToken, {
        'Content-Type': 'application/json'
      });
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cleanPhoneId)}/messages`, {
        method: 'POST',
        headers: sendHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanTo,
          type: 'text',
          text: { body: text },
        }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      return true;
    } catch (e: any) {
      console.error('Erro ao enviar mensagem real via WhatsApp:', e);
      showToast(`Erro no envio WhatsApp: ${e?.message}`);
      return false;
    }
  };

  // Motor Central de IA para Gerar Resposta ao Lead
  const generateAiReplyForLead = async (lead: Lead, incomingMessage: string): Promise<string> => {
    const cleanApiKey = toIso88591Header(apiKey);
    if (!cleanApiKey) {
      return `Olá ${lead.name.split(' ')[0]}! Qual seria o melhor horário amanhã para alinharmos em 15 min no Meet?`;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: cleanApiKey });
      
      const activeBooksPrompt = books
        .filter(b => b.active)
        .map(b => `- ${b.title} (Peso: ${b.systemWeight}%): ${b.coreFramework} -> ${b.keyTechniques.join(', ')}`)
        .join('\n');

      const historyContext = lead.messages
        .slice(-5)
        .map(m => `${m.from === 'bot' ? 'Você (Assistente)' : `${lead.name}`}: ${m.text}`)
        .join('\n');

      const fullPrompt = `
${systemPrompt.prompt}

METODOLOGIAS DE VENDAS ATIVAS:
${activeBooksPrompt}

DADOS DO LEAD ATUAL:
- Nome: ${lead.name}
- Empresa: ${lead.company}
- Nicho: ${lead.niche}
- Papel do Contato: ${lead.role === 'atendente_recepcao' ? 'RECEPÇÃO / ATENDENTE' : 'DECISOR'}

HISTÓRICO DA CONVERSA:
${historyContext}

ÚLTIMA MENSAGEM RECEBIDA DO LEAD:
"${incomingMessage}"

Gere a resposta ideal para enviar no WhatsApp (máximo 2 a 3 frases curtas, tom ${systemPrompt.tone}, sem clichês de vendas):
`;

      const result = await ai.models.generateContent({
        model: selectedModel,
        contents: fullPrompt,
        config: {
          temperature: systemPrompt.temperature,
          maxOutputTokens: systemPrompt.maxTokens,
        }
      });

      return result.text ? result.text.trim() : 'Perfeito! Vamos alinhar isso em uma chamada rápida no Google Meet?';
    } catch (err: any) {
      console.error('Erro na chamada Gemini:', err);
      return `Olá ${lead.name}! Vamos alinhar isso rapidamente no Meet? Qual o melhor horário amanhã?`;
    }
  };

  // Processar Mensagem Recebida do Lead (Webhook ou Entrada Manual)
  const processIncomingLeadMessage = async (leadId: string, text: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead) return;

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    // 1. Verificação Rigorosa de Opt-Out / Stop-Words (Proteção LGPD & Anti-ban)
    if (OPT_OUT_REGEX.test(text)) {
      const optOutMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        from: 'lead',
        text,
        time: timeStr,
        status: 'received'
      };

      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          return {
            ...l,
            status: 'bloqueado',
            optOutDetected: true,
            optOutReason: 'Stop-word detectada (Pedido de exclusão LGPD)',
            lastInteractionTime: `Hoje às ${timeStr}`,
            messages: [...l.messages, optOutMsg],
            pendingAiProposal: undefined,
          };
        }
        return l;
      }));

      // Log no Google Sheets
      const sheetLog: GoogleSheetsLog = {
        id: `sh-${Date.now()}`,
        timestamp: nowIso,
        leadId,
        phone: targetLead.phone,
        company: targetLead.company,
        type: 'opt_out',
        direction: 'in',
        content: `[OPT-OUT LGPD] "${text}" -> Lead bloqueado permanentemente`,
        status: 'logged'
      };
      setSheetsLogs(prev => [sheetLog, ...prev]);

      showToast(`Stop-word detectada: Lead ${targetLead.name} bloqueado (Anti-ban LGPD).`);
      return;
    }

    // 2. Mensagem válida do lead
    const newLeadMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      from: 'lead',
      text,
      time: timeStr,
      status: 'received'
    };

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          status: l.status === 'reuniao_marcada' ? 'reuniao_marcada' : 'em_conversa',
          lastInteractionTime: `Hoje às ${timeStr}`,
          messages: [...l.messages, newLeadMsg]
        };
      }
      return l;
    }));

    // Log no Sheets
    setSheetsLogs(prev => [
      {
        id: `sh-${Date.now()}`,
        timestamp: nowIso,
        leadId,
        phone: targetLead.phone,
        company: targetLead.company,
        type: 'chat',
        direction: 'in',
        content: text,
        status: 'received'
      },
      ...prev
    ]);

    // 3. IA analisa e gera proposta de resposta
    setIsAiThinking(true);
    const aiProposal = await generateAiReplyForLead({ ...targetLead, messages: [...targetLead.messages, newLeadMsg] }, text);
    setIsAiThinking(false);

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          pendingAiProposal: aiProposal
        };
      }
      return l;
    }));

    showToast(`IA preparou resposta para ${targetLead.name}.`);
  };

  // Aprovação de 1 Toque do Operador
  const handleApproveProposal = async (leadId: string, customText?: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    if (!targetLead || !targetLead.pendingAiProposal) return;

    const messageText = customText || targetLead.pendingAiProposal;
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    const isMeeting = /AGENDAR:/i.test(messageText) || /(meet\.google\.com|reunião agendada|amanhã às)/i.test(messageText);

    // Se o WhatsApp estiver conectado, envia de verdade pela Meta API
    if (waState.connected) {
      await sendRealWhatsAppMessage(targetLead.phone, messageText);
    }

    const botMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      from: 'bot',
      text: messageText,
      time: timeStr,
      status: 'sent',
      riskLevel: 'high'
    };

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          status: isMeeting ? 'reuniao_marcada' : 'em_conversa',
          lastInteractionTime: `Hoje às ${timeStr}`,
          messages: [...l.messages, botMessage],
          pendingAiProposal: undefined,
        };
      }
      return l;
    }));

    // Registro no Sheets
    setSheetsLogs(prev => [
      {
        id: `sh-${Date.now()}`,
        timestamp: nowIso,
        leadId,
        phone: targetLead.phone,
        company: targetLead.company,
        type: isMeeting ? 'meeting' : 'ai_reply',
        direction: 'out',
        content: messageText,
        status: 'sent'
      },
      ...prev
    ]);

    setEditingLeadId(null);
    setEditingProposalText('');
    showToast(`Mensagem enviada para ${targetLead.name}!`);
  };

  // Descartar Proposta da IA
  const handleDiscardProposal = (leadId: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pendingAiProposal: undefined } : l));
    setEditingLeadId(null);
    showToast('Proposta descartada.');
  };

  // Disparo em Massa do Estágio 1 (com Envio Real caso WhatsApp esteja conectado)
  const handleStartDispatchStage1 = async () => {
    if (!waState.connected) {
      showToast('Conecte o WhatsApp Oficial nas configurações antes de iniciar disparos.');
      setActiveTab('whatsapp');
      return;
    }

    const availableLeads = leads.filter(l => l.status === 'novo' && !l.optOutDetected);

    if (availableLeads.length === 0) {
      showToast('Nenhum lead novo pendente para disparo. Adicione contatos primeiro.');
      return;
    }

    const sentTodayCount = leads.filter(l => l.status === 'disparado' && l.lastInteractionTime.includes('Hoje')).length;
    const remainingLimit = Math.max(0, healthSignals.safeDailyLimit - sentTodayCount);

    if (remainingLimit <= 0) {
      showToast(`Limite diário de segurança (${healthSignals.safeDailyLimit} disparos) atingido! Modo Anti-Ban protege o número.`);
      return;
    }

    const batchToDispatch = availableLeads.slice(0, remainingLimit);
    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: batchToDispatch.length, leadName: batchToDispatch[0].name });

    let idx = 0;
    const interval = setInterval(async () => {
      if (idx >= batchToDispatch.length) {
        clearInterval(interval);
        setIsDispatching(false);
        setDispatchProgress(null);
        showToast(`${batchToDispatch.length} aberturas enviadas via WhatsApp Oficial!`);
        return;
      }

      const target = batchToDispatch[idx];
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const nowIso = new Date().toISOString();

      const openerMessageText = `${selectedOpener}! Vi a atuação da ${target.company} no mercado e gostaria de fazer uma pergunta rápida sobre a operação de vocês.`;

      // Envio real pela API da Meta
      if (waState.connected) {
        await sendRealWhatsAppMessage(target.phone, openerMessageText);
      }

      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}-${idx}`,
        from: 'bot',
        text: openerMessageText,
        time: timeStr,
        isAudio: isAudioNote,
        status: 'sent',
        riskLevel: 'low'
      };

      setLeads(prev => prev.map(l => {
        if (l.id === target.id) {
          return {
            ...l,
            status: 'disparado',
            lastOpenerUsed: selectedOpener,
            lastInteractionTime: `Hoje às ${timeStr}`,
            messages: [...l.messages, newMsg]
          };
        }
        return l;
      }));

      // Log no Sheets
      setSheetsLogs(prev => [
        {
          id: `sh-${Date.now()}-${idx}`,
          timestamp: nowIso,
          leadId: target.id,
          phone: target.phone,
          company: target.company,
          type: 'chat',
          direction: 'out',
          content: openerMessageText,
          status: 'sent'
        },
        ...prev
      ]);

      idx++;
      if (idx < batchToDispatch.length) {
        setDispatchProgress({ current: idx, total: batchToDispatch.length, leadName: batchToDispatch[idx].name });
      }
    }, 1500);
  };

  // Adicionar Lead Individual Manual
  const handleAddNewLead = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newLeadPhone.replace(/\D/g, '');
    if (!newLeadName.trim() || cleanPhone.length < 8) {
      showToast('Preencha o nome e um telefone válido com DDD (ex: 11999998888).');
      return;
    }

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: newLeadName.trim(),
      phone: cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`,
      company: newLeadCompany.trim() || 'Empresa Própria',
      niche: newLeadNiche.trim() || 'Geral',
      role: newLeadRole,
      status: 'novo',
      optOutDetected: false,
      lastInteractionTime: 'Aguardando disparo',
      followUpDays: 0,
      dossier: null,
      messages: [],
    };

    setLeads(prev => [newLead, ...prev]);
    setSelectedLeadId(newLead.id);
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadCompany('');
    setNewLeadNiche('');
    setShowAddLeadModal(false);
    showToast(`Lead "${newLead.name}" cadastrado com sucesso!`);
  };

  // Importador de Leads em Lote
  const handleBatchImport = () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const newLeadsList: Lead[] = [];

    lines.forEach((line, i) => {
      const parts = line.split(/[,;\t|]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const rawPhone = parts[1].replace(/\D/g, '');
        const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
        const company = parts[2] || `Empresa ${name.split(' ')[0]}`;
        const niche = parts[3] || 'Geral';
        const role: ContactRole = parts[4]?.toLowerCase().includes('recep') ? 'atendente_recepcao' : 'decisor';

        if (rawPhone.length >= 8) {
          newLeadsList.push({
            id: `lead-imported-${Date.now()}-${i}`,
            phone,
            name,
            company,
            niche,
            role,
            status: 'novo',
            optOutDetected: false,
            lastInteractionTime: 'Recém importado',
            followUpDays: 0,
            dossier: null,
            messages: []
          });
        }
      }
    });

    if (newLeadsList.length > 0) {
      setLeads(prev => [...newLeadsList, ...prev]);
      if (!selectedLeadId) setSelectedLeadId(newLeadsList[0].id);
      setImportText('');
      setShowImportModal(false);
      showToast(`${newLeadsList.length} leads importados com sucesso!`);
    } else {
      showToast('Formato não reconhecido. Exemplo: Nome, 11999998888, Empresa, Nicho');
    }
  };

  // Mensagens aguardando aprovação
  const pendingApprovals = useMemo(() => {
    return leads.filter(l => Boolean(l.pendingAiProposal));
  }, [leads]);

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 flex flex-col justify-between max-w-lg mx-auto selection:bg-[#F5B700] selection:text-black pb-24 font-sans antialiased">
      
      {/* ========================================================================= */}
      {/* 1. TOPO: STATUS CONSOLE & CONEXÃO REAL                                    */}
      {/* ========================================================================= */}
      <header className="p-4 pt-5 space-y-3 bg-[#000000]">
        
        <div className="w-full bg-[#F5B700] text-black p-5 rounded-2xl flex flex-col justify-between shadow-lg border border-black/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-[#F5B700] px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" />
              GIROFY PROSPECT • API OFICIAL
            </span>
            <span className="text-xs font-semibold">{dateString}</span>
          </div>

          <div className="text-center my-1.5">
            <div className="text-5xl font-bold tracking-tighter leading-none text-black font-mono">
              {timeString}
            </div>
            <div className="text-xs font-semibold text-black/80 mt-1 flex items-center justify-center gap-2">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${waState.connected ? 'bg-emerald-700' : 'bg-rose-700'}`} />
                WhatsApp: {waState.connected ? 'Conectado' : 'Desconectado'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isKeyValid ? 'bg-emerald-700' : 'bg-rose-700'}`} />
                IA: {isKeyValid ? 'Ativa' : 'Sem Chave'}
              </span>
            </div>
          </div>

          {/* Health Score Real */}
          <div className="flex items-center justify-between text-[11px] font-bold pt-2 border-t border-black/15">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className={`w-4 h-4 ${healthSignals.protectionModeActive ? 'text-rose-900 animate-pulse' : 'text-black'}`} />
              <span>Health Score: {healthSignals.healthScore}%</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${healthSignals.protectionModeActive ? 'bg-rose-900 text-white font-bold' : 'bg-black/15 text-black'}`}>
              {healthSignals.protectionModeActive ? 'Modo Proteção Ativo' : `Limite Diário: ${healthSignals.safeDailyLimit}`}
            </span>
          </div>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL (GAVETAS TÁTEIS & FLUXO ZERADO)                      */}
      {/* ========================================================================= */}
      <main className="flex-1 px-4 space-y-4 bg-[#000000]">

        {/* ----------------- ABA 1: HOME (VISÃO GERAL & GAVETAS) ----------------- */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            
            {/* Alerta de WhatsApp Desconectado */}
            {!waState.connected && (
              <div className="p-4 rounded-2xl bg-[#09090B] border border-[#25D366]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#25D366]" />
                    WhatsApp Oficial Desconectado
                  </span>
                  <span className="text-[10px] bg-[#25D366] text-black font-bold px-2 py-0.5 rounded-full">
                    Ação Necessária
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Para disparar mensagens reais no WhatsApp sem simulações falsas, conecte seu <strong>Phone Number ID</strong> e <strong>Token da Meta Cloud API</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('whatsapp')}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#25D366] text-black font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Conectar WhatsApp API Agora</span>
                </button>
              </div>
            )}

            {/* Fila de Aprovação de Respostas da IA */}
            {pendingApprovals.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#080808] border-2 border-[#F5B700] space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F5B700]" />
                    <span className="text-xs font-bold text-white">
                      {pendingApprovals.length} Mensagem(ns) Aguardando Envio
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-[#F5B700] text-black px-2 py-0.5 rounded-full">
                    1-Toque
                  </span>
                </div>

                {pendingApprovals.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-xl bg-black border border-zinc-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        {lead.name} <span className="text-zinc-400 font-normal">({lead.company})</span>
                      </span>
                      <span className="text-[10px] text-[#F5B700] uppercase font-mono">{lead.phone}</span>
                    </div>

                    <p className="text-zinc-300 bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-[11px] leading-relaxed">
                      "{lead.pendingAiProposal}"
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApproveProposal(lead.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#F5B700] text-black font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Aprovar & Enviar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingLeadId(lead.id);
                          setEditingProposalText(lead.pendingAiProposal || '');
                        }}
                        className="py-2 px-3 rounded-xl bg-black border border-zinc-700 text-zinc-200 text-xs font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDiscardProposal(lead.id)}
                        className="py-2 px-2.5 rounded-xl bg-black border border-rose-900/50 text-rose-400 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {editingLeadId === lead.id && (
                      <div className="pt-2 space-y-2">
                        <textarea
                          rows={2}
                          value={editingProposalText}
                          onChange={(e) => setEditingProposalText(e.target.value)}
                          className="w-full bg-black p-2.5 rounded-lg text-xs text-white border border-[#F5B700] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleApproveProposal(lead.id, editingProposalText)}
                          className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                        >
                          Enviar Mensagem Editada
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Grid com as Gavetas Principais */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* Gaveta 1: WhatsApp Oficial */}
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`p-4 rounded-2xl border flex flex-col justify-between text-left active:scale-95 transition-all shadow-md h-32 ${
                  waState.connected ? 'bg-[#050505] border-[#25D366]/50' : 'bg-[#09090B] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${waState.connected ? 'bg-[#25D366] shadow-[0_0_8px_#25D366]' : 'bg-rose-500'}`} />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">WhatsApp API</span>
                  <span className="text-[11px] text-zinc-400">
                    {waState.connected ? waState.config.verifiedName || 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              </button>

              {/* Gaveta 2: Funil de Leads */}
              <button
                type="button"
                onClick={() => setActiveTab('leads')}
                className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                    {leads.length} Leads
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Funil de Leads</span>
                  <span className="text-[11px] text-zinc-400">
                    {leads.filter(l => l.status === 'reuniao_marcada').length} Reuniões Agendadas
                  </span>
                </div>
              </button>

              {/* Gaveta 3: Cérebro IA & Chave */}
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-[#F5B700]/10 border border-[#F5B700]/20 flex items-center justify-center text-[#F5B700]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isKeyValid ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>
                    {isKeyValid ? 'Ativa' : 'Sem Chave'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Cérebro IA</span>
                  <span className="text-[11px] text-zinc-400">{books.filter(b => b.active).length} Metodologias</span>
                </div>
              </button>

              {/* Gaveta 4: Google Sheets */}
              <button
                type="button"
                onClick={() => setActiveTab('sheets')}
                className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 flex flex-col justify-between text-left hover:border-zinc-700 active:scale-95 transition-all shadow-md h-32"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                    {sheetsLogs.length} logs
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Planilha / CRM</span>
                  <span className="text-[11px] text-zinc-400">Histórico de Interações</span>
                </div>
              </button>

            </div>

            {/* Painel de Disparo de Abertura (Estágio 1) */}
            <div className="bg-[#050505] p-5 rounded-2xl border border-zinc-800 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Estágio 1 • Abertura</span>
                  <h3 className="text-xs font-bold text-white">Disparo Rápido de Qualificação</h3>
                </div>

                <div className="flex items-center gap-1.5 bg-black px-3 py-1 rounded-full border border-zinc-800">
                  <Clock className="w-3 h-3 text-[#F5B700]" />
                  <span className="text-[10px] text-zinc-300 font-mono">
                    {leads.filter(l => l.status === 'novo' && !l.optOutDetected).length} Novos Disponíveis
                  </span>
                </div>
              </div>

              {/* Seletor de Gatilho */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'Bom Dia' as OpenerType, icon: Sun, label: 'Bom Dia' },
                  { type: 'Boa Tarde' as OpenerType, icon: Sunset, label: 'Boa Tarde' },
                  { type: 'Boa Noite' as OpenerType, icon: Moon, label: 'Boa Noite' },
                ].map((op) => {
                  const isSelected = selectedOpener === op.type;
                  const Icon = op.icon;
                  return (
                    <button
                      key={op.type}
                      type="button"
                      onClick={() => setSelectedOpener(op.type)}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#F5B700] text-black border-[#F5B700] shadow-md scale-102'
                          : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-700'
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
                onClick={handleStartDispatchStage1}
                disabled={isDispatching}
                className="w-full py-4 rounded-2xl bg-[#F5B700] text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
              >
                {isDispatching ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>
                  {isDispatching 
                    ? 'Enviando...' 
                    : `Disparar para Leads Novos (${leads.filter(l => l.status === 'novo' && !l.optOutDetected).length} disponíveis)`}
                </span>
              </button>

              {isDispatching && dispatchProgress && (
                <div className="p-3 rounded-xl bg-black border border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-[#F5B700] font-bold">Enviando para: {dispatchProgress.leadName}</span>
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

            {/* Botão de Limpeza Completa (Zerar App) */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleResetAllData}
                className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Zerar todos os contatos e começar do zero</span>
              </button>
            </div>

          </div>
        )}

        {/* ----------------- ABA 2: FUNIL DE LEADS (100% LIMPO E ADICIONÁVEL) ----------------- */}
        {activeTab === 'leads' && (
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
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#F5B700] text-black text-xs font-bold flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Lead</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold flex items-center gap-1 active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Em Lote</span>
                </button>
              </div>
            </div>

            {/* Modal: Adicionar Lead Individual */}
            {showAddLeadModal && (
              <form onSubmit={handleAddNewLead} className="p-4 rounded-2xl bg-[#09090B] border border-[#F5B700] space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Cadastrar Novo Contato Real</span>
                  <button type="button" onClick={() => setShowAddLeadModal(false)} className="text-xs text-zinc-400">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={newLeadName}
                      onChange={(e) => setNewLeadName(e.target.value)}
                      placeholder="Ex: João da Silva"
                      className="w-full bg-black p-2.5 rounded-xl text-white border border-zinc-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">WhatsApp (com DDD)</label>
                    <input
                      type="tel"
                      required
                      value={newLeadPhone}
                      onChange={(e) => setNewLeadPhone(e.target.value)}
                      placeholder="Ex: 11999998888"
                      className="w-full bg-black p-2.5 rounded-xl text-white border border-zinc-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Empresa</label>
                    <input
                      type="text"
                      value={newLeadCompany}
                      onChange={(e) => setNewLeadCompany(e.target.value)}
                      placeholder="Ex: Silva Transportes"
                      className="w-full bg-black p-2.5 rounded-xl text-white border border-zinc-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Papel</label>
                    <select
                      value={newLeadRole}
                      onChange={(e) => setNewLeadRole(e.target.value as ContactRole)}
                      className="w-full bg-black p-2.5 rounded-xl text-white border border-zinc-800 focus:outline-none"
                    >
                      <option value="decisor">Decisor / Dono</option>
                      <option value="atendente_recepcao">Recepção / Atendente</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#F5B700] text-black font-bold text-xs uppercase"
                >
                  Salvar no Funil
                </button>
              </form>
            )}

            {/* Modal: Importar em Massa */}
            {showImportModal && (
              <div className="p-4 rounded-2xl bg-[#09090B] border border-[#F5B700] space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Importação em Lote</span>
                  <button type="button" onClick={() => setShowImportModal(false)} className="text-xs text-zinc-400">✕</button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Cole uma linha por contato: <code>Nome, Telefone, Empresa, Nicho, Papel</code>
                </p>
                <textarea
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Carlos Silva, 11999998888, Silva Transportes, Logística, Decisor&#10;Mariana Costa, 21988887777, Odonto Prime, Saúde, Recepção"
                  className="w-full bg-black p-3 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleBatchImport}
                  className="w-full py-2.5 rounded-xl bg-[#F5B700] text-black font-bold text-xs uppercase"
                >
                  Importar Linhas
                </button>
              </div>
            )}

            {/* Lista Real de Leads */}
            {leads.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#050505] border border-zinc-850 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Nenhum lead cadastrado</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Seu banco de dados está 100% limpo. Adicione seus contatos reais acima para iniciar a prospecção.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#F5B700] text-black font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Lead</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {leads.map((lead) => {
                  const isBlocked = lead.optOutDetected || lead.status === 'bloqueado';
                  return (
                    <div
                      key={lead.id}
                      className={`p-3.5 rounded-2xl border transition-all text-xs ${
                        selectedLeadId === lead.id
                          ? 'bg-[#09090B] border-[#F5B700]'
                          : isBlocked
                          ? 'bg-black border-rose-900/40 opacity-70'
                          : 'bg-[#050505] border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{lead.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              lead.role === 'atendente_recepcao' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/40' : 'bg-blue-950/80 text-blue-400 border border-blue-800/40'
                            }`}>
                              {lead.role === 'atendente_recepcao' ? 'Recepção' : 'Decisor'}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">{lead.company} • {lead.phone}</span>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isBlocked
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                            : lead.status === 'reuniao_marcada'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : lead.status === 'em_conversa'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                            : lead.status === 'disparado'
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-zinc-850 text-zinc-300'
                        }`}>
                          {isBlocked ? 'Bloqueado (LGPD)' : lead.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-zinc-850 mt-2">
                        <span className="text-[10px] text-zinc-500 font-mono">{lead.lastInteractionTime}</span>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeadId(lead.id);
                            setActiveTab('whatsapp');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#F5B700] text-black text-[10px] font-bold"
                        >
                          Abrir no WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ----------------- ABA 3: CONECTOR WHATSAPP OFICIAL (PASSO A PASSO META) ----------------- */}
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
              
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${waState.connected ? 'bg-[#25D366] shadow-[0_0_8px_#25D366]' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-white">
                  {waState.connected ? waState.config.connectedNumber || 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>

            {/* Status da Conexão Atual */}
            <div className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  {waState.connected ? `API Oficial Ativa • ${waState.config.verifiedName || 'Meta Cloud API'}` : 'Nenhuma Conexão Ativa'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {waState.connected ? `Rating: ${waState.config.qualityRating} • Phone ID: ${waState.config.phoneNumberId}` : 'Preencha suas credenciais abaixo'}
                </span>
              </div>

              {waState.connected && (
                <button
                  type="button"
                  onClick={handleDisconnectWhatsApp}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-800/40 text-xs font-bold"
                >
                  Desconectar
                </button>
              )}
            </div>

            {/* PASSO A PASSO INSTANTÂNEO PARA PEGAR AS CREDENCIAIS NA META */}
            {/* CONFIGURAÇÃO DE WEBHOOK META (OFICIAL VERCEL & CLOUD) */}
            <div className="bg-[#080808] p-4 rounded-2xl border border-zinc-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#F5B700] uppercase text-[10px] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Webhook Oficial da Meta (Etapa 2 - Produção)
                </span>
                <span className="text-[9px] bg-zinc-900 px-2 py-0.5 rounded text-emerald-400 font-mono">Endpoint Ativo</span>
              </div>

              <p className="text-zinc-400 text-[11px]">
                Copie os valores abaixo e cole diretamente na seção <strong>"Configurar Webhooks"</strong> do painel da Meta Developers:
              </p>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="bg-black p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <span className="text-[9px] text-zinc-500 block uppercase">1. URL de Callback:</span>
                    <span className="text-emerald-400 select-all truncate block">https://prospectfy.vercel.app/api/webhook</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://prospectfy.vercel.app/api/webhook');
                      showToast('URL de Callback copiada!');
                    }}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white text-[10px] font-sans font-bold flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>

                <div className="bg-black p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase">2. Verificar Token (Verify Token):</span>
                    <span className="text-white select-all block">prospectfy_webhook_token</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('prospectfy_webhook_token');
                      showToast('Verify Token copiado!');
                    }}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white text-[10px] font-sans font-bold flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
              </div>
            </div>

            {/* FORMULÁRIO DE CREDENCIAIS REAIS */}
            <div className="bg-[#050505] p-5 rounded-2xl border border-zinc-800 space-y-3.5 shadow-md">
              <div>
                <span className="text-[10px] font-bold text-[#25D366] uppercase block">Credenciais Oficiais</span>
                <h3 className="text-xs font-bold text-white">Meta WhatsApp Cloud API v21.0</h3>
              </div>

              {/* Phone Number ID */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                  Phone Number ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={waInputPhoneNumberId}
                  onChange={(e) => setWaInputPhoneNumberId(sanitizePhoneOrId(e.target.value))}
                  onBlur={() => setWaInputPhoneNumberId(prev => sanitizePhoneOrId(prev))}
                  placeholder="Ex: 512398471029384"
                  className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                />
              </div>

              {/* Token de Acesso (Bearer) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                    Token de Acesso (Bearer Token) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[9px] text-zinc-500">Auto-limpeza ASCII ativa</span>
                </div>
                <input
                  type="password"
                  value={waInputToken}
                  onChange={(e) => setWaInputToken(e.target.value)}
                  onBlur={() => setWaInputToken(prev => toIso88591Header(prev))}
                  placeholder="Ex: EAAG..."
                  className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                />
              </div>

              {/* WABA ID (Opcional) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                    WhatsApp Business ID (WABA)
                  </label>
                  <input
                    type="text"
                    value={waInputWabaId}
                    onChange={(e) => setWaInputWabaId(sanitizePhoneOrId(e.target.value))}
                    onBlur={() => setWaInputWabaId(prev => sanitizePhoneOrId(prev))}
                    placeholder="Ex: 109283746501928"
                    className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                    Seu Número WhatsApp
                  </label>
                  <input
                    type="text"
                    value={waInputConnectedNumber}
                    onChange={(e) => setWaInputConnectedNumber(e.target.value)}
                    onBlur={() => setWaInputConnectedNumber(prev => toIso88591Header(prev))}
                    placeholder="Ex: +55 11 99999-8888"
                    className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Telefone de Teste Imediato */}
              <div className="pt-2 border-t border-zinc-850 space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                  Número para Teste Instantâneo (Opcional)
                </label>
                <input
                  type="tel"
                  value={testRecipientPhone}
                  onChange={(e) => setTestRecipientPhone(e.target.value)}
                  placeholder="Ex: 5511999998888 (com DDI e DDD)"
                  className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveWhatsAppConfig(false)}
                  disabled={isTestingWhatsApp}
                  className="flex-1 py-3 rounded-xl bg-[#25D366] text-black font-bold text-xs uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
                >
                  {isTestingWhatsApp ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span>Salvar & Validar API</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveWhatsAppConfig(true)}
                  disabled={isTestingWhatsApp || !testRecipientPhone}
                  className="py-3 px-4 rounded-xl bg-black border border-[#25D366] text-[#25D366] font-bold text-xs active:scale-95 disabled:opacity-40"
                >
                  Salvar + Testar Envio Real
                </button>
              </div>

              {/* Mensagem de Retorno do Último Teste */}
              {waState.lastTestMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  waState.lastTestStatus === 'success' ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}>
                  {waState.lastTestStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{waState.lastTestMessage}</span>
                </div>
              )}
            </div>

            {/* Chat com Lead Ativo (quando houver lead) */}
            {selectedLead && (
              <div className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 space-y-3 shadow-md flex flex-col h-[360px]">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                  <div>
                    <span className="text-xs font-bold text-white block">{selectedLead.name}</span>
                    <span className="text-[10px] text-zinc-400">{selectedLead.company} • {selectedLead.phone}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    selectedLead.optOutDetected ? 'bg-rose-950 text-rose-300' : 'bg-black text-[#F5B700] border border-[#F5B700]/30'
                  }`}>
                    {selectedLead.optOutDetected ? 'OPT-OUT LGPD' : selectedLead.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {selectedLead.messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-zinc-500 text-xs">
                      Nenhuma mensagem trocada ainda com este lead.
                    </div>
                  ) : (
                    selectedLead.messages.map((m) => (
                      <div key={m.id} className={`flex flex-col ${m.from === 'bot' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                          m.from === 'bot'
                            ? 'bg-[#F5B700] text-black font-medium rounded-br-none'
                            : 'bg-black text-zinc-100 rounded-bl-none border border-zinc-800'
                        }`}>
                          <span>{m.text}</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 mt-0.5 px-1">{m.time}</span>
                      </div>
                    ))
                  )}

                  {isAiThinking && (
                    <div className="p-2.5 rounded-xl bg-black border border-zinc-800 text-xs text-[#F5B700] flex items-center gap-2 animate-pulse">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Cérebro IA formulando resposta...</span>
                    </div>
                  )}
                </div>

                {/* Envio Manual Direto */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!chatTextInput.trim()) return;
                    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    
                    if (waState.connected) {
                      await sendRealWhatsAppMessage(selectedLead.phone, chatTextInput);
                    }

                    const newMsg: ChatMessage = {
                      id: `msg-${Date.now()}`,
                      from: 'bot',
                      text: chatTextInput,
                      time: timeStr,
                      status: 'sent'
                    };
                    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, messages: [...l.messages, newMsg] } : l));
                    setChatTextInput('');
                  }} 
                  className="flex gap-2 pt-1 border-t border-zinc-850"
                >
                  <input
                    type="text"
                    value={chatTextInput}
                    onChange={(e) => setChatTextInput(e.target.value)}
                    placeholder="Digitar mensagem no WhatsApp..."
                    className="flex-1 bg-black px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none border border-zinc-800"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2.5 rounded-xl bg-[#F5B700] text-black text-xs font-bold active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

          </div>
        )}

        {/* ----------------- ABA 4: CÉREBRO IA & CHAVE DE API GEMINI ----------------- */}
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
              
              <span className="text-xs font-bold text-white">Cérebro IA & Modelos</span>
            </div>

            {/* Chave Gemini */}
            <div className="bg-[#050505] p-5 rounded-2xl border border-zinc-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Motor Google Gemini</span>
                  <h3 className="text-xs font-bold text-white">Chave de API & Modelo</h3>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isKeyValid ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                }`}>
                  {isKeyValid ? 'Ativa & Pronta' : 'Desconectada'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase block">Modelo Selecionado</label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    localStorage.setItem('girofy_selected_model', e.target.value);
                  }}
                  className="w-full bg-black p-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey ? '••••••••••••••••••••••••••••••' : apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    disabled={isKeyValid}
                    placeholder="Cole sua chave de API Gemini..."
                    className="flex-1 bg-black px-3.5 py-2.5 rounded-xl text-xs text-white border border-zinc-800 focus:outline-none"
                  />

                  {isKeyValid ? (
                    <button
                      type="button"
                      onClick={handleDisconnectKey}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleActivateApiKey}
                      disabled={isTestingKey}
                      className="px-4 py-2.5 rounded-xl bg-[#F5B700] text-black text-xs font-bold flex items-center gap-1"
                    >
                      {isTestingKey ? 'Testando...' : 'Ativar Chave'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Metodologias Ponderadas */}
            <div className="bg-[#050505] p-5 rounded-2xl border border-zinc-800 space-y-3 shadow-md">
              <div>
                <span className="text-[10px] font-bold text-[#F5B700] uppercase block">Metodologias de Vendas</span>
                <h3 className="text-xs font-bold text-white">Livros & Ponderação de Prompt</h3>
              </div>

              <div className="space-y-2.5">
                {books.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-black border border-zinc-850 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white block">{b.title}</span>
                        <span className="text-[10px] text-zinc-400">{b.author} • {b.tagline}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBooks(prev => prev.map(item => item.id === b.id ? { ...item, active: !item.active } : item))}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors ${b.active ? 'bg-[#F5B700]' : 'bg-zinc-800'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-black transition-transform ${b.active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {b.active && (
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-zinc-400">
                        <span>Peso no Prompt:</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={b.systemWeight}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBooks(prev => prev.map(item => item.id === b.id ? { ...item, systemWeight: val } : item));
                          }}
                          className="flex-1 accent-[#F5B700]"
                        />
                        <span className="font-bold text-white font-mono">{b.systemWeight}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ----------------- ABA 5: GOOGLE SHEETS / CRM ----------------- */}
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
              
              <span className="text-xs font-bold text-white">Google Sheets • CRM</span>
            </div>

            <div className="bg-[#050505] p-4 rounded-2xl border border-zinc-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Log de Conversas Reais</span>
                  <span className="text-[10px] text-zinc-400">{sheetsLogs.length} Registros</span>
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

              {sheetsLogs.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  Nenhuma interação registrada ainda. Os envios reais pelo WhatsApp serão listados aqui.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 text-xs">
                  {sheetsLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-black border border-zinc-850 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{log.company} ({log.phone})</span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {log.timestamp.includes('T') ? log.timestamp.split('T')[1].slice(0, 5) : log.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-300 leading-relaxed">{log.content}</p>

                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          log.type === 'opt_out' ? 'bg-rose-950 text-rose-400 border border-rose-800/40' : 'text-[#F5B700]'
                        }`}>
                          {log.type}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold">{log.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. DOCK INFERIOR MOBILE                                                  */}
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
            onClick={() => setActiveTab('leads')}
            className={`p-3 rounded-full transition-all ${
              activeTab === 'leads' ? 'bg-[#F5B700] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`p-3 rounded-full transition-all relative ${
              activeTab === 'whatsapp' ? 'bg-[#25D366] text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${waState.connected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500'}`} />
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

        </div>
      </nav>

      {/* Toast Notificação */}
      {toastMsg && (
        <div className="fixed top-6 inset-x-0 mx-auto z-50 max-w-xs px-4 py-2.5 rounded-full bg-[#000000] border border-[#F5B700] text-xs font-bold text-[#F5B700] flex items-center justify-center gap-2 shadow-2xl animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-[#F5B700] animate-ping" />
          <span className="text-center">{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
