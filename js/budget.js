/**
 * @fileoverview Budget page controller. Renders allocations from the pure
 * engine, tracks spend, flags overspend, and asks the AI for savings ideas.
 */

import { boot } from '../main.js';
import { $, registerActions, requireEvent, escapeHtml, debounce, runAiTask, eventMeta } from './shared.js';
import { EVENT_TYPES } from './event-templates.js';
import { allocateBudget, categoryStatuses, summarizeBudget, formatMoney, describeBudgetForAI, cleanAmount } from './budget-model.js';
import { formatDate } from './date-utils.js';
import { persistEvent } from './event-store.js';
import { askAI } from './chatbot.js';

boot('budget');

const root = $('#budget-root');
let event = requireEvent(root);

const TONE_TEXT = { ok: 'On track', warn: 'Near limit', over: 'Over budget' };

if (event) {
  const allocations = allocateBudget(event);
  const money = (n) => formatMoney(n, event.currency);
  const statuses = () => categoryStatuses(allocations, event.spent);

  root.innerHTML = `
    ${eventMeta(event, EVENT_TYPES[event.type].label, formatDate(event.date))}
    <dl class="figures" aria-label="Budget summary">
      <div><dt>Budget</dt><dd id="f-planned"></dd></div>
      <div><dt>Spent</dt><dd id="f-spent"></dd></div>
      <div><dt>Remaining</dt><dd id="f-remaining"></dd></div>
      <div><dt>Per guest</dt><dd id="f-guest"></dd></div>
    </dl>
    <div id="over-alert" class="alert" role="alert" hidden></div>
    <section aria-label="Categories">
      ${allocations.map((a) => `
        <div class="cat-row" data-cat="${a.id}">
          <div><h3>${escapeHtml(a.label)}</h3><span class="planned">Planned ${money(a.amount)} (${a.pct}%)</span></div>
          <div class="spend">
            <label class="sr-only" for="spent-${a.id}">Spent on ${escapeHtml(a.label)}</label>
            <input id="spent-${a.id}" type="number" inputmode="numeric" min="0" step="100" placeholder="Spent" data-cat="${a.id}" value="${event.spent[a.id] || ''}">
          </div>
          <progress max="100" value="0" aria-label="${escapeHtml(a.label)} used"></progress>
          <div class="row-note"><span class="state"></span><span class="left"></span></div>
        </div>`).join('')}
    </section>
    <hr class="rule">
    <h2>Ways to save</h2>
    <p class="muted">The assistant reads the figures above and suggests where to trim.</p>
    <button class="btn" type="button" data-action="suggest-savings">Suggest savings</button>
    <p id="ai-status" class="status" role="status"></p>
    <div id="ai-output" class="ai-output" aria-live="polite"></div>`;

  const refresh = () => {
    const list = statuses();
    const sum = summarizeBudget(list, event.guests);
    $('#f-planned').textContent = money(sum.planned);
    $('#f-spent').textContent = money(sum.spent);
    $('#f-remaining').textContent = money(sum.remaining);
    $('#f-remaining').style.color = sum.remaining < 0 ? 'var(--danger)' : '';
    $('#f-guest').textContent = money(sum.perGuestPlanned);

    list.forEach((s) => {
      const row = $(`.cat-row[data-cat="${s.id}"]`);
      const bar = $('progress', row);
      bar.value = Math.min(100, Math.round(Math.min(s.ratio, 1) * 100));
      $('.state', row).textContent = TONE_TEXT[s.status];
      $('.left', row).textContent = s.remaining >= 0 ? `${money(s.remaining)} left` : `${money(-s.remaining)} over`;
      row.dataset.status = s.status;
    });

    const alertEl = $('#over-alert');
    const over = list.filter((s) => s.status === 'over');
    alertEl.hidden = over.length === 0;
    alertEl.textContent = over.length ? `Over budget in ${over.map((s) => s.label).join(', ')}. Move money from another category or trim here.` : '';
  };

  const save = debounce(() => { event = persistEvent(event); }, 400);

  root.addEventListener('input', (e) => {
    const cat = e.target.dataset?.cat;
    if (!cat || e.target.tagName !== 'INPUT') return;
    event = { ...event, spent: { ...event.spent, [cat]: cleanAmount(e.target.value) } };
    refresh();
    save();
  });

  registerActions({
    'suggest-savings': (btn) => runAiTask({
      button: btn,
      statusEl: $('#ai-status'),
      outputEl: $('#ai-output'),
      scope: 'budget-ai',
      task: () => askAI({ task: 'savings', messages: [{ role: 'user', content: describeBudgetForAI(statuses(), event.currency) }] }),
    }),
  });

  refresh();
}
