/**
 * @fileoverview Event Setup wizard controller. DOM only: validation and
 * calculation live in the pure modules.
 */

import { boot } from '../main.js';
import { $, $$, registerActions, escapeHtml, setStatus, basePath } from './shared.js';
import { EVENT_TYPES, CURRENCIES, MAX_PRIORITIES, priorityCategories, validateEventInput } from './event-templates.js';
import { formatMoney } from './budget-model.js';
import { formatDate, todayISO } from './date-utils.js';
import { createEvent, persistEvent } from './event-store.js';


boot('planner');

const STEPS = 4;
const form = $('#wizard');
const statusEl = $('#form-status');
let step = 1;

const selectedType = () => form.querySelector('input[name="type"]:checked')?.value ?? '';
const selectedPriorities = () => $$('input[name="priority"]:checked').map((i) => i.value);

function renderTypes() {
  $('#type-options').innerHTML = Object.entries(EVENT_TYPES).map(([id, t]) => `
    <label class="type-option"><input type="radio" name="type" value="${id}"><strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.blurb)}</span></label>`).join('');
  $('#currency').innerHTML = Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}">${escapeHtml(c.label)}</option>`).join('');
  $('#date').min = todayISO();
}

function onTypeChange() {
  const type = selectedType();
  const tpl = EVENT_TYPES[type];
  if (!tpl) return;
  const guests = $('#guests');
  guests.min = tpl.minGuests;
  guests.max = tpl.maxGuests;
  if (!guests.value) guests.value = tpl.defaultGuests;
  $('#priorities').innerHTML = priorityCategories(type).map((c) => `
    <label class="check"><input type="checkbox" name="priority" value="${c.id}"> ${escapeHtml(c.label)}</label>`).join('');
}

function readInput() {
  return {
    type: selectedType(),
    name: $('#name').value,
    date: $('#date').value,
    guests: $('#guests').value,
    budget: $('#budget').value,
    currency: $('#currency').value,
    priorities: selectedPriorities(),
    vibe: $('#vibe').value,
  };
}

function showErrors(errors) {
  $$('.error', form).forEach((el) => { el.textContent = ''; });
  Object.entries(errors).forEach(([field, msg]) => {
    const el = $(`#err-${field}`);
    if (el) el.textContent = msg;
  });
  const first = Object.keys(errors).map((f) => $(`#${f}`) ?? $(`[name="${f}"]`)).find(Boolean);
  first?.focus();
}

const STEP_FIELDS = { 1: ['type'], 2: ['name', 'date', 'guests'], 3: ['budget', 'currency', 'priorities'], 4: ['vibe'] };

/** Validate only the fields on the current step. */
function stepErrors() {
  const { errors } = validateEventInput(readInput());
  return Object.fromEntries(Object.entries(errors).filter(([f]) => STEP_FIELDS[step].includes(f)));
}

function renderReview() {
  const v = readInput();
  const tpl = EVENT_TYPES[v.type];
  if (!tpl) return;
  const rows = [
    ['Event', `${escapeHtml(v.name)} (${escapeHtml(tpl.label)})`],
    ['Date', escapeHtml(formatDate(v.date))],
    ['Guests', escapeHtml(v.guests)],
    ['Budget', escapeHtml(formatMoney(Number(v.budget) || 0, v.currency))],
    ['Priorities', v.priorities.length ? v.priorities.map((p) => escapeHtml(priorityCategories(v.type).find((c) => c.id === p)?.label ?? p)).join(', ') : 'None'],
  ];
  $('#review').innerHTML = `<dl>${rows.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>`;
}

function showStep(n) {
  step = n;
  $$('fieldset[data-step]', form).forEach((fs) => { fs.hidden = Number(fs.dataset.step) !== n; });
  $('#back').hidden = n === 1;
  $('#next').hidden = n === STEPS;
  $('#create').hidden = n !== STEPS;
  $('#step-label').textContent = `Step ${n} of ${STEPS}`;
  if (n === STEPS) renderReview();
  setStatus(statusEl, '');
  form.querySelector(`fieldset[data-step="${n}"] input:not([type="radio"])`)?.focus();
}

registerActions({
  'wizard-next': () => {
    const errors = stepErrors();
    showErrors(errors);
    if (Object.keys(errors).length === 0) showStep(Math.min(step + 1, STEPS));
  },
  'wizard-back': () => showStep(Math.max(step - 1, 1)),
});

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') onTypeChange();
  if (e.target.name === 'priority' && selectedPriorities().length > MAX_PRIORITIES) {
    e.target.checked = false;
    setStatus(statusEl, `You can choose up to ${MAX_PRIORITIES} priorities.`, 'error');
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (step < STEPS) return;
  const result = validateEventInput(readInput());
  showErrors(result.errors);
  if (!result.valid) {
    setStatus(statusEl, 'Some answers need attention. Go back to fix them.', 'error');
    return;
  }
  const event = createEvent(result.value);
  persistEvent(event);
  location.href = `${basePath()}pages/budget.html`;
});

renderTypes();
showStep(1);
