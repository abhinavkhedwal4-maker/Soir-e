# Architecture

Soirée is static HTML plus ES modules and one serverless function. There is no build step.

## Module map

```
js/
  sanitize.js        — pure: escapeHtml, renderAiText, sanitizePromptInjection, cleanLine
  date-utils.js      — pure: parseDate, addDays, daysBetween, formatDate, todayISO
  event-templates.js — pure: EVENT_TYPES, CURRENCIES, validateEventInput, buildAiContext
  budget-model.js    — pure: allocateBudget, categoryStatuses, summarizeBudget, formatMoney
  timeline-model.js  — pure: buildTimeline, summarizeTimeline, describeTimelineForAI
  vendor-checklists.js — pure: getVendorChecklist, checklistProgress, toggleChecked
  errors.js          — pure: AppError, friendlyMessage, logError
  event-store.js     — state: localStorage + optional Firestore mirror
  firebase.js        — lazy loader for Firebase SDK (no-op until configured)
  auth.js            — Firebase Auth helpers, sign-in/out
  shared.js          — DOM helpers, renderChrome, runAiTask, registerActions, theme
  chatbot.js         — askAI, initChat (floating chat panel)
  planner.js  )
  budget.js   )
  timeline.js ) page controllers — DOM wiring only, delegate to pure modules
  vendors.js  )
  ideas.js    )
  my-events.js)

api/
  _lib.js    — handleChat, validateRequest, sanitizeContext, buildMessages, createRateLimiter
  chat.js    — Vercel adapter (thin wrapper over _lib.js)

server.js    — local dev server (thin wrapper over _lib.js, reads headers from vercel.json)
```

## Request lifecycle

1. The user completes the wizard. `validateEventInput` (pure) normalizes the input and `event-store` saves the event to `localStorage`. If signed in, it is mirrored to Firestore in the background.
2. Budget, timeline and vendor pages read the current event and call pure modules: `allocateBudget`, `buildTimeline`, `checklistProgress`. Nothing here touches the network.
3. When the user asks for AI help, the page calls `runAiTask` (shared helper) which calls `askAI`, which POSTs `{ task, messages, context }` to `/api/chat`. `runAiTask` handles the busy state, status messages, `showAi`, error display and focus — once, not per feature.
4. `api/_lib.js` checks method, content type and rate limit, validates the body, sanitizes context with an allowlist, builds the system prompt server-side and calls the NVIDIA chat-completions endpoint with a 25 s `AbortController` timeout. Failures map to generic status codes with a `code` field.
5. The reply is escaped and formatted by `renderAiText` before insertion.

## Why this shape

- **Computation stays out of the model:** amounts and due dates are testable and repeatable; the model only advises.
- **One API core, two adapters:** `api/chat.js` and `server.js` both call `handleChat`, so local behaviour equals production.
- **One header source:** `vercel.json` defines headers; `server.js` reads it.
- **Injectable time and storage:** `buildTimeline(event, today)`, `createStore(storage, clock)` make tests deterministic.
- **Timeline anchoring:** compression is computed from the event's creation date, so due dates do not shift daily.
- **`runAiTask` helper:** the pattern "disable button → think → show AI reply → re-enable → surface error" is DRY across budget, timeline, vendors and ideas. Each caller supplies a task thunk and DOM refs.
- **Accessible `<dialog>`:** delete confirmation avoids `window.confirm` so focus management and keyboard behaviour are controlled.
