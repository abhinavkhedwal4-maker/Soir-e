/**
 * @fileoverview AI client and floating chat panel. `askAI` is the single path
 * from the browser to /api/chat, used by every module.
 */

import { $, renderAiText, escapeHtml, registerActions } from './shared.js';
import { getCurrentEvent } from './event-store.js';
import { buildAiContext } from './event-templates.js';
import { AppError, logError, friendlyMessage } from './errors.js';

const MAX_HISTORY = 10;

/**
 * Ask the assistant. Throws AppError with a safe code on failure.
 * @param {{task?:string, messages:{role:string,content:string}[], context?:object}} req - Request.
 * @returns {Promise<string>} Model reply.
 */
export async function askAI({ task = 'chat', messages, context }) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, messages, context: context ?? buildAiContext(getCurrentEvent()) }),
    });
  } catch (err) {
    logError('ai-network', err);
    throw new AppError('network');
  }
  if (res.status === 429) throw new AppError('rate_limited');
  if (res.status === 400 || res.status === 413 || res.status === 415) throw new AppError('bad_request');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = data?.code === 'not_configured' ? 'not_configured' : 'unavailable';
    throw new AppError(code);
  }
  const data = await res.json().catch(() => ({}));
  if (typeof data.reply !== 'string') throw new AppError('unavailable');
  return data.reply;
}

/**
 * Wire up the floating chat panel rendered by renderChrome.
 * @returns {void}
 */
export function initChat() {
  const form = $('#chat-form');
  const panel = $('#chat-panel');
  const toggle = $('.chat-toggle');
  if (!form || !panel || !toggle) return;

  const log = $('#chat-log');
  const input = $('#chat-input');
  const history = [];

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus(); else toggle.focus();
  };
  registerActions({ 'chat-toggle': () => setOpen(panel.hidden) });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) setOpen(false);
  });

  const addMessage = (role, html) => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.dataset.role = role;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', `<p>${escapeHtml(text)}</p>`);
    history.push({ role: 'user', content: text });
    const pending = addMessage('assistant', '<p class="muted">Thinking…</p>');
    const send = form.querySelector('button');
    send.disabled = true;
    try {
      const reply = await askAI({ task: 'chat', messages: history.slice(-MAX_HISTORY) });
      history.push({ role: 'assistant', content: reply });
      pending.innerHTML = renderAiText(reply);
    } catch (err) {
      history.pop();
      pending.innerHTML = `<p class="error">${escapeHtml(friendlyMessage(err))}</p>`;
    } finally {
      send.disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  });
}
