/**
 * @fileoverview Central error type and logging helper. One place decides what
 * users see and what is logged.
 */

export class AppError extends Error {
  /**
   * @param {string} code - Machine-readable code (network, rate_limited, unavailable, bad_request).
   * @param {string} [message] - Optional developer message.
   */
  constructor(code, message = code) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

const USER_MESSAGES = {
  network: 'Could not reach the assistant. Check your connection and try again.',
  rate_limited: 'You have asked a lot in a short time. Wait a few minutes and try again.',
  unavailable: 'The assistant is unavailable right now. Your plan is unaffected, so try again shortly.',
  bad_request: 'That request could not be processed. Try shortening or rewording it.',
  not_configured: 'The assistant is not set up yet. Contact the site owner.',
};

/**
 * Log an error with a module tag (never shown to users).
 * @param {string} scope - Module name.
 * @param {unknown} err - Error or value.
 * @returns {void}
 */
export function logError(scope, err) {
  console.error(`[soiree:${scope}]`, err instanceof Error ? err.message : err);
}

/**
 * Map any error to a safe, user-facing sentence.
 * @param {unknown} err - Error thrown by a feature.
 * @returns {string} Message safe to display.
 */
export function friendlyMessage(err) {
  return USER_MESSAGES[err?.code] ?? USER_MESSAGES.unavailable;
}
