# Security Policy

## Threat model
**Assets:** the NVIDIA API key, availability and cost of the AI endpoint, and users' event plans (names, dates, budgets). **Likely threats:** abuse of `/api/chat` (cost and denial of service), prompt injection through chat or fields, XSS through AI output or stored data, key leakage, and misconfigured auth domains.

## Controls
- **Secrets:** `NVIDIA_API_KEY` exists only in environment variables, never in the client or repository. The endpoint refuses to run with a missing or placeholder key.
- **Server-built prompts:** the browser sends only a task name from an allowlist, user/assistant messages and a context object. System prompts are created on the server, and client `system` messages are rejected.
- **Input validation:** roles, message count (12), message length (4,000), body size (32 KB), JSON content type, and a field allowlist for context with type and range checks.
- **Prompt-injection filtering:** common override phrases are neutralized in user messages and context. This is pattern-based and one layer of defence, not a guarantee; the structural controls above matter more.
- **Output safety:** model text is HTML-escaped before formatting. All stored values are escaped when rendered.
- **Rate limiting:** 20 AI requests per 15 minutes per IP. In-memory, so per instance on serverless; see README for a shared-store upgrade.
- **Headers:** CSP without `unsafe-inline` for scripts or styles, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP `same-origin-allow-popups` (needed for the Google sign-in popup), `Cross-Origin-Resource-Policy: same-origin`, and `Cache-Control: no-store` on the API. They are defined in `vercel.json`, which production actually uses, and the local server reads the same file.
- **Static server hardening (local):** path traversal checks, dotfile and source-file blocking.
- **Privacy:** the event name is never sent to the model. Plans stay in `localStorage` unless the user signs in.
- **Firestore rules:** users can only read and write `users/{uid}/events/*` where `uid` is their own.
- **Error hygiene:** users see generic messages; details are logged server-side without keys or request bodies.
- **Dependencies:** zero runtime dependencies; ESLint is dev-only. Firebase SDK is loaded from Google's CDN at a pinned version. Dependabot is configured (`.github/dependabot.yml`) to open weekly PRs for dev-dependency updates. `npm audit --omit=dev` runs in CI.

## OWASP Top 10 (2021)
| Risk | Mitigation |
|---|---|
| A01 Broken access control | Firestore rules per user; core features need no account |
| A02 Cryptographic failures | HTTPS and HSTS; no sensitive data server-side |
| A03 Injection | Validation, allowlists, escaping, injection filtering |
| A04 Insecure design | Threat model; calculations kept out of the model; server-owned prompts |
| A05 Security misconfiguration | Headers defined in the deployed config; placeholder-key refusal |
| A06 Vulnerable components | No runtime dependencies |
| A07 Authentication failures | Delegated to Firebase Auth; optional |
| A08 Integrity failures | CI runs lint and tests; pinned SDK version |
| A09 Logging failures | Tagged server logs for upstream errors and timeouts |
| A10 SSRF | No user-controlled URLs are fetched |

## Reporting a vulnerability
Open a GitHub issue at `https://github.com/soiree-app/soiree/issues` titled `[security]` without exploit details, or contact the maintainer. See `/.well-known/security.txt`.

## Incident response
Identify via logs, rotate `NVIDIA_API_KEY` in Vercel, patch with a regression test in `tests/app.test.js`, redeploy, and record the cause in `CHANGELOG.md`.
