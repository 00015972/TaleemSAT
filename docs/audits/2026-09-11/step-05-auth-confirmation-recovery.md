# Step 05 — signup confirmation and password recovery

Implemented locally on 12 September 2026. This addresses B05 of the [launch audit](../../launch-audit-2026-09-11.md). The application flow is complete; hosted configuration verification is only partially complete because the Supabase identity available to this session does not expose the checkout's project.

## Change

- Signup now branches on the actual Supabase result: an active session proceeds to `/dashboard`; a successful response without a session shows a check-email state.
- The confirmation-required state identifies the submitted address, explains the next action, and provides resend success/error feedback with repeat-click protection.
- Signup, resend, forgot-password, and settings password-reset requests use explicit callback URLs.
- Recovery requests identify the fixed `/reset-password` destination and recovery flow.
- A successful SSR/PKCE recovery callback sets a 15-minute, `HttpOnly`, `SameSite=Lax` recovery cookie only for the exact recovery callback shape.
- `/reset-password` now requires both a server-verified Supabase user and the short-lived recovery cookie. Direct, invalid, expired, and reused links render a stable error state instead of waiting forever for `PASSWORD_RECOVERY`.
- Password updates use a same-origin server endpoint that rechecks recovery state and user identity, validates the password length, updates through the user-scoped Supabase client, and consumes the recovery cookie after success.
- Touched auth forms use explicit label associations, alert/live-region semantics, guarded submissions, and exception-safe loading state.

## Local validation

| Check | Result |
|---|---|
| Auth flow helper tests | 3 passed: signup outcomes, exact recovery callback recognition, and flow-specific callback failures |
| Recovery endpoint tests | 9 passed: missing cookie, missing user, malformed bodies, password bounds, successful update/cookie consumption, and retryable provider failure |
| Complete TypeScript test suite | 61 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Production build | Passed with webpack; Next.js 16.3.4 generated `/reset-password`, `/api/auth/recovery`, and `/auth/callback` as dynamic routes |
| Signed-out production-page check | Direct `/reset-password` rendered “Reset link unavailable” with a request-new-link action; the old indefinite verification message was absent |

The test suite does not send mail or change a real password. A full clean-browser round trip still requires a deployed build and a test account.

## Hosted Supabase verification

The checkout's `NEXT_PUBLIC_SUPABASE_URL` identifies project `hueyugiqprnsnogngcjn`. A read-only request to that project's public Auth settings endpoint returned HTTP 200 and established:

| Setting | Observed value | Assessment |
|---|---|---|
| Email/password provider | Enabled | Compatible with signup and recovery |
| New user signup | Enabled | Compatible with the signup form |
| `mailer_autoconfirm` | `true` | Production currently does **not** require email confirmation; signup should return a session, and the new confirmation-required branch remains ready if this setting is changed |

The current browser dashboard account exposes only project `gpkwlgeqxgycviyrvqzl`, which is paused, and does not expose the checkout's project. Direct navigation to the checkout project returns to that account's project list. Supabase MCP OAuth completed for the visible `Mirsoduq` organization, but this already-running Codex session still does not expose Supabase project tools and the authorized dashboard identity does not list project `hueyugiqprnsnogngcjn`.

Consequently, these hosted settings are not yet verified:

- Site URL and redirect allowlist;
- confirmation and recovery email template link variables;
- custom SMTP enabled state, sender, host, and port;
- authentication email rate limits and ordinary-recipient delivery capability.

The documented production domain `https://taleemsat.com` also timed out during a 15-second read-only HTTPS check. That check does not establish whether the cause is DNS, hosting, firewalling, or temporary availability.

No secret, user list, email content, or credential was printed or copied into this artifact. No hosted setting was changed and no test email was sent.

## Result

The B05 application code is complete locally and supports both Supabase modes: the currently observed auto-confirm behavior and a future confirmation-required configuration. B05 cannot be marked fully verified for launch until the correct hosted project is accessible and the remaining URL, template, SMTP, rate-limit, and clean-browser email checks pass.
