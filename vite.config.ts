import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

import apiHandler from './api/index';

function adaptHandler(handler: (req: any, res: any) => Promise<any> | any) {
  return async (req: any, res: any) => {
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
    res.json = function (data: any) {
      if (!res.writableEnded) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      }
      return res;
    };
    res.send = function (data: any) {
      if (res.writableEnded) return res;
      if (typeof data === 'object') {
        return res.json(data);
      }
      res.end(data);
      return res;
    };

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          req.body = (req.headers['content-type'] || '').includes('application/json')
            ? JSON.parse(bodyStr || '{}')
            : (bodyStr ? JSON.parse(bodyStr) : {});
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
    const wrappedApiHandler = adaptHandler(apiHandler);

    // Intercept all /api/* requests before Vite's SPA fallback
    server.middlewares.use((req, res, next) => {
      const urlPath = (req.url || '').split('?')[0];

      if (urlPath.startsWith('/api')) {
        wrappedApiHandler(req, res);
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
