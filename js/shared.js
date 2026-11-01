/**
 * @fileoverview Shared browser helpers: DOM shortcuts, the one place that
 * renders the navbar + chat panel, event delegation for `data-action`, theme,
 * and small UI utilities. No inline handlers anywhere, so the CSP needs no
 * 'unsafe-inline' for scripts.
 */

import { escapeHtml, renderAiText } from './sanitize.js';
import { getCurrentEvent } from './event-store.js';
import { logError, friendlyMessage } from './errors.js';

export { escapeHtml, sanitizeString, renderAiText } from './sanitize.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** @returns {string} Relative prefix to the site root from the current page. */
export const basePath = () => (location.pathname.includes('/pages/') ? '../' : './');

const NAV = [
  ['planner', 'Plan', 'pages/planner.html'],
  ['budget', 'Budget', 'pages/budget.html'],
  ['timeline', 'Timeline', 'pages/timeline.html'],
  ['vendors', 'Vendors', 'pages/vendors.html'],
  ['ideas', 'Ideas', 'pages/ideas.html'],
  ['my-events', 'My events', 'pages/my-events.html'],
];

/**
 * Debounce a function.
 * @param {Function} fn - Function to wrap.
 * @param {number} [ms=300] - Delay.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ─── Event delegation ────────────────────────────────────────────────────────

const registry = new Map();
let wired = false;

/**
 * Register handlers for `data-action="name"` elements (click delegation).
 * @param {Record<string,(el:HTMLElement, ev:Event)=>void>} map - Handlers by action name.
 * @returns {void}
 */
export function registerActions(map) {
  Object.entries(map).forEach(([name, fn]) => registry.set(name, fn));
  if (wired) return;
  wired = true;
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    const fn = el && registry.get(el.dataset.action);
    if (fn) fn(el, ev);
  });
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const THEME_KEY = 'soiree.theme';

export function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) document.documentElement.dataset.theme = saved;
  } catch (_e) { /* storage unavailable */ }
}

export function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (_e) { /* ignore */ }
}

// ─── Shared chrome (navbar, skip link, chat panel, footer) ──────────────────

/**
 * Render the navbar, chat panel and footer. This is the only place they exist.
 * @param {string} active - Current page key.
 * @returns {void}
 */
export function renderChrome(active) {
  const base = basePath();
  const links = NAV.map(([key, label, href]) => `<a href="${base}${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', '<a class="skip-link" href="#main">Skip to content</a>');

  const header = $('#site-header');
  if (header) {
    header.className = 'site-header';
    header.innerHTML = `
      <a class="wordmark" href="${base}index.html">Soirée</a>
      <nav class="site-nav" aria-label="Primary">${links}</nav>
      <div class="header-tools">
        <button class="btn btn-quiet" type="button" data-action="toggle-theme" aria-label="Switch colour theme">Theme</button>
        <button class="btn btn-quiet" type="button" data-action="auth-toggle" id="auth-button" hidden>Sign in</button>
      </div>`;
  }

  const footer = $('#site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.innerHTML = '<p>Plans stay on this device unless you sign in. Budget and schedule figures are calculated by the app; the assistant only suggests.</p>';
  }

  const chat = $('#chat-root');
  if (chat) {
    chat.innerHTML = `
      <button class="btn chat-toggle" type="button" data-action="chat-toggle" aria-expanded="false" aria-controls="chat-panel">Ask Soirée</button>
      <aside id="chat-panel" class="chat-panel" aria-label="Planning assistant" hidden>
        <div id="chat-log" class="chat-log" role="log" aria-live="polite">
          <div class="chat-msg"><p>Ask about menus, etiquette, vendors or anything about your event.</p></div>
        </div>
        <form id="chat-form" class="chat-form">
          <label class="sr-only" for="chat-input">Your question</label>
          <textarea id="chat-input" rows="2" maxlength="1000" placeholder="Ask a question"></textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </aside>`;
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/**
 * Set a message in an aria-live status element.
 * @param {HTMLElement|null} el - Status element.
 * @param {string} msg - Text.
 * @param {'info'|'error'} [kind='info'] - Tone.
 * @returns {void}
 */
export function setStatus(el, msg, kind = 'info') {
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
}

/**
 * Disable a button while work is in flight.
 * @param {HTMLButtonElement} btn - Button.
 * @param {boolean} busy - Busy state.
 * @param {string} [busyText] - Temporary label.
 * @returns {void}
 */
export function setBusy(btn, busy, busyText = 'Working…') {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = busyText; } else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  btn.disabled = busy;
  btn.setAttribute('aria-busy', String(busy));
}

/**
 * Put AI text into a container as safe HTML.
 * @param {HTMLElement} el - Output container.
 * @param {string} text - Model text.
 * @returns {void}
 */
export function showAi(el, text) {
  el.innerHTML = renderAiText(text);
}

/**
 * Run one AI action: disable the button, show a thinking status, call the
 * model, render the result, then re-enable. Logs and surfaces any error.
 * @param {object} opts - Options.
 * @param {HTMLButtonElement} opts.button - Trigger button.
 * @param {HTMLElement|null} opts.statusEl - aria-live status element (may be null).
 * @param {HTMLElement} opts.outputEl - Container for the AI reply.
 * @param {() => Promise<string>} opts.task - Async thunk that calls askAI and returns the reply.
 * @param {string} [opts.scope='ai'] - Scope label for logError.
 * @returns {Promise<void>}
 */
export async function runAiTask({ button, statusEl, outputEl, task, scope = 'ai' }) {
  setBusy(button, true);
  setStatus(statusEl, 'Thinking…');
  try {
    const reply = await task();
    showAi(outputEl, reply);
    setStatus(statusEl, '');
  } catch (err) {
    logError(scope, err);
    setStatus(statusEl, friendlyMessage(err), 'error');
  } finally {
    setBusy(button, false);
  }
}

/**
 * Return the current event, or render a friendly empty state and return null.
 * @param {HTMLElement} container - Where to show the empty state.
 * @returns {object|null} Current event.
 */
export function requireEvent(container) {
  const ev = getCurrentEvent();
  if (ev) return ev;
  container.innerHTML = `
    <div class="empty">
      <h2>No event yet</h2>
      <p class="muted">Set up an event and the budget, timeline and vendor checklist fill themselves in.</p>
      <a class="btn btn-primary" href="${basePath()}pages/planner.html">Plan an event</a>
    </div>`;
  return null;
}

/**
 * Page heading block for an event.
 * @param {object} ev - Event.
 * @param {string} label - Event type label.
 * @param {string} dateText - Formatted date.
 * @returns {string} HTML.
 */
export function eventMeta(ev, label, dateText) {
  return `<p class="meta"><span>${escapeHtml(ev.name)}</span><span>${escapeHtml(label)}</span><span>${escapeHtml(dateText)}</span><span>${ev.guests} guests</span></p>`;
}
