import fs from 'fs';
import path from 'path';
import { Contact, ChatMessage, AuditLog, DataDeletionRequest } from './types';

// Structured in-memory and file-backed database layer.
// Designed for seamless transition to Firestore (Firebase) via standardized repository interface.

interface DatabaseSchema {
  contacts: Record<string, Contact>; // keyed by phone
  messages: ChatMessage[];
  processedMessageIds: string[]; // for webhook idempotency
  auditLogs: AuditLog[];
  deletionRequests: Record<string, DataDeletionRequest>;
}

// Persist data locally in /tmp or workspace so it survives serverless invocations within container life
const DB_FILE_PATH = path.resolve(process.env.DATA_DIR || '/tmp', 'prospectfy_db.json');

const INITIAL_DATA: DatabaseSchema = {
  contacts: {},
  messages: [],
  processedMessageIds: [],
  auditLogs: [],
  deletionRequests: {},
};

let memoryCache: DatabaseSchema | null = null;

function loadDatabase(): DatabaseSchema {
  if (memoryCache) {
    return memoryCache;
  }

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      memoryCache = JSON.parse(raw);
      return memoryCache!;
    }
  } catch (err) {
    console.warn('[DB] Could not load persisted file, initializing empty store:', err);
  }

  memoryCache = JSON.parse(JSON.stringify(INITIAL_DATA));
  saveDatabase(memoryCache!);
  return memoryCache!;
}

function saveDatabase(data: DatabaseSchema): void {
  memoryCache = data;
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to persist data to disk:', err);
  }
}

export const db = {
  // --- Contacts ---
  async getContacts(): Promise<Contact[]> {
    const data = loadDatabase();
    return Object.values(data.contacts).sort((a, b) => 
      new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    );
  },

  async getContactByPhone(phone: string): Promise<Contact | null> {
    const clean = phone.replace(/\D/g, '');
    const data = loadDatabase();
    return data.contacts[clean] || null;
  },

  async saveContact(contact: Contact): Promise<Contact> {
    const clean = contact.phone.replace(/\D/g, '');
    const data = loadDatabase();
    const existing = data.contacts[clean];
    const updated: Contact = {
      ...existing,
      ...contact,
      phone: clean,
      createdAt: existing ? existing.createdAt : (contact.createdAt || new Date().toISOString()),
      lastInteractionAt: contact.lastInteractionAt || new Date().toISOString(),
    };
    data.contacts[clean] = updated;
    saveDatabase(data);
    return updated;
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

  // --- Messages ---
  async getMessages(phone?: string): Promise<ChatMessage[]> {
    const data = loadDatabase();
    if (!phone) {
      return [...data.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    const clean = phone.replace(/\D/g, '');
    return data.messages
      .filter(m => m.contactPhone.replace(/\D/g, '') === clean)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async saveMessage(message: ChatMessage): Promise<ChatMessage> {
    const cleanPhone = message.contactPhone.replace(/\D/g, '');
    const data = loadDatabase();
    const msgToSave: ChatMessage = {
      ...message,
      contactPhone: cleanPhone,
      timestamp: message.timestamp || new Date().toISOString(),
    };

    // Replace if exists, or append
    const existingIdx = data.messages.findIndex(m => m.id === msgToSave.id);
    if (existingIdx >= 0) {
      data.messages[existingIdx] = msgToSave;
    } else {
      data.messages.push(msgToSave);
    }

    // Keep message history capped at 2000 items in local buffer
    if (data.messages.length > 2000) {
      data.messages = data.messages.slice(-2000);
    }

    saveDatabase(data);
    return msgToSave;
  },

  // --- Webhook Idempotency ---
  async hasProcessedMessage(metaMessageId: string): Promise<boolean> {
    if (!metaMessageId) return false;
    const data = loadDatabase();
    return data.processedMessageIds.includes(metaMessageId);
  },

  async markMessageAsProcessed(metaMessageId: string): Promise<void> {
    if (!metaMessageId) return;
    const data = loadDatabase();
    if (!data.processedMessageIds.includes(metaMessageId)) {
      data.processedMessageIds.push(metaMessageId);
      // Cap at 1000 items
      if (data.processedMessageIds.length > 1000) {
        data.processedMessageIds = data.processedMessageIds.slice(-1000);
      }
      saveDatabase(data);
    }
  },

  // --- Audit Logs ---
  async addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const data = loadDatabase();
    const entry: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    data.auditLogs.unshift(entry);
    if (data.auditLogs.length > 500) {
      data.auditLogs = data.auditLogs.slice(0, 500);
    }
    saveDatabase(data);
    return entry;
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const data = loadDatabase();
    return data.auditLogs.slice(0, limit);
  },

  // --- Data Deletion (LGPD / Meta Compliance) ---
  async createDeletionRequest(identifier: string, notes?: string): Promise<DataDeletionRequest> {
    const data = loadDatabase();
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

    data.deletionRequests[confirmationCode] = request;
    saveDatabase(data);
    return request;
  },

  async getDeletionRequest(confirmationCode: string): Promise<DataDeletionRequest | null> {
    const data = loadDatabase();
    return data.deletionRequests[confirmationCode] || null;
  },

  async executeDataDeletion(identifier: string): Promise<{ success: boolean; deletedCount: number }> {
    const data = loadDatabase();
    const cleanPhone = identifier.replace(/\D/g, '');
    let deletedCount = 0;

    // Remove contact
    if (data.contacts[cleanPhone]) {
      delete data.contacts[cleanPhone];
      deletedCount++;
    }

    // Remove associated messages
    const initialMsgCount = data.messages.length;
    data.messages = data.messages.filter(m => m.contactPhone.replace(/\D/g, '') !== cleanPhone);
    deletedCount += (initialMsgCount - data.messages.length);

    // Update deletion request status
    for (const req of Object.values(data.deletionRequests)) {
      if (req.identifier.replace(/\D/g, '') === cleanPhone || req.identifier === identifier) {
        req.status = 'completed';
        req.completedAt = new Date().toISOString();
      }
    }

    saveDatabase(data);

    await this.addAuditLog({
      type: 'data_deletion',
      phone: cleanPhone,
      summary: `Exclusão definitiva de dados solicitada e concluída para ${identifier}. Registros removidos: ${deletedCount}.`,
    });

    return { success: true, deletedCount };
  },
};
