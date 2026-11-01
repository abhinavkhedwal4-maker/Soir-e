/**
 * @fileoverview Event state. localStorage is the source of truth so nothing
 * requires an account; when signed in, events are mirrored to Firestore.
 * `createStore` takes any Storage-like object, which keeps it testable in Node.
 */

import { EVENT_TYPES } from './event-templates.js';
import { todayISO } from './date-utils.js';
import { getFirebase } from './firebase.js';
import { logError } from './errors.js';

const EVENTS_KEY = 'soiree.events.v1';
const CURRENT_KEY = 'soiree.current.v1';

/**
 * Wrap a Storage-like object so quota or privacy-mode failures fall back to memory.
 * @param {Storage|undefined} storage - Storage-like object.
 * @returns {{get:Function,set:Function,remove:Function}} Safe accessors.
 */
function safeStorage(storage) {
  const mem = new Map();
  return {
    get(key) {
      if (storage) {
        try { return storage.getItem(key); } catch (_e) { /* use memory */ }
      }
      return mem.get(key) ?? null;
    },
    set(key, value) {
      if (storage) {
        try { storage.setItem(key, value); return; } catch (_e) { /* use memory */ }
      }
      mem.set(key, value);
    },
    remove(key) {
      mem.delete(key);
      if (storage) {
        try { storage.removeItem(key); } catch (_e) { /* ignore */ }
      }
    },
  };
}

/**
 * @param {unknown} e - Candidate event.
 * @returns {boolean} True if it has the minimum shape of a saved event.
 */
function isEventShape(e) {
  return Boolean(e) && typeof e === 'object' && typeof e.id === 'string' && Boolean(EVENT_TYPES[e.type]) && typeof e.date === 'string';
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create an event store over a storage backend.
 * @param {Storage|undefined} storage - Backend (localStorage in the browser).
 * @param {() => Date} [clock] - Injectable clock.
 * @returns {object} Store API.
 */
export function createStore(storage, clock = () => new Date()) {
  const io = safeStorage(storage);

  const readAll = () => {
    try {
      const parsed = JSON.parse(io.get(EVENTS_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_e) {
      return {};
    }
  };
  const writeAll = (map) => io.set(EVENTS_KEY, JSON.stringify(map));

  const api = {
    list() {
      return Object.values(readAll()).filter(isEventShape).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    get(id) {
      const e = readAll()[id];
      return isEventShape(e) ? e : null;
    },
    current() {
      const id = io.get(CURRENT_KEY);
      return id ? api.get(id) : null;
    },
    setCurrent(id) {
      io.set(CURRENT_KEY, id);
    },
    create(value) {
      const now = clock();
      const event = {
        ...value,
        id: newId(),
        anchorDate: todayISO(now),
        spent: {},
        done: {},
        checked: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      writeAll({ ...readAll(), [event.id]: event });
      api.setCurrent(event.id);
      return event;
    },
    save(event) {
      const saved = { ...event, updatedAt: clock().toISOString() };
      writeAll({ ...readAll(), [saved.id]: saved });
      return saved;
    },
    /** Store an event as-is (used when merging cloud copies). */
    importEvent(event) {
      if (!isEventShape(event)) return false;
      writeAll({ ...readAll(), [event.id]: event });
      return true;
    },
    remove(id) {
      const map = readAll();
      delete map[id];
      writeAll(map);
      if (io.get(CURRENT_KEY) === id) io.remove(CURRENT_KEY);
    },
  };
  return api;
}

function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (_e) {
    return undefined;
  }
}

const store = createStore(browserStorage());

export const listEvents = () => store.list();
export const getEvent = (id) => store.get(id);
export const getCurrentEvent = () => store.current();
export const setCurrentEvent = (id) => store.setCurrent(id);
export const createEvent = (value) => store.create(value);
export const deleteLocalEvent = (id) => store.remove(id);

// ─── Optional cloud mirror (best effort; never blocks the UI) ────────────────

/**
 * Signed-in user's Firestore collection helpers, or null when unavailable.
 * @returns {Promise<{fb:object,uid:string}|null>} Handles.
 */
async function cloud() {
  const fb = await getFirebase();
  const user = fb?.auth.currentUser;
  return fb && user ? { fb, uid: user.uid } : null;
}

/**
 * Upload one event for the signed-in user.
 * @param {object} event - Event to upload.
 * @returns {Promise<boolean>} True if uploaded.
 */
export async function pushEvent(event) {
  try {
    const c = await cloud();
    if (!c) return false;
    const { doc, setDoc } = c.fb.fsM;
    await setDoc(doc(c.fb.db, 'users', c.uid, 'events', event.id), event);
    return true;
  } catch (err) {
    logError('cloud-push', err);
    return false;
  }
}

/**
 * Save locally, then mirror to the cloud in the background.
 * @param {object} event - Event to persist.
 * @returns {object} The saved event.
 */
export function persistEvent(event) {
  const saved = store.save(event);
  pushEvent(saved);
  return saved;
}

/**
 * Delete locally and, if signed in, from the cloud.
 * @param {string} id - Event id.
 * @returns {Promise<void>}
 */
export async function removeEvent(id) {
  store.remove(id);
  try {
    const c = await cloud();
    if (c) await c.fb.fsM.deleteDoc(c.fb.fsM.doc(c.fb.db, 'users', c.uid, 'events', id));
  } catch (err) {
    logError('cloud-delete', err);
  }
}

/**
 * Merge cloud events into local storage (newer copy wins) and upload local-only ones.
 * @returns {Promise<number>} Number of local events changed.
 */
export async function syncFromCloud() {
  try {
    const c = await cloud();
    if (!c) return 0;
    const { collection, getDocs } = c.fb.fsM;
    const snap = await getDocs(collection(c.fb.db, 'users', c.uid, 'events'));
    const remote = new Map();
    snap.forEach((d) => remote.set(d.id, d.data()));

    let changed = 0;
    remote.forEach((re, id) => {
      const local = store.get(id);
      if (!local || String(re.updatedAt) > String(local.updatedAt)) {
        if (store.importEvent(re)) changed += 1;
      }
    });
    await Promise.all(store.list().filter((e) => !remote.has(e.id)).map(pushEvent));
    return changed;
  } catch (err) {
    logError('cloud-sync', err);
    return 0;
  }
}
