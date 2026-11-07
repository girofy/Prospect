import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiHandler from './api/index';
import { startProspector } from './api/lib/prospector';
import { startLearning } from './api/lib/learning';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(res: http.ServerResponse, filePath: string, defaultStatus = 200) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(defaultStatus, { 'Content-Type': contentType });
    res.end(data);
    return true;
  } catch (err) {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  // Helper response methods for API compatibility
  const resCompat: any = res;
  resCompat.status = (code: number) => {
    res.statusCode = code;
    return resCompat;
  };
  resCompat.json = (data: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return resCompat;
  };
  resCompat.send = (data: any) => {
    if (typeof data === 'object') {
      return resCompat.json(data);
    }
    res.end(data);
    return resCompat;
  };

  // Route /api/* to the serverless router
  if (pathname.startsWith('/api')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
    });
    req.on('end', async () => {
      try {
        if (bodyData && (req.headers['content-type'] || '').includes('application/json')) {
          (req as any).body = JSON.parse(bodyData);
        } else {
          (req as any).body = bodyData;
        }
      } catch {
        (req as any).body = bodyData;
      }

      try {
        await apiHandler(req as any, resCompat);
      } catch (err: any) {
        console.error('[Server API Error]:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
        }
      }
    });
    return;
  }

  // Serve static files from dist
  const potentialFile = path.join(DIST_DIR, pathname);
  if (serveStatic(res, potentialFile)) {
    return;
  }

  // SPA fallback to index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (serveStatic(res, indexPath)) {
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Prospectfy Production Server] running on http://0.0.0.0:${PORT}`);
  startProspector();
  startLearning();
});
