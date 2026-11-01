/**
 * @fileoverview Vercel serverless adapter for POST /api/chat.
 * All logic lives in ./_lib.js so it is identical to the local dev server.
 */

import { handleChat, createRateLimiter, clientIp } from './_lib.js';

const limiter = createRateLimiter();

/**
 * @param {import('http').IncomingMessage & {body?: unknown}} req - Request (body pre-parsed by Vercel).
 * @param {import('http').ServerResponse & {status:Function,json:Function}} res - Response.
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
  const result = await handleChat({
    method: req.method,
    contentType: req.headers['content-type'],
    body: req.body,
    ip: clientIp(req.headers, req.socket?.remoteAddress),
    env: process.env,
    limiter,
  });
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(result.headers ?? {}).forEach(([k, v]) => res.setHeader(k, v));
  res.status(result.status).json(result.body);
}
