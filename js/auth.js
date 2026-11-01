/**
 * @fileoverview Optional Google sign-in. The app is fully usable without it.
 */

import { getFirebase, isConfigured } from './firebase.js';
import { syncFromCloud } from './event-store.js';
import { logError } from './errors.js';

/**
 * Keep the account button in sync with auth state.
 * @param {HTMLButtonElement|null} button - Button rendered by the shared chrome.
 * @returns {Promise<void>}
 */
export async function wireAuth(button) {
  if (!button) return;
  if (!isConfigured()) {
    button.hidden = true;
    return;
  }
  try {
    const fb = await getFirebase();
    fb.authM.onAuthStateChanged(fb.auth, async (user) => {
      button.textContent = user ? 'Sign out' : 'Sign in';
      button.dataset.signedIn = user ? 'true' : 'false';
      if (user) {
        const changed = await syncFromCloud();
        window.dispatchEvent(new CustomEvent('soiree:synced', { detail: { changed } }));
      }
    });
  } catch (err) {
    logError('auth-init', err);
    button.hidden = true;
  }
}

/**
 * Sign in with Google, or sign out if already signed in.
 * @returns {Promise<void>}
 */
export async function toggleAuth() {
  try {
    const fb = await getFirebase();
    if (!fb) return;
    if (fb.auth.currentUser) await fb.authM.signOut(fb.auth);
    else await fb.authM.signInWithPopup(fb.auth, new fb.authM.GoogleAuthProvider());
  } catch (err) {
    logError('auth-toggle', err);
  }
}
