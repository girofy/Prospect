// server.ts
import http from "http";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

// api/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
var client = null;
function supabase() {
  if (client) return client;
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) {
    throw new Error(
      "[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY n\xE3o configurados. Defina as duas vari\xE1veis de ambiente."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

// api/lib/db.ts
var DEFAULT_CONFIG = {
  metaPhoneNumberId: "1221241567748320",
  webhookVerifyToken: "impossivel2008",
  geminiModel: "gemini-3.6-flash",
  autoReplyEnabled: true,
  activeGateway: "direct_pairing",
  directPairingPhone: "557488126578",
  directPairingStatus: "connected"
};
function contactFromRow(row) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    company: row.company,
    niche: row.niche ?? void 0,
    role: row.role,
    status: row.status,
    agentState: row.agent_state,
    optOutDetected: row.opt_out_detected,
    optOutReason: row.opt_out_reason ?? void 0,
    lastInteractionAt: row.last_interaction_at,
    unreadCount: row.unread_count ?? void 0,
    notes: row.notes ?? void 0,
    createdAt: row.created_at
  };
}
function contactToRow(c) {
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
    created_at: c.createdAt
  };
}
function messageFromRow(row) {
  return {
    id: row.id,
    contactPhone: row.contact_phone,
    from: row.from,
    text: row.text,
    type: row.type,
    timestamp: row.timestamp,
    metaMessageId: row.meta_message_id ?? void 0,
    status: row.status ?? void 0,
    mediaUrl: row.media_url ?? void 0,
    aiReasoning: row.ai_reasoning ?? void 0
  };
}
function messageToRow(m) {
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
    ai_reasoning: m.aiReasoning ?? null
  };
}
function auditLogFromRow(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    phone: row.phone ?? void 0,
    summary: row.summary,
    details: row.details ?? void 0
  };
}
function deletionFromRow(row) {
  return {
    id: row.id,
    confirmationCode: row.confirmation_code,
    identifier: row.identifier,
    status: row.status,
    requestedAt: row.requested_at,
    completedAt: row.completed_at ?? void 0,
    notes: row.notes ?? void 0
  };
}
function mustOk(res, context) {
  if (res.error) {
    console.error(`[DB] ${context}:`, res.error.message || res.error);
    throw new Error(`[DB] ${context}: ${res.error.message || res.error}`);
  }
  return res.data;
}
var configCache = { ...DEFAULT_CONFIG };
var configLoaded = false;
var configLoadPromise = null;
async function loadConfigOnce() {
  try {
    const { data, error } = await supabase().from("app_config").select("data").eq("id", true).maybeSingle();
    if (!error && data?.data) {
      configCache = { ...DEFAULT_CONFIG, ...data.data };
    }
  } catch (err) {
    console.warn("[DB] Falha ao carregar config inicial do Supabase:", err);
  } finally {
    configLoaded = true;
  }
}
function ensureConfigLoaded() {
  if (!configLoadPromise) configLoadPromise = loadConfigOnce();
  return configLoadPromise;
}
ensureConfigLoaded();
var db = {
  // --- Contacts ---
  async getContacts() {
    const res = await supabase().from("contacts").select("*").order("last_interaction_at", { ascending: false });
    return mustOk(res, "getContacts").map(contactFromRow);
  },
  async getContactByPhone(phone) {
    const clean = phone.replace(/\D/g, "");
    const res = await supabase().from("contacts").select("*").eq("phone", clean).maybeSingle();
    const row = mustOk(res, "getContactByPhone");
    return row ? contactFromRow(row) : null;
  },
  async saveContact(contact) {
    const clean = contact.phone.replace(/\D/g, "");
    const existing = await this.getContactByPhone(clean);
    const updated = {
      ...existing,
      ...contact,
      phone: clean,
      createdAt: existing ? existing.createdAt : contact.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      lastInteractionAt: contact.lastInteractionAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    const res = await supabase().from("contacts").upsert(contactToRow(updated), { onConflict: "phone" }).select().single();
    return contactFromRow(mustOk(res, "saveContact"));
  },
  async updateContactAgentState(phone, agentState) {
    const contact = await this.getContactByPhone(phone);
    if (!contact) return null;
    contact.agentState = agentState;
    contact.lastInteractionAt = (/* @__PURE__ */ new Date()).toISOString();
    return this.saveContact(contact);
  },
  async updateContactStatus(phone, status) {
    const contact = await this.getContactByPhone(phone);
    if (!contact) return null;
    contact.status = status;
    contact.lastInteractionAt = (/* @__PURE__ */ new Date()).toISOString();
    return this.saveContact(contact);
  },
  async clearAllContacts() {
    const countRes = await supabase().from("contacts").select("phone", { count: "exact", head: true });
    const count = countRes.count || 0;
    mustOk(await supabase().from("messages").delete().neq("id", ""), "clearAllContacts(messages)");
    mustOk(await supabase().from("contacts").delete().neq("phone", ""), "clearAllContacts(contacts)");
    await this.addAuditLog({
      type: "status_change",
      summary: `Todos os ${count} leads e mensagens foram removidos do CRM a pedido do usu\xE1rio.`
    });
    return count;
  },
  async batchSaveContacts(contactsList) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cleanList = contactsList.map((item) => ({ ...item, phone: item.phone.replace(/\D/g, "") })).filter((item) => item.phone && item.phone.length >= 10);
    if (cleanList.length === 0) return [];
    const phones = cleanList.map((c) => c.phone);
    const existingRes = await supabase().from("contacts").select("phone, created_at").in("phone", phones);
    const existingMap = new Map((mustOk(existingRes, "batchSaveContacts(lookup)") || []).map((r) => [r.phone, r.created_at]));
    const rows = cleanList.map(
      (item) => contactToRow({
        ...item,
        createdAt: existingMap.get(item.phone) || item.createdAt || now,
        lastInteractionAt: now
      })
    );
    const res = await supabase().from("contacts").upsert(rows, { onConflict: "phone" }).select();
    const results = mustOk(res, "batchSaveContacts(upsert)").map(contactFromRow);
    await this.addAuditLog({
      type: "status_change",
      summary: `${results.length} contatos importados e salvos com sucesso no CRM via arquivo.`
    });
    return results;
  },
  // --- Messages ---
  // Sem telefone: traz os 5000 mais recentes (globais). Com volume alto, revisar.
  async getMessages(phone) {
    if (phone) {
      const clean = phone.replace(/\D/g, "");
      const res2 = await supabase().from("messages").select("*").eq("contact_phone", clean).order("timestamp", { ascending: true });
      return mustOk(res2, "getMessages(phone)").map(messageFromRow);
    }
    const res = await supabase().from("messages").select("*").order("timestamp", { ascending: false }).limit(5e3);
    return mustOk(res, "getMessages(all)").map(messageFromRow).reverse();
  },
  async saveMessage(message) {
    const cleanPhone = message.contactPhone.replace(/\D/g, "");
    const toSave = {
      ...message,
      contactPhone: cleanPhone,
      timestamp: message.timestamp || (/* @__PURE__ */ new Date()).toISOString()
    };
    const res = await supabase().from("messages").upsert(messageToRow(toSave), { onConflict: "id" }).select().single();
    return messageFromRow(mustOk(res, "saveMessage"));
  },
  // Conjunto de telefones que já mandaram pelo menos 1 mensagem como lead.
  // Usado pelo prospector e pelo painel para medir taxa de resposta sem
  // carregar todas as mensagens.
  async getRepliedPhones() {
    const res = await supabase().from("messages").select("contact_phone").eq("from", "lead");
    const rows = mustOk(res, "getRepliedPhones");
    return new Set(rows.map((r) => r.contact_phone));
  },
  // --- Webhook Idempotency ---
  async hasProcessedMessage(metaMessageId) {
    if (!metaMessageId) return false;
    const res = await supabase().from("processed_message_ids").select("meta_message_id").eq("meta_message_id", metaMessageId).maybeSingle();
    return !!mustOk(res, "hasProcessedMessage");
  },
  async markMessageAsProcessed(metaMessageId) {
    if (!metaMessageId) return;
    const res = await supabase().from("processed_message_ids").upsert({ meta_message_id: metaMessageId }, { onConflict: "meta_message_id", ignoreDuplicates: true });
    if (res.error) console.warn("[DB] markMessageAsProcessed:", res.error.message);
  },
  // --- Audit Logs ---
  async addAuditLog(log) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...log
    };
    const res = await supabase().from("audit_logs").insert({ id: entry.id, timestamp: entry.timestamp, type: entry.type, phone: entry.phone ?? null, summary: entry.summary, details: entry.details ?? null });
    if (res.error) console.warn("[DB] addAuditLog:", res.error.message);
    return entry;
  },
  async getAuditLogs(limit = 100) {
    const res = await supabase().from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(limit);
    return mustOk(res, "getAuditLogs").map(auditLogFromRow);
  },
  // --- Data Deletion (LGPD / Meta Compliance) ---
  async createDeletionRequest(identifier, notes) {
    const cleanId = identifier.trim().toLowerCase();
    const confirmationCode = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const request = {
      id: `req-${Date.now()}`,
      confirmationCode,
      identifier: cleanId,
      status: "pending",
      requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
      notes
    };
    const res = await supabase().from("deletion_requests").insert({
      id: request.id,
      confirmation_code: request.confirmationCode,
      identifier: request.identifier,
      status: request.status,
      requested_at: request.requestedAt,
      notes: request.notes ?? null
    });
    mustOk(res, "createDeletionRequest");
    return request;
  },
  async getDeletionRequest(confirmationCode) {
    const res = await supabase().from("deletion_requests").select("*").eq("confirmation_code", confirmationCode).maybeSingle();
    const row = mustOk(res, "getDeletionRequest");
    return row ? deletionFromRow(row) : null;
  },
  async executeDataDeletion(identifier) {
    const cleanPhone = identifier.replace(/\D/g, "");
    let deletedCount = 0;
    const msgCountRes = await supabase().from("messages").select("id", { count: "exact", head: true }).eq("contact_phone", cleanPhone);
    deletedCount += msgCountRes.count || 0;
    mustOk(await supabase().from("messages").delete().eq("contact_phone", cleanPhone), "executeDataDeletion(messages)");
    const contactRes = await supabase().from("contacts").delete().eq("phone", cleanPhone).select();
    deletedCount += (mustOk(contactRes, "executeDataDeletion(contacts)") || []).length;
    const pendingRes = await supabase().from("deletion_requests").select("id, identifier").eq("status", "pending");
    const pending = mustOk(pendingRes, "executeDataDeletion(pending lookup)") || [];
    const matchIds = pending.filter((r) => r.identifier.replace(/\D/g, "") === cleanPhone || r.identifier === identifier).map((r) => r.id);
    if (matchIds.length > 0) {
      mustOk(
        await supabase().from("deletion_requests").update({ status: "completed", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).in("id", matchIds),
        "executeDataDeletion(update requests)"
      );
    }
    await this.addAuditLog({
      type: "data_deletion",
      phone: cleanPhone,
      summary: `Exclus\xE3o definitiva de dados solicitada e conclu\xEDda para ${identifier}. Registros removidos: ${deletedCount}.`
    });
    return { success: true, deletedCount };
  },
  // --- Base de conhecimento (documentos que a IA lê) ---
  async listKnowledge() {
    const res = await supabase().from("knowledge_docs").select("id, title, content, active, created_at").order("created_at", { ascending: false });
    return mustOk(res, "listKnowledge") || [];
  },
  async getActiveKnowledge() {
    const res = await supabase().from("knowledge_docs").select("title, content").eq("active", true).order("created_at", { ascending: true });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  },
  async saveKnowledge(title, content) {
    const res = await supabase().from("knowledge_docs").insert({ title, content, active: true, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    mustOk(res, "saveKnowledge");
  },
  async setKnowledgeActive(id, active) {
    const res = await supabase().from("knowledge_docs").update({ active, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    mustOk(res, "setKnowledgeActive");
  },
  async deleteKnowledge(id) {
    const res = await supabase().from("knowledge_docs").delete().eq("id", id);
    mustOk(res, "deleteKnowledge");
  },
  // --- Uso da IA (cota) — grava sem gerar log de auditoria a cada chamada ---
  async saveAiUsage(patch) {
    await ensureConfigLoaded();
    const updated = { ...configCache, ...patch };
    const res = await supabase().from("app_config").upsert({ id: true, data: updated }, { onConflict: "id" });
    if (res.error) console.warn("[DB] saveAiUsage:", res.error.message);
    configCache = updated;
  },
  // --- Aprendizado: lições gravadas a partir de conversas encerradas ---
  async saveLearning(l) {
    const res = await supabase().from("learnings").insert({
      contact_phone: l.contactPhone,
      outcome: l.outcome,
      worked: l.worked,
      failed: l.failed,
      why: l.why,
      opener_style: l.openerStyle ?? null
    });
    if (res.error) console.warn("[DB] saveLearning:", res.error.message);
  },
  async getRecentLearnings(n) {
    const res = await supabase().from("learnings").select("*").order("created_at", { ascending: false }).limit(n);
    if (res.error || !res.data) return [];
    return res.data;
  },
  // Telefones que já têm lição gravada desde uma data (evita aprender a mesma conversa duas vezes).
  async getLearnedPhonesSince(sinceIso) {
    const res = await supabase().from("learnings").select("contact_phone").gte("created_at", sinceIso);
    if (res.error || !res.data) return /* @__PURE__ */ new Set();
    return new Set(res.data.map((r) => r.contact_phone).filter(Boolean));
  },
  // Lições mais recentes em forma de frase, para o prompt. Se a tabela ainda não existir, devolve [].
  async getTopLearnings(n) {
    const res = await supabase().from("learnings").select("outcome, worked, failed, why").order("created_at", { ascending: false }).limit(n);
    if (res.error || !res.data) return [];
    return res.data.map((r) => `[${r.outcome}] funcionou: ${r.worked || "-"} | n\xE3o funcionou: ${r.failed || "-"} | porqu\xEA: ${r.why || "-"}`);
  },
  // --- Dynamic App Configuration ---
  // Leitura síncrona a partir do cache em memória (carregado em segundo plano no import do módulo).
  // Pode estar um tick atrasado logo no boot do processo; getConfig() aguarda a carga inicial.
  getConfigSync() {
    return configCache;
  },
  async getConfig() {
    await ensureConfigLoaded();
    return { ...configCache };
  },
  async saveConfig(updates) {
    await ensureConfigLoaded();
    const updated = { ...configCache, ...updates };
    const res = await supabase().from("app_config").upsert({ id: true, data: updated }, { onConflict: "id" });
    if (res.error) console.warn("[DB] saveConfig:", res.error.message);
    configCache = updated;
    await this.addAuditLog({
      type: "status_change",
      summary: "Par\xE2metros de configura\xE7\xE3o atualizados via painel de Ajustes.",
      details: {
        hasMetaToken: Boolean(updated.metaAccessToken),
        hasGeminiKey: Boolean(updated.geminiApiKey),
        phoneNumberId: updated.metaPhoneNumberId,
        autoReplyEnabled: updated.autoReplyEnabled
      }
    });
    return updated;
  }
};

// api/lib/whatsapp.ts
import crypto from "crypto";
var AUTHORIZED_BUSINESS_NUMBER = "557488126578";
var DEFAULT_PHONE_NUMBER_ID = "1221241567748320";
var DEFAULT_APP_ID = "1572840733789529";
var DEFAULT_BUSINESS_ID = "1232106109979142";
function getMetaConfig() {
  const dynamicConfig = db.getConfigSync();
  const token = dynamicConfig.metaAccessToken || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || "";
  const phoneNumberId = dynamicConfig.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || DEFAULT_PHONE_NUMBER_ID;
  const appSecret = dynamicConfig.metaAppSecret || process.env.META_APP_SECRET || "";
  const verifyToken = dynamicConfig.webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || "impossivel2008";
  return {
    token: token.trim().replace(/^Bearer\s+/i, ""),
    phoneNumberId: phoneNumberId.trim(),
    appSecret: appSecret.trim(),
    verifyToken: verifyToken.trim(),
    isConfigured: Boolean(token.trim()),
    autoReplyEnabled: dynamicConfig.autoReplyEnabled !== false
  };
}
function validateXHubSignature(rawBody, signatureHeader) {
  const { appSecret } = getMetaConfig();
  if (!appSecret) {
    return true;
  }
  if (!signatureHeader) {
    return false;
  }
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }
  const expectedSignature = parts[1];
  try {
    const hmac = crypto.createHmac("sha256", appSecret);
    const calculatedSignature = hmac.update(rawBody, "utf-8").digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const calculatedBuffer = Buffer.from(calculatedSignature, "hex");
    if (expectedBuffer.length !== calculatedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch (err) {
    console.error("[WhatsApp Security] Error validating signature:", err);
    return false;
  }
}
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = `55${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    const ddd = cleaned.slice(2, 4);
    const rest = cleaned.slice(4);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      cleaned = `55${ddd}9${rest}`;
    }
  }
  return cleaned;
}
function isSelfMessage(from) {
  const cleanFrom = from.replace(/\D/g, "");
  const cleanBusiness = AUTHORIZED_BUSINESS_NUMBER.replace(/\D/g, "");
  const { phoneNumberId } = getMetaConfig();
  return cleanFrom === cleanBusiness || cleanFrom === phoneNumberId;
}
async function sendWhatsAppTextMessage(recipientPhone, text) {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();
  if (!isConfigured) {
    return {
      success: false,
      error: "META_ACCESS_TOKEN n\xE3o configurado no servidor. Adicione a vari\xE1vel de ambiente na Vercel."
    };
  }
  const cleanRecipient = formatPhoneNumber(recipientPhone);
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanRecipient,
        type: "text",
        text: {
          preview_url: false,
          body: text
        }
      })
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      const errorCode = data.error?.code;
      let guidance = errorMsg;
      if (errorCode === 131047) {
        guidance = "Janela de 24 horas expirada. A Meta exige um template aprovado para reabrir conversa comercial.";
      } else if (errorCode === 190) {
        guidance = "Token de Acesso da Meta expirado ou inv\xE1lido. Necess\xE1rio gerar novo token permanente na Meta Developers.";
      } else if (errorCode === 130429) {
        guidance = "Limite de taxa (Rate Limit) da API do WhatsApp atingido. Aguarde alguns instantes.";
      }
      console.error(`[WhatsApp API Error] Code ${errorCode}: ${guidance}`);
      return { success: false, error: guidance };
    }
    const messageId = data.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    console.error("[WhatsApp Network Error]", err?.message);
    return { success: false, error: err?.message || "Falha na comunica\xE7\xE3o com a Graph API da Meta" };
  }
}
async function markWhatsAppMessageAsRead(messageId) {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();
  if (!isConfigured || !messageId) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}
async function getWhatsAppNumberStatus() {
  const { token, phoneNumberId, isConfigured } = getMetaConfig();
  if (!isConfigured) {
    return {
      configured: false,
      error: "Token da Meta n\xE3o configurado no ambiente Vercel/Node."
    };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });
    const data = await res.json();
    if (data.error) {
      return {
        configured: true,
        error: data.error.message
      };
    }
    return {
      configured: true,
      verifiedName: data.verified_name || "N\xFAmero Meta Verificado",
      displayPhoneNumber: data.display_phone_number || "+55 74 8812-6578",
      qualityRating: data.quality_rating || "GREEN"
    };
  } catch (err) {
    return {
      configured: true,
      error: err?.message || "Falha ao consultar Graph API"
    };
  }
}

// api/lib/gemini.ts
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
var DEFAULT_MODEL = "gemini-3.6-flash";
var RETIRED_MODEL = /^gemini-2\.5-/;
function resolveModel(fromDb) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (fromDb && !RETIRED_MODEL.test(fromDb)) return fromDb;
  return DEFAULT_MODEL;
}
var DAILY_CALL_LIMIT = Number(process.env.GEMINI_DAILY_CALL_LIMIT ?? 200);
var SYSTEM_PROMPT = `
Voc\xEA \xE9 o atendente comercial da Girofy, empresa de Sobradinho-BA que faz sites e automa\xE7\xF5es para neg\xF3cios locais de Sobradinho, Juazeiro e Petrolina. Voc\xEA conversa pelo WhatsApp com donos e funcion\xE1rios de barbearias, sal\xF5es, hot\xE9is e pousadas, academias, pet shops, mec\xE2nicas, empresas de eventos e profissionais aut\xF4nomos. Voc\xEA fala em nome da Girofy. O fundador \xE9 o C\xE9sar.

COMO VOC\xCA FALA
- Como gente do interior da Bahia no WhatsApp: curto, simples, educado, direto. Pode usar "voc\xEAs", "t\xE1", "pra", "show", "beleza". Nada de jarg\xE3o ("solu\xE7\xE3o", "alavancar", "agendar uma reuni\xE3o", "parceria estrat\xE9gica").
- Cada mensagem tem de 8 a 16 palavras e no m\xE1ximo uma pergunta. Sauda\xE7\xE3o pura ("Bom dia!") \xE9 a \xFAnica exce\xE7\xE3o.
- N\xE3o use travess\xE3o, lista, emoji em excesso nem negrito. No m\xE1ximo um emoji, e s\xF3 se o lead usar.
- N\xE3o se apresente com curr\xEDculo. N\xE3o diga "sem press\xE3o", "sem compromisso" nem "se n\xE3o for o momento". N\xE3o pe\xE7a desculpa se o lead n\xE3o reclamou de nada. Nunca use a palavra "reuni\xE3o".
- Espelhe o jeito do lead: se ele escreve "blz", voc\xEA pode ser mais solto; se ele \xE9 formal, seja formal.

COMO VOC\xCA DECIDE (antes de cada resposta)
1. Leia a \xFAltima mensagem do lead e o estado da conversa (est\xE1gio, \xFAltima pergunta feita, obje\xE7\xF5es j\xE1 ditas).
2. Classifique a resposta: avan\xE7ou, d\xFAvida, obje\xE7\xE3o, desvio, atendente/rob\xF4, pedido de parada, pergunta se \xE9 IA.
3. Escolha UMA a\xE7\xE3o que avance um passo. Nunca repita uma mensagem j\xE1 enviada. Se o lead respondeu algo, sua mensagem precisa mostrar que voc\xEA leu (use as palavras dele).
4. Prefira perguntas de sim/n\xE3o ou de escolha entre duas op\xE7\xF5es que ambas avan\xE7am ("Prefere ver pelo celular ou pelo computador?"). Perguntas abertas longas ("o que achou?") n\xE3o recebem resposta.
5. Se faltar informa\xE7\xE3o para personalizar (nome, nicho, se tem site), pergunte ou fale de forma gen\xE9rica. Nunca envie texto com campo vazio, chave entre colchetes ou palavras como "Lead", "Em qualifica\xE7\xE3o", "{nome}".

O CAMINHO NORMAL DA CONVERSA
Sauda\xE7\xE3o \u2192 observa\xE7\xE3o curta e verdadeira sobre o neg\xF3cio (ex.: n\xE3o tem site, ou s\xF3 tem link de terceiro) \u2192 "Voc\xEA \xE9 o respons\xE1vel?" \u2192 oferta da pr\xE9via gratuita do site do pr\xF3prio neg\xF3cio \u2192 envio da pr\xE9via \u2192 pergunta de fechamento com duas sa\xEDdas que avan\xE7am \u2192 pre\xE7o \u2192 PIX/materiais ou passar para o C\xE9sar.
Voc\xEA n\xE3o precisa seguir na ordem se o lead pular etapas. Se ele perguntar "quanto?", responda o pre\xE7o com \xE2ncora. Se pedir a pr\xE9via logo, mande.

A OFERTA ATUAL
- Pr\xE9via gratuita do site do pr\xF3prio neg\xF3cio, feita antes de qualquer pagamento.
- Site por R$ 300, pago s\xF3 na entrega, quando o lead aprovar. Entrada de 50% \xE9 opcional e adianta a fila.
- Inclui: p\xE1gina com fotos, servi\xE7os, hor\xE1rios, bot\xE3o de WhatsApp, mapa e link \xFAnico para colocar no Instagram e no Google.
- Ancore o pre\xE7o no ticket do pr\xF3prio neg\xF3cio (ex.: "R$ 300 d\xE1 uns 12 cortes de R$ 25").
- N\xE3o d\xEA desconto sem contrapartida. Se pedirem desconto, troque por algo (pagar entrada, indicar algu\xE9m, depoimento depois de entregue).

PRINC\xCDPIOS DE VENDA QUE VOC\xCA USA
- Escute primeiro: repita as \xFAltimas palavras do lead em forma de pergunta (espelho) ou nomeie o que parece estar acontecendo ("Parece que voc\xEAs j\xE1 t\xEAm cliente demais pelo boca a boca").
- Ensine algo \xFAtil sobre o neg\xF3cio dele (quem procura "barbearia perto de mim" no Google acha quem tem p\xE1gina), em uma frase.
- Torne o sim f\xE1cil: pr\xE9via gr\xE1tis, pagamento na entrega, voc\xEA cuida de tudo.
- Prova social s\xF3 se for real e fornecida pelo C\xE9sar. Escassez s\xF3 se for real (ex.: vagas de entrega da semana definidas pelo C\xE9sar).
- Quando o lead some depois do pre\xE7o, fa\xE7a uma pergunta de aprendizado: "O que pesou mais: pre\xE7o, momento ou o site?"

QUANDO PASSAR PARA O C\xC9SAR
Passe a conversa (marcando handoff=true) quando: o lead aceitar fechar, pedir para falar com uma pessoa, pedir algo fora da oferta (sistema, loja virtual, automa\xE7\xE3o complexa), negociar condi\xE7\xF5es que voc\xEA n\xE3o pode decidir, ou ficar irritado. Diga algo como "Vou chamar o C\xE9sar aqui, ele te responde ainda hoje."

ATENDENTES E ROB\xD4S
Se quem responde \xE9 um menu autom\xE1tico, responda curto pedindo atendimento humano ou escolha a op\xE7\xE3o mais pr\xF3xima de "falar com atendente". Se \xE9 funcion\xE1rio sem poder de decis\xE3o, pe\xE7a o contato do respons\xE1vel com educa\xE7\xE3o e registre o nome. Ao falar com o respons\xE1vel, cite a indica\xE7\xE3o ("A Joana da recep\xE7\xE3o me passou seu contato").

OS DOIS LIMITES (nunca quebre)
1. VERDADE. Se o lead perguntar sinceramente se voc\xEA \xE9 rob\xF4 ou IA, diga a verdade com simpatia: "Sou o assistente virtual da Girofy, o C\xE9sar acompanha tudo. Quer falar direto com ele?" Nunca invente fatos, n\xFAmeros, clientes, depoimentos ou resultados. Nunca prometa posi\xE7\xE3o no Google: diga "pode ajudar a ser encontrado", nunca "vai aparecer em primeiro". Se n\xE3o souber, diga que confirma com o C\xE9sar. S\xF3 afirme "voc\xEAs n\xE3o t\xEAm site" se isso estiver verificado no estado da conversa; se o lead tiver link de terceiros, reconhe\xE7a o link.
2. PARADA. Se o lead disser que n\xE3o quer, pedir para parar, xingar ou disser "n\xE3o manda mais", responda uma \xFAnica vez de forma curta e gentil ("Beleza, n\xE3o te chamo mais. Sucesso a\xED!") e marque opt_out=true. Nunca mais escreva para esse n\xFAmero.

Fora esses dois limites, use seu julgamento. Seu objetivo \xE9 ser o melhor vendedor iniciante que esse dono de neg\xF3cio j\xE1 viu: r\xE1pido, educado, \xFAtil, humano e que n\xE3o enche o saco.

SA\xCDDA: responda SOMENTE com o texto da mensagem que vai para o WhatsApp.
Se for passar a conversa para o C\xE9sar, escreva a mensagem e, no fim, [TRANSF_HUMANO: motivo].
Se a pessoa pedir para parar, confirme em uma frase e n\xE3o escreva mais nada.
`;
var KNOWLEDGE_MAX_CHARS = 3e4;
var knowledgeCache = null;
async function loadKnowledge() {
  if (knowledgeCache && Date.now() - knowledgeCache.at < 6e4) return knowledgeCache.text;
  let out = "";
  try {
    const docs = await db.getActiveKnowledge();
    for (const d of docs) out += `

# ${d.title}
${d.content}`;
  } catch (err) {
    console.warn("[Knowledge] falha ao ler documentos do banco:", err);
  }
  try {
    const dir = path.resolve(process.cwd(), "knowledge");
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md")).sort();
      for (const f of files) out += `

# ${f}
${fs.readFileSync(path.join(dir, f), "utf-8")}`;
    }
  } catch (err) {
    console.warn("[Knowledge] falha ao ler knowledge/:", err);
  }
  const text = out.slice(0, KNOWLEDGE_MAX_CHARS).trim();
  knowledgeCache = { at: Date.now(), text };
  return text;
}
function clearKnowledgeCache() {
  knowledgeCache = null;
}
function validateReply(text, recentBot) {
  const t = text.replace(/\[TRANSF_HUMANO:[^\]]*\]/gi, "").trim();
  if (!t) return "mensagem vazia";
  if (/[{}\[\]]|\bnull\b|undefined/i.test(t)) return "tem chave, colchete ou campo vazio";
  if (/\bLead\b|Em qualificação/.test(t)) return "usou r\xF3tulo interno no lugar do nome";
  if (/reunião|sem pressão|sem compromisso|se não for o momento|só passando/i.test(t)) return "usou frase proibida";
  if (t.split(/\s+/).length > 22) return "mensagem longa demais";
  if ((t.match(/\?/g) || []).length > 1) return "mais de uma pergunta";
  const norm = (x) => new Set(x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const a = norm(t);
  for (const b of recentBot) {
    const bs = norm(b);
    const inter = [...a].filter((w) => bs.has(w)).length;
    const uni = (/* @__PURE__ */ new Set([...a, ...bs])).size;
    if (uni > 0 && inter / uni > 0.6) return "parecida demais com mensagem j\xE1 enviada";
  }
  return null;
}
function todayBahia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
}
async function reserveAiCall() {
  const cfg = await db.getConfig();
  if (cfg.aiPausedUntil && Date.parse(cfg.aiPausedUntil) > Date.now()) return false;
  const day = todayBahia();
  const used = cfg.aiUsageDay === day ? cfg.aiUsageCount || 0 : 0;
  if (used >= DAILY_CALL_LIMIT) return false;
  await db.saveAiUsage({ aiUsageDay: day, aiUsageCount: used + 1 });
  return true;
}
async function generateGirofyCommercialReply(contact, incoming, history) {
  const fail = (reason) => ({
    replyText: "",
    aiAvailable: false,
    unavailableReason: reason,
    transferToHuman: false
  });
  const cfg = await db.getConfig();
  const apiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[Gemini] GEMINI_API_KEY n\xE3o configurada: resposta n\xE3o enviada.");
    return fail("no_key");
  }
  if (!await reserveAiCall()) {
    console.warn("[Gemini] cota di\xE1ria do agente atingida ou IA pausada: nada enviado.");
    return fail("quota");
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const recent = history.slice(-12);
    const recentBot = recent.filter((m) => m.from === "bot").slice(-4).map((m) => `- "${m.text}"`).join("\n");
    const transcript2 = recent.map((m) => {
      const who = m.from === "bot" ? "Voc\xEA" : m.from === "operator" ? "C\xE9sar (humano)" : "Pessoa";
      return `${who}: ${m.text}`;
    }).join("\n");
    const knowledge = await loadKnowledge();
    const learnings = await db.getTopLearnings(8);
    const promptText = `
${SYSTEM_PROMPT}
${knowledge ? `
BASE DE CONHECIMENTO DA GIROFY:
${knowledge}
` : ""}
${learnings.length ? `
O QUE J\xC1 FUNCIONOU E N\xC3O FUNCIONOU (aprendido de conversas anteriores, use como guia):
${learnings.map((l) => `- ${l}`).join("\n")}
` : ""}
DADOS DA PESSOA:
- Nome: ${contact.name && !/^(lead|contato)/i.test(contact.name) ? contact.name : "n\xE3o sei o nome"}
- Neg\xF3cio: ${contact.company && contact.company !== "Em qualifica\xE7\xE3o" ? contact.company : "n\xE3o sei o nome do neg\xF3cio"}
- Nicho: ${contact.niche || "n\xE3o informado"}

SUAS \xDALTIMAS MENSAGENS (n\xE3o repita nenhuma destas ideias):
${recentBot || "(nenhuma ainda)"}

CONVERSA RECENTE:
${transcript2 || "(in\xEDcio da conversa)"}

NOVA MENSAGEM DA PESSOA:
"${incoming.text}"

Responda s\xF3 com o texto da pr\xF3xima mensagem para o WhatsApp.
`;
    const recentBotTexts = recent.filter((m) => m.from === "bot").slice(-4).map((m) => m.text);
    const mediaPart = incoming.media ? [{ inlineData: { mimeType: incoming.media.mimeType, data: incoming.media.data } }] : [];
    let rawText = "";
    let lastProblem = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const feedback = lastProblem ? `

SUA TENTATIVA ANTERIOR FOI RECUSADA: ${lastProblem}. Escreva outra mensagem, com outras palavras, seguindo as regras.` : "";
      const response = await ai.models.generateContent({
        // Modelo: variável de ambiente manda; o valor gravado no banco só vale se não for um modelo descontinuado.
        model: resolveModel(cfg.geminiModel),
        contents: [{ role: "user", parts: [...mediaPart, { text: promptText + feedback }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 200,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      const candidate = response.text ? response.text.trim() : "";
      const problem = validateReply(candidate, recentBotTexts);
      if (!problem) {
        rawText = candidate;
        break;
      }
      lastProblem = problem;
      console.warn("[Gemini] resposta recusada pelo validador:", problem, "|", candidate);
    }
    if (!rawText) return fail("invalid");
    let transferToHuman = false;
    let transferReason;
    const transferMatch = rawText.match(/\[TRANSF_HUMANO:\s*([^\]]+)\]/i);
    if (transferMatch) {
      transferToHuman = true;
      transferReason = transferMatch[1].trim();
      rawText = rawText.replace(/\[TRANSF_HUMANO:[^\]]+\]/gi, "").trim();
    }
    const directHumanPattern = /(falar com (humano|atendente|pessoa|alguém|proprietário|responsável)|me liga|passa para humano)/i;
    if (directHumanPattern.test(incoming.text)) {
      transferToHuman = true;
      transferReason = "Pedido expl\xEDcito de atendimento humano pelo cliente";
      if (!rawText) rawText = "Claro. Vou pedir para o C\xE9sar te responder pessoalmente. Um instante.";
    }
    if (!rawText) return fail("empty");
    const isMeetingRequested = /meet\.google\.com|reunião|15 min/i.test(rawText);
    return {
      replyText: rawText,
      aiAvailable: true,
      transferToHuman,
      transferReason,
      isMeetingRequested
    };
  } catch (err) {
    const msg = String(err?.message || err);
    console.error("[Gemini AI Server Error]:", msg);
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
      await db.saveAiUsage({ aiPausedUntil: new Date(Date.now() + 60 * 6e4).toISOString() });
      return fail("quota");
    }
    return fail("error");
  }
}

// api/_handlers/webhook.ts
var OPT_OUT_REGEX = /(não tenho interesse|nao tenho interesse|pare de mandar|para de mandar|remove meu contato|remover contato|tirar da lista|não me mande|nao me mande|denunciar|spam|sair|desinscrever|bloqueado|nunca mais)/i;
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Hub-Signature-256");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    let mode = req.query?.["hub.mode"];
    let token = req.query?.["hub.verify_token"];
    let challenge = req.query?.["hub.challenge"];
    if (!mode && req.url) {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
        mode = parsedUrl.searchParams.get("hub.mode");
        token = parsedUrl.searchParams.get("hub.verify_token");
        challenge = parsedUrl.searchParams.get("hub.challenge");
      } catch {
      }
    }
    const { verifyToken } = getMetaConfig();
    if (mode === "subscribe") {
      if (token && token.trim() === verifyToken) {
        console.log("[Meta Webhook] Verifica\xE7\xE3o conclu\xEDda com sucesso.");
        res.setHeader("Content-Type", "text/plain");
        return res.status(200).send(challenge || "OK");
      }
      console.warn("[Meta Webhook] Tentativa de subscri\xE7\xE3o rejeitada: Token inv\xE1lido.");
      return res.status(403).send("Forbidden: Token de verifica\xE7\xE3o inv\xE1lido.");
    }
    return res.status(200).json({
      status: "active",
      service: "Prospectfy WhatsApp Cloud API Webhook",
      endpoint: "/api/webhook",
      protocol: "Meta Graph API v21.0",
      authentication: "Secured via X-Hub-Signature-256 & Verify Token"
    });
  }
  if (req.method === "POST") {
    let rawBody = "";
    let parsedBody = null;
    if (typeof req.body === "string") {
      rawBody = req.body;
      try {
        parsedBody = JSON.parse(req.body);
      } catch {
      }
    } else if (req.body && typeof req.body === "object") {
      parsedBody = req.body;
      rawBody = JSON.stringify(req.body);
    }
    const signatureHeader = req.headers?.["x-hub-signature-256"] || req.headers?.["X-Hub-Signature-256"];
    if (!validateXHubSignature(rawBody, signatureHeader)) {
      console.error("[Meta Webhook Security] Assinatura X-Hub-Signature-256 rejeitada.");
      return res.status(401).json({ error: "Assinatura inv\xE1lida" });
    }
    res.status(200).json({ status: "EVENT_RECEIVED" });
    if (!parsedBody || !parsedBody.entry) {
      return;
    }
    try {
      for (const entry of parsedBody.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;
          if (value.statuses && value.statuses.length > 0) {
            for (const statusItem of value.statuses) {
              const status = statusItem.status;
              console.log(`[WhatsApp Status] Mensagem ${statusItem.id} -> ${status}`);
            }
          }
          if (value.messages && value.messages.length > 0) {
            const contactProfile = value.contacts?.[0];
            const senderProfileName = contactProfile?.profile?.name || "";
            for (const msg of value.messages) {
              const messageId = msg.id;
              const rawFrom = msg.from;
              if (isSelfMessage(rawFrom)) {
                console.log(`[WhatsApp Webhook] Mensagem ignorada (origem \xE9 o pr\xF3prio n\xFAmero comercial): ${rawFrom}`);
                continue;
              }
              if (await db.hasProcessedMessage(messageId)) {
                console.log(`[WhatsApp Webhook] Mensagem j\xE1 processada anteriormente (idempot\xEAncia): ${messageId}`);
                continue;
              }
              await db.markMessageAsProcessed(messageId);
              const cleanPhone = formatPhoneNumber(rawFrom);
              let contact = await db.getContactByPhone(cleanPhone);
              if (!contact) {
                contact = await db.saveContact({
                  id: `contact-${cleanPhone}`,
                  phone: cleanPhone,
                  name: senderProfileName || `Contato ${cleanPhone.slice(-4)}`,
                  company: "Em qualifica\xE7\xE3o",
                  role: "decisor",
                  status: "em_conversa",
                  agentState: "ai_active",
                  optOutDetected: false,
                  lastInteractionAt: (/* @__PURE__ */ new Date()).toISOString(),
                  createdAt: (/* @__PURE__ */ new Date()).toISOString()
                });
              } else if (senderProfileName && (!contact.name || contact.name.startsWith("Contato "))) {
                contact.name = senderProfileName;
                await db.saveContact(contact);
              }
              let messageText = "";
              let messageType = "text";
              if (msg.type === "text" && msg.text?.body) {
                messageText = msg.text.body.trim();
                messageType = "text";
              } else if (msg.type === "audio" || msg.type === "voice") {
                messageText = "[\xC1udio recebido do contato]";
                messageType = "audio";
              } else if (msg.type === "image") {
                messageText = msg.image?.caption ? `[Imagem: ${msg.image.caption}]` : "[Imagem recebida]";
                messageType = "image";
              } else if (msg.type === "document") {
                messageText = msg.document?.filename ? `[Documento: ${msg.document.filename}]` : "[Documento recebido]";
                messageType = "document";
              } else {
                messageText = `[Mensagem recebida do tipo: ${msg.type}]`;
                messageType = "unsupported";
              }
              const incomingChatMessage = {
                id: `in-${messageId}`,
                contactPhone: cleanPhone,
                from: "lead",
                text: messageText,
                type: messageType,
                timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                metaMessageId: messageId,
                status: "received"
              };
              await db.saveMessage(incomingChatMessage);
              await markWhatsAppMessageAsRead(messageId);
              if (OPT_OUT_REGEX.test(messageText)) {
                await db.saveContact({
                  ...contact,
                  status: "bloqueado",
                  optOutDetected: true,
                  optOutReason: "Solicita\xE7\xE3o expl\xEDcita do titular (Opt-Out LGPD)",
                  agentState: "paused",
                  lastInteractionAt: (/* @__PURE__ */ new Date()).toISOString()
                });
                await db.addAuditLog({
                  type: "opt_out",
                  phone: cleanPhone,
                  summary: `Opt-Out LGPD registrado para ${cleanPhone}: "${messageText}". Atendimento automatizado pausado permanentemente.`
                });
                console.log(`[WhatsApp LGPD] Contato ${cleanPhone} optou por sair. Bot desativado.`);
                continue;
              }
              if (contact.optOutDetected) {
                console.log(`[WhatsApp] Contato ${cleanPhone} j\xE1 possui opt-out registrado. Nenhuma a\xE7\xE3o tomada.`);
                continue;
              }
              if (contact.agentState === "human_takeover") {
                console.log(`[WhatsApp] Contato ${cleanPhone} est\xE1 sob atendimento humano exclusivo. IA em espera.`);
                await db.addAuditLog({
                  type: "incoming_message",
                  phone: cleanPhone,
                  summary: `Nova mensagem recebida de contato em atendimento humano: "${messageText.slice(0, 50)}..."`
                });
                continue;
              }
              if (contact.agentState === "paused") {
                console.log(`[WhatsApp] Agente pausado para o contato ${cleanPhone}.`);
                continue;
              }
              const { autoReplyEnabled } = getMetaConfig();
              if (autoReplyEnabled === false) {
                console.log(`[WhatsApp] Auto-reply desativado globalmente pelo painel de Ajustes.`);
                continue;
              }
              const history = await db.getMessages(cleanPhone);
              let promptText = messageText;
              if (messageType === "audio") {
                promptText = "O cliente enviou um \xE1udio. Agrade\xE7a brevemente e pergunte se ele pode adiantar a d\xFAvida por texto ou se prefere agendarmos 15 min no Meet para conversarmos.";
              }
              const aiResult = await generateGirofyCommercialReply(contact, { text: promptText }, history);
              if (!aiResult.aiAvailable) continue;
              if (aiResult.transferToHuman) {
                contact.agentState = "human_takeover";
                contact.status = "aguardando_humano";
                await db.saveContact(contact);
                await db.addAuditLog({
                  type: "status_change",
                  phone: cleanPhone,
                  summary: `Atendimento transferido para humano: ${aiResult.transferReason || "Complexidade da negocia\xE7\xE3o"}`
                });
              } else if (aiResult.isMeetingRequested) {
                contact.status = "reuniao_marcada";
                await db.saveContact(contact);
              }
              const dynamicConfig = await db.getConfig();
              const gateway = dynamicConfig.activeGateway || "direct_pairing";
              let sentSuccess = false;
              let outMsgId;
              if (gateway === "meta_cloud_api") {
                const sendResult = await sendWhatsAppTextMessage(cleanPhone, aiResult.replyText);
                sentSuccess = sendResult.success;
                outMsgId = sendResult.messageId;
                if (!sentSuccess) {
                  console.warn(`[Meta Send Warning] ${sendResult.error}`);
                }
              } else {
                sentSuccess = true;
              }
              if (sentSuccess) {
                const outgoingChatMessage = {
                  id: `out-${outMsgId || Date.now()}`,
                  contactPhone: cleanPhone,
                  from: "bot",
                  text: aiResult.replyText,
                  type: "text",
                  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                  metaMessageId: outMsgId,
                  status: "sent",
                  aiReasoning: aiResult.transferReason ? `Transferido para humano: ${aiResult.transferReason}` : void 0
                };
                await db.saveMessage(outgoingChatMessage);
                await db.addAuditLog({
                  type: "ai_reply",
                  phone: cleanPhone,
                  summary: `Resposta IA comercial enviada via ${gateway === "direct_pairing" ? "Conex\xE3o Direta" : "Meta API"}: "${aiResult.replyText.slice(0, 60)}..."`
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[Meta Webhook Processing Error]:", err);
    }
    return;
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}

// api/_handlers/contacts.ts
async function handler2(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "GET") {
      const contacts = await db.getContacts();
      return res.status(200).json({ contacts });
    }
    if (req.method === "DELETE") {
      const removedCount = await db.clearAllContacts();
      return res.status(200).json({ success: true, message: `${removedCount} contatos removidos do CRM.`, removedCount });
    }
    if (req.method === "POST" || req.method === "PUT") {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (body2.action === "clear_all") {
        const count = await db.clearAllContacts();
        return res.status(200).json({ success: true, message: "Todos os contatos foram removidos.", count });
      }
      if (Array.isArray(body2.contacts)) {
        const imported = await db.batchSaveContacts(body2.contacts);
        return res.status(200).json({ success: true, count: imported.length, contacts: imported });
      }
      const { phone, name, company, niche, role, status, agentState, notes } = body2;
      if (!phone) {
        return res.status(400).json({ error: "Telefone \xE9 obrigat\xF3rio." });
      }
      const cleanPhone = formatPhoneNumber(phone);
      let existing = await db.getContactByPhone(cleanPhone);
      const contactData = {
        id: existing?.id || `contact-${cleanPhone}`,
        phone: cleanPhone,
        name: name !== void 0 ? name : existing?.name || `Contato ${cleanPhone.slice(-4)}`,
        company: company !== void 0 ? company : existing?.company || "Empresa",
        niche: niche !== void 0 ? niche : existing?.niche || "Geral",
        role: role !== void 0 ? role : existing?.role || "decisor",
        status: status !== void 0 ? status : existing?.status || "novo",
        agentState: agentState !== void 0 ? agentState : existing?.agentState || "ai_active",
        optOutDetected: existing?.optOutDetected || false,
        optOutReason: existing?.optOutReason,
        notes: notes !== void 0 ? notes : existing?.notes,
        lastInteractionAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: existing?.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = await db.saveContact(contactData);
      return res.status(200).json({ contact: saved });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[API Contacts Error]:", err);
    return res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
}

// api/lib/evolution.ts
function getEvolutionCfg() {
  const url = (process.env.EVOLUTION_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.EVOLUTION_API_KEY || "").trim();
  const instance = (process.env.EVOLUTION_INSTANCE || "prospectfy").trim();
  if (!url || !apiKey) return null;
  return { url, apiKey, instance };
}
async function sendEvolutionText(phone, text, delayMs = 3e3) {
  const cfg = getEvolutionCfg();
  if (!cfg) {
    return { success: false, error: "EVOLUTION_URL / EVOLUTION_API_KEY n\xE3o configurados" };
  }
  try {
    const res = await fetch(`${cfg.url}/message/sendText/${encodeURIComponent(cfg.instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
      body: JSON.stringify({ number: phone, text, delay: delayMs, linkPreview: false })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` };
    }
    return { success: true, messageId: data?.key?.id };
  } catch (err) {
    return { success: false, error: err?.message || "Falha de rede na Evolution" };
  }
}
async function fetchEvolutionMedia(messageKey, message) {
  const cfg = getEvolutionCfg();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(cfg.instance)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
      body: JSON.stringify({ message: { key: messageKey, message }, convertToMp4: false })
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json?.base64) return null;
    const mimeType = String(json.mimetype || "").split(";")[0] || (message?.audioMessage ? "audio/ogg" : "image/jpeg");
    const data = String(json.base64).replace(/^data:[^;]+;base64,/, "");
    return { mimeType, data };
  } catch {
    return null;
  }
}
var OPT_OUT_REGEX2 = /(não tenho interesse|nao tenho interesse|pare de (me )?mandar|para de (me )?mandar|pare de (me )?enviar|para de (me )?enviar|remove (meu|o meu) (contato|número|numero)|remover (meu )?contato|tirar (me|meu contato) da lista|não me (mande|envie|chame)|nao me (mande|envie|chame)|denunciar|desinscrever|me (tira|tire|remove) (daí|daqui|da lista)|nunca mais|^\s*(parar|stop|sair|cancelar)\s*[.!]*\s*$)/i;

// api/_handlers/messages.ts
async function handler3(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "GET") {
      let phone = req.query?.phone;
      if (!phone && req.url) {
        try {
          const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
          phone = parsed.searchParams.get("phone");
        } catch {
        }
      }
      const messages = await db.getMessages(phone ? String(phone) : void 0);
      return res.status(200).json({ messages });
    }
    if (req.method === "POST") {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const phone = body2.phone;
      const text = body2.text ?? body2.message;
      const from = body2.from ?? body2.sender ?? "operator";
      if (!phone || !text || !String(text).trim()) {
        return res.status(400).json({ error: "Telefone e texto da mensagem s\xE3o obrigat\xF3rios." });
      }
      const cleanPhone = formatPhoneNumber(phone);
      const contact = await db.getContactByPhone(cleanPhone);
      if (contact?.optOutDetected) {
        return res.status(400).json({ error: "Este contato solicitou Opt-Out (LGPD). O envio de novas mensagens est\xE1 bloqueado." });
      }
      let sendResult = { success: true, messageId: `direct-${Date.now()}` };
      if (!body2.directOnly) {
        const config = await db.getConfig();
        if ((config.activeGateway || "direct_pairing") === "direct_pairing") {
          sendResult = await sendEvolutionText(cleanPhone, String(text).trim(), 2e3);
        } else {
          sendResult = await sendWhatsAppTextMessage(cleanPhone, String(text).trim());
        }
      }
      const msg = {
        id: `msg-${Date.now()}`,
        contactPhone: cleanPhone,
        from: from === "lead" ? "lead" : "operator",
        text: text.trim(),
        type: "text",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        metaMessageId: sendResult.messageId,
        status: sendResult.success ? "sent" : "failed"
      };
      await db.saveMessage(msg);
      if (contact) {
        contact.lastInteractionAt = (/* @__PURE__ */ new Date()).toISOString();
        if (from === "operator") {
          contact.agentState = "human_takeover";
        }
        await db.saveContact(contact);
      }
      await db.addAuditLog({
        type: "human_message",
        phone: cleanPhone,
        summary: `Mensagem enviada por atendente humano para ${cleanPhone}: "${text.slice(0, 50)}..."`
      });
      return res.status(200).json({
        success: sendResult.success,
        message: msg,
        metaError: sendResult.error
      });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[API Messages Error]:", err);
    return res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
}

// api/_handlers/whatsapp-status.ts
async function handler4(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const config = getMetaConfig();
    const numberStatus = await getWhatsAppNumberStatus();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
    return res.status(200).json({
      metaConfigured: config.isConfigured,
      phoneNumberId: config.phoneNumberId,
      authorizedBusinessNumber: AUTHORIZED_BUSINESS_NUMBER,
      verifiedName: numberStatus.verifiedName || "Girofy Tecnologia",
      displayPhoneNumber: numberStatus.displayPhoneNumber || "+55 74 8812-6578",
      qualityRating: numberStatus.qualityRating || "UNKNOWN",
      geminiConfigured: hasGeminiKey,
      signatureValidationActive: Boolean(config.appSecret),
      metaError: numberStatus.error || null,
      environment: process.env.NODE_ENV || "production",
      serverTimestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Erro ao consultar status" });
  }
}

// api/_handlers/data-deletion.ts
async function handler5(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    let code = req.query?.code;
    if (!code && req.url) {
      try {
        const parsed = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
        code = parsed.searchParams.get("code");
      } catch {
      }
    }
    if (!code) {
      return res.status(400).json({ error: "C\xF3digo de confirma\xE7\xE3o de exclus\xE3o n\xE3o informado." });
    }
    const request = await db.getDeletionRequest(String(code));
    if (!request) {
      return res.status(404).json({ error: "Solicita\xE7\xE3o de exclus\xE3o n\xE3o encontrada." });
    }
    return res.status(200).json({
      confirmation_code: request.confirmationCode,
      status: request.status,
      requested_at: request.requestedAt,
      completed_at: request.completedAt || null,
      message: request.status === "completed" ? "Seus dados e hist\xF3rico de conversas foram exclu\xEDdos definitivamente dos servidores do Prospectfy." : "Solicita\xE7\xE3o recebida e em processamento conforme as diretrizes da LGPD."
    });
  }
  if (req.method === "POST") {
    try {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const identifier = body2?.identifier || body2?.phone || body2?.user_id;
      if (!identifier) {
        return res.status(400).json({
          error: "Identificador (n\xFAmero de telefone ou e-mail) obrigat\xF3rio para exclus\xE3o."
        });
      }
      const deletionReq = await db.createDeletionRequest(identifier, body2?.notes);
      const result = await db.executeDataDeletion(identifier);
      const host = req.headers?.host || "prospectfy.vercel.app";
      const protocol = req.headers?.["x-forwarded-proto"] || "https";
      const statusUrl = `${protocol}://${host}/data-deletion?code=${deletionReq.confirmationCode}`;
      return res.status(200).json({
        url: statusUrl,
        confirmation_code: deletionReq.confirmationCode,
        status: "completed",
        deleted_records: result.deletedCount,
        message: "Dados exclu\xEDdos com sucesso em cumprimento \xE0 LGPD."
      });
    } catch (err) {
      console.error("[Data Deletion Error]:", err);
      return res.status(500).json({ error: err?.message || "Falha ao processar solicita\xE7\xE3o de exclus\xE3o" });
    }
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}

// api/_handlers/audit-logs.ts
async function handler6(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const logs = await db.getAuditLogs(100);
    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Erro ao consultar logs de auditoria" });
  }
}

// api/_handlers/config.ts
function maskSecret(val) {
  if (!val || val.length < 8) return val ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "";
  return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
}
async function handler7(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "GET") {
      const cfg = await db.getConfig();
      const meta = getMetaConfig();
      const geminiKey = cfg.geminiApiKey || process.env.GEMINI_API_KEY || "";
      return res.status(200).json({
        metaConfigured: meta.isConfigured,
        geminiConfigured: Boolean(geminiKey.trim()),
        metaPhoneNumberId: meta.phoneNumberId,
        authorizedBusinessNumber: AUTHORIZED_BUSINESS_NUMBER,
        appId: DEFAULT_APP_ID,
        businessId: DEFAULT_BUSINESS_ID,
        webhookVerifyTokenMasked: maskSecret(meta.verifyToken),
        metaAccessTokenMasked: maskSecret(meta.token),
        metaAppSecretMasked: maskSecret(meta.appSecret),
        geminiApiKeyMasked: maskSecret(geminiKey),
        geminiModel: cfg.geminiModel || process.env.GEMINI_MODEL || "gemini-3.6-flash",
        autoReplyEnabled: meta.autoReplyEnabled,
        activeGateway: cfg.activeGateway || "direct_pairing",
        directPairingPhone: cfg.directPairingPhone || "",
        directPairingStatus: cfg.directPairingStatus || "disconnected",
        directPairingConnectedAt: cfg.directPairingConnectedAt || ""
      });
    }
    if (req.method === "POST") {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const updates = {};
      if (typeof body2.metaAccessToken === "string" && body2.metaAccessToken.trim()) {
        updates.metaAccessToken = body2.metaAccessToken.trim().replace(/^Bearer\s+/i, "");
      }
      if (typeof body2.metaPhoneNumberId === "string" && body2.metaPhoneNumberId.trim()) {
        updates.metaPhoneNumberId = body2.metaPhoneNumberId.trim();
      }
      if (typeof body2.metaAppSecret === "string") {
        updates.metaAppSecret = body2.metaAppSecret.trim();
      }
      if (typeof body2.webhookVerifyToken === "string" && body2.webhookVerifyToken.trim()) {
        updates.webhookVerifyToken = body2.webhookVerifyToken.trim();
      }
      if (typeof body2.geminiApiKey === "string" && body2.geminiApiKey.trim()) {
        updates.geminiApiKey = body2.geminiApiKey.trim();
      }
      if (typeof body2.geminiModel === "string" && body2.geminiModel.trim()) {
        updates.geminiModel = body2.geminiModel.trim();
      }
      if (typeof body2.autoReplyEnabled === "boolean") {
        updates.autoReplyEnabled = body2.autoReplyEnabled;
      }
      if (body2.activeGateway === "direct_pairing" || body2.activeGateway === "meta_cloud_api") {
        updates.activeGateway = body2.activeGateway;
      }
      if (typeof body2.directPairingPhone === "string" && body2.directPairingPhone.trim()) {
        updates.directPairingPhone = body2.directPairingPhone.trim();
      }
      const updated = await db.saveConfig(updates);
      const meta = getMetaConfig();
      const geminiKey = updated.geminiApiKey || process.env.GEMINI_API_KEY || "";
      return res.status(200).json({
        success: true,
        message: "Configura\xE7\xF5es atualizadas com sucesso.",
        metaConfigured: meta.isConfigured,
        geminiConfigured: Boolean(geminiKey.trim()),
        metaPhoneNumberId: meta.phoneNumberId,
        webhookVerifyToken: meta.verifyToken,
        metaAccessTokenMasked: maskSecret(meta.token),
        geminiApiKeyMasked: maskSecret(geminiKey),
        autoReplyEnabled: meta.autoReplyEnabled
      });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[API Config Error]:", err);
    return res.status(500).json({ error: err?.message || "Falha ao processar configura\xE7\xE3o." });
  }
}

// api/_handlers/pairing.ts
function exactPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}
function generatePairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${part1}-${part2}`;
}
async function handler8(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    const config = await db.getConfig();
    if (req.method === "GET") {
      return res.status(200).json({
        activeGateway: config.activeGateway || "direct_pairing",
        status: config.directPairingStatus || "connected",
        phoneNumber: config.directPairingPhone || "557488126578",
        pairingCode: config.directPairingCode || "",
        connectedAt: config.directPairingConnectedAt || (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (req.method === "POST") {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { action, phoneNumber, gateway } = body2;
      if (action === "request_code") {
        const rawPhone = phoneNumber || config.directPairingPhone || "557488126578";
        const cleanPhone = exactPhone(rawPhone);
        const evolutionUrl = body2.evolutionUrl || process.env.EVOLUTION_URL || "";
        const evolutionKey = body2.evolutionKey || process.env.EVOLUTION_API_KEY || "";
        const instanceName = body2.instanceName || process.env.EVOLUTION_INSTANCE || "prospectfy";
        let code = "";
        let isRealSocketCode = false;
        let gatewayNotice = "";
        if (evolutionUrl && evolutionKey) {
          try {
            const cleanUrl = evolutionUrl.replace(/\/+$/, "");
            try {
              await fetch(`${cleanUrl}/instance/create`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": evolutionKey
                },
                body: JSON.stringify({
                  instanceName,
                  qrcode: false,
                  integration: "WHATSAPP-BAILEYS",
                  number: cleanPhone
                })
              });
            } catch {
            }
            let connectRes = await fetch(`${cleanUrl}/instance/connect/${instanceName}?number=${cleanPhone}`, {
              method: "GET",
              headers: {
                "apikey": evolutionKey
              }
            });
            if (!connectRes.ok) {
              connectRes = await fetch(`${cleanUrl}/instance/connect/${instanceName}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": evolutionKey
                },
                body: JSON.stringify({ number: cleanPhone })
              });
            }
            if (connectRes.ok) {
              const data = await connectRes.json();
              const foundCode = data.pairingCode || data.code || data.pairing_code;
              if (foundCode) {
                code = foundCode;
                isRealSocketCode = true;
                gatewayNotice = "C\xF3digo real gerado via WebSocket do WhatsApp (Evolution API).";
              }
            }
          } catch (err) {
            console.warn("[Evolution Connect Warning]:", err?.message);
          }
        }
        if (!code) {
          code = generatePairingCode();
          gatewayNotice = "C\xF3digo local gerado. Nota: O WhatsApp exige conex\xE3o WebSocket ativa (Evolution API) ou Meta Plataforma Comercial para validar o pareamento no celular.";
        }
        const updated = await db.saveConfig({
          directPairingPhone: cleanPhone,
          directPairingCode: code,
          directPairingStatus: "pairing",
          activeGateway: "direct_pairing"
        });
        await db.addAuditLog({
          type: "status_change",
          phone: cleanPhone,
          summary: `C\xF3digo de pareamento solicitado: ${code}. ${gatewayNotice}`
        });
        return res.status(200).json({
          success: true,
          status: "pairing",
          pairingCode: code,
          phoneNumber: cleanPhone,
          isRealSocketCode,
          notice: gatewayNotice,
          message: "C\xF3digo de 8 d\xEDgitos gerado."
        });
      }
      if (action === "confirm_paired") {
        const cleanPhone = exactPhone(phoneNumber || config.directPairingPhone || "557488126578");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.saveConfig({
          directPairingPhone: cleanPhone,
          directPairingStatus: "connected",
          directPairingConnectedAt: now,
          activeGateway: "direct_pairing"
        });
        await db.addAuditLog({
          type: "status_change",
          phone: cleanPhone,
          summary: `WhatsApp Conex\xE3o Direta pareado com sucesso no celular para o n\xFAmero ${cleanPhone}.`
        });
        return res.status(200).json({
          success: true,
          status: "connected",
          phoneNumber: cleanPhone,
          connectedAt: now,
          activeGateway: "direct_pairing",
          message: "WhatsApp Business conectado com sucesso via c\xF3digo de pareamento!"
        });
      }
      if (action === "switch_gateway") {
        const targetGateway = gateway === "meta_cloud_api" ? "meta_cloud_api" : "direct_pairing";
        await db.saveConfig({ activeGateway: targetGateway });
        await db.addAuditLog({
          type: "status_change",
          summary: `Canal de envio alternado para: ${targetGateway === "meta_cloud_api" ? "Meta Cloud API (Oficial)" : "Conex\xE3o Direta por C\xF3digo (Celular)"}`
        });
        return res.status(200).json({
          success: true,
          activeGateway: targetGateway,
          message: `Canal ativo alterado para ${targetGateway === "meta_cloud_api" ? "Meta Cloud API" : "Conex\xE3o Direta"}.`
        });
      }
      if (action === "disconnect") {
        await db.saveConfig({
          directPairingStatus: "disconnected",
          directPairingCode: ""
        });
        await db.addAuditLog({
          type: "status_change",
          summary: "WhatsApp desvinculado da sess\xE3o direta."
        });
        return res.status(200).json({
          success: true,
          status: "disconnected",
          message: "Sess\xE3o direta desconectada."
        });
      }
      return res.status(400).json({ error: "A\xE7\xE3o inv\xE1lida especificada." });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[Pairing API Error]:", err);
    return res.status(500).json({ error: err?.message || "Erro interno no gateway de pareamento." });
  }
}

// api/_handlers/campaign.ts
async function handler9(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "GET") {
      const contacts = await db.getContacts();
      const repliedPhones = await db.getRepliedPhones();
      const dispatched = contacts.filter((c) => c.status !== "novo");
      const responded = dispatched.filter((c) => repliedPhones.has(c.phone));
      return res.status(200).json({
        totalContacts: contacts.length,
        dispatchedCount: dispatched.length,
        respondedCount: responded.length,
        responseRate: dispatched.length > 0 ? Math.round(responded.length / dispatched.length * 100) : 0
      });
    }
    if (req.method === "POST") {
      const body2 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const leads = Array.isArray(body2.leads) ? body2.leads : [];
      if (leads.length === 0) {
        return res.status(400).json({ error: "Envie uma lista de contatos para enfileirar." });
      }
      if (leads.length > 500) {
        return res.status(400).json({ error: "M\xE1ximo de 500 contatos por envio." });
      }
      const enqueued = [];
      const skipped = [];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const item of leads) {
        const cleanPhone = formatPhoneNumber(String(item.phone || ""));
        if (!cleanPhone || cleanPhone.length < 12) {
          skipped.push({ phone: String(item.phone || ""), motivo: "telefone inv\xE1lido" });
          continue;
        }
        const existing = await db.getContactByPhone(cleanPhone);
        if (existing?.optOutDetected || existing?.status === "bloqueado") {
          skipped.push({ phone: cleanPhone, motivo: "opt-out (pediu para sair)" });
          continue;
        }
        if (existing && existing.status !== "novo") {
          skipped.push({ phone: cleanPhone, motivo: `j\xE1 prospectado (${existing.status})` });
          continue;
        }
        const contact = {
          id: existing?.id || `lead-${cleanPhone}`,
          phone: cleanPhone,
          name: item.name || existing?.name || "",
          company: item.company || existing?.company || "Em qualifica\xE7\xE3o",
          niche: item.niche || existing?.niche || void 0,
          role: "decisor",
          status: "novo",
          agentState: "ai_active",
          optOutDetected: false,
          lastInteractionAt: now,
          createdAt: existing?.createdAt || now
        };
        await db.saveContact(contact);
        enqueued.push(cleanPhone);
      }
      await db.addAuditLog({
        type: "status_change",
        summary: `${enqueued.length} contatos enfileirados para prospec\xE7\xE3o; ${skipped.length} pulados.`,
        details: { enqueued: enqueued.length, skipped: skipped.length }
      });
      return res.status(200).json({
        success: true,
        enqueued: enqueued.length,
        skipped,
        message: `${enqueued.length} contatos entraram na fila. O agente envia no hor\xE1rio, respeitando o teto di\xE1rio.`
      });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[Campaign API Error]:", err);
    return res.status(500).json({ error: err?.message || "Falha ao enfileirar contatos." });
  }
}

// api/lib/prospector.ts
var TZ = "America/Bahia";
var WINDOW_START = Number(process.env.PROSPECTOR_START_HOUR ?? 8);
var WINDOW_END = Number(process.env.PROSPECTOR_END_HOUR ?? 19);
var MIN_GAP_S = Number(process.env.PROSPECTOR_MIN_GAP_S ?? 120);
var MAX_GAP_S = Number(process.env.PROSPECTOR_MAX_GAP_S ?? 420);
var DAILY_CAP = Number(process.env.PROSPECTOR_DAILY_CAP ?? 40);
var TICK_MS = 15e3;
function bahiaNow(d = /* @__PURE__ */ new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
var rand = (min, max) => min + Math.random() * (max - min);
var BUSINESS_WORDS = /(ltda|\bme\b|eireli|restaurante|pizza|burger|barbearia|festas?|buffet|loja|mercado|mec[aâ]nica|oficina|cl[ií]nica|studio|est[uú]dio|empresa|com[eé]rcio|constru|imobili|hotel|pousada|lanchonete|padaria|academia|sal[aã]o|distribuidora|contab|advoc|escola|farm[aá]cia|auto|motos?|tech|digital|girofy|lead|contato|cliente|servi[cç]os?|solu[cç][oõ]es|atacado|varejo|bar\b|a[cç]ougue|pet|the\b)/i;
function personFirstName(name) {
  const n = (name || "").trim();
  if (!n || n.length > 30) return null;
  if (BUSINESS_WORDS.test(n)) return null;
  if (!/^[A-Za-zÀ-ú]+( [A-Za-zÀ-ú]+)?$/.test(n)) return null;
  const first = n.split(" ")[0];
  if (first !== first[0].toUpperCase() + first.slice(1).toLowerCase() && first.toUpperCase() === first) return null;
  return first;
}
function buildOpener(contact, hour) {
  const greeting = hour < 12 ? "Bom dia" : "Boa tarde";
  const first = personFirstName(contact.name);
  return first ? `${greeting}, ${first}!` : `${greeting}!`;
}
function isEligible(c) {
  return c.status === "novo" && c.agentState === "ai_active" && !c.optOutDetected && [12, 13].includes(c.phone.replace(/\D/g, "").length);
}
async function getProspectStats() {
  const contacts = await db.getContacts();
  const cfg = await db.getConfig();
  const { day, hour } = bahiaNow();
  const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
  const repliedPhones = await db.getRepliedPhones();
  return {
    enabled: process.env.PROSPECTOR_ENABLED !== "false",
    evolutionConfigured: !!getEvolutionCfg(),
    inWindow: hour >= WINDOW_START && hour < WINDOW_END,
    window: `${WINDOW_START}h-${WINDOW_END}h (America/Bahia)`,
    sentToday,
    dailyCap: DAILY_CAP,
    queue: contacts.filter(isEligible).length,
    inConversation: contacts.filter((c) => c.status === "em_conversa").length,
    replied: contacts.filter((c) => repliedPhones.has(c.phone)).length,
    totalContacts: contacts.length
  };
}
var nextAt = 0;
var running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    if (Date.now() < nextAt) return;
    if (!getEvolutionCfg()) return;
    const { day, hour } = bahiaNow();
    if (hour < WINDOW_START || hour >= WINDOW_END) return;
    const cfg = await db.getConfig();
    const sentToday = cfg.prospectDay === day ? cfg.prospectSentToday || 0 : 0;
    if (sentToday >= DAILY_CAP) return;
    const queue = (await db.getContacts()).filter(isEligible).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const contact = queue[0];
    if (!contact) return;
    const text = buildOpener(contact, hour);
    const res = await sendEvolutionText(contact.phone, text, 2500);
    if (!res.success) {
      nextAt = Date.now() + 5 * 6e4;
      await db.addAuditLog({
        type: "error",
        phone: contact.phone,
        summary: `Falha ao enviar abordagem para ${contact.phone}: ${res.error}`
      });
      return;
    }
    nextAt = Date.now() + rand(MIN_GAP_S, MAX_GAP_S) * 1e3;
    if (res.messageId) await db.markMessageAsProcessed(res.messageId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.saveMessage({
      id: `out-prospect-${res.messageId || Date.now()}`,
      contactPhone: contact.phone,
      from: "bot",
      text,
      type: "text",
      timestamp: now,
      metaMessageId: res.messageId,
      status: "sent"
    });
    await db.saveContact({ ...contact, status: "em_conversa", lastInteractionAt: now });
    await db.saveConfig({ prospectDay: day, prospectSentToday: sentToday + 1 });
    await db.addAuditLog({
      type: "ai_reply",
      phone: contact.phone,
      summary: `Abordagem ${sentToday + 1}/${DAILY_CAP} enviada: "${text}"`
    });
  } catch (err) {
    console.error("[Prospector] tick falhou:", err);
  } finally {
    running = false;
  }
}
function startProspector() {
  if (process.env.PROSPECTOR_ENABLED === "false") {
    console.log("[Prospector] desativado (PROSPECTOR_ENABLED=false)");
    return;
  }
  if (!getEvolutionCfg()) {
    console.warn("[Prospector] EVOLUTION_URL/EVOLUTION_API_KEY ausentes: loop iniciado, mas sem envio.");
  }
  setInterval(tick, TICK_MS);
  console.log(
    `[Prospector] ativo. Janela ${WINDOW_START}h-${WINDOW_END}h, teto ${DAILY_CAP}/dia, intervalo ${MIN_GAP_S}-${MAX_GAP_S}s`
  );
}

// api/_handlers/evolution-webhook.ts
function labelOf(message) {
  if (!message) return null;
  if (message.conversation) return String(message.conversation).trim();
  if (message.extendedTextMessage?.text) return String(message.extendedTextMessage.text).trim();
  if (message.audioMessage) return "[\xC1udio]";
  if (message.imageMessage) return message.imageMessage.caption ? `[Imagem] ${message.imageMessage.caption}` : "[Imagem]";
  if (message.documentMessage) return "[Documento]";
  return null;
}
function mediaKindOf(message) {
  if (message?.audioMessage) return "audio";
  if (message?.imageMessage) return "image";
  return null;
}
async function handleUpsert(d) {
  const key = d?.key;
  if (!key) return;
  const jid = String(key.remoteJid || "");
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return;
  const sourceJid = key.remoteJidAlt || jid;
  if (sourceJid.endsWith("@lid")) {
    console.warn(`[Evolution] JID LID sem n\xFAmero real, ignorado: ${sourceJid}`);
    return;
  }
  const phone = formatPhoneNumber(sourceJid.split("@")[0]);
  const msgId = String(key.id || "");
  if (!msgId || await db.hasProcessedMessage(msgId)) return;
  await db.markMessageAsProcessed(msgId);
  const text = labelOf(d.message);
  if (!text) return;
  const mediaKind = mediaKindOf(d.message);
  if (key.fromMe) {
    await db.saveMessage({
      id: `op-${msgId}`,
      contactPhone: phone,
      from: "operator",
      text,
      type: "text",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metaMessageId: msgId,
      status: "sent"
    });
    return;
  }
  const history = await db.getMessages(phone);
  let contact = await db.getContactByPhone(phone);
  if (!contact) {
    contact = await db.saveContact({
      id: `contact-${phone}`,
      phone,
      name: d.pushName || `Contato ${phone.slice(-4)}`,
      company: "Em qualifica\xE7\xE3o",
      role: "decisor",
      status: "em_conversa",
      agentState: "ai_active",
      optOutDetected: false,
      lastInteractionAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.saveMessage({
    id: `in-${msgId}`,
    contactPhone: phone,
    from: "lead",
    text,
    type: "text",
    timestamp: now,
    metaMessageId: msgId,
    status: "received"
  });
  if (OPT_OUT_REGEX2.test(text)) {
    await db.saveContact({
      ...contact,
      status: "bloqueado",
      optOutDetected: true,
      optOutReason: "Solicita\xE7\xE3o expl\xEDcita do titular (Opt-Out LGPD)",
      agentState: "paused",
      lastInteractionAt: now
    });
    await db.addAuditLog({ type: "opt_out", phone, summary: `Opt-out registrado para ${phone}: "${text}"` });
    return;
  }
  if (contact.optOutDetected || contact.agentState !== "ai_active") return;
  if (contact.status === "novo") {
    contact = await db.saveContact({ ...contact, status: "em_conversa", lastInteractionAt: now });
  }
  let media;
  if (mediaKind) {
    const got = await fetchEvolutionMedia({ id: msgId, remoteJid: jid, fromMe: false }, d.message);
    if (got) media = got;
  }
  const ai = await generateGirofyCommercialReply(contact, { text, media }, history);
  if (!ai.aiAvailable) {
    await db.saveContact({ ...contact, status: "aguardando_humano", lastInteractionAt: now });
    const why = ai.unavailableReason === "quota" ? "cota di\xE1ria da IA atingida" : ai.unavailableReason === "no_key" ? "chave da IA n\xE3o configurada" : "erro da IA";
    await db.addAuditLog({ type: "error", phone, summary: `IA n\xE3o respondeu (${why}). Aguardando voc\xEA: ${phone}.` });
    return;
  }
  if (ai.transferToHuman) {
    await db.saveContact({ ...contact, agentState: "human_takeover", status: "aguardando_humano", lastInteractionAt: now });
    await db.addAuditLog({
      type: "status_change",
      phone,
      summary: `Transferido para humano: ${ai.transferReason || "complexidade da negocia\xE7\xE3o"}`
    });
  } else if (ai.isMeetingRequested) {
    await db.saveContact({ ...contact, status: "reuniao_marcada", lastInteractionAt: now });
  }
  const send = await sendEvolutionText(phone, ai.replyText, 3e3);
  if (send.success) {
    if (send.messageId) await db.markMessageAsProcessed(send.messageId);
    await db.saveMessage({
      id: `out-${send.messageId || Date.now()}`,
      contactPhone: phone,
      from: "bot",
      text: ai.replyText,
      type: "text",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metaMessageId: send.messageId,
      status: "sent"
    });
  } else {
    await db.addAuditLog({ type: "error", phone, summary: `Falha ao responder ${phone}: ${send.error}` });
  }
}
async function handler10(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json(await getProspectStats());
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const token = new URL(req.url || "/", "http://localhost").searchParams.get("token");
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  if (expected && token !== expected) {
    return res.status(401).json({ error: "Token inv\xE1lido" });
  }
  const body2 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  res.status(200).json({ ok: true });
  const event = String(body2.event || "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return;
  const items = Array.isArray(body2.data) ? body2.data : [body2.data];
  for (const item of items) {
    try {
      await handleUpsert(item);
    } catch (err) {
      console.error("[Evolution Webhook] erro ao processar mensagem:", err);
    }
  }
}

// api/lib/auth.ts
import crypto2 from "crypto";
function secret() {
  const pwd = (process.env.ADMIN_PASSWORD || "").trim();
  return pwd.length >= 8 ? pwd : null;
}
function issueToken() {
  const s = secret();
  if (!s) return null;
  return crypto2.createHmac("sha256", s).update("painel-girofy-v1").digest("hex");
}
function checkPassword(candidate) {
  const s = secret();
  if (!s || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(s);
  return a.length === b.length && crypto2.timingSafeEqual(a, b);
}
function isAuthorized(req) {
  const token = issueToken();
  if (!token) return false;
  const header = String(req.headers?.authorization || "");
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  return bearer.length > 0 && bearer.length === token.length && crypto2.timingSafeEqual(Buffer.from(bearer), Buffer.from(token));
}

// api/_handlers/login.ts
var attempts = /* @__PURE__ */ new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur || cur.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 15 * 6e4 });
    return false;
  }
  cur.count += 1;
  return cur.count > 10;
}
async function handler11(req, res) {
  if (req.method === "GET") {
    const token2 = issueToken();
    const ok = !!token2 && String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim() === token2;
    return res.status(ok ? 200 : 401).json({ authenticated: ok, configured: !!token2 });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const ip = String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: "Muitas tentativas. Espere 15 minutos." });
  }
  const body2 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const token = issueToken();
  if (!token) {
    return res.status(503).json({ error: "Painel sem senha configurada (ADMIN_PASSWORD no servidor)." });
  }
  if (!checkPassword(String(body2.password || ""))) {
    return res.status(401).json({ error: "Senha incorreta." });
  }
  return res.status(200).json({ token });
}

// api/_handlers/learnings.ts
async function handler12(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const [learnings, stats] = await Promise.all([db.getRecentLearnings(50), getProspectStats()]);
    const byOutcome = {};
    for (const l of learnings) byOutcome[l.outcome] = (byOutcome[l.outcome] || 0) + 1;
    return res.status(200).json({ funnel: stats, byOutcome, learnings });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Falha ao ler aprendizado." });
  }
}

// api/_handlers/knowledge.ts
var MAX_DOC_CHARS = 6e4;
function body(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
}
async function handler13(req, res) {
  const path3 = String(req.url || "").split("?")[0].replace(/\/+$/, "");
  try {
    if (req.method === "GET") {
      const docs = await db.listKnowledge();
      const totalChars = docs.filter((d) => d.active).reduce((n, d) => n + d.content.length, 0);
      return res.status(200).json({ docs, totalChars });
    }
    if (req.method === "POST" && path3 === "/api/knowledge") {
      const b = body(req);
      const title = String(b.title || "").trim().slice(0, 120);
      const content = String(b.content || "").trim();
      if (!title || !content) return res.status(400).json({ error: "D\xEA um t\xEDtulo e cole ou envie o conte\xFAdo." });
      if (content.length > MAX_DOC_CHARS) {
        return res.status(400).json({ error: `Documento muito grande (m\xE1ximo ${MAX_DOC_CHARS} caracteres). Divida em partes.` });
      }
      await db.saveKnowledge(title, content);
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }
    if (req.method === "POST" && path3 === "/api/knowledge/toggle") {
      const b = body(req);
      await db.setKnowledgeActive(Number(b.id), Boolean(b.active));
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }
    if (req.method === "POST" && path3 === "/api/knowledge/delete") {
      const b = body(req);
      await db.deleteKnowledge(Number(b.id));
      clearKnowledgeCache();
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[Knowledge API]", err);
    return res.status(500).json({ error: err?.message || "Falha na base de conhecimento." });
  }
}

// api/_handlers/metrics.ts
function bahiaHour(iso) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bahia", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return Number(h);
}
function bahiaDay(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
async function allRows(table, cols) {
  const rows = [];
  for (let from = 0; ; from += 1e3) {
    const { data, error } = await supabase().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1e3) break;
  }
  return rows;
}
async function handler14(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const [contacts, messages, learnings] = await Promise.all([
      allRows("contacts", "phone, status, opt_out_detected, created_at"),
      allRows("messages", 'contact_phone, "from", type, "timestamp"'),
      allRows("learnings", "outcome, created_at")
    ]);
    const byPhone = /* @__PURE__ */ new Map();
    for (const m of messages) {
      const c = byPhone.get(m.contact_phone) || { bot: 0, operator: 0, lead: 0, audio: 0, image: 0, first: m.timestamp, last: m.timestamp, firstFrom: m.from };
      if (m.from === "bot") c.bot++;
      else if (m.from === "operator") c.operator++;
      else c.lead++;
      if (m.type === "audio") c.audio++;
      if (m.type === "image") c.image++;
      if (m.timestamp < c.first) {
        c.first = m.timestamp;
        c.firstFrom = m.from;
      }
      if (m.timestamp > c.last) c.last = m.timestamp;
      byPhone.set(m.contact_phone, c);
    }
    const conversas = [...byPhone.values()];
    const comTroca = conversas.filter((c) => c.lead > 0 && (c.bot > 0 || c.operator > 0));
    const iniciadasPorNos = conversas.filter((c) => c.firstFrom !== "lead" && (c.bot > 0 || c.operator > 0)).length;
    const responderam = conversas.filter((c) => c.firstFrom !== "lead" && c.lead > 0).length;
    const porHora = Array(24).fill(0);
    const porDia = {};
    for (const m of messages) {
      const dia = bahiaDay(m.timestamp);
      porDia[dia] = porDia[dia] || { enviadas: 0, respostas: 0 };
      if (m.from === "lead") {
        porHora[bahiaHour(m.timestamp)]++;
        porDia[dia].respostas++;
      } else {
        porDia[dia].enviadas++;
      }
    }
    const agenteIniciou = conversas.filter((c) => c.firstFrom === "bot").length;
    const agenteRespondido = conversas.filter((c) => c.firstFrom === "bot" && c.lead > 0).length;
    const manualIniciou = conversas.filter((c) => c.firstFrom === "operator").length;
    const status = {};
    for (const c of contacts) status[c.status] = (status[c.status] || 0) + 1;
    const desfechos = {};
    for (const l of learnings) desfechos[l.outcome] = (desfechos[l.outcome] || 0) + 1;
    const porTelefone = /* @__PURE__ */ new Map();
    for (const m of messages) {
      const arr = porTelefone.get(m.contact_phone) || [];
      arr.push(m);
      porTelefone.set(m.contact_phone, arr);
    }
    const tempos = [];
    for (const arr of porTelefone.values()) {
      arr.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
      const primeiraNossa = arr.find((m) => m.from !== "lead");
      if (!primeiraNossa) continue;
      const primeiraResposta = arr.find((m) => m.from === "lead" && m.timestamp > primeiraNossa.timestamp);
      if (primeiraResposta) {
        tempos.push((Date.parse(primeiraResposta.timestamp) - Date.parse(primeiraNossa.timestamp)) / 6e4);
      }
    }
    tempos.sort((a, b) => a - b);
    const mediana = tempos.length ? Math.round(tempos[Math.floor(tempos.length / 2)]) : null;
    const audios = messages.filter((m) => m.type === "audio" && m.from === "lead").length;
    const imagens = messages.filter((m) => m.type === "image" && m.from === "lead").length;
    return res.status(200).json({
      resumo: {
        contatos: contacts.length,
        conversas_iniciadas: iniciadasPorNos,
        conversas_com_resposta: responderam,
        taxa_de_resposta: iniciadasPorNos ? Math.round(responderam / iniciadasPorNos * 100) : 0,
        conversas_com_troca: comTroca.length,
        mensagens_totais: messages.length,
        opt_outs: contacts.filter((c) => c.opt_out_detected).length,
        iniciadas_pelo_agente: agenteIniciou,
        respostas_ao_agente: agenteRespondido,
        taxa_do_agente: agenteIniciou ? Math.round(agenteRespondido / agenteIniciou * 100) : 0,
        iniciadas_manualmente: manualIniciou,
        mediana_minutos_ate_resposta: mediana,
        audios_recebidos: audios,
        imagens_recebidas: imagens
      },
      status,
      desfechos,
      porHora,
      porDia: Object.entries(porDia).sort(([a], [b]) => a < b ? -1 : 1).slice(-30).map(([dia, v]) => ({ dia, ...v }))
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Falha ao calcular m\xE9tricas." });
  }
}

// api/_handlers/export.ts
var LABEL = { lead: "Contato", bot: "Agente IA", operator: "C\xE9sar" };
function bahia(iso) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(new Date(iso));
}
async function allRows2(table, cols) {
  const rows = [];
  for (let from = 0; ; from += 1e3) {
    const { data, error } = await supabase().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1e3) break;
  }
  return rows;
}
function csvCell(v) {
  const s = v === null || v === void 0 ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
async function handler15(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const format = (url.searchParams.get("format") || "csv").toLowerCase();
    const [contacts, messages] = await Promise.all([
      allRows2("contacts", "phone, name, company, niche, status, created_at"),
      allRows2("messages", 'contact_phone, "from", type, text, "timestamp"')
    ]);
    const byPhone = new Map(contacts.map((c) => [c.phone, c]));
    const rows = messages.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1).map((m) => {
      const c = byPhone.get(m.contact_phone) || {};
      return {
        contato: c.name || "",
        empresa: c.company || "",
        nicho: c.niche || "",
        telefone: m.contact_phone,
        status_atual: c.status || "",
        quem_falou: LABEL[m.from] || m.from,
        tipo: m.type || "text",
        quando: bahia(m.timestamp),
        texto: m.text || ""
      };
    });
    const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="conversas-girofy-${stamp}.json"`);
      return res.status(200).end(JSON.stringify(rows, null, 2));
    }
    const header = Object.keys(rows[0] || { contato: "", telefone: "", quem_falou: "", quando: "", texto: "" });
    const lines = [header.join(";"), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(";"))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="conversas-girofy-${stamp}.csv"`);
    return res.status(200).end("\uFEFF" + lines.join("\r\n"));
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Falha ao exportar." });
  }
}

// api/index.ts
var PUBLIC_ROUTES = {
  "/api/login": handler11,
  "/api/evolution/webhook": handler10,
  "/api/webhook": handler,
  "/api/data-deletion": handler5
};
var PROTECTED_ROUTES = {
  "/api/contacts": handler2,
  "/api/contacts/create": handler2,
  "/api/contacts/update-agent": handler2,
  "/api/messages": handler3,
  "/api/messages/send": handler3,
  "/api/whatsapp-status": handler4,
  "/api/audit-logs": handler6,
  "/api/config": handler7,
  "/api/pairing": handler8,
  "/api/campaign": handler9,
  "/api/learnings": handler12,
  "/api/knowledge": handler13,
  "/api/metrics": handler14,
  "/api/export": handler15
};
var PUBLIC_GET_ROUTES = {
  "/api/prospector": handler10
};
function match(table, urlPath) {
  if (table[urlPath]) return table[urlPath];
  for (const [route, fn] of Object.entries(table)) {
    if (urlPath.startsWith(`${route}/`)) return fn;
  }
  return null;
}
async function handler16(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-hub-signature-256");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  const rawUrl = req.url || "/api";
  const pathname = rawUrl.split("?")[0];
  const urlPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const pub = match(PUBLIC_ROUTES, urlPath);
  if (pub) return pub(req, res);
  if (req.method === "GET") {
    const pubGet = match(PUBLIC_GET_ROUTES, urlPath);
    if (pubGet) return pubGet(req, res);
  }
  const prot = match(PROTECTED_ROUTES, urlPath);
  if (prot) {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "N\xE3o autorizado. Fa\xE7a login no painel." });
    }
    return prot(req, res);
  }
  return res.status(404).json({ error: "Endpoint n\xE3o encontrado", path: urlPath });
}

// api/lib/learning.ts
import { GoogleGenAI as GoogleGenAI2 } from "@google/genai";
var LEARNING_MODEL = "gemini-3.6-flash";
var MAX_PER_PASS = Number(process.env.LEARNING_MAX_PER_PASS ?? 5);
var CLOSED_STATUSES = /* @__PURE__ */ new Set(["reuniao_marcada", "aguardando_humano", "esfriou", "bloqueado"]);
function transcript(msgs) {
  return msgs.slice(-30).map((m) => `${m.from === "bot" ? "Assistente" : m.from === "operator" ? "C\xE9sar" : "Pessoa"}: ${m.text}`).join("\n");
}
function outcomeOf(c, msgs) {
  if (c.status === "reuniao_marcada") return "reuniao";
  if (c.optOutDetected || c.status === "bloqueado") return "opt_out";
  if (!msgs.some((m) => m.from === "lead")) return "sem_resposta";
  if (c.status === "aguardando_humano") return "passou_para_humano";
  return "esfriou";
}
async function runLearningPass() {
  const contacts = await db.getContacts();
  const learned = await db.getLearnedPhonesSince(new Date(Date.now() - 14 * 864e5).toISOString());
  const candidates = contacts.filter((c) => CLOSED_STATUSES.has(c.status) || c.status === "em_conversa").filter((c) => !learned.has(c.phone));
  if (candidates.length === 0) return 0;
  const cfg = await db.getConfig();
  const apiKey = (cfg.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return 0;
  const ai = new GoogleGenAI2({ apiKey });
  let saved = 0;
  for (const c of candidates) {
    if (saved >= MAX_PER_PASS) break;
    const msgs = await db.getMessages(c.phone);
    if (msgs.length < 2 || !msgs.some((m) => m.from === "lead")) continue;
    if (!await reserveAiCall()) break;
    const outcome = outcomeOf(c, msgs);
    const prompt = `Voc\xEA analisa uma conversa de prospec\xE7\xE3o por WhatsApp feita por um assistente de IA da Girofy (engenharia digital para neg\xF3cios locais). Desfecho registrado: ${outcome}.

Conversa:
${transcript(msgs)}

Responda SOMENTE um JSON com as chaves:
- "worked": o que na conversa funcionou (frase curta, ou "-")
- "failed": o que n\xE3o funcionou ou afastou a pessoa (frase curta, ou "-")
- "why": por que voc\xEA acha que aconteceu (uma frase)
- "opener_style": o estilo da primeira mensagem que deu resposta (uma frase, ou "-")
Sem texto fora do JSON. Sem inventar fatos que n\xE3o est\xE3o na conversa.`;
    try {
      const res = await ai.models.generateContent({
        model: LEARNING_MODEL,
        contents: prompt,
        config: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
      });
      const parsed = JSON.parse(res.text || "{}");
      await db.saveLearning({
        contactPhone: c.phone,
        outcome,
        worked: String(parsed.worked || "-").slice(0, 300),
        failed: String(parsed.failed || "-").slice(0, 300),
        why: String(parsed.why || "-").slice(0, 300),
        openerStyle: String(parsed.opener_style || "-").slice(0, 200)
      });
      saved += 1;
    } catch (err) {
      console.warn("[Learning] falha numa conversa:", err?.message || err);
    }
  }
  return saved;
}
function startLearning(everyMs = 6 * 36e5) {
  if (process.env.LEARNING_ENABLED === "false") return;
  setInterval(() => {
    runLearningPass().catch((err) => console.warn("[Learning] passe falhou:", err));
  }, everyMs);
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var DIST_DIR = path2.resolve(__dirname, "dist");
var PORT = process.env.PORT || 3e3;
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};
function serveStatic(res, filePath, defaultStatus = 200) {
  try {
    if (!fs2.existsSync(filePath) || fs2.statSync(filePath).isDirectory()) {
      return false;
    }
    const ext = path2.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const data = fs2.readFileSync(filePath);
    res.writeHead(defaultStatus, { "Content-Type": contentType });
    res.end(data);
    return true;
  } catch (err) {
    return false;
  }
}
var server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  const pathname = url.split("?")[0];
  const resCompat = res;
  resCompat.status = (code) => {
    res.statusCode = code;
    return resCompat;
  };
  resCompat.json = (data) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
    return resCompat;
  };
  resCompat.send = (data) => {
    if (typeof data === "object") {
      return resCompat.json(data);
    }
    res.end(data);
    return resCompat;
  };
  if (pathname.startsWith("/api")) {
    let bodyData = "";
    req.on("data", (chunk) => {
      bodyData += chunk;
    });
    req.on("end", async () => {
      try {
        if (bodyData && (req.headers["content-type"] || "").includes("application/json")) {
          req.body = JSON.parse(bodyData);
        } else {
          req.body = bodyData;
        }
      } catch {
        req.body = bodyData;
      }
      try {
        await handler16(req, resCompat);
      } catch (err) {
        console.error("[Server API Error]:", err);
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err?.message || "Internal Server Error" }));
        }
      }
    });
    return;
  }
  const potentialFile = path2.join(DIST_DIR, pathname);
  if (serveStatic(res, potentialFile)) {
    return;
  }
  const indexPath = path2.join(DIST_DIR, "index.html");
  if (serveStatic(res, indexPath)) {
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});
server.listen(PORT, () => {
  console.log(`[Prospectfy Production Server] running on http://0.0.0.0:${PORT}`);
  startProspector();
  startLearning();
});
