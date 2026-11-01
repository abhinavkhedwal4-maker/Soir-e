/**
 * @fileoverview Ideas Studio controller: themes, menus and activities from the
 * AI, personalised with the event's vibe, budget and guest count.
 */

import { boot } from '../main.js';
import { $, requireEvent, escapeHtml, runAiTask, eventMeta } from './shared.js';
import { EVENT_TYPES } from './event-templates.js';
import { formatDate } from './date-utils.js';
import { formatMoney } from './budget-model.js';
import { askAI } from './chatbot.js';

boot('ideas');

const root = $('#ideas-root');
const event = requireEvent(root);

const FOCUS = {
  all: 'themes, a menu and activities',
  themes: 'themes and colour palettes',
  menu: 'menu ideas',
  activities: 'activities and entertainment',
};

if (event) {
  root.innerHTML = `
    ${eventMeta(event, EVENT_TYPES[event.type].label, formatDate(event.date))}
    <p class="muted">Budget ${escapeHtml(formatMoney(event.budget, event.currency))} for ${event.guests} guests.</p>
    <form id="ideas-form" class="ideas-form">
      <div class="field"><label for="focus">What do you need?</label>
        <select id="focus">${Object.entries(FOCUS).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}</select></div>
      <div class="field"><label for="vibe">Vibe <span class="hint">For example: garden, candlelit, relaxed.</span></label>
        <input id="vibe" type="text" maxlength="120" value="${escapeHtml(event.vibe ?? '')}"></div>
      <div class="field"><label for="extra">Anything to include or avoid? <span class="hint">Optional. Dietary needs, cultural traditions, accessibility.</span></label>
        <textarea id="extra" rows="3" maxlength="400"></textarea></div>
      <button class="btn btn-primary" type="submit" id="go">Generate ideas</button>
    </form>
    <p id="ai-status" class="status" role="status"></p>
    <div id="ai-output" class="ai-output" aria-live="polite"></div>`;

  $('#ideas-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = $('#go');
    const vibe = $('#vibe').value.trim();
    const extra = $('#extra').value.trim();
    const content = `Give me ${FOCUS[$('#focus').value]} for my ${EVENT_TYPES[event.type].label.toLowerCase()}.${extra ? ` Notes: ${extra}` : ''}`;
    runAiTask({
      button: btn,
      statusEl: $('#ai-status'),
      outputEl: $('#ai-output'),
      scope: 'ideas-ai',
      task: () => askAI({ task: 'ideas', messages: [{ role: 'user', content }], context: { type: event.type, guests: event.guests, budget: event.budget, currency: event.currency, date: event.date, vibe } }),
    });
  });
}
