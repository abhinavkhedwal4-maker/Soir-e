/**
 * @fileoverview Boot sequence shared by every page, plus landing-page init.
 * Page controllers call `boot('<page>')` first.
 */

import { renderChrome, initTheme, registerActions, toggleTheme, $ } from './js/shared.js';
import { initChat } from './js/chatbot.js';
import { wireAuth, toggleAuth } from './js/auth.js';

/**
 * Render shared chrome and wire global behaviour.
 * @param {string} page - Page key used to mark the active nav link.
 * @returns {void}
 */
export function boot(page) {
  initTheme();
  renderChrome(page);
  registerActions({ 'toggle-theme': toggleTheme, 'auth-toggle': toggleAuth });
  initChat();
  wireAuth($('#auth-button'));
}

if (document.body.dataset.page === 'home') boot('home');
