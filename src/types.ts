export type TabType = 'home' | 'leads' | 'whatsapp' | 'ai' | 'cadence' | 'sheets' | 'analytics';

export type OpenerType = 'Bom Dia' | 'Boa Tarde' | 'Boa Noite';

export type LeadStatus = 
  | 'novo' 
  | 'disparado' 
  | 'respondeu' 
  | 'em_conversa' 
  | 'reuniao_marcada' 
  | 'esfriou' 
  | 'bloqueado';

export type ContactRole = 'decisor' | 'atendente_recepcao';

export interface ChatMessage {
  id: string;
  from: 'bot' | 'lead' | 'operator';
  text: string;
  time: string;
  isAudio?: boolean;
  status?: 'sent' | 'received' | 'pending_approval';
  riskLevel?: 'low' | 'high';
  aiReasoning?: string;
}

export interface LeadDossier {
  summary: string;
  painPoints: string[];
  suggestedApproach: string;
  researchedAt: string;
}

export interface Lead {
  id: string;
  phone: string;
  name: string;
  company: string;
  niche: string;
  role: ContactRole;
  status: LeadStatus;
  optOutDetected: boolean;
  optOutReason?: string;
  lastOpenerUsed?: OpenerType;
  lastInteractionTime: string;
  followUpDays: number;
  dossier: LeadDossier | null;
  messages: ChatMessage[];
  pendingAiProposal?: string;
  notes?: string;
}

export interface KnowledgeBook {
  id: string;
  title: string;
  author: string;
  tagline: string;
  active: boolean;
  coreFramework: string;
  keyTechniques: string[];
  systemWeight: number; // 0 - 100%
  colorAccent?: string;
}

export interface SystemPromptConfig {
  prompt: string;
  presetName: string;
  temperature: number;
  tone: 'consultivo' | 'direto' | 'desafiador' | 'parceiro_recepcao';
  maxTokens: number;
  includeAudioNoteTrigger: boolean;
  safetyCooldownSeconds: number;
}

export interface WhatsAppCloudApiConfig {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  connectedNumber: string;
  verifiedName: string;
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
}

export interface WhatsAppSessionState {
  connected: boolean;
  pairingStatus: 'disconnected' | 'connecting' | 'connected';
  gatewayType: 'meta_cloud_api' | 'custom_webhook';
  config: WhatsAppCloudApiConfig;
  lastTestStatus?: 'success' | 'error';
  lastTestMessage?: string;
  lastActive: string;
}

export interface HealthScoreSignals {
  undeliveredCount: number;
  blockedCount: number;
  spamReports: number;
  totalSent: number;
  totalReplies: number;
  healthScore: number; // 0 - 100
  protectionModeActive: boolean;
  safeDailyLimit: number;
  baseDailyLimit: number;
}

export interface SectorRule {
  id: string;
  niche: string;
  rule: string;
  bestTime: string;
  avoidDays: string[];
}

export interface ExperienceMemory {
  openerStats: Record<OpenerType, { sent: number; replies: number }>;
  successfulPhrases: string[];
  ignoredPhrases: string[];
  sectorRules: SectorRule[];
  operatorApprovalCount: number;
  operatorEditCount: number;
  autonomyLevel: number; // 0 - 100%
}

export interface GoogleSheetsLog {
  id: string;
  timestamp: string;
  leadId: string;
  phone: string;
  company: string;
  type: 'chat' | 'audio' | 'ai_reply' | 'opt_out' | 'meeting';
  direction: 'in' | 'out';
  content: string;
  status: 'sent' | 'received' | 'logged';
}

export interface GoogleIntegrationSettings {
  calendarEnabled: boolean;
  meetEnabled: boolean;
  calendarId: string;
  calendarName: string;
  autoCreateMeetLink: boolean;
  meetingDurationMinutes: number;
  bufferMinutes: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  syncedEventsCount: number;
  lastSyncTimestamp: string;
}
