/**
 * @fileoverview Lazy Firebase loader. Nothing is downloaded until a signed-in
 * feature needs it, and the app works fully when Firebase is not configured.
 *
 * SETUP: create a NEW Firebase project, enable Google sign-in, create Firestore,
 * paste the web config below, then add `localhost` and your Vercel domain under
 * Authentication > Settings > Authorized domains.
 */

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let cached = null;

/**
 * @returns {boolean} True once real config values have been pasted in.
 */
export function isConfigured() {
  return !firebaseConfig.apiKey.startsWith('YOUR_');
}

/**
 * Load and initialise Firebase on first use.
 * @returns {Promise<{auth:object,db:object,authM:object,fsM:object}|null>} Handles, or null if unconfigured.
 */
export async function getFirebase() {
  if (!isConfigured()) return null;
  if (cached) return cached;
  const [appM, authM, fsM] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appM.initializeApp(firebaseConfig);
  cached = { auth: authM.getAuth(app), db: fsM.getFirestore(app), authM, fsM };
  return cached;
}
