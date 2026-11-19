// Servidor local que imita Cloudflare Pages (estáticos + Functions + D1 sobre SQLite).
// Uso: node test/server.mjs [puerto]   (ADMIN_TOKEN y DB_FILE opcionales por entorno)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { handleApi } from '../src/api.js';
import { leaguePage } from '../src/pages.js';

const ROOT = fileURLToPath(new URL('../public', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

// Aplica la misma CSP que public/_headers para detectar violaciones en local.
let cspCache;
const csp = async () => (cspCache ??= (await readFile(join(ROOT, '_headers'), 'utf8')).match(/Content-Security-Policy: (.+)/)[1]);

async function asset(pathname) {
  const p = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidates = p.endsWith('/') ? [join(p, 'index.html')] : [p, p + '.html'];
  for (const c of candidates) {
    const file = join(ROOT, c);
    if (!file.startsWith(ROOT) || c.startsWith('/_')) continue;
    try { if ((await stat(file)).isFile()) return new Response(await readFile(file), { headers: { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'content-security-policy': await csp() } }); } catch {}
  }
  return new Response('Not found', { status: 404 });
}

export function startServer({ port = 8788, env: extra = {} } = {}) {
  const env = { DB: createD1(process.env.DB_FILE || ':memory:'), ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'local-admin-token-123456', ...extra };
  env.ASSETS = { fetch: (u) => asset(new URL(u).pathname) };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    let out;
    const m = url.pathname.match(/^\/l\/([^/]+)\/?$/);
    if (url.pathname.startsWith('/api/')) out = await handleApi(request, env);
    else if (m) out = await leaguePage(request, env, m[1]);
    else out = await asset(url.pathname);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  });
  return new Promise((r) => server.listen(port, () => r({ server, env })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 8788);
  await startServer({ port });
  console.log(`Tepicas local en http://localhost:${port}`);
}
