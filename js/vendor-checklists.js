/**
 * @fileoverview Pure vendor checklist data and progress calculation.
 */

const CHECKLISTS = {
  wedding: [
    { id: 'venue', label: 'Venue', items: ['Confirm date, hours and setup access', 'Get capacity and layout in writing', 'Check catering and alcohol rules', 'Agree the payment schedule', 'Confirm rain or backup plan'] },
    { id: 'catering', label: 'Caterer', items: ['Attend a tasting', 'Confirm dietary and allergy handling', 'Get per-head and service costs in writing', 'Confirm staffing and equipment', 'Agree the final headcount deadline'] },
    { id: 'photography', label: 'Photographer and videographer', items: ['Review full galleries, not highlights', 'Agree coverage hours and shot list', 'Confirm delivery date and format', 'Confirm backup photographer plan'] },
    { id: 'music', label: 'Music and entertainment', items: ['Hear a recent live set or recording', 'Share the must-play and do-not-play lists', 'Confirm sound and power needs with the venue', 'Agree overtime terms'] },
    { id: 'decor', label: 'Decor and florals', items: ['Share colours and reference photos', 'Confirm setup and teardown times', 'Agree on what happens to flowers after the event', 'Get an itemized quote'] },
    { id: 'attire', label: 'Attire and styling', items: ['Book fittings with buffer time', 'Confirm alteration deadlines', 'Arrange accessories and shoes', 'Plan hair and makeup trial'] },
  ],
  birthday: [
    { id: 'venue', label: 'Venue', items: ['Confirm date, time slot and guest limit', 'Ask what decor is allowed', 'Check the deposit and cancellation terms', 'Confirm outside food and cake policy'] },
    { id: 'catering', label: 'Food and cake', items: ['Confirm dietary and allergy options', 'Confirm delivery or pickup time', 'Agree the order deadline', 'Confirm serving ware and cutlery'] },
    { id: 'entertainment', label: 'Entertainment', items: ['Check the age range suitability', 'Confirm space and power needs', 'Get the performance length in writing', 'Agree overtime and travel charges'] },
    { id: 'decor', label: 'Decor', items: ['Confirm theme and colours', 'Order balloons and banners early', 'Plan setup time', 'Arrange a photo corner'] },
  ],
  community: [
    { id: 'venue', label: 'Venue and permits', items: ['Confirm capacity and access', 'Check noise and curfew rules', 'Submit permit applications', 'Arrange public liability insurance', 'Plan accessibility, parking and toilets'] },
    { id: 'av', label: 'Sound and equipment', items: ['Get an equipment list in writing', 'Confirm power supply and backups', 'Schedule a sound check', 'Agree setup and teardown times'] },
    { id: 'catering', label: 'Food and drink', items: ['Check food safety and licensing', 'Confirm dietary options', 'Agree service times', 'Plan waste and recycling'] },
    { id: 'volunteers', label: 'Volunteers and safety', items: ['Assign a lead for each area', 'Share a run sheet and contact list', 'Arrange first aid cover', 'Plan a crowd and emergency procedure'] },
  ],
};

/**
 * Get a vendor checklist for an event type, with stable item ids.
 * @param {string} type - Event type id.
 * @returns {{id:string,label:string,items:{id:string,text:string}[]}[]} Checklist.
 */
export function getVendorChecklist(type) {
  return (CHECKLISTS[type] ?? []).map((v) => ({
    id: v.id,
    label: v.label,
    items: v.items.map((text, i) => ({ id: `${v.id}-${i + 1}`, text })),
  }));
}

/**
 * Calculate overall and per-vendor progress. Stale ids in `checked` are ignored.
 * @param {object[]} checklist - Output of getVendorChecklist.
 * @param {Record<string,boolean>} [checked={}] - Checked item ids.
 * @returns {{done:number,total:number,percent:number,byVendor:object[]}} Progress.
 */
export function checklistProgress(checklist, checked = {}) {
  const byVendor = checklist.map((v) => {
    const done = v.items.filter((i) => checked[i.id]).length;
    return { id: v.id, label: v.label, done, total: v.items.length, percent: v.items.length ? Math.round((done / v.items.length) * 100) : 0 };
  });
  const done = byVendor.reduce((s, v) => s + v.done, 0);
  const total = byVendor.reduce((s, v) => s + v.total, 0);
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, byVendor };
}

/**
 * Return a new checked map with one item toggled (input is not mutated).
 * @param {Record<string,boolean>} checked - Current map.
 * @param {string} itemId - Item to toggle.
 * @param {boolean} [value] - Force a value; toggles if omitted.
 * @returns {Record<string,boolean>} New map.
 */
export function toggleChecked(checked, itemId, value) {
  const next = { ...checked };
  const on = value ?? !next[itemId];
  if (on) next[itemId] = true;
  else delete next[itemId];
  return next;
}
