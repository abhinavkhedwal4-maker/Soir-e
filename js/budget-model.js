/**
 * @fileoverview Pure budget engine: allocation by event type, guest count and
 * priorities, plus overspend detection. Deterministic and unit-tested.
 */

import { EVENT_TYPES, CURRENCIES, PRIORITY_BOOST } from './event-templates.js';

export const WARN_THRESHOLD = 0.9;

/**
 * Split a total budget across an event type's categories. Priority categories
 * are weighted up, the contingency is never boosted, and amounts always sum
 * exactly to the total (largest-remainder rounding).
 * @param {{type:string,budget:number,priorities?:string[]}} params - Event data.
 * @returns {{id:string,label:string,amount:number,pct:number}[]} Allocations.
 */
export function allocateBudget({ type, budget, priorities = [] }) {
  const tpl = EVENT_TYPES[type];
  if (!tpl) throw new RangeError(`Unknown event type: ${type}`);
  if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('Budget must be a positive number');

  const total = Math.round(budget);
  const weights = tpl.categories.map((c) => c.share * (!c.fixed && priorities.includes(c.id) ? PRIORITY_BOOST : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / weightSum) * total);
  const amounts = exact.map(Math.floor);

  let leftover = total - amounts.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .forEach(({ i }) => {
      if (leftover > 0) { amounts[i] += 1; leftover -= 1; }
    });

  return tpl.categories.map((c, i) => ({
    id: c.id,
    label: c.label,
    amount: amounts[i],
    pct: Math.round((amounts[i] / total) * 1000) / 10,
  }));
}

/**
 * Clamp a user-entered spend to a non-negative finite number.
 * @param {unknown} v - Raw value.
 * @returns {number} Safe amount.
 */
export function cleanAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Compare planned allocations against what has been spent.
 * @param {{id:string,label:string,amount:number}[]} allocations - Planned amounts.
 * @param {Record<string,number>} [spent={}] - Spend per category id.
 * @returns {object[]} Per-category status rows.
 */
export function categoryStatuses(allocations, spent = {}) {
  return allocations.map((a) => {
    const used = cleanAmount(spent[a.id]);
    const ratio = a.amount > 0 ? used / a.amount : used > 0 ? Infinity : 0;
    let status = 'ok';
    if (used > a.amount) status = 'over';
    else if (ratio >= WARN_THRESHOLD) status = 'warn';
    return { id: a.id, label: a.label, planned: a.amount, spent: used, remaining: a.amount - used, ratio, status };
  });
}

/**
 * Roll category statuses up into totals.
 * @param {object[]} statuses - Output of categoryStatuses.
 * @param {number} guests - Guest count.
 * @returns {object} Totals, per-guest cost and over-budget categories.
 */
export function summarizeBudget(statuses, guests) {
  const planned = statuses.reduce((s, c) => s + c.planned, 0);
  const spent = statuses.reduce((s, c) => s + c.spent, 0);
  return {
    planned,
    spent,
    remaining: planned - spent,
    perGuestPlanned: guests > 0 ? Math.round(planned / guests) : 0,
    perGuestSpent: guests > 0 ? Math.round(spent / guests) : 0,
    overCategories: statuses.filter((c) => c.status === 'over').map((c) => c.id),
    overBudget: spent > planned,
  };
}

/**
 * Format money for a currency code.
 * @param {number} amount - Amount.
 * @param {string} [currency='INR'] - Currency code.
 * @returns {string} Formatted amount.
 */
export function formatMoney(amount, currency = 'INR') {
  const meta = CURRENCIES[currency] ?? CURRENCIES.INR;
  const code = CURRENCIES[currency] ? currency : 'INR';
  return new Intl.NumberFormat(meta.locale, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount);
}

/**
 * Describe the budget as plain text for the AI "suggest savings" request.
 * The figures are computed here; the model only advises.
 * @param {object[]} statuses - Category statuses.
 * @param {string} currency - Currency code.
 * @returns {string} Prompt text.
 */
export function describeBudgetForAI(statuses, currency) {
  const lines = statuses.map((c) => `- ${c.label}: planned ${formatMoney(c.planned, currency)}, spent ${formatMoney(c.spent, currency)} (${c.status})`);
  return `Here is my budget so far. Suggest practical ways to save without hurting the guest experience, starting with any category that is over or near its limit.\n${lines.join('\n')}`;
}
