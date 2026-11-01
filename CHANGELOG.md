# Changelog

## [Unreleased]

### Added
- `runAiTask` shared helper in `shared.js` — removes duplicated busy/status/error logic from budget, timeline, vendors and ideas controllers
- Accessible `<dialog>` for delete confirmation in My Events — replaces `window.confirm` with focus management and keyboard support
- Download plan as JSON button on each event card in My Events
- `Cross-Origin-Resource-Policy: same-origin` header in `vercel.json`
- `.github/dependabot.yml` — weekly npm dependency update PRs
- `npm audit --omit=dev` step in CI
- Node 18 + 20 matrix in CI (previously Node 20 only)
- SVG favicon via inline data URI on every HTML page (eliminates 404 noise)
- 15 new tests: `renderAiText` XSS payloads, `validateRequest` boundary sizes, `describeTimelineForAI` / `describeBudgetForAI` edge cases, timeout simulation
- ADR-10 through ADR-13 in `docs/decisions.md`
- `docs/AUDIT.md` with per-criterion scores and remaining risks
- Module map in `docs/ARCHITECTURE.md`

### Changed
- README: requirement table now includes route and module columns; AI usage table now shows what code computes vs what the model produces; tests count updated to 127; section headers renumbered; evaluation map updated
- `SECURITY.md`: updated headers list, dependency management, reporting URL
- `security.txt`: fixed placeholder GitHub username, updated Expires date
- CI badge URL: fixed placeholder GitHub username

### Fixed
- Unused import cleanup in budget, timeline, vendors and ideas controllers
- Test count badge corrected from 105 → 127

## [1.0.0]
- Plan wizard for weddings, birthdays and community events
- Budget planner: exact-sum allocation, priorities, live overspend flags, AI savings ideas
- Timeline builder: backward scheduling with stable compression for short lead times
- Vendor checklists with progress and AI vendor questions
- Ideas studio and floating assistant, served through NVIDIA's OpenAI-compatible API
- `localStorage` persistence with optional Firebase sign-in and Firestore sync
- Security headers in `vercel.json`; API core shared by Vercel and the local server
- 112-test suite importing real modules; CI with lint and tests
- `handleChat` returns distinct error codes: `not_configured`, `upstream_auth`, `upstream_model`, `upstream_unavailable`
- Default model changed to `meta/llama-3.1-8b-instruct` (previous model reached EOL)
