/**
 * @fileoverview My Events controller: list, open and delete saved events.
 * Works from localStorage; signing in merges the Firestore copy.
 * Uses a native <dialog> for delete confirmation (no window.confirm).
 * Each event card has a "Download" button that exports the plan as .json.
 */

import { boot } from '../main.js';
import { $, registerActions, escapeHtml, basePath } from './shared.js';
import { EVENT_TYPES } from './event-templates.js';
import { formatMoney } from './budget-model.js';
import { formatDate } from './date-utils.js';
import { listEvents, setCurrentEvent, removeEvent, getEvent } from './event-store.js';
import { isConfigured } from './firebase.js';

boot('my-events');

const root = $('#events-root');

/**
 * Render the events list into #events-root.
 * @returns {void}
 */
function render() {
  const events = listEvents();
  const cards = events.map((e) => `
    <article class="card event-card" aria-labelledby="t-${e.id}">
      <h3 id="t-${e.id}">${escapeHtml(e.name)}</h3>
      <p class="meta"><span>${escapeHtml(EVENT_TYPES[e.type].label)}</span><span>${escapeHtml(formatDate(e.date))}</span><span>${e.guests} guests</span><span>${escapeHtml(formatMoney(e.budget, e.currency))}</span></p>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" data-action="open-event" data-id="${e.id}">Open</button>
        <button class="btn btn-quiet" type="button" data-action="download-event" data-id="${e.id}" aria-label="Download ${escapeHtml(e.name)} as JSON">Download</button>
        <button class="btn btn-danger btn-quiet" type="button" data-action="delete-event" data-id="${e.id}" aria-label="Delete ${escapeHtml(e.name)}">Delete</button>
      </div>
    </article>`).join('');

  root.innerHTML = `
    ${events.length ? cards : '<div class="empty"><h2>Nothing saved yet</h2><p class="muted">Your events appear here once you create one.</p></div>'}
    <div class="btn-row"><a class="btn" href="${basePath()}pages/planner.html">New event</a></div>
    <p class="muted account-note">${isConfigured() ? 'Events are saved on this device. Sign in to keep them across devices.' : 'Events are saved on this device only.'}</p>`;
}

// ─── Accessible delete dialog ─────────────────────────────────────────────────

const dialog = /** @type {HTMLDialogElement} */ ($('#delete-dialog'));
let _pendingDeleteId = null;
let _pendingTrigger = null;

/**
 * Open the delete confirmation dialog and record which event and which button
 * triggered it so focus can be restored on cancel.
 * @param {string} id - Event id to delete.
 * @param {HTMLElement} trigger - Button that opened the dialog.
 * @returns {void}
 */
function openDeleteDialog(id, trigger) {
  _pendingDeleteId = id;
  _pendingTrigger = trigger;
  if (dialog) {
    dialog.showModal();
    $('#delete-confirm')?.focus();
  }
}

if (dialog) {
  $('#delete-confirm')?.addEventListener('click', async () => {
    const id = _pendingDeleteId;
    dialog.close();
    if (id) await removeEvent(id);
    render();
  });

  $('#delete-cancel')?.addEventListener('click', () => {
    dialog.close();
    _pendingTrigger?.focus();
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _pendingTrigger?.focus();
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Trigger a browser download of an event as a .json file.
 * @param {string} id - Event id.
 * @returns {void}
 */
function downloadEvent(id) {
  const ev = getEvent(id);
  if (!ev) return;
  const blob = new Blob([JSON.stringify(ev, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-plan.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

registerActions({
  'open-event': (el) => {
    setCurrentEvent(el.dataset.id);
    location.href = `${basePath()}pages/budget.html`;
  },
  'download-event': (el) => downloadEvent(el.dataset.id),
  'delete-event': (el) => openDeleteDialog(el.dataset.id, el),
});

window.addEventListener('soiree:synced', render);
render();
