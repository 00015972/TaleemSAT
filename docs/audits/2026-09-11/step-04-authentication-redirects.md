# Step 04 — authentication redirect validation

Completed locally on 12 September 2026. This implements B04 of the [launch audit](../../launch-audit-2026-09-11.md). It does not represent a deployment.

## Change

- Added one shared redirect boundary in `lib/auth/redirect.ts` for server and client auth navigation.
- Allowed same-origin absolute paths, including legitimate query strings and fragments.
- Rejected absolute URLs, protocol-relative paths, schemes, backslashes, encoded and repeatedly encoded slash/backslash variants, control characters, malformed percent encoding, non-string values, surrounding whitespace, and oversized values.
- Sanitized the login page's `next` value before it reaches the client and repeated the check immediately before `router.push`.
- Sanitized the callback destination before constructing a redirect. Invalid values fall back to `/dashboard`.
- Added visible login feedback for failed non-recovery callbacks.
- Preserved protected-route query strings when proxying a signed-out user to login.
- Copied refreshed Supabase cookies onto proxy redirect responses so an authentication redirect does not discard a token refresh.

## Validation

| Check | Result |
|---|---|
| Redirect helper tests | 4 passed: valid deep links, malicious/malformed inputs, dot-segment normalization, and callback URL construction |
| Complete TypeScript test suite | 61 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Production build | Passed with Next.js 16.3.4 using webpack; auth callback and recovery API routes are present |
| Local production HTTP checks | Passed: signed-out `/question-bank?mode=focus&count=12` retained the full intended path; invalid callback destinations returned to login with a visible error code; recovery callback failures returned to the reset error state |

The default Turbopack build could not run in this execution environment because its CSS worker was denied permission to bind a local port. The webpack production build compiled, typechecked, generated all 17 static pages, and completed successfully.

## Result

B04 is complete locally. Both the server callback and client login path use the same fail-closed validation rules. A malicious `next` value cannot select an external destination, while legitimate application deep links retain their query parameters.

No valid production auth code was consumed, no account was changed, and no authentication email was sent during this step.
