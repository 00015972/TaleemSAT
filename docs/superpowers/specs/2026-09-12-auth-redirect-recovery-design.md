# Authentication Redirect and Recovery Design

**Date:** 12 September 2026  
**Audit scope:** B04 and B05 from `docs/launch-audit-2026-09-11.md`

## Objective

Close the two authentication release gates without redesigning the wider authentication UI:

1. Prevent untrusted redirect destinations from reaching Next.js navigation or callback redirects.
2. Complete signup confirmation and password-recovery flows for Supabase's SSR/PKCE session model.
3. Verify the relevant hosted Supabase settings without changing production configuration or exposing secrets.

## Non-goals

- Social login, multi-factor authentication, billing, or account deletion.
- A broad visual redesign of the authentication pages.
- Replacing the current PKCE email flow with a token-hash confirmation route.
- Sending production confirmation or recovery emails during configuration inspection.
- Automatically changing hosted Supabase settings. Any mismatch will be documented for explicit follow-up.

## Redirect boundary

Add one environment-independent helper in `lib/auth` that accepts an unknown redirect value and returns either a safe internal destination or `/dashboard`.

A destination is safe only when it:

- is a non-empty string beginning with exactly one forward slash;
- contains no scheme, protocol-relative prefix, backslash, control character, or malformed percent encoding;
- remains on a fixed local origin after URL parsing; and
- preserves an allowed local path's query string and fragment.

The login page will sanitize `next` before it reaches the client component. The login form will apply the helper again before calling `router.push`, providing defense in depth if it is reused elsewhere. The auth callback will apply the same helper before constructing its response.

Invalid redirect input will fall back to `/dashboard`. Callback exchange failures will redirect to a page that displays a human-readable error instead of silently discarding the cause. Recovery callback failures will lead to the reset page's expired/invalid-link state; other callback failures will lead to the login page.

## Signup confirmation flow

The signup form will inspect both the result and error returned by `signUp`:

- If Supabase returns a session, the account is ready and the user proceeds to `/dashboard`.
- If signup succeeds without a session, the form changes to a confirmation-required state showing the submitted address and clear next steps.
- The confirmation state includes a resend action. Resend success and failure are announced visibly, repeat clicks are disabled while a request is active, and unexpected exceptions restore the enabled state.

Signup and resend requests will use the application callback URL explicitly so hosted templates that honor `RedirectTo` return to the SSR callback.

## Password recovery flow

Forgot-password requests will use the fixed callback destination `/auth/callback?next=/reset-password&flow=recovery`. The callback will exchange the one-time PKCE code first. Only a successful exchange where `next` is exactly `/reset-password` and `flow` is exactly `recovery` will set a short-lived, `HttpOnly`, `SameSite=Lax` recovery cookie.

The reset page will be split into a server gate and a client form:

- The server gate requires both a valid authenticated Supabase user and the short-lived recovery cookie.
- Missing or invalid state renders an explicit expired/invalid-link message with a way to request another link.
- The form never waits exclusively for a browser `PASSWORD_RECOVERY` event, so an SSR-exchanged session cannot leave it permanently on “Verifying your reset link…”.
- Password submission goes to a same-origin server endpoint that rechecks the user and recovery cookie, updates the password through the user-scoped Supabase client, clears the recovery cookie after success, and returns a predictable error shape.
- The client prevents mismatched or short passwords, disables repeated submissions, handles thrown failures, and refreshes navigation after success.

The recovery cookie is an application flow guard, not a substitute for Supabase's one-time code and authenticated session. It contains no identity or secret and expires after 15 minutes.

## Error handling and accessibility

Touched forms will use `try/catch/finally` so network exceptions cannot leave controls permanently disabled. Status and error messages will use live-region semantics. Inputs touched by this work will receive stable IDs, explicit label associations, and error descriptions where applicable. Error copy will avoid exposing raw callback codes or implementation details.

## Automated validation

Focused tests will cover:

- valid local paths, nested paths, queries, and fragments;
- absolute URLs, protocol-relative URLs, executable schemes, backslashes, encoded backslashes, control characters, malformed encodings, and non-string values;
- callback success/failure destination selection and recovery-cookie behavior through extracted pure decision helpers;
- signup session-present versus confirmation-required branching;
- reset readiness based on server-authenticated recovery state rather than an auth event;
- pure signup-result and reset-request state transitions used by the forms.

Repository verification will run the focused tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

## Hosted Supabase verification

Using the connected Supabase project tools, or the authenticated Supabase dashboard as a read-only fallback, inspect:

- the selected project's identity, matched against `NEXT_PUBLIC_SUPABASE_URL` without printing credentials;
- production Site URL;
- exact production and development callback allowlist entries, flagging overly broad production wildcards;
- email/password provider state and whether email confirmation is required;
- confirmation and recovery template links, ensuring they use `ConfirmationURL` or a compatible `RedirectTo` flow that reaches `/auth/callback`;
- custom SMTP enabled state, sender identity, and non-secret host/port metadata;
- relevant authentication email rate limits and any configuration that prevents delivery to ordinary student addresses.

No SMTP password, access token, anon key, service-role key, user email list, or message content will be copied into audit artifacts. Configuration inspection proves setup, not inbox delivery; an end-to-end delivery test remains separate unless explicitly requested.

## Deliverables

- Shared redirect-validation and recovery-flow utilities.
- Updated login, callback, signup, resend, forgot-password, and reset-password behavior.
- Focused automated tests.
- `docs/audits/2026-09-11/step-04-authentication-redirects.md`.
- `docs/audits/2026-09-11/step-05-auth-confirmation-recovery.md`.
- A production-configuration verification summary in the Step 05 document, including any remaining manual or delivery-test gap.

## Acceptance criteria

- Normal internal deep links still work, including query parameters.
- External URLs, `//host`, backslash variants, malformed encodings, and executable schemes never reach router or callback navigation.
- Callback errors are visible and actionable.
- Signup behaves correctly whether confirmation is enabled or disabled.
- Confirmation-required signup provides truthful resend feedback.
- A valid recovery link produces a usable reset form after the server exchanges its code.
- Direct, expired, invalid, and reused reset links produce a stable recovery error state rather than an endless verification message.
- Password update is single-submit, clears recovery state on success, and reports failures without losing retry capability.
- Hosted Supabase redirect, template, provider, SMTP, and rate-limit settings are inspected and documented without mutating production.
- Focused tests, typecheck, lint, and production build pass, or any unrelated pre-existing failure is recorded precisely.
