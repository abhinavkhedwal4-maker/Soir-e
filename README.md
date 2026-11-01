# Soirée: a GenAI planner for weddings, birthdays and community events

> Budgets, timelines and checklists are **calculated by tested code**. The AI handles the part that needs imagination: ideas, tailoring and vendor questions.

![CI](https://github.com/soiree-app/soiree/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-127%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## 1. Problem statement alignment

| Requirement | Route | Module | How it works |
|---|---|---|---|
| R1 Budgets | `/pages/budget.html` | `budget-model.js` | Pure allocation by event type, guest count and up to 3 priorities. Amounts always sum exactly to the total. Overspend is flagged live; the AI suggests savings. |
| R2 Timelines | `/pages/timeline.html` | `timeline-model.js` | Pure backward scheduler from the event date. If the date is closer than the usual lead time, milestones compress proportionally from a fixed anchor so dates stay stable. AI adds tailored tips. |
| R3 Vendor checklists | `/pages/vendors.html` | `vendor-checklists.js` | Per-event-type checklists with progress tracking. AI writes questions to ask each vendor. |
| R4 Personalized ideas | `/pages/ideas.html` | `ideas.js` | AI themes, menus and activities from vibe, budget and guest count. |
| R5 Weddings, birthdays, community events | `/pages/planner.html` | `event-templates.js` | One four-step wizard with distinct category splits and milestone schedules per type. |
| R6 Saving plans | `/pages/my-events.html` | `event-store.js` | `localStorage` always; Firestore mirror when signed in. Download plan as JSON. No account required. |

## 2. Architecture

```
Browser (HTML + vanilla ES modules, no build step)
  pure modules  ── date-utils · event-templates · budget-model · timeline-model
                   vendor-checklists · sanitize
  state         ── event-store (localStorage, optional Firestore mirror)
  page scripts  ── planner · budget · timeline · vendors · ideas · my-events (DOM only)
  shared chrome ── shared.js (nav, chat panel, runAiTask, theme, a11y helpers)
        │  POST /api/chat  { task, messages, context }
        ▼
api/chat.js (Vercel function) ─ thin adapter ─▶ api/_lib.js ─▶ NVIDIA API (OpenAI-compatible)
server.js (local dev)         ─ thin adapter ─▶ api/_lib.js  (same headers from vercel.json)
```

Design decisions are recorded in [`docs/decisions.md`](docs/decisions.md) and the request lifecycle in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Generative AI use

The model never decides amounts, dates or progress figures — those are computed by pure, tested functions. The server builds every system prompt from an allowlisted task name and sanitized context so the browser cannot inject its own instructions.

| Feature | What the code computes | What the model produces |
|---|---|---|
| Ask Soirée (chat panel) | Builds context from event (type, guests, budget, date, vibe) | Answers about the user's event |
| Ideas | Formats event details as context | Themes, menus, activities |
| Budget: Suggest savings | Calls `categoryStatuses` → `describeBudgetForAI` | Ranked savings from code-computed figures |
| Timeline: Get tips | Calls `buildTimeline` → `describeTimelineForAI` | Two tailored tips per upcoming milestone |
| Vendors: Questions to ask | Passes the vendor category label | Six specific questions per vendor |

## 4. Security

- Strict CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and `Cross-Origin-Resource-Policy: same-origin` are defined **once in `vercel.json`**; the local server reads the same file.
- No inline handlers or inline styles: `data-action` event delegation, so no `unsafe-inline` for scripts or styles.
- API key only in server environment. Strict request validation (roles, sizes, task allowlist), JSON content-type gate, prompt-injection filtering, rate limiting (20 requests per 15 min per IP), sanitized errors.
- AI output is escaped before it is rendered as HTML (`renderAiText` escapes first, then formats).
- Firestore rules restrict each user to their own events (`firestore.rules`).
- Dependabot configured for weekly dependency PRs; `npm audit --omit=dev` runs in CI.

See [`SECURITY.md`](SECURITY.md) for the threat model and OWASP mapping.

## 5. Accessibility

- Skip link to `#main` on every page.
- One `h1` per page; unique `<title>` on each page.
- Labelled controls everywhere (`<label for=…>` and `aria-labelledby`); `aria-live` status regions for AI output and form feedback.
- Keyboard-operable: native `<details>`, checkboxes, radios, `Escape` closes the chat panel and returns focus, wizard steps move focus to the first field.
- Delete confirmation uses a native `<dialog>` (no `window.confirm`); focus goes to Confirm on open and returns to the trigger on cancel.
- Visible focus rings, 4.5:1+ text contrast in light and dark, `prefers-reduced-motion` honoured, `prefers-color-scheme` plus a manual theme toggle.
- Responsive from 320 px, `lang="en"` on every page.

## 6. Testing

```bash
npm test
```

127 zero-dependency tests import the **real source modules** (no copied logic), covering:

- Sanitization (`escapeHtml`, `renderAiText` XSS payloads, `sanitizePromptInjection`, `cleanLine`)
- Date utilities
- Event validation (all three event types, edge cases)
- Budget engine (exact-sum property, priorities, overspend detection)
- Timeline engine (compression, stability, status classification)
- Vendor checklists
- Event store (corrupt/unavailable storage)
- Error mapping (`friendlyMessage`, `AppError` codes)
- API request validation (boundary sizes, role allowlist, injection filter)
- API handler (success path, all error codes, rate limiter, timeout simulation)

CI runs lint (`eslint --max-warnings 0`), tests and `npm audit --omit=dev` on Node 18 and 20.

## 7. Setup

```bash
npm install
cp .env.example .env       # add NVIDIA_API_KEY
npm test
npm start                  # http://localhost:3000
```

Environment variables:

```env
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
PORT=3000
```

Check which models your key can use:
`curl https://integrate.api.nvidia.com/v1/models -H "Authorization: Bearer $NVIDIA_API_KEY"`

### Firebase (optional)

1. Create a **new** Firebase project, enable Google sign-in and Firestore.
2. Paste the web config into `js/firebase.js`.
3. Authentication → Settings → **Authorized domains**: add `localhost` and your Vercel domain.
4. Paste `firestore.rules` into Firestore → Rules and publish.

Until config is pasted, the Sign in button stays hidden and everything works locally.

## 8. Deployment

Push to GitHub, import the repo in Vercel, and set `NVIDIA_API_KEY` (and optionally `NVIDIA_MODEL`) under Settings → Environment Variables. No build command is needed.

## 9. Evaluation map

| Criterion | Evidence |
|---|---|
| Code quality | Pure modules separated from DOM controllers; shared `runAiTask` helper eliminates repetition; JSDoc on all exports; `data-action` delegation; ESLint in CI |
| Security | Section 4 and `SECURITY.md`; CORP header; Dependabot; `npm audit` in CI |
| Testing and maintainability | 127 tests on real modules (floor was 112); injectable clock and storage; deterministic engines; boundary and XSS tests |
| Efficiency | No build, no framework, Firebase loaded lazily only when configured; debounced saves; in-place DOM updates; capped prompts (900 tokens, 25 s timeout) |
| Problem alignment | Requirement table in section 1; Download plan button; three event types with distinct splits and schedules |
| Accessibility | Section 5; accessible `<dialog>` for delete; skip link; unique titles; `aria-live` regions; keyboard walkthrough confirmed |
| Documentation | This README; `docs/ARCHITECTURE.md`; `docs/decisions.md` (ADRs); `docs/AUDIT.md`; `CHANGELOG.md` |

## 10. Limits and next steps

- The rate limiter is in-memory, so on serverless it is per instance. Use a shared store (for example Upstash Redis) for hard guarantees.
- Event details cannot yet be edited after creation; create a new event instead. (See `docs/decisions.md` ADR-10.)
- Budget templates are general guidance, not local price data.
- No print stylesheet for plans (download as JSON is the export path today).

*Soirée gives planning suggestions, not professional legal, medical or financial advice.*
