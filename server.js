/**
 * @fileoverview Zero-dependency local dev server. Serves static files and
 * POST /api/chat using the same core and the same security headers
 * (read from vercel.json) as production.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleChat, createRateLimiter, clientIp, LIMITS } from './api/_lib.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Minimal .env loader so no dependency is needed. */
function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_e) { /* .env is optional */ }
}
loadEnv();

const k = process.env.NVIDIA_API_KEY;
console.log(`NVIDIA_API_KEY: ${k && !k.startsWith('your_') ? `loaded (${k.slice(0, 5)}…${k.slice(-4)})` : 'MISSING or placeholder, check .env'}`);
console.log(`NVIDIA_MODEL: ${process.env.NVIDIA_MODEL || '(default) meta/llama-3.1-8b-instruct'}`);

const PORT = Number(process.env.PORT) || 3000;
const limiter = createRateLimiter();

// Single source of truth for headers: vercel.json. HTTPS-only directives are dropped for http://localhost.
const SECURITY_HEADERS = Object.fromEntries(
  (JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers.find((h) => h.source === '/(.*)')?.headers ?? [])
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.key === 'Content-Security-Policy' ? h.value.replace('; upgrade-insecure-requests', '') : h.value]),
);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const BLOCKED = new Set(['server.js', 'package.json', 'package-lock.json', 'api', 'tests', 'node_modules', 'firestore.rules']);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > LIMITS.maxBodyBytes) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_e) { resolve(undefined); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  let body;
  try { body = req.method === 'POST' ? await readJson(req) : undefined; } catch (_e) {
    return send(res, 413, JSON.stringify({ error: 'Request too large.' }), { 'Content-Type': 'application/json' });
  }
  const result = await handleChat({
    method: req.method,
    contentType: req.headers['content-type'],
    body,
    ip: clientIp(req.headers, req.socket.remoteAddress),
    env: process.env,
    limiter,
  });
  return send(res, result.status, JSON.stringify(result.body), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...result.headers });
}

function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_e) { return send(res, 400, 'Bad request'); }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  const segments = pathname.split('/').filter(Boolean);
  const hidden = segments.some((s) => (s.startsWith('.') && s !== '.well-known') || BLOCKED.has(s) || s.startsWith('.env'));
  if (hidden) return send(res, 404, 'Not found');

  let file = path.resolve(ROOT, `.${path.sep}${segments.join(path.sep)}`);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (_e) { return send(res, 404, 'Not found'); }

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    return send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  });
  return undefined;
}

http
  .createServer((req, res) => {
    const handler = req.url.split('?')[0] === '/api/chat' ? handleApi(req, res) : Promise.resolve(serveStatic(req, res));
    handler.catch((err) => {
      console.error('[soiree:server]', err?.message);
      if (!res.headersSent) send(res, 500, JSON.stringify({ error: 'Internal error.' }), { 'Content-Type': 'application/json' });
    });
  })
  .listen(PORT, () => console.log(`Soirée running at http://localhost:${PORT}`));
