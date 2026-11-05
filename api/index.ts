import webhookHandler from './_handlers/webhook';
import contactsHandler from './_handlers/contacts';
import messagesHandler from './_handlers/messages';
import whatsappStatusHandler from './_handlers/whatsapp-status';
import dataDeletionHandler from './_handlers/data-deletion';
import auditLogsHandler from './_handlers/audit-logs';
import configHandler from './_handlers/config';
import pairingHandler from './_handlers/pairing';
import campaignHandler from './_handlers/campaign';
import evolutionProxyHandler from './_handlers/evolution-proxy';

const handlers: Record<string, (req: any, res: any) => Promise<any> | any> = {
  '/api/webhook': webhookHandler,
  '/api/contacts': contactsHandler,
  '/api/contacts/create': contactsHandler,
  '/api/contacts/update-agent': contactsHandler,
  '/api/messages': messagesHandler,
  '/api/messages/send': messagesHandler,
  '/api/whatsapp-status': whatsappStatusHandler,
  '/api/data-deletion': dataDeletionHandler,
  '/api/audit-logs': auditLogsHandler,
  '/api/config': configHandler,
  '/api/pairing': pairingHandler,
  '/api/campaign': campaignHandler,
  '/api/evolution/proxy': evolutionProxyHandler,
};

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hub-signature-256');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = req.url || '/api';
  const pathname = rawUrl.split('?')[0];
  const urlPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Route dispatching
  const routeHandler = handlers[urlPath];

  if (routeHandler) {
    return routeHandler(req, res);
  }

  // Prefix matching if exact match not found (e.g. /api/contacts/...)
  for (const [route, fn] of Object.entries(handlers)) {
    if (urlPath === route || urlPath.startsWith(`${route}/`)) {
      return fn(req, res);
    }
  }

  return res.status(404).json({
    error: 'Endpoint não encontrado',
    path: urlPath,
    availableRoutes: Object.keys(handlers),
  });
}
