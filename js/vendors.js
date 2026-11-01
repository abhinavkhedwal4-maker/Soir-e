/**
 * @fileoverview Vendor checklist controller with progress tracking and
 * AI-generated questions per vendor.
 */

import { boot } from '../main.js';
import { $, $$, registerActions, requireEvent, escapeHtml, runAiTask, eventMeta } from './shared.js';
import { EVENT_TYPES } from './event-templates.js';
import { getVendorChecklist, checklistProgress, toggleChecked } from './vendor-checklists.js';
import { formatDate } from './date-utils.js';
import { persistEvent } from './event-store.js';
import { askAI } from './chatbot.js';

boot('vendors');

const root = $('#vendors-root');
let event = requireEvent(root);

if (event) {
  const checklist = getVendorChecklist(event.type);

  root.innerHTML = `
    ${eventMeta(event, EVENT_TYPES[event.type].label, formatDate(event.date))}
    <p id="v-summary" class="muted"></p>
    <progress id="v-bar" max="100" value="0" aria-label="Checklist complete"></progress>
    <div class="spacer"></div>
    ${checklist.map((v) => `
      <details class="vendor" data-vendor="${v.id}">
        <summary><span>${escapeHtml(v.label)}</span><span class="count"></span></summary>
        <div class="vendor-body">
          ${v.items.map((i) => `
            <label class="check-item"><input type="checkbox" data-action="toggle-item" data-id="${i.id}" ${event.checked[i.id] ? 'checked' : ''}><span>${escapeHtml(i.text)}</span></label>`).join('')}
          <div class="btn-row"><button class="btn btn-quiet" type="button" data-action="vendor-questions" data-vendor="${v.id}">Questions to ask</button></div>
          <p class="status" role="status"></p>
          <div class="ai-output" aria-live="polite"></div>
        </div>
      </details>`).join('')}`;

  const refresh = () => {
    const p = checklistProgress(checklist, event.checked);
    $('#v-summary').textContent = `${p.done} of ${p.total} items complete`;
    $('#v-bar').value = p.percent;
    p.byVendor.forEach((v) => { $('.count', $(`details[data-vendor="${v.id}"]`)).textContent = `${v.done}/${v.total}`; });
  };

  registerActions({
    'toggle-item': (el) => {
      event = persistEvent({ ...event, checked: toggleChecked(event.checked, el.dataset.id, el.checked) });
      refresh();
    },
    'vendor-questions': (btn) => {
      const vendor = checklist.find((v) => v.id === btn.dataset.vendor);
      const box = btn.closest('.vendor-body');
      return runAiTask({
        button: btn,
        statusEl: $('.status', box),
        outputEl: $('.ai-output', box),
        scope: 'vendors-ai',
        task: () => askAI({ task: 'vendor_questions', messages: [{ role: 'user', content: `What should I ask this vendor before booking: ${vendor.label}?` }] }),
      });
    },
  });

  $$('details.vendor', root)[0]?.setAttribute('open', '');
  refresh();
}
