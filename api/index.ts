import webhookHandler from './_handlers/webhook';
import contactsHandler from './_handlers/contacts';
import messagesHandler from './_handlers/messages';
import whatsappStatusHandler from './_handlers/whatsapp-status';
import dataDeletionHandler from './_handlers/data-deletion';
import auditLogsHandler from './_handlers/audit-logs';
import configHandler from './_handlers/config';
import pairingHandler from './_handlers/pairing';
import campaignHandler from './_handlers/campaign';
import evolutionWebhookHandler from './_handlers/evolution-webhook';
import loginHandler from './_handlers/login';
import learningsHandler from './_handlers/learnings';
import knowledgeHandler from './_handlers/knowledge';
import metricsHandler from './_handlers/metrics';
import campaignsHandler from './_handlers/campaigns';
import exportHandler from './_handlers/export';
import aiTestHandler from './_handlers/ai-test';
import aiModelsHandler from './_handlers/ai-models';
import followupsHandler from './_handlers/followups';
import personalExportHandler from './_handlers/personal-export';
import { isAuthorized } from './lib/auth';

type Handler = (req: any, res: any) => Promise<any> | any;

// Rotas públicas: cada uma tem a própria proteção (token do webhook, assinatura Meta, ou pedido LGPD).
const PUBLIC_ROUTES: Record<string, Handler> = {
  '/api/login': loginHandler,
  '/api/evolution/webhook': evolutionWebhookHandler,
  '/api/webhook': webhookHandler,
  '/api/data-deletion': dataDeletionHandler,
};

// Rotas do painel: exigem login. Sem ADMIN_PASSWORD configurado, ninguém entra.
const PROTECTED_ROUTES: Record<string, Handler> = {
  '/api/contacts': contactsHandler,
  '/api/contacts/create': contactsHandler,
  '/api/contacts/update-agent': contactsHandler,
  '/api/messages': messagesHandler,
  '/api/messages/send': messagesHandler,
  '/api/whatsapp-status': whatsappStatusHandler,
  '/api/audit-logs': auditLogsHandler,
  '/api/config': configHandler,
  '/api/pairing': pairingHandler,
  '/api/campaign': campaignHandler,
  '/api/learnings': learningsHandler,
  '/api/knowledge': knowledgeHandler,
  '/api/metrics': metricsHandler,
  '/api/campaigns': campaignsHandler,
  '/api/export': exportHandler,
  '/api/ai-test': aiTestHandler,
  '/api/ai-models': aiModelsHandler,
  '/api/followups': followupsHandler,
  '/api/personal-export': personalExportHandler,
};

// Stats do agente: só GET e sem dado pessoal (contagens). Pode ser público.
const PUBLIC_GET_ROUTES: Record<string, Handler> = {
  '/api/prospector': evolutionWebhookHandler,
};

function match(table: Record<string, Handler>, urlPath: string): Handler | null {
  if (table[urlPath]) return table[urlPath];
  for (const [route, fn] of Object.entries(table)) {
    if (urlPath.startsWith(`${route}/`)) return fn;
  }
  return null;
}

export default async function handler(req: any, res: any) {
  // Mesma origem apenas: o painel é servido pelo próprio app. Sem CORS aberto.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hub-signature-256');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = req.url || '/api';
  const pathname = rawUrl.split('?')[0];
  const urlPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  const pub = match(PUBLIC_ROUTES, urlPath);
  if (pub) return pub(req, res);

  if (req.method === 'GET') {
    const pubGet = match(PUBLIC_GET_ROUTES, urlPath);
    if (pubGet) return pubGet(req, res);
  }

  const prot = match(PROTECTED_ROUTES, urlPath);
  if (prot) {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Não autorizado. Faça login no painel.' });
    }
    return prot(req, res);
  }

  return res.status(404).json({ error: 'Endpoint não encontrado', path: urlPath });
}
