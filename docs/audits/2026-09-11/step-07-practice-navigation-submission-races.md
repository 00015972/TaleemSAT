# Step 07 — practice navigation and submission races

Completed on 12 September 2026. This closes B07 in the [launch audit](../../launch-audit-2026-09-11.md). The application changes are complete locally, migration 014 was applied to the owner-confirmed TaleemSAT Supabase database, and the navigation flow was exercised through the local production build. The application code has not been deployed.

## Confirmed issue

`ReadyPracticeRunner` updated the manifest index before its question request completed. Overlapping navigation requests could settle out of order and replace the visible question with an older response while answer submission read the identifier from the newer index. Question prefetch and foreground fetches were not deduplicated, failed fetches could leave an indefinite skeleton, and repeated Enter events could cross the asynchronous React `checking` update. Recorded attempts had no stable request identity for retry after a lost response.

## Change

- Added a monotonic navigation request gate. Only the newest foreground request may commit the visible question, loading state, error, or timer.
- Made the displayed question valid only when its identifier matches the active manifest entry. Selection, shortcuts, and submission use that same identity boundary.
- Added a keyed in-flight loader shared by prefetch and foreground navigation. One question identifier now has at most one unresolved fetch.
- Added a visible question-load error with a retry action. Stale failures cannot replace the current view.
- Added a synchronous submission lock that closes the gap before React commits its visual checking state.
- Captured answer submissions by question identifier. Results, errors, attempts, and progression update the submitted question even if navigation occurs while the response is pending.
- Added an immutable pending first-submission payload containing question ID, selected answer, original timing, and a browser-generated UUID. An indeterminate retry reuses the exact payload.
- Extended the bounded practice-answer schema so recorded attempts require a UUID submission key and unrecorded learning retries cannot supply one.
- Added `attempts.submission_key` plus a unique `(user_id, submission_key)` index in `drizzle/sql/014_practice_submission_idempotency.sql`, Drizzle schema, and Supabase types.
- Made the answer route recover the existing attempt after a conflict on the named submission-key index. Exact payload replays return the stored correctness and progression; mismatched reuse returns `409 SUBMISSION_KEY_REUSED`. Unrelated unique violations remain save failures.

## Database verification

Migration 014 was applied transactionally through the existing owner-confirmed database connection. A post-apply catalog query confirmed:

- `public.attempts.submission_key` has type `uuid`;
- the column is nullable for historical and non-practice rows; and
- `attempts_user_submission_key_unique` exists on `(user_id, submission_key)`.

The additive migration is safe to rerun. It does not backfill or alter existing attempts.

## Validation

| Check | Result |
|---|---|
| Race-safety and validation-schema tests | 11 passed, 0 failed |
| Practice-answer route tests | 12 passed, 0 failed |
| Complete current TypeScript test set | 86 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Production build | Passed with Next.js 16.3.4 using webpack; 18 static pages generated and route inventory preserved |
| Local production browser check | Passed with an authenticated student; an immediate question 80 jump, Next, and Back settled on question 80 with matching content and no browser warnings/errors |
| `git diff --check` | Passed; only existing CRLF normalization warnings were reported for generated/schema files |

The default Turbopack build could not run in the execution sandbox because its CSS worker was denied permission to bind a local port. The webpack production build compiled, typechecked, generated all routes, and completed successfully.

Focused tests prove stale navigation identities are rejected, foreground and prefetch loads share a promise, rejected loads can retry, the lock rejects a second synchronous acquisition, a pending retry preserves its original key and timing, and displayed/active question identifiers must match. Route tests prove validation happens before privileged access, the key is persisted, exact conflict replay returns the stored attempt, mismatched key reuse returns 409, unrelated constraint failures are not mistaken for replay, and the answer-key boundary remains intact.

No real student answer was submitted during browser verification, so the check did not alter student analytics. Repeated Enter is covered at the synchronous lock boundary rather than by writing a real attempt. A deployment smoke test should repeat throttled navigation and one disposable-account response-loss replay after the local application code is deployed.

## Result

B07 is complete locally and at the database schema boundary. Rapid navigation cannot make a stale response authoritative, submission is derived from the validated displayed question, duplicate client events are synchronously excluded, and retried recorded answers have a database-enforced idempotency key. Deploy the updated application code before relying on the already-applied submission-key requirement.
