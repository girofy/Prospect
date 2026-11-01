// Core Data Models for Prospectfy Commercial WhatsApp Architecture

export type LeadStatus =
  | 'novo'
  | 'em_conversa'
  | 'qualificado'
  | 'reuniao_marcada'
  | 'aguardando_humano'
  | 'esfriou'
  | 'bloqueado';

export type AgentState = 'ai_active' | 'human_takeover' | 'paused';

export type MessageSender = 'lead' | 'bot' | 'operator';

export type MessageType = 'text' | 'audio' | 'image' | 'document' | 'template' | 'interactive' | 'unsupported';

export interface ChatMessage {
  id: string;
  contactPhone: string;
  from: MessageSender;
  text: string;
  type: MessageType;
  timestamp: string;
  metaMessageId?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'received';
  mediaUrl?: string;
  aiReasoning?: string;
}

export interface Contact {
  id: string;
  phone: string; // E.164 format (e.g. 557488126578)
  name: string;
  company: string;
  niche?: string;
  role: 'decisor' | 'atendente_recepcao' | 'desconhecido';
  status: LeadStatus;
  agentState: AgentState;
  optOutDetected: boolean;
  optOutReason?: string;
  lastInteractionAt: string;
  unreadCount?: number;
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  type: 'incoming_message' | 'ai_reply' | 'human_message' | 'opt_out' | 'status_change' | 'data_deletion' | 'error';
  phone?: string;
  summary: string;
  details?: Record<string, any>;
}

export interface DataDeletionRequest {
  id: string;
  confirmationCode: string;
  identifier: string; // phone or email
  status: 'pending' | 'completed' | 'rejected';
  requestedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: {
            body: string;
          };
          audio?: {
            id: string;
            mime_type?: string;
          };
          image?: {
            id: string;
            caption?: string;
          };
          document?: {
            id: string;
            filename?: string;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
          }>;
        }>;
      };
      field: string;
    }>;
  }>;
}
