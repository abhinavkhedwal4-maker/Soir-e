/**
 * @fileoverview Timeline page controller. Dates come from the pure scheduler;
 * the AI only adds tailored tips for the next milestones.
 */

import { boot } from '../main.js';
import { $, registerActions, requireEvent, escapeHtml, runAiTask, eventMeta } from './shared.js';
import { EVENT_TYPES } from './event-templates.js';
import { buildTimeline, summarizeTimeline, describeTimelineForAI } from './timeline-model.js';
import { formatDate, todayISO, daysBetween } from './date-utils.js';
import { persistEvent } from './event-store.js';
import { askAI } from './chatbot.js';

boot('timeline');

const root = $('#timeline-root');
let event = requireEvent(root);

const LABEL = { done: 'Done', overdue: 'Overdue', soon: 'Due soon', upcoming: 'Upcoming' };

/** @returns {string} Plain-language due text. */
function dueText(m) {
  if (m.status === 'done') return `Was due ${formatDate(m.due)}`;
  if (m.daysLeft === 0) return `Due today, ${formatDate(m.due)}`;
  if (m.daysLeft < 0) return `${-m.daysLeft} day${m.daysLeft === -1 ? '' : 's'} overdue, due ${formatDate(m.due)}`;
  return `${formatDate(m.due)}, in ${m.daysLeft} day${m.daysLeft === 1 ? '' : 's'}`;
}

if (event) {
  const compute = () => buildTimeline(event, todayISO());
  const { compressed } = compute();
  const daysToGo = daysBetween(todayISO(), event.date);

  root.innerHTML = `
    ${eventMeta(event, EVENT_TYPES[event.type].label, formatDate(event.date))}
    <dl class="figures" aria-label="Timeline summary">
      <div><dt>Days to go</dt><dd>${Math.max(daysToGo, 0)}</dd></div>
      <div><dt>Complete</dt><dd id="t-done"></dd></div>
      <div><dt>Overdue</dt><dd id="t-overdue"></dd></div>
    </dl>
    <progress id="t-bar" max="100" value="0" aria-label="Milestones complete"></progress>
    ${compressed ? '<p class="notice">Your date is closer than the usual lead time, so milestones are compressed to fit. Book the biggest items first.</p>' : ''}
    <ol id="milestones" class="milestones"></ol>
    <h2>Tailored tips</h2>
    <p class="muted">Tips for your next three open milestones.</p>
    <button class="btn" type="button" data-action="tailor-notes">Get tips</button>
    <p id="ai-status" class="status" role="status"></p>
    <div id="ai-output" class="ai-output" aria-live="polite"></div>`;

  const render = (focusId) => {
    const { milestones } = compute();
    const sum = summarizeTimeline(milestones);
    $('#milestones').innerHTML = milestones.map((m) => `
      <li class="milestone" data-status="${m.status}">
        <input type="checkbox" id="m-${m.id}" data-action="toggle-milestone" data-id="${m.id}" ${m.status === 'done' ? 'checked' : ''}>
        <label for="m-${m.id}">${escapeHtml(m.title)}</label>
        <span class="badge" data-tone="${m.status}">${LABEL[m.status]}</span>
        <span class="when">${escapeHtml(dueText(m))}</span>
        <p class="note">${escapeHtml(m.note)}</p>
      </li>`).join('');
    $('#t-done').textContent = `${sum.done} of ${sum.total}`;
    $('#t-overdue').textContent = String(sum.overdue);
    $('#t-bar').value = sum.percent;
    if (focusId) $(`#m-${focusId}`)?.focus();
  };

  registerActions({
    'toggle-milestone': (el) => {
      const done = { ...event.done };
      if (el.checked) done[el.dataset.id] = true; else delete done[el.dataset.id];
      event = persistEvent({ ...event, done });
      render(el.dataset.id);
    },
    'tailor-notes': (btn) => runAiTask({
      button: btn,
      statusEl: $('#ai-status'),
      outputEl: $('#ai-output'),
      scope: 'timeline-ai',
      task: () => askAI({ task: 'timeline_notes', messages: [{ role: 'user', content: describeTimelineForAI(compute().milestones) }] }),
    }),
  });

  render();
}
