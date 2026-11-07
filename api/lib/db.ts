import { supabase } from './supabaseClient';
import { Contact, ChatMessage, AuditLog, DataDeletionRequest } from './types';

// Camada de persistência sobre Postgres (Supabase). Mesma interface de antes
// (que era um JSON em /tmp), trocada para sobreviver a redeploy e restart.

export interface AppConfig {
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaAppSecret?: string;
  webhookVerifyToken?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  autoReplyEnabled?: boolean;
  activeGateway?: 'direct_pairing' | 'meta_cloud_api';
  directPairingPhone?: string;
  directPairingCode?: string;
  directPairingStatus?: 'disconnected' | 'pairing' | 'connected';
  directPairingConnectedAt?: string;
  prospectDay?: string; // dia (America/Bahia) da contagem de abordagens
  prospectSentToday?: number;
  aiUsageDay?: string; // dia da contagem de chamadas da IA (cota gratuita)
  aiUsageCount?: number;
  aiPausedUntil?: string; // ISO: IA pausada até (após erro de cota)
  aiPausedModels?: Record<string, string>; // 'provedor:modelo' -> ISO até quando pausado
  aiChain?: { provider: 'gemini' | 'groq'; model: string }[]; // ordem de uso dos modelos
  groqApiKey?: string;
  prospectorPaused?: boolean; // dono pausou a prospecção (respostas a leads continuam)
  ownerUnlockedUntil?: string; // ISO: modo dono liberado por senha até quando
}

const DEFAULT_CONFIG: AppConfig = {
  metaPhoneNumberId: '1221241567748320',
  webhookVerifyToken: 'impossivel2008',
  geminiModel: 'gemini-3.6-flash',
  autoReplyEnabled: true,
  activeGateway: 'direct_pairing',
  directPairingPhone: '557488126578',
  directPairingStatus: 'connected',
};

// --- Mapeamento linha <-> modelo -------------------------------------------------

function contactFromRow(row: any): Contact {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    company: row.company,
    niche: row.niche ?? undefined,
    role: row.role,
    status: row.status,
    agentState: row.agent_state,
    optOutDetected: row.opt_out_detected,
    optOutReason: row.opt_out_reason ?? undefined,
    lastInteractionAt: row.last_interaction_at,
    unreadCount: row.unread_count ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function contactToRow(c: Contact) {
  return {
    phone: c.phone,
    id: c.id,
    name: c.name,
    company: c.company,
    niche: c.niche ?? null,
    role: c.role,
    status: c.status,
    agent_state: c.agentState,
    opt_out_detected: c.optOutDetected,
    opt_out_reason: c.optOutReason ?? null,
    last_interaction_at: c.lastInteractionAt,
    unread_count: c.unreadCount ?? null,
    notes: c.notes ?? null,
    created_at: c.createdAt,
  };
}

function messageFromRow(row: any): ChatMessage {
  return {
    id: row.id,
    contactPhone: row.contact_phone,
    from: row.from,
    text: row.text,
    type: row.type,
    timestamp: row.timestamp,
    metaMessageId: row.meta_message_id ?? undefined,
    status: row.status ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    aiReasoning: row.ai_reasoning ?? undefined,
  };
}

function messageToRow(m: ChatMessage) {
  return {
    id: m.id,
    contact_phone: m.contactPhone,
    from: m.from,
    text: m.text,
    type: m.type,
    timestamp: m.timestamp,
    meta_message_id: m.metaMessageId ?? null,
    status: m.status ?? null,
    media_url: m.mediaUrl ?? null,
    ai_reasoning: m.aiReasoning ?? null,
  };
}

function auditLogFromRow(row: any): AuditLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    phone: row.phone ?? undefined,
    summary: row.summary,
    details: row.details ?? undefined,
  };
}

function deletionFromRow(row: any): DataDeletionRequest {
  return {
    id: row.id,
    confirmationCode: row.confirmation_code,
    identifier: row.identifier,
    status: row.status,
    requestedAt: row.requested_at,
    completedAt: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mustOk<T>(res: { data: T; error: any }, context: string): T {
  if (res.error) {
    console.error(`[DB] ${context}:`, res.error.message || res.error);
    throw new Error(`[DB] ${context}: ${res.error.message || res.error}`);
  }
  return res.data;
}

// --- Cache de config em memória, para leitura síncrona (getConfigSync) ----------
// Carregada em segundo plano assim que o módulo sobe; getConfig() aguarda a
// primeira carga antes de responder.

let configCache: AppConfig = { ...DEFAULT_CONFIG };
let configLoaded = false;
let configLoadPromise: Promise<void> | null = null;

let configLoadedAt = 0;
const CONFIG_TTL_MS = 20_000;

async function loadConfigOnce(): Promise<void> {
  try {
    const { data, error } = await supabase().from('app_config').select('data').eq('id', true).maybeSingle();
    if (!error && data?.data) {
      configCache = { ...DEFAULT_CONFIG, ...(data.data as AppConfig) };
    }
  } catch (err) {
    console.warn('[DB] Falha ao carregar config inicial do Supabase:', err);
  } finally {
    configLoaded = true;
    configLoadedAt = Date.now();
  }
}

// Relê do banco a cada 20 s: o que foi mudado direto no Supabase (ou por outro processo) vale logo.
function ensureConfigLoaded(): Promise<void> {
  if (!configLoadPromise || (configLoaded && Date.now() - configLoadedAt > CONFIG_TTL_MS)) {
    configLoaded = false;
    configLoadPromise = loadConfigOnce();
  }
  return configLoadPromise;
}
ensureConfigLoaded(); // dispara no import do módulo, sem bloquear

export const db = {
  // --- Contacts ---
  async getContacts(): Promise<Contact[]> {
    const res = await supabase().from('contacts').select('*').order('last_interaction_at', { ascending: false });
    return mustOk(res, 'getContacts').map(contactFromRow);
  },

  async getContactByPhone(phone: string): Promise<Contact | null> {
    const clean = phone.replace(/\D/g, '');
    const res = await supabase().from('contacts').select('*').eq('phone', clean).maybeSingle();
    const row = mustOk(res, 'getContactByPhone');
    return row ? contactFromRow(row) : null;
  },

  async saveContact(contact: Contact): Promise<Contact> {
    const clean = contact.phone.replace(/\D/g, '');
    const existing = await this.getContactByPhone(clean);
    const updated: Contact = {
      ...existing,
      ...contact,
      phone: clean,
      createdAt: existing ? existing.createdAt : contact.createdAt || new Date().toISOString(),
      lastInteractionAt: contact.lastInteractionAt || new Date().toISOString(),
    };
    const res = await supabase().from('contacts').upsert(contactToRow(updated), { onConflict: 'phone' }).select().single();
    return contactFromRow(mustOk(res, 'saveContact'));
  },

  async updateContactAgentState(phone: string, agentState: Contact['agentState']): Promise<Contact | null> {
    const contact = await this.getContactByPhone(phone);
    if (!contact) return null;
    contact.agentState = agentState;
    contact.lastInteractionAt = new Date().toISOString();
    return this.saveContact(contact);
  },

  async updateContactStatus(phone: string, status: Contact['status']): Promise<Contact | null> {
    const contact = await this.getContactByPhone(phone);
    if (!contact) return null;
    contact.status = status;
    contact.lastInteractionAt = new Date().toISOString();
    return this.saveContact(contact);
  },

  async clearAllContacts(): Promise<number> {
    const countRes = await supabase().from('contacts').select('phone', { count: 'exact', head: true });
    const count = countRes.count || 0;
    mustOk(await supabase().from('messages').delete().neq('id', ''), 'clearAllContacts(messages)');
    mustOk(await supabase().from('contacts').delete().neq('phone', ''), 'clearAllContacts(contacts)');
    await this.addAuditLog({
      type: 'status_change',
      summary: `Todos os ${count} leads e mensagens foram removidos do CRM a pedido do usuário.`,
    });
    return count;
  },

  async batchSaveContacts(contactsList: Contact[]): Promise<Contact[]> {
    const now = new Date().toISOString();
    const cleanList = contactsList
      .map(item => ({ ...item, phone: item.phone.replace(/\D/g, '') }))
      .filter(item => item.phone && item.phone.length >= 10);
    if (cleanList.length === 0) return [];

    const phones = cleanList.map(c => c.phone);
    const existingRes = await supabase().from('contacts').select('phone, created_at').in('phone', phones);
    const existingMap = new Map((mustOk(existingRes, 'batchSaveContacts(lookup)') || []).map((r: any) => [r.phone, r.created_at]));

    const rows = cleanList.map(item =>
      contactToRow({
        ...item,
        createdAt: existingMap.get(item.phone) || item.createdAt || now,
        lastInteractionAt: now,
      } as Contact)
    );

    const res = await supabase().from('contacts').upsert(rows, { onConflict: 'phone' }).select();
    const results = mustOk(res, 'batchSaveContacts(upsert)').map(contactFromRow);

    await this.addAuditLog({
      type: 'status_change',
      summary: `${results.length} contatos importados e salvos com sucesso no CRM via arquivo.`,
    });
    return results;
  },

  // --- Messages ---
  // Sem telefone: traz os 5000 mais recentes (globais). Com volume alto, revisar.
  async getMessages(phone?: string): Promise<ChatMessage[]> {
    if (phone) {
      const clean = phone.replace(/\D/g, '');
      const res = await supabase()
        .from('messages')
        .select('*')
        .eq('contact_phone', clean)
        .order('timestamp', { ascending: true });
      return mustOk(res, 'getMessages(phone)').map(messageFromRow);
    }
    const res = await supabase().from('messages').select('*').order('timestamp', { ascending: false }).limit(5000);
    return mustOk(res, 'getMessages(all)').map(messageFromRow).reverse();
  },

  async saveMessage(message: ChatMessage): Promise<ChatMessage> {
    const cleanPhone = message.contactPhone.replace(/\D/g, '');
    const toSave: ChatMessage = {
      ...message,
      contactPhone: cleanPhone,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    const res = await supabase().from('messages').upsert(messageToRow(toSave), { onConflict: 'id' }).select().single();
    return messageFromRow(mustOk(res, 'saveMessage'));
  },

  // Já existe conversa com esse número (mesmo em outro formato, com ou sem o 9)? Conta qualquer mensagem
  // guardada, de qualquer lado, e outro contato com os mesmos 8 últimos dígitos que já saiu da fila.
  async hasHistoryWith(phone: string): Promise<boolean> {
    const tail = String(phone || '').replace(/\D/g, '').slice(-8);
    if (tail.length < 8) return false;
    const msgs = await supabase().from('messages').select('id', { count: 'exact', head: true }).like('contact_phone', `%${tail}`);
    if ((msgs.count || 0) > 0) return true;
    const others = await supabase().from('contacts').select('phone, status').like('phone', `%${tail}`).neq('phone', phone).neq('status', 'novo');
    return (others.data || []).length > 0;
  },

  // Conjunto de telefones que já mandaram pelo menos 1 mensagem como lead.
  // Usado pelo prospector e pelo painel para medir taxa de resposta sem
  // carregar todas as mensagens.
  async getRepliedPhones(): Promise<Set<string>> {
    const res = await supabase().from('messages').select('contact_phone').eq('from', 'lead');
    const rows = mustOk(res, 'getRepliedPhones');
    return new Set(rows.map((r: any) => r.contact_phone));
  },

  // --- Webhook Idempotency ---
  async hasProcessedMessage(metaMessageId: string): Promise<boolean> {
    if (!metaMessageId) return false;
    const res = await supabase().from('processed_message_ids').select('meta_message_id').eq('meta_message_id', metaMessageId).maybeSingle();
    return !!mustOk(res, 'hasProcessedMessage');
  },

  async markMessageAsProcessed(metaMessageId: string): Promise<void> {
    if (!metaMessageId) return;
    const res = await supabase()
      .from('processed_message_ids')
      .upsert({ meta_message_id: metaMessageId }, { onConflict: 'meta_message_id', ignoreDuplicates: true });
    if (res.error) console.warn('[DB] markMessageAsProcessed:', res.error.message);
  },

  // --- Audit Logs ---
  async addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    const res = await supabase()
      .from('audit_logs')
      .insert({ id: entry.id, timestamp: entry.timestamp, type: entry.type, phone: entry.phone ?? null, summary: entry.summary, details: entry.details ?? null });
    if (res.error) console.warn('[DB] addAuditLog:', res.error.message);
    return entry;
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const res = await supabase().from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
    return mustOk(res, 'getAuditLogs').map(auditLogFromRow);
  },

  // --- Data Deletion (LGPD / Meta Compliance) ---
  async createDeletionRequest(identifier: string, notes?: string): Promise<DataDeletionRequest> {
    const cleanId = identifier.trim().toLowerCase();
    const confirmationCode = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const request: DataDeletionRequest = {
      id: `req-${Date.now()}`,
      confirmationCode,
      identifier: cleanId,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      notes,
    };
    const res = await supabase().from('deletion_requests').insert({
      id: request.id,
      confirmation_code: request.confirmationCode,
      identifier: request.identifier,
      status: request.status,
      requested_at: request.requestedAt,
      notes: request.notes ?? null,
    });
    mustOk(res, 'createDeletionRequest');
    return request;
  },

  async getDeletionRequest(confirmationCode: string): Promise<DataDeletionRequest | null> {
    const res = await supabase().from('deletion_requests').select('*').eq('confirmation_code', confirmationCode).maybeSingle();
    const row = mustOk(res, 'getDeletionRequest');
    return row ? deletionFromRow(row) : null;
  },

  async executeDataDeletion(identifier: string): Promise<{ success: boolean; deletedCount: number }> {
    const cleanPhone = identifier.replace(/\D/g, '');
    let deletedCount = 0;

    const msgCountRes = await supabase().from('messages').select('id', { count: 'exact', head: true }).eq('contact_phone', cleanPhone);
    deletedCount += msgCountRes.count || 0;
    mustOk(await supabase().from('messages').delete().eq('contact_phone', cleanPhone), 'executeDataDeletion(messages)');

    const contactRes = await supabase().from('contacts').delete().eq('phone', cleanPhone).select();
    deletedCount += (mustOk(contactRes, 'executeDataDeletion(contacts)') || []).length;

    // Marca pedidos de exclusão pendentes que batem com esse telefone (dígitos) ou o identificador cru.
    const pendingRes = await supabase().from('deletion_requests').select('id, identifier').eq('status', 'pending');
    const pending = mustOk(pendingRes, 'executeDataDeletion(pending lookup)') || [];
    const matchIds = pending
      .filter((r: any) => r.identifier.replace(/\D/g, '') === cleanPhone || r.identifier === identifier)
      .map((r: any) => r.id);
    if (matchIds.length > 0) {
      mustOk(
        await supabase()
          .from('deletion_requests')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .in('id', matchIds),
        'executeDataDeletion(update requests)'
      );
    }

    await this.addAuditLog({
      type: 'data_deletion',
      phone: cleanPhone,
      summary: `Exclusão definitiva de dados solicitada e concluída para ${identifier}. Registros removidos: ${deletedCount}.`,
    });

    return { success: true, deletedCount };
  },

  // --- Base de conhecimento (documentos que a IA lê) ---
  async listKnowledge(): Promise<{ id: number; title: string; content: string; active: boolean; created_at: string }[]> {
    const res = await supabase().from('knowledge_docs').select('id, title, content, active, created_at').order('created_at', { ascending: false });
    return mustOk(res, 'listKnowledge') || [];
  },

  async getActiveKnowledge(): Promise<{ title: string; content: string }[]> {
    const res = await supabase().from('knowledge_docs').select('title, content').eq('active', true).order('created_at', { ascending: true });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  },

  async saveKnowledge(title: string, content: string): Promise<void> {
    const res = await supabase().from('knowledge_docs').insert({ title, content, active: true, updated_at: new Date().toISOString() });
    mustOk(res, 'saveKnowledge');
  },

  async setKnowledgeActive(id: number, active: boolean): Promise<void> {
    const res = await supabase().from('knowledge_docs').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
    mustOk(res, 'setKnowledgeActive');
  },

  async deleteKnowledge(id: number): Promise<void> {
    const res = await supabase().from('knowledge_docs').delete().eq('id', id);
    mustOk(res, 'deleteKnowledge');
  },

  // --- Uso da IA (cota) — grava sem gerar log de auditoria a cada chamada ---
  async saveAiUsage(patch: Partial<Pick<AppConfig, 'aiUsageDay' | 'aiUsageCount' | 'aiPausedUntil' | 'aiPausedModels'>>): Promise<void> {
    await ensureConfigLoaded();
    const updated: AppConfig = { ...configCache, ...patch };
    const res = await supabase().from('app_config').upsert({ id: true, data: updated }, { onConflict: 'id' });
    if (res.error) console.warn('[DB] saveAiUsage:', res.error.message);
    configCache = updated;
  },

  // --- Aprendizado: lições gravadas a partir de conversas encerradas ---
  async saveLearning(l: { contactPhone: string; outcome: string; worked: string; failed: string; why: string; openerStyle?: string }): Promise<void> {
    const res = await supabase().from('learnings').insert({
      contact_phone: l.contactPhone,
      outcome: l.outcome,
      worked: l.worked,
      failed: l.failed,
      why: l.why,
      opener_style: l.openerStyle ?? null,
    });
    if (res.error) console.warn('[DB] saveLearning:', res.error.message);
  },

  async getRecentLearnings(n: number): Promise<any[]> {
    const res = await supabase().from('learnings').select('*').order('created_at', { ascending: false }).limit(n);
    if (res.error || !res.data) return [];
    return res.data;
  },

  // Telefones que já têm lição gravada desde uma data (evita aprender a mesma conversa duas vezes).
  async getLearnedPhonesSince(sinceIso: string): Promise<Set<string>> {
    const res = await supabase().from('learnings').select('contact_phone').gte('created_at', sinceIso);
    if (res.error || !res.data) return new Set();
    return new Set(res.data.map((r: any) => r.contact_phone).filter(Boolean));
  },

  // Lições mais recentes em forma de frase, para o prompt. Se a tabela ainda não existir, devolve [].
  async getTopLearnings(n: number): Promise<string[]> {
    const res = await supabase().from('learnings').select('outcome, worked, failed, why').order('created_at', { ascending: false }).limit(n);
    if (res.error || !res.data) return [];
    return res.data.map((r: any) => `[${r.outcome}] funcionou: ${r.worked || '-'} | não funcionou: ${r.failed || '-'} | porquê: ${r.why || '-'}`);
  },

  // --- Dynamic App Configuration ---
  // Leitura síncrona a partir do cache em memória (carregado em segundo plano no import do módulo).
  // Pode estar um tick atrasado logo no boot do processo; getConfig() aguarda a carga inicial.
  getConfigSync(): AppConfig {
    return configCache;
  },

  async getConfig(): Promise<AppConfig> {
    await ensureConfigLoaded();
    return { ...configCache };
  },

  async saveConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    await ensureConfigLoaded();
    const updated: AppConfig = { ...configCache, ...updates };
    const res = await supabase().from('app_config').upsert({ id: true, data: updated }, { onConflict: 'id' });
    if (res.error) console.warn('[DB] saveConfig:', res.error.message);
    configCache = updated;

    await this.addAuditLog({
      type: 'status_change',
      summary: 'Parâmetros de configuração atualizados via painel de Ajustes.',
      details: {
        hasMetaToken: Boolean(updated.metaAccessToken),
        hasGeminiKey: Boolean(updated.geminiApiKey),
        phoneNumberId: updated.metaPhoneNumberId,
        autoReplyEnabled: updated.autoReplyEnabled,
      },
    });

    return updated;
  },
};
