# Contributing to Soirée

## Setup
```bash
npm install
cp .env.example .env   # add NVIDIA_API_KEY
npm test && npm start
```

## Quality bar (CI enforces both)
| Command | Checks |
|---|---|
| `npm run lint` | ESLint, zero warnings |
| `npm test` | Full suite |

## Layout
Each page has one HTML file in `pages/`, one controller in `js/`, one stylesheet in `css/`. **Pure modules** (`date-utils`, `event-templates`, `budget-model`, `timeline-model`, `vendor-checklists`, `sanitize`) have no DOM, network or clock access; clocks and storage are injected. Controllers only render and wire events. Shared chrome (nav, chat panel, footer) is rendered by `renderChrome` in `js/shared.js`.

## Style
- No inline `onclick` or `style=""`. Use `data-action` and `registerActions`.
- JSDoc on every exported function.
- Escape anything inserted with `innerHTML`.
- Never let the model compute budgets or dates. Compute in a pure module and pass the result in the prompt.
- Conventional Commits: `feat(budget): flag near-limit categories`.

## Tests
Add tests to `tests/app.test.js`. Import the real module; do not copy logic. Cover the happy path, empty and extreme input, and failure modes.

## Security issues
Do not open public issues with exploit details. See `SECURITY.md`.
