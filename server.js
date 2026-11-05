// server.ts
import http from "http";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

// api/lib/db.ts
import fs from "fs";
import path from "path";
var DB_FILE_PATH = path.resolve(process.env.DATA_DIR || "/tmp", "prospectfy_db.json");
var INITIAL_DATA = {
  contacts: {},
  messages: [],
  processedMessageIds: [],
  auditLogs: [],
  deletionRequests: {},
  config: {
    metaPhoneNumberId: "1221241567748320",
    webhookVerifyToken: "impossivel2008",
    geminiModel: "gemini-2.5-flash",
    autoReplyEnabled: true,
    activeGateway: "direct_pairing",
    directPairingPhone: "557488126578",
    directPairingCode: "",
    directPairingStatus: "connected",
    directPairingConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
};
var memoryCache = null;
function loadDatabase() {
  if (memoryCache) {
    return memoryCache;
  }
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      memoryCache = JSON.parse(raw);
      return memoryCache;
    }
  } catch (err) {
    console.warn("[DB] Could not load persisted file, initializing empty store:", err);
  }
  memoryCache = JSON.parse(JSON.stringify(INITIAL_DATA));
  saveDatabase(memoryCache);
  return memoryCache;
}
function saveDatabase(data) {
  memoryCache = data;
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB] Failed to persist data to disk:", err);
  }
}
var db = {
  // --- Contacts ---
  async getContacts() {
    const data = loadDatabase();
    return Object.values(data.contacts).sort(
      (a, b) => new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()
    );
  },
  async getContactByPhone(phone) {
    const clean = phone.replace(/\D/g, "");
    const data = loadDatabase();
    return data.contacts[clean] || null;
  },
  async saveContact(contact) {
    const clean = contact.phone.replace(/\D/g, "");
    const data = loadDatabase();
    const existing = data.contacts[clean];
    const updated = {
      ...existing,
      ...contact,
      phone: clean,
      createdAt: existing ? existing.createdAt : contact.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      lastInteractionAt: contact.lastInteractionAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    data.contacts[clean] = updated;
    saveDatabase(data);
    return updated;
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
    const data = loadDatabase();
    const count = Object.keys(data.contacts).length;
    data.contacts = {};
    data.messages = [];
    saveDatabase(data);
    await this.addAuditLog({
      type: "status_change",
      summary: `Todos os ${count} leads e mensagens foram removidos do CRM a pedido do usu\xE1rio.`
    });
    return count;
  },
  async batchSaveContacts(contactsList) {
    const data = loadDatabase();
    const results = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const item of contactsList) {
      const clean = item.phone.replace(/\D/g, "");
      if (!clean || clean.length < 10) continue;
      const existing = data.contacts[clean];
      const updated = {
        ...existing,
        ...item,
        phone: clean,
        createdAt: existing?.createdAt || item.createdAt || now,
        lastInteractionAt: now
      };
      data.contacts[clean] = updated;
      results.push(updated);
    }
    saveDatabase(data);
    await this.addAuditLog({
      type: "status_change",
      summary: `${results.length} contatos importados e salvos com sucesso no CRM via arquivo.`
    });
    return results;
  },
  // --- Messages ---
  async getMessages(phone) {
    const data = loadDatabase();
    if (!phone) {
      return [...data.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    const clean = phone.replace(/\D/g, "");
    return data.messages.filter((m) => m.contactPhone.replace(/\D/g, "") === clean).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },
  async saveMessage(message) {
    const cleanPhone = message.contactPhone.replace(/\D/g, "");
    const data = loadDatabase();
    const msgToSave = {
      ...message,
      contactPhone: cleanPhone,
      timestamp: message.timestamp || (/* @__PURE__ */ new Date()).toISOString()
    };
    const existingIdx = data.messages.findIndex((m) => m.id === msgToSave.id);
    if (existingIdx >= 0) {
      data.messages[existingIdx] = msgToSave;
    } else {
      data.messages.push(msgToSave);
    }
    if (data.messages.length > 2e3) {
      data.messages = data.messages.slice(-2e3);
    }
    saveDatabase(data);
    return msgToSave;
  },
  // --- Webhook Idempotency ---
  async hasProcessedMessage(metaMessageId) {
    if (!metaMessageId) return false;
    const data = loadDatabase();
    return data.processedMessageIds.includes(metaMessageId);
  },
  async markMessageAsProcessed(metaMessageId) {
    if (!metaMessageId) return;
    const data = loadDatabase();
    if (!data.processedMessageIds.includes(metaMessageId)) {
      data.processedMessageIds.push(metaMessageId);
      if (data.processedMessageIds.length > 1e3) {
        data.processedMessageIds = data.processedMessageIds.slice(-1e3);
      }
      saveDatabase(data);
    }
  },
  // --- Audit Logs ---
  async addAuditLog(log) {
    const data = loadDatabase();
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...log
    };
    data.auditLogs.unshift(entry);
    if (data.auditLogs.length > 500) {
      data.auditLogs = data.auditLogs.slice(0, 500);
    }
    saveDatabase(data);
    return entry;
  },
  async getAuditLogs(limit = 100) {
    const data = loadDatabase();
    return data.auditLogs.slice(0, limit);
  },
  // --- Data Deletion (LGPD / Meta Compliance) ---
  async createDeletionRequest(identifier, notes) {
    const data = loadDatabase();
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
    data.deletionRequests[confirmationCode] = request;
    saveDatabase(data);
    return request;
  },
  async getDeletionRequest(confirmationCode) {
    const data = loadDatabase();
    return data.deletionRequests[confirmationCode] || null;
  },
  async executeDataDeletion(identifier) {
    const data = loadDatabase();
    const cleanPhone = identifier.replace(/\D/g, "");
    let deletedCount = 0;
    if (data.contacts[cleanPhone]) {
      delete data.contacts[cleanPhone];
      deletedCount++;
    }
    const initialMsgCount = data.messages.length;
    data.messages = data.messages.filter((m) => m.contactPhone.replace(/\D/g, "") !== cleanPhone);
    deletedCount += initialMsgCount - data.messages.length;
    for (const req of Object.values(data.deletionRequests)) {
      if (req.identifier.replace(/\D/g, "") === cleanPhone || req.identifier === identifier) {
        req.status = "completed";
        req.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    saveDatabase(data);
    await this.addAuditLog({
      type: "data_deletion",
      phone: cleanPhone,
      summary: `Exclus\xE3o definitiva de dados solicitada e conclu\xEDda para ${identifier}. Registros removidos: ${deletedCount}.`
    });
    return { success: true, deletedCount };
  },
  // --- Dynamic App Configuration ---
  getConfigSync() {
    const data = loadDatabase();
    return data.config || {};
  },
  async getConfig() {
    const data = loadDatabase();
    if (!data.config) {
      data.config = {
        metaPhoneNumberId: "1221241567748320",
        webhookVerifyToken: "impossivel2008",
        geminiModel: "gemini-2.5-flash",
        autoReplyEnabled: true
      };
      saveDatabase(data);
    }
    return { ...data.config };
  },
  async saveConfig(updates) {
    const data = loadDatabase();
    const current = data.config || {};
    const updated = {
      ...current,
      ...updates
    };
    data.config = updated;
    saveDatabase(data);
    await this.addAuditLog({
      type: "config_update",
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
import { GoogleGenAI } from "@google/genai";
var GIROFY_SYSTEM_PROMPT = `
Voc\xEA \xE9 o Assistente Comercial da Girofy, ag\xEAncia de tecnologia, sites modernos e automa\xE7\xF5es sob medida.
Voc\xEA atende contatos que responderam ao "Bom dia" ou \xE0 prospec\xE7\xE3o do propriet\xE1rio da Girofy no WhatsApp.

DIRETRIZES DE CONVERSA\xC7\xC3O HUMANA (REGRA DE OURO):
1. Fale EXATAMENTE como um ser humano digitando no WhatsApp do celular: direto, educado, natural e sem enrola\xE7\xE3o.
2. LIMITE ESTRITO DE TAMANHO: Cada mensagem DEVE ter entre 10 e 15 palavras no m\xE1ximo.
3. NUNCA envie par\xE1grafos longos, listas, t\xF3picos ou frases corporativas artificiais.
4. Envie 1 mensagem direta (ou no m\xE1ximo 2 bal\xF5es curtos e separados por quebra de linha).
5. O foco \xE9 entender a dor da empresa e agendar uma conversa r\xE1pida de 15 minutos no Google Meet.
6. Se perguntarem pre\xE7o de Landing Page: "A partir de R$ 997, entregue pronta e r\xE1pida para gerar vendas."
7. Se o contato pedir para falar com atendente ou humano, inclua a tag interna [TRANSF_HUMANO: motivo] e avise com gentileza.
`;
async function generateGirofyCommercialReply(contact, incomingText, history) {
  const dynamicConfig = db.getConfigSync();
  const apiKey = (dynamicConfig.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const firstName = contact.name ? contact.name.split(" ")[0] : "tudo bem";
    return {
      replyText: `Ol\xE1, ${firstName}! Obrigado pelo retorno. Posso te apresentar brevemente nossas solu\xE7\xF5es para a ${contact.company || "sua empresa"} ou prefere alinharmos 15 min no Meet?`,
      transferToHuman: false
    };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const recentHistory = history.slice(-6).map((m) => `${m.from === "bot" ? "Girofy (Voc\xEA)" : m.from === "operator" ? "Atendente Humano" : contact.name || "Cliente"}: ${m.text}`).join("\n");
    const prompt = `
${GIROFY_SYSTEM_PROMPT}

DADOS DO CONTATO:
- Nome: ${contact.name || "N\xE3o informado"}
- Empresa: ${contact.company || "N\xE3o informada"}
- Nicho: ${contact.niche || "Geral"}
- Papel: ${contact.role || "decisor"}
- Status Atual: ${contact.status}

HIST\xD3RICO RECENTE DA CONVERSA:
${recentHistory || "(Sem hist\xF3rico anterior)"}

NOVA MENSAGEM RECEBIDA DO CONTATO:
"${incomingText}"

Gere a resposta ideal para o WhatsApp:
`;
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 100
      }
    });
    let rawText = response.text ? response.text.trim() : "";
    let transferToHuman = false;
    let transferReason;
    const transferMatch = rawText.match(/\[TRANSF_HUMANO:\s*([^\]]+)\]/i);
    if (transferMatch) {
      transferToHuman = true;
      transferReason = transferMatch[1].trim();
      rawText = rawText.replace(/\[TRANSF_HUMANO:[^\]]+\]/gi, "").trim();
    }
    const directHumanPattern = /(falar com (humano|atendente|pessoa|alguém|proprietário|responsável)|me liga|passa para humano)/i;
    if (directHumanPattern.test(incomingText)) {
      transferToHuman = true;
      transferReason = "Pedido expl\xEDcito de atendimento humano pelo cliente";
      if (!rawText || !rawText.toLowerCase().includes("humano")) {
        rawText = "Com certeza! J\xE1 estou transferindo nossa conversa para o nosso especialista humano da Girofy assumir agora mesmo. Um instante.";
      }
    }
    const isMeetingRequested = /meet\.google\.com|reunião|amanhã às|alinhamento de 15/i.test(rawText);
    return {
      replyText: rawText || "Perfeito! Voc\xEA teria disponibilidade amanh\xE3 para conversarmos 15 minutos no Google Meet?",
      transferToHuman,
      transferReason,
      isMeetingRequested
    };
  } catch (err) {
    console.error("[Gemini AI Server Error]:", err?.message);
    const firstName = contact.name ? contact.name.split(" ")[0] : "";
    return {
      replyText: `Ol\xE1${firstName ? ` ${firstName}` : ""}! Recebemos sua mensagem e j\xE1 vamos te responder com mais detalhes. Se preferir, qual o melhor hor\xE1rio amanh\xE3 para um diagn\xF3stico r\xE1pido?`,
      transferToHuman: false
    };
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
              const aiResult = await generateGirofyCommercialReply(contact, promptText, history);
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
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (body.action === "clear_all") {
        const count = await db.clearAllContacts();
        return res.status(200).json({ success: true, message: "Todos os contatos foram removidos.", count });
      }
      if (Array.isArray(body.contacts)) {
        const imported = await db.batchSaveContacts(body.contacts);
        return res.status(200).json({ success: true, count: imported.length, contacts: imported });
      }
      const { phone, name, company, niche, role, status, agentState, notes } = body;
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
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { phone, text, from = "operator" } = body;
      if (!phone || !text || !text.trim()) {
        return res.status(400).json({ error: "Telefone e texto da mensagem s\xE3o obrigat\xF3rios." });
      }
      const cleanPhone = formatPhoneNumber(phone);
      const contact = await db.getContactByPhone(cleanPhone);
      if (contact?.optOutDetected) {
        return res.status(400).json({ error: "Este contato solicitou Opt-Out (LGPD). O envio de novas mensagens est\xE1 bloqueado." });
      }
      let sendResult = { success: true, messageId: `direct-${Date.now()}` };
      if (!body.directOnly) {
        sendResult = await sendWhatsAppTextMessage(cleanPhone, text.trim());
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
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const identifier = body?.identifier || body?.phone || body?.user_id;
      if (!identifier) {
        return res.status(400).json({
          error: "Identificador (n\xFAmero de telefone ou e-mail) obrigat\xF3rio para exclus\xE3o."
        });
      }
      const deletionReq = await db.createDeletionRequest(identifier, body?.notes);
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
        webhookVerifyToken: meta.verifyToken,
        metaAccessTokenMasked: maskSecret(meta.token),
        metaAppSecretMasked: maskSecret(meta.appSecret),
        geminiApiKeyMasked: maskSecret(geminiKey),
        geminiModel: cfg.geminiModel || "gemini-2.5-flash",
        autoReplyEnabled: meta.autoReplyEnabled,
        activeGateway: cfg.activeGateway || "direct_pairing",
        directPairingPhone: cfg.directPairingPhone || "557488126578",
        directPairingStatus: cfg.directPairingStatus || "connected",
        directPairingCode: cfg.directPairingCode || "",
        directPairingConnectedAt: cfg.directPairingConnectedAt || ""
      });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const updates = {};
      if (typeof body.metaAccessToken === "string" && body.metaAccessToken.trim()) {
        updates.metaAccessToken = body.metaAccessToken.trim().replace(/^Bearer\s+/i, "");
      }
      if (typeof body.metaPhoneNumberId === "string" && body.metaPhoneNumberId.trim()) {
        updates.metaPhoneNumberId = body.metaPhoneNumberId.trim();
      }
      if (typeof body.metaAppSecret === "string") {
        updates.metaAppSecret = body.metaAppSecret.trim();
      }
      if (typeof body.webhookVerifyToken === "string" && body.webhookVerifyToken.trim()) {
        updates.webhookVerifyToken = body.webhookVerifyToken.trim();
      }
      if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) {
        updates.geminiApiKey = body.geminiApiKey.trim();
      }
      if (typeof body.geminiModel === "string" && body.geminiModel.trim()) {
        updates.geminiModel = body.geminiModel.trim();
      }
      if (typeof body.autoReplyEnabled === "boolean") {
        updates.autoReplyEnabled = body.autoReplyEnabled;
      }
      if (body.activeGateway === "direct_pairing" || body.activeGateway === "meta_cloud_api") {
        updates.activeGateway = body.activeGateway;
      }
      if (typeof body.directPairingPhone === "string" && body.directPairingPhone.trim()) {
        updates.directPairingPhone = body.directPairingPhone.trim();
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
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { action, phoneNumber, gateway } = body;
      if (action === "request_code") {
        const rawPhone = phoneNumber || config.directPairingPhone || "557488126578";
        const cleanPhone = formatPhoneNumber(rawPhone);
        const { evolutionUrl, evolutionKey, instanceName = "prospectfy" } = body;
        let code = "";
        let isRealSocketCode = false;
        let gatewayNotice = "";
        if (evolutionUrl && evolutionKey) {
          try {
            const cleanUrl = evolutionUrl.replace(/\/+$/, "");
            const connectRes = await fetch(`${cleanUrl}/instance/connect/${instanceName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionKey
              },
              body: JSON.stringify({ number: cleanPhone })
            });
            if (connectRes.ok) {
              const data = await connectRes.json();
              if (data.pairingCode || data.code) {
                code = data.pairingCode || data.code;
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
        const cleanPhone = formatPhoneNumber(phoneNumber || config.directPairingPhone || "557488126578");
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  try {
    if (req.method === "GET") {
      const contacts = await db.getContacts();
      const messages = await db.getMessages();
      const microDispatched = contacts.filter((c) => c.status === "em_conversa" || c.status === "novo" || c.status === "qualificado");
      const responded = microDispatched.filter((c) => {
        const msgs = messages.filter((m) => m.contactPhone === c.phone);
        return msgs.some((m) => m.from === "lead");
      });
      return res.status(200).json({
        totalContacts: contacts.length,
        dispatchedCount: microDispatched.length,
        respondedCount: responded.length,
        responseRate: microDispatched.length > 0 ? Math.round(responded.length / microDispatched.length * 100) : 0
      });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { leads, customMessage } = body;
      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Envie uma lista de contatos para o micro-disparo." });
      }
      const safeLeads = leads.slice(0, 10);
      const config = await db.getConfig();
      const gateway = config.activeGateway || "direct_pairing";
      const results = [];
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      for (let i = 0; i < safeLeads.length; i++) {
        const item = safeLeads[i];
        const rawPhone = item.phone || "";
        const cleanPhone = formatPhoneNumber(rawPhone);
        if (!cleanPhone || cleanPhone.length < 10) continue;
        const name = item.name || "Contato";
        const company = item.company || "Empresa";
        const firstName = name.split(" ")[0];
        const messageText = customMessage ? customMessage.replace("{nome}", firstName).replace("{empresa}", company) : `Bom dia, ${firstName}! Tudo bem? Vi o trabalho da ${company} e achei muito interessante.`;
        const contact = {
          id: `lead-${cleanPhone}`,
          phone: cleanPhone,
          name,
          company,
          niche: item.niche || "Prospec\xE7\xE3o Ativa",
          role: "decisor",
          status: "em_conversa",
          agentState: "ai_active",
          optOutDetected: false,
          lastInteractionAt: timestamp,
          createdAt: timestamp
        };
        await db.saveContact(contact);
        const outgoingMsg = {
          id: `msg-micro-${Date.now()}-${i}`,
          contactPhone: cleanPhone,
          from: "operator",
          text: messageText,
          type: "text",
          timestamp: new Date(Date.now() + i * 2e4).toISOString(),
          status: "sent"
        };
        if (gateway === "meta_cloud_api") {
          try {
            const sendRes = await sendWhatsAppTextMessage(cleanPhone, messageText);
            if (sendRes.success && sendRes.messageId) {
              outgoingMsg.metaMessageId = sendRes.messageId;
              outgoingMsg.status = "delivered";
            }
          } catch (e) {
            console.warn("[Micro-dispatch Meta API]", e);
          }
        }
        await db.saveMessage(outgoingMsg);
        results.push({
          phone: cleanPhone,
          name,
          company,
          message: messageText,
          status: "enviado",
          gateway,
          scheduledIntervalSeconds: i * 25
          // 25s safe human delay
        });
      }
      await db.addAuditLog({
        type: "incoming_message",
        summary: `Micro-disparo cadenciado executado com sucesso para ${results.length} contatos via ${gateway === "direct_pairing" ? "Conex\xE3o Direta (Celular)" : "Meta Cloud API"}.`,
        details: { count: results.length, gateway }
      });
      return res.status(200).json({
        success: true,
        dispatched: results.length,
        gateway,
        leads: results,
        message: `${results.length} mensagens cadenciadas com intervalo seguro de 25s iniciadas com sucesso!`
      });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("[Campaign API Error]:", err);
    return res.status(500).json({ error: err?.message || "Falha ao processar micro-disparo." });
  }
}

// api/_handlers/evolution-proxy.ts
async function handler10(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { targetUrl, method = "GET", headers = {}, body: payloadBody } = body;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing targetUrl" });
    }
    const fetchOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };
    if (payloadBody && method !== "GET" && method !== "HEAD") {
      fetchOptions.body = typeof payloadBody === "string" ? payloadBody : JSON.stringify(payloadBody);
    }
    const proxyRes = await fetch(targetUrl, fetchOptions);
    const contentType = proxyRes.headers.get("content-type") || "application/json";
    const textData = await proxyRes.text();
    res.status(proxyRes.status);
    res.setHeader("Content-Type", contentType);
    return res.end(textData);
  } catch (err) {
    console.error("[Evolution Proxy Error]:", err);
    return res.status(500).json({ error: err?.message || "Proxy error" });
  }
}

// api/index.ts
var handlers = {
  "/api/webhook": handler,
  "/api/contacts": handler2,
  "/api/contacts/create": handler2,
  "/api/contacts/update-agent": handler2,
  "/api/messages": handler3,
  "/api/messages/send": handler3,
  "/api/whatsapp-status": handler4,
  "/api/data-deletion": handler5,
  "/api/audit-logs": handler6,
  "/api/config": handler7,
  "/api/pairing": handler8,
  "/api/campaign": handler9,
  "/api/evolution/proxy": handler10
};
async function handler11(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-hub-signature-256");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  const rawUrl = req.url || "/api";
  const pathname = rawUrl.split("?")[0];
  const urlPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const routeHandler = handlers[urlPath];
  if (routeHandler) {
    return routeHandler(req, res);
  }
  for (const [route, fn] of Object.entries(handlers)) {
    if (urlPath === route || urlPath.startsWith(`${route}/`)) {
      return fn(req, res);
    }
  }
  return res.status(404).json({
    error: "Endpoint n\xE3o encontrado",
    path: urlPath,
    availableRoutes: Object.keys(handlers)
  });
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
        await handler11(req, resCompat);
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
});
