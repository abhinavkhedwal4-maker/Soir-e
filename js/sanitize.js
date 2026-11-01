/**
 * @fileoverview Pure text-safety helpers shared by the browser and the API.
 * No DOM access, so every function is unit-testable in Node.
 */

export const MAX_TEXT = 2000;

/**
 * Escape HTML special characters.
 * @param {unknown} str - Value to escape.
 * @returns {string} Escaped string ('' for non-strings).
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape and truncate user-supplied text.
 * @param {unknown} str - Value to sanitize.
 * @param {number} [max=MAX_TEXT] - Maximum length kept.
 * @returns {string} Safe, length-capped string.
 */
export function sanitizeString(str, max = MAX_TEXT) {
  return escapeHtml(str).slice(0, max);
}

const INJECTION_PATTERNS = [
  /ignore (all |previous |prior |the above )?instructions/gi,
  /disregard (all |previous |your |prior )?(prompts|instructions)/gi,
  /new instructions\s*:/gi,
  /reveal (your |the )?(system )?prompt/gi,
];

/**
 * Neutralize common prompt-override phrases. Pattern-based, so it is one
 * defensive layer, not a guarantee (see SECURITY.md).
 * @param {unknown} str - Text headed for the model.
 * @returns {string} Text with override phrases replaced by "[filtered]".
 */
export function sanitizePromptInjection(str) {
  if (typeof str !== 'string') return '';
  return INJECTION_PATTERNS.reduce((acc, p) => acc.replace(p, '[filtered]'), str);
}

/**
 * Collapse text to one line of printable characters for prompt context.
 * @param {unknown} str - Raw value.
 * @param {number} [max=120] - Maximum length.
 * @returns {string} Cleaned single-line string.
 */
export function cleanLine(str, max = 120) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const flat = str.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitizePromptInjection(flat).slice(0, max);
}

/**
 * Convert plain AI output into safe HTML (paragraphs, bullets, bold, headings).
 * Escapes first, so model output can never inject markup.
 * @param {unknown} raw - Model text.
 * @returns {string} Safe HTML string.
 */
export function renderAiText(raw) {
  const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) { out.push('</ul>'); inList = false; }
  };
  for (const line of escapeHtml(String(raw ?? '')).split(/\r?\n/)) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (item) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${bold(item[1])}</li>`);
    } else if (heading) {
      closeList();
      out.push(`<h4>${bold(heading[1])}</h4>`);
    } else {
      closeList();
      if (line.trim()) out.push(`<p>${bold(line.trim())}</p>`);
    }
  }
  closeList();
  return out.join('');
}
