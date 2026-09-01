import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const metaWebhookPlugin = (): Plugin => ({
  name: 'meta-webhook-dev-server',
  configureServer(server) {
    server.middlewares.use('/api/webhook', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
      }

      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const mode = parsedUrl.searchParams.get('hub.mode');
      const token = parsedUrl.searchParams.get('hub.verify_token');
      const challenge = parsedUrl.searchParams.get('hub.challenge');

      if (req.method === 'GET') {
        const VALID_TOKENS = ['impossivel2008', 'prospectfy_webhook_token', 'girofy_secret_123', 'prospectfy'];
        if (mode === 'subscribe' && (VALID_TOKENS.includes(token || '') || !token || token === 'impossivel2008' || token === 'prospectfy_webhook_token')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end(challenge || 'OK');
          return;
        }

        if (!mode) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'active',
            service: 'Prospectfy WhatsApp Cloud API Webhook',
            endpoint: '/api/webhook',
            default_verify_token: 'impossivel2008'
          }));
          return;
        }

        res.statusCode = 403;
        res.end('Forbidden: Invalid Verify Token');
        return;
      }

      if (req.method === 'POST') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'EVENT_RECEIVED' }));
        return;
      }

      res.statusCode = 405;
      res.end('Method Not Allowed');
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), metaWebhookPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
