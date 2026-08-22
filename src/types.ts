export type TabType = 'dashboard' | 'whatsapp' | 'training' | 'integrations' | 'history';

export type OpenerType = 'Bom Dia' | 'Boa Tarde' | 'Boa Noite';

export interface DispatchItem {
  id: string;
  phone: string;
  name?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  opener: OpenerType;
  timestamp: string;
  channel: 'whatsapp';
  responseReceived?: boolean;
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
  tone: 'formal' | 'consultivo' | 'direto' | 'amigavel';
  maxTokens: number;
  includeAudioNoteTrigger: boolean;
  safetyCooldownSeconds: number;
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

export interface WhatsAppSessionState {
  connected: boolean;
  pairingStatus: 'idle' | 'generating_qr' | 'awaiting_scan' | 'connected' | 'error';
  qrCodeSeed: string;
  deviceName: string;
  batteryLevel: number;
  networkLatencyMs: number;
  connectedNumber: string;
  lastActive: string;
}

export interface DispatchLimitStats {
  dailyLimit: number;
  sentToday: number;
  queuedToday: number;
  repliesToday: number;
  conversionRate: number;
}
