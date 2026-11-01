/**
 * @fileoverview Pure backward scheduler. Milestones are placed relative to the
 * event date; if less time remains than the full lead time, the schedule is
 * compressed proportionally from a fixed anchor date so due dates stay stable.
 */

import { EVENT_TYPES } from './event-templates.js';
import { addDays, daysBetween, formatDate } from './date-utils.js';

export const DUE_SOON_DAYS = 7;

/**
 * Build the milestone schedule for an event.
 * @param {{type:string,date:string,anchorDate:string,done?:Record<string,boolean>}} event - Event data.
 * @param {string} today - Today's ISO date (injected for testability).
 * @returns {{milestones:object[], compressed:boolean}} Ordered milestones.
 */
export function buildTimeline({ type, date, anchorDate, done = {} }, today) {
  const tpl = EVENT_TYPES[type];
  if (!tpl) throw new RangeError(`Unknown event type: ${type}`);

  const available = daysBetween(anchorDate, date);
  if (available < 0) return { milestones: [], compressed: false };

  const fullDays = tpl.leadWeeks * 7;
  const scale = Math.min(1, available / fullDays);

  const milestones = tpl.milestones
    .map((m) => {
      const due = addDays(date, -Math.round(m.weeksBefore * 7 * scale));
      const isDone = Boolean(done[m.id]);
      const daysLeft = daysBetween(today, due);
      let status = 'upcoming';
      if (isDone) status = 'done';
      else if (daysLeft < 0) status = 'overdue';
      else if (daysLeft <= DUE_SOON_DAYS) status = 'soon';
      return { id: m.id, title: m.title, note: m.note, weeksBefore: m.weeksBefore, due, daysLeft, status };
    })
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.weeksBefore - a.weeksBefore));

  return { milestones, compressed: scale < 1 };
}

/**
 * Summarize progress across milestones.
 * @param {object[]} milestones - Output of buildTimeline.
 * @returns {object} Counts, percent complete and the next open milestone.
 */
export function summarizeTimeline(milestones) {
  const total = milestones.length;
  const done = milestones.filter((m) => m.status === 'done').length;
  return {
    total,
    done,
    overdue: milestones.filter((m) => m.status === 'overdue').length,
    soon: milestones.filter((m) => m.status === 'soon').length,
    percent: total ? Math.round((done / total) * 100) : 0,
    next: milestones.find((m) => m.status !== 'done') ?? null,
  };
}

/**
 * Describe the next open milestones as plain text for the AI "tailor notes" request.
 * @param {object[]} milestones - Output of buildTimeline.
 * @param {number} [count=3] - How many to include.
 * @returns {string} Prompt text.
 */
export function describeTimelineForAI(milestones, count = 3) {
  const open = milestones.filter((m) => m.status !== 'done').slice(0, count);
  if (open.length === 0) return 'Every milestone is complete. Suggest a short final-week checklist.';
  const lines = open.map((m) => `- ${m.title} (due ${formatDate(m.due)}, ${m.status})`);
  return `These are my next milestones. For each, give two specific tips tailored to my event.\n${lines.join('\n')}`;
}
