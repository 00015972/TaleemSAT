# Step 08 — authoritative, retry-safe attempts

Implemented locally on 12 September 2026. This addresses B08 in the [launch audit](../../launch-audit-2026-09-11.md). Migration 015 is ready but has not been applied to the connected TaleemSAT Supabase project because the remote schema-change approval gate requires explicit user authorization.

## Confirmed issue

The practice request let the browser decide `recordAttempt`, so a caller could ask for correctness without recording a wrong guess and later record only a correct response. The browser's first-result memory also reset with each component session. Practice and the dormant mock implementation treated progression snapshot failures as save failures after attempts had already committed, encouraging duplicate retries.

Step 07 added a client-generated idempotency key, but it did not make the first-answer decision server-owned or bind submissions to an immutable run roster.

## Change

- Added server-issued assessment sessions and immutable ordered session-question rosters shared by practice and mock flows.
- Added a server-generated submission UUID for every assigned question and a unique `(session_id, question_id)` attempt boundary.
- Removed `questionId`, `recordAttempt`, and client-generated submission keys from the practice-answer contract.
- Made the practice route derive question identity from an owned session/submission pair and call a row-locking database function that atomically records the first answer, replays an exact retry, or classifies a later changed answer as an unrecorded learning retry.
- Kept a later server-issued practice run eligible to record a new first answer to the same question. The existing progression ledger remains unique per user/question, so repeat runs cannot mint XP twice.
- Added atomic mock finalization for the complete server-owned roster. Omitted answers become explicit unanswered attempts and cannot shrink the score denominator.
- Excluded unanswered mock rows from the progression trigger so skipped questions do not award XP.
- Kept mock start and submit behind the Step 02 launch gate. The full secure path is dormant but covered by enabled-path tests.
- Changed practice and mock responses to preserve HTTP 200 grading success when only progression display loading fails. Clients clear pending save state and show a non-blocking warning.
- Retained ambiguous-response reconciliation through session-linked attempt rows.
- Updated Drizzle schema, Supabase types, practice/mock clients, runtime validation, schema documentation, and API documentation.

## Database design and preflight

`drizzle/sql/015_authoritative_attempt_sessions.sql` is additive for historical records. It creates the two RLS-enabled session tables, indexed foreign keys and lookup paths, service-role-only transaction functions, nullable `attempts.session_id`, and the session/question unique index. It makes `attempts.selected_answer` nullable only so a finalized mock can represent unanswered questions.

Live read-only inspection confirmed the connected project is `TaleemSAT` (`hueyugiqprnsnogngcjn`), healthy, running PostgreSQL 17, and already contains migration 014's submission-key index. It also found the legacy database-only `attempts_selected_answer_check` constraint that accepts only A–D. Migration 015 removes that obsolete constraint because it conflicts with the supported grid-in answer format.

The pre-change Supabase advisors reported existing unrelated findings, including missing policies on two admin import tables, mutable search paths on legacy timestamp functions, broadly executable legacy security-definer functions, several unindexed foreign keys, and multiple permissive policies. Migration 015 does not broaden those findings; its new write functions explicitly use an empty search path and revoke execution from public, anonymous, and authenticated roles.

## Validation

| Check | Result |
|---|---|
| Focused authoritative practice/mock and contract tests | 49 passed, 0 failed |
| Complete current TypeScript test suite | 94 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Webpack production build | Passed with Next.js 16.3.4; 18 static pages generated and the route inventory preserved |
| `git diff --check` | Passed; only existing CRLF normalization warnings appeared for schema/type files |
| Remote migration 015 | Pending explicit production-schema approval |

Tests prove legacy client recording controls are rejected before privileged access; question identity comes from the owned session roster; wrong first answers remain authoritative; changed later answers are learning retries; exact and ambiguous retries reconcile without new attempts; progression display failure returns saved grading success; mock omissions become unanswered results; repeated mock finalization returns the original score; foreign submission identifiers are rejected; and the disabled mock gate performs no body parsing or database work.

The SQL transaction and concurrency invariants have not yet been exercised against the hosted database because migration 015 was not applied. Application code depends on that migration and must not be deployed first.

## Result

B08 is implemented and verified locally at the application boundary. It is not operationally complete until migration 015 is explicitly approved, applied to the connected TaleemSAT project, and followed by catalog, advisor, and live authenticated practice verification. Deploy the application only after that database rollout succeeds.
