/**
 * @fileoverview Pure, timezone-safe calendar helpers. All dates are
 * 'YYYY-MM-DD' strings handled in UTC so results never depend on the
 * machine's timezone.
 */

const DAY_MS = 86400000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a strict ISO calendar date.
 * @param {unknown} iso - 'YYYY-MM-DD'.
 * @returns {Date|null} UTC midnight Date, or null if invalid (e.g. 2026-02-30).
 */
export function parseDate(iso) {
  const m = typeof iso === 'string' ? iso.match(ISO_RE) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === iso ? d : null;
}

/**
 * Format a Date as 'YYYY-MM-DD' (UTC).
 * @param {Date} d - Date to format.
 * @returns {string} ISO date.
 */
export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Today's local calendar date as ISO.
 * @param {Date} [now=new Date()] - Injectable clock.
 * @returns {string} 'YYYY-MM-DD'.
 */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Add (or subtract) days.
 * @param {string} iso - Start date.
 * @param {number} days - Days to add.
 * @returns {string} Resulting ISO date.
 */
export function addDays(iso, days) {
  const d = parseDate(iso);
  if (!d) throw new RangeError(`Invalid date: ${iso}`);
  return toISODate(new Date(d.getTime() + days * DAY_MS));
}

/**
 * Whole days from one date to another (positive if `to` is later).
 * @param {string} from - Start date.
 * @param {string} to - End date.
 * @returns {number} Day difference.
 */
export function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) throw new RangeError('Invalid date');
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Human-readable date.
 * @param {string} iso - ISO date.
 * @param {string} [locale='en-IN'] - BCP 47 locale.
 * @returns {string} e.g. "14 Feb 2027" ('' if invalid).
 */
export function formatDate(iso, locale = 'en-IN') {
  const d = parseDate(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}
