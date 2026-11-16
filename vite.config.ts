import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

if (typeof process !== 'undefined' && process.loadEnvFile) {
  try { process.loadEnvFile('.env'); } catch {}
}

function apiPlugin() {
  return {
    name: 'api-serverless-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }
        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5173'}`);
          const pathname = parsedUrl.pathname;
          const routeName = pathname.replace(/^\/api\/?/, '').split('/')[0];
          if (!routeName) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Endpoint not found' }));
          }

          const apiFile = path.resolve(process.cwd(), `api/${routeName}.js`);
          if (!fs.existsSync(apiFile)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `API route ${routeName} not found` }));
          }

          const query: Record<string, any> = {};
          for (const [k, v] of parsedUrl.searchParams.entries()) {
            query[k] = v;
          }
          req.query = query;

          let body = '';
          if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method || '')) {
            body = await new Promise<string>((resolve, reject) => {
              let acc = '';
              req.on('data', (chunk: any) => { acc += chunk; });
              req.on('end', () => resolve(acc));
              req.on('error', reject);
            });
            if (body) {
              try {
                req.body = JSON.parse(body);
              } catch {
                req.body = body;
              }
            } else {
              req.body = {};
            }
          } else {
            req.body = {};
          }

          res.status = function (code: number) {
            this.statusCode = code;
            return this;
          };
          res.json = function (data: any) {
            this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
            return this;
          };

          const mod = await import(`file://${apiFile}?t=${Date.now()}`);
          const handler = mod.default || mod;
          await handler(req, res);
        } catch (err: any) {
          console.error('API Error in route:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
          }
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [apiPlugin(), react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}
  return { plugins };
});
