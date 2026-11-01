# Architecture Decision Records

## ADR-1: Deterministic budget and schedule engines
Allocation, overspend detection and milestone dates are pure functions with tests. The model receives their output and only suggests. This prevents hallucinated figures.

## ADR-2: Server-owned prompts
The client sends a task id from an allowlist plus sanitized context. System prompts are built on the server and client `system` messages are rejected, which removes the easiest prompt-injection path.

## ADR-3: NVIDIA's OpenAI-compatible API behind our own endpoint
The key never reaches the browser. The model is read from `NVIDIA_MODEL` with a verified default, so a deprecation is a config change.

## ADR-4: Headers live in `vercel.json`
Headers set only in the local server do not exist in production. `vercel.json` is the single source and `server.js` reads it.

## ADR-5: No inline handlers or styles
`data-action` delegation and CSSOM updates mean the CSP needs no `unsafe-inline`. Progress is shown with native `<progress>` elements.

## ADR-6: Local-first persistence
`localStorage` is the source of truth; Firestore is an optional mirror (newer `updatedAt` wins). No account is needed for any feature.

## ADR-7: Largest-remainder rounding
Allocations are whole currency units that always sum to the budget, avoiding off-by-one totals.

## ADR-8: Vanilla JS
No build tooling and fast loads. Type safety comes from JSDoc, validation at boundaries and tests.

## ADR-9: Minimalist design system
Hairline borders, one terracotta accent, Fraunces and Inter, no shadows or gradients. A darker accent shade is used for text to keep 4.5:1 contrast.

## ADR-10: No edit-after-creation (for now)
Event details cannot be edited after creation; the user creates a new event instead. The decision avoids complexity around budget and timeline recomputation without test coverage for the transition states. A future version should add an edit wizard step that calls `validateEventInput` on the new values, updates `budget` and `guests`, and calls `persistEvent`.

## ADR-11: runAiTask shared helper
The pattern "disable button → set thinking status → call askAI → show reply / show error → re-enable" was duplicated in budget, timeline, vendors and ideas. Extracted to `runAiTask` in `shared.js` so the logic lives once and each caller supplies a task thunk and three DOM refs.

## ADR-12: Native `<dialog>` for delete confirmation
`window.confirm` is not keyboard-accessible in some browsers and provides no focus control. A native `<dialog>` gives explicit focus management (focus on Confirm when open, return to trigger on cancel), standard `Escape` handling, and a backdrop that blocks interaction with the rest of the page.

## ADR-13: Download plan as JSON
Saving plans locally is R6. Exporting via `URL.createObjectURL` + a temporary `<a>` link is zero-dependency and works in all modern browsers. The exported JSON contains the full event object, including budget spends and milestone completion state.
