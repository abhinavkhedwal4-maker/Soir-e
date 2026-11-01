/**
 * @fileoverview Pure event data: types, budget splits, milestones, and input
 * validation. No DOM, no network. Everything the planner "knows" lives here so
 * budgets and schedules are never left to the language model.
 */

import { parseDate, todayISO } from './date-utils.js';

export const MAX_PRIORITIES = 3;
export const PRIORITY_BOOST = 1.5;

export const CURRENCIES = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'Indian rupee (₹)' },
  USD: { symbol: '$', locale: 'en-US', label: 'US dollar ($)' },
  EUR: { symbol: '€', locale: 'en-IE', label: 'Euro (€)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'British pound (£)' },
};

/** @typedef {{id:string,label:string,share:number,fixed?:boolean}} BudgetCategory */
/** @typedef {{id:string,title:string,weeksBefore:number,note:string}} MilestoneTemplate */

export const EVENT_TYPES = {
  wedding: {
    label: 'Wedding',
    blurb: 'Venue, catering, ceremony and everything between.',
    minGuests: 10,
    maxGuests: 2000,
    defaultGuests: 150,
    leadWeeks: 52,
    categories: [
      { id: 'venue', label: 'Venue', share: 22 },
      { id: 'catering', label: 'Food and drink', share: 28 },
      { id: 'photography', label: 'Photo and video', share: 10 },
      { id: 'attire', label: 'Attire and styling', share: 9 },
      { id: 'decor', label: 'Decor and flowers', share: 10 },
      { id: 'music', label: 'Music and entertainment', share: 7 },
      { id: 'stationery', label: 'Invitations', share: 3 },
      { id: 'transport', label: 'Transport and stay', share: 3 },
      { id: 'contingency', label: 'Contingency', share: 8, fixed: true },
    ],
    milestones: [
      { id: 'budget', title: 'Agree budget and first guest list', weeksBefore: 52, note: 'Settle who is contributing and a rough headcount.' },
      { id: 'venue', title: 'Book the venue', weeksBefore: 48, note: 'Venue availability sets the date for everything else.' },
      { id: 'photo', title: 'Book photographer and videographer', weeksBefore: 44, note: 'Popular names fill up a year ahead.' },
      { id: 'caterer', title: 'Choose and book the caterer', weeksBefore: 40, note: 'Arrange a tasting before paying a deposit.' },
      { id: 'attire', title: 'Start shopping for attire', weeksBefore: 36, note: 'Allow time for fittings and alterations.' },
      { id: 'music', title: 'Book music or entertainment', weeksBefore: 32, note: 'Confirm sound requirements with the venue.' },
      { id: 'save-date', title: 'Send save-the-dates', weeksBefore: 28, note: 'Especially important for guests travelling in.' },
      { id: 'decor', title: 'Finalize decor and florals', weeksBefore: 16, note: 'Match the plan to what the venue allows.' },
      { id: 'invites', title: 'Send formal invitations', weeksBefore: 8, note: 'Set an RSVP deadline about three weeks out.' },
      { id: 'menu', title: 'Finalize menu and dietary needs', weeksBefore: 6, note: 'Collect allergies and dietary requirements with RSVPs.' },
      { id: 'confirm', title: 'Confirm every vendor in writing', weeksBefore: 4, note: 'Arrival times, contact numbers and final balances.' },
      { id: 'headcount', title: 'Lock the final headcount', weeksBefore: 2, note: 'Caterers usually need this two weeks ahead.' },
      { id: 'seating', title: 'Seating plan and venue walkthrough', weeksBefore: 1, note: 'Walk the space with your planner or venue lead.' },
      { id: 'day', title: 'Wedding day', weeksBefore: 0, note: 'Delegate. You should not be solving problems today.' },
    ],
  },
  birthday: {
    label: 'Birthday',
    blurb: 'A party sized to the guest of honour.',
    minGuests: 2,
    maxGuests: 500,
    defaultGuests: 30,
    leadWeeks: 8,
    categories: [
      { id: 'venue', label: 'Venue', share: 20 },
      { id: 'catering', label: 'Food and drink', share: 32 },
      { id: 'cake', label: 'Cake and desserts', share: 8 },
      { id: 'decor', label: 'Decor and balloons', share: 12 },
      { id: 'entertainment', label: 'Entertainment', share: 14 },
      { id: 'favors', label: 'Favors and gifts', share: 6 },
      { id: 'photography', label: 'Photography', share: 4 },
      { id: 'contingency', label: 'Contingency', share: 4, fixed: true },
    ],
    milestones: [
      { id: 'budget', title: 'Set budget and guest list', weeksBefore: 8, note: 'Decide the age range and who is invited.' },
      { id: 'venue', title: 'Pick and book the venue', weeksBefore: 7, note: 'Check weekend availability and cancellation terms.' },
      { id: 'invites', title: 'Send invitations', weeksBefore: 5, note: 'Include an RSVP date and any theme or dress code.' },
      { id: 'entertainment', title: 'Book entertainment', weeksBefore: 5, note: 'Ask what the performer needs for space and power.' },
      { id: 'cake', title: 'Order the cake', weeksBefore: 3, note: 'Confirm flavour, size and dietary needs.' },
      { id: 'menu', title: 'Plan the menu', weeksBefore: 3, note: 'Include at least one option for each dietary need.' },
      { id: 'decor', title: 'Buy decor and favors', weeksBefore: 2, note: 'Order online early to leave time for delivery.' },
      { id: 'rsvp', title: 'Chase RSVPs and confirm numbers', weeksBefore: 1, note: 'Send final numbers to the caterer or venue.' },
      { id: 'day', title: 'Birthday day', weeksBefore: 0, note: 'Set up early and enjoy it.' },
    ],
  },
  community: {
    label: 'Community event',
    blurb: 'Fundraisers, festivals, meetups and fairs.',
    minGuests: 10,
    maxGuests: 5000,
    defaultGuests: 200,
    leadWeeks: 12,
    categories: [
      { id: 'venue', label: 'Venue or site', share: 18 },
      { id: 'catering', label: 'Food and drink', share: 25 },
      { id: 'av', label: 'Sound, lighting and stage', share: 14 },
      { id: 'promotion', label: 'Promotion and printing', share: 10 },
      { id: 'permits', label: 'Permits and insurance', share: 8 },
      { id: 'activities', label: 'Activities and programme', share: 10 },
      { id: 'volunteers', label: 'Volunteer support', share: 5 },
      { id: 'contingency', label: 'Contingency', share: 10, fixed: true },
    ],
    milestones: [
      { id: 'goals', title: 'Define goals, audience and budget', weeksBefore: 12, note: 'Write down what success looks like.' },
      { id: 'venue', title: 'Secure the venue or site', weeksBefore: 10, note: 'Check capacity, access and noise rules.' },
      { id: 'permits', title: 'Apply for permits and insurance', weeksBefore: 9, note: 'Approvals can take weeks. Start early.' },
      { id: 'volunteers', title: 'Recruit and organize volunteers', weeksBefore: 8, note: 'Assign clear roles and a lead for each.' },
      { id: 'promo', title: 'Launch promotion', weeksBefore: 6, note: 'Use local groups, notice boards and social posts.' },
      { id: 'av', title: 'Confirm sound, lighting and equipment', weeksBefore: 4, note: 'Get a written equipment list from suppliers.' },
      { id: 'supplies', title: 'Order supplies and signage', weeksBefore: 3, note: 'Plan for first aid, waste and water.' },
      { id: 'briefing', title: 'Brief volunteers and run through the schedule', weeksBefore: 1, note: 'Share a one-page run sheet and contact list.' },
      { id: 'day', title: 'Event day', weeksBefore: 0, note: 'Check in with every team lead at the start.' },
    ],
  },
};

/**
 * Categories a user may mark as a priority (everything except fixed ones).
 * @param {string} type - Event type id.
 * @returns {BudgetCategory[]} Prioritizable categories.
 */
export function priorityCategories(type) {
  return (EVENT_TYPES[type]?.categories ?? []).filter((c) => !c.fixed);
}

/**
 * Validate and normalize raw wizard input.
 * @param {object} input - Raw form values.
 * @param {string} [today=todayISO()] - Injectable "today" for deterministic tests.
 * @returns {{valid:boolean, errors:Record<string,string>, value:object|null}} Result.
 */
export function validateEventInput(input, today = todayISO()) {
  const errors = {};
  const type = String(input?.type ?? '');
  const tpl = EVENT_TYPES[type];
  if (!tpl) errors.type = 'Choose an event type.';

  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) errors.name = 'Give your event a name.';
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.';

  const date = String(input?.date ?? '');
  if (!parseDate(date)) errors.date = 'Enter a valid date.';
  else if (date < today) errors.date = 'Pick today or a later date.';

  const guests = Number(input?.guests);
  if (tpl && (!Number.isInteger(guests) || guests < tpl.minGuests || guests > tpl.maxGuests)) {
    errors.guests = `Enter a whole number from ${tpl.minGuests} to ${tpl.maxGuests}.`;
  }

  const budget = Number(input?.budget);
  if (!Number.isFinite(budget) || budget < 100 || budget > 1e9) {
    errors.budget = 'Enter a budget between 100 and 1,000,000,000.';
  }

  const currency = String(input?.currency ?? 'INR');
  if (!CURRENCIES[currency]) errors.currency = 'Choose a supported currency.';

  const allowed = new Set(priorityCategories(type).map((c) => c.id));
  const priorities = [...new Set(Array.isArray(input?.priorities) ? input.priorities : [])];
  if (priorities.length > MAX_PRIORITIES) errors.priorities = `Choose at most ${MAX_PRIORITIES} priorities.`;
  else if (priorities.some((p) => !allowed.has(p))) errors.priorities = 'One of the priorities is not valid for this event.';

  // eslint-disable-next-line no-control-regex
  const vibe = String(input?.vibe ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if (vibe.length > 120) errors.vibe = 'Keep the vibe under 120 characters.';

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    value: valid ? { type, name, date, guests, budget: Math.round(budget), currency, priorities, vibe } : null,
  };
}

/**
 * Build the minimal, non-identifying context sent with AI requests.
 * The event name is deliberately excluded.
 * @param {object|null} event - Current event.
 * @returns {object} Context object ({} when there is no event).
 */
export function buildAiContext(event) {
  if (!event) return {};
  const { type, guests, budget, currency, date, vibe } = event;
  return { type, guests, budget, currency, date, vibe };
}
