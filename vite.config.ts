import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

import webhookHandler from './api/_handlers/webhook';
import contactsHandler from './api/_handlers/contacts';
import messagesHandler from './api/_handlers/messages';
import statusHandler from './api/_handlers/whatsapp-status';
import dataDeletionHandler from './api/_handlers/data-deletion';
import auditLogsHandler from './api/_handlers/audit-logs';
import configHandler from './api/_handlers/config';
import pairingHandler from './api/_handlers/pairing';
import campaignHandler from './api/_handlers/campaign';

function adaptHandler(handler: (req: any, res: any) => Promise<any> | any) {
  return async (req: any, res: any) => {
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
    res.json = function (data: any) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
    res.send = function (data: any) {
      if (typeof data === 'object') {
        return res.json(data);
      }
      res.end(data);
      return res;
    };

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          req.body = JSON.parse(bodyStr || '{}');
        } catch {
          req.body = bodyStr;
        }
        try {
          await handler(req, res);
        } catch (err: any) {
          console.error('[Dev API Error]:', err);
          if (!res.writableEnded) {
            res.status(500).json({ error: err?.message || 'Server Error' });
          }
        }
      });
    } else {
      try {
        await handler(req, res);
      } catch (err: any) {
        console.error('[Dev API Error]:', err);
        if (!res.writableEnded) {
          res.status(500).json({ error: err?.message || 'Server Error' });
        }
      }
    }
  };
}

const apiDevServerPlugin = (): Plugin => ({
  name: 'api-dev-server',
  configureServer(server) {
    const handlers: Record<string, any> = {
      '/api/webhook': adaptHandler(webhookHandler),
      '/api/contacts': adaptHandler(contactsHandler),
      '/api/messages': adaptHandler(messagesHandler),
      '/api/whatsapp-status': adaptHandler(statusHandler),
      '/api/data-deletion': adaptHandler(dataDeletionHandler),
      '/api/audit-logs': adaptHandler(auditLogsHandler),
      '/api/config': adaptHandler(configHandler),
      '/api/pairing': adaptHandler(pairingHandler),
      '/api/campaign': adaptHandler(campaignHandler),
    };

    // Use a single top-level interceptor for all /api/* routes
    server.middlewares.use((req, res, next) => {
      const urlPath = (req.url || '').split('?')[0];

      if (handlers[urlPath]) {
        handlers[urlPath](req, res);
        return;
      }

      // Evolution API / Evolution Go CORS-free Proxy (preserva suporte se necessário)
      if (urlPath === '/api/evolution/proxy') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk: any) => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(bodyStr || '{}');
              const { targetUrl, method = 'GET', headers = {}, body } = payload;
              if (!targetUrl) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing targetUrl' }));
                return;
              }

              const fetchOptions: RequestInit = {
                method,
                headers: {
                  'Content-Type': 'application/json',
                  ...headers,
                },
              };
              if (body && method !== 'GET' && method !== 'HEAD') {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
              }

              const proxyRes = await fetch(targetUrl, fetchOptions);
              const responseText = await proxyRes.text();
              res.statusCode = proxyRes.status;
              res.setHeader('Content-Type', proxyRes.headers.get('content-type') || 'application/json');
              res.end(responseText);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Proxy error' }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      next();
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
