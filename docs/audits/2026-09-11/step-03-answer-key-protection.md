# Step 03 — answer-key protection

Completed on 12 September 2026. This closes B03 in the [launch audit](../../launch-audit-2026-09-11.md). The application changes are complete locally, migration 013 was applied to the owner-confirmed TaleemSAT Supabase project, and the hosted boundary was verified with two disposable non-admin accounts plus one temporary admin account.

## Confirmed issue

The practice answer route read `correct_answer`, `accepted_answers`, and `explanation` with the authenticated user's Supabase client. That client has the same database role a signed-in browser can use against the Supabase Data API. Hiding answer fields in a custom route response therefore did not establish a database-enforced answer-key boundary.

RLS can hide draft rows but does not hide selected columns from an otherwise visible published row. Effective column privileges are required in addition to the published-question RLS policy.

## Local change

- Added `drizzle/sql/013_answer_key_column_privileges.sql`.
- The migration removes broad table privileges and historical column-level question reads from `anon` and `authenticated`, then grants `authenticated` only the fields required by published-question display and the existing security-invoker practice RPCs. This also removes unused direct insert, update, delete, truncate, reference, and trigger privileges; question authoring already uses admin-gated service routes.
- `correct_answer`, `accepted_answers`, `explanation`, author provenance, source reference, and update timestamps are absent from the student grant.
- The migration preserves full question reads for `service_role` and fails if effective privilege checks show a sensitive student grant or missing required content grant.
- The practice answer route now authenticates and validates the request before creating the server-only client. That one trusted client performs the minimal grading-key read, attempt insert, and progression follow-up.
- The admin question editor now performs its own database-backed admin gate before creating a service-role client and loading protected answer fields. It no longer depends on student-role column access or solely on the parent layout gate.
- Null and array JSON bodies now receive `400 INVALID_BODY` instead of reaching destructuring or privileged database code.
- Mock handlers remain disabled and contain no grading reads or attempt writes.
- Added `scripts/verify-answer-key-boundary.mjs`, guarded by the explicit `B03_ALLOW_TEST_USER_MUTATIONS=true` opt-in, to reproduce the live isolation checks and remove its disposable accounts in a `finally` cleanup.

## Local validation

| Check | Result |
|---|---|
| Focused practice-answer and mock-access tests | 30 passed, 0 failed |
| Complete current unit-test set | 52 passed, 0 failed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| Production build | Passed with Next.js 16.3.4 using webpack; route inventory preserved |
| `git diff --check` | Passed |

The practice-answer tests use independent fail-fast student and service-role fakes. They prove signed-out and malformed requests never create the privileged client; grading keys are selected only through the server-only client; wrong retries do not return the key or create attempts; MCQ and grid-in grading retain their current response behavior; unpublished questions do not create attempts; and persistence/progression failures retain explicit error responses.

These automated tests validate control flow, not hosted PostgreSQL grants.

## Hosted verification

Before migration 013, catalog inspection confirmed that both `anon` and `authenticated` had table-wide `SELECT` on `public.questions`. Their effective column permissions included `correct_answer`, `accepted_answers`, and `explanation`; the code concern was therefore a confirmed live exposure, not only a theoretical risk.

The owner identified the Supabase project referenced by `.env.local` as the authoritative TaleemSAT project. Migration 013 was applied transactionally through that project's Asia-Pacific connection pooler.

Post-migration catalog inspection showed:

- `anon` has no table-wide or column-level question reads;
- `authenticated` has no table-wide question read and can select only the 15 explicitly granted student-safe columns;
- `authenticated` has no effective access to `correct_answer`, `accepted_answers`, or `explanation`;
- `authenticated` also has no direct insert, update, delete, truncate, reference, or trigger privilege on questions; and
- `service_role` retains full question reads, including all grading-key columns.

The live verification then created two confirmed disposable student identities and checked:

- published student-safe question reads succeed;
- direct grading-key reads fail;
- draft and archived questions return no rows;
- `get_practice_run` succeeds and contains no protected fields;
- one student cannot read the other student's profile, attempt, progression, or subscription rows;
- a student cannot update their own role, tier, or XP;
- a student cannot update the other student's ordinary profile fields;
- a student cannot update questions or insert a self-graded attempt;
- import jobs and import items return no accessible rows; and
- the updated local production grading route returns a correct result through its server-only key read.

A third disposable identity was promoted through the database-backed `users.role` field solely for a read-only admin smoke test. It successfully loaded the protected question editor through the updated local production build, proving the page-local gate and service-role answer read work after the column restriction. No real question was edited.

All disposable Auth and profile records were removed afterward. A direct cleanup query returned zero matching Auth users and zero matching public profiles. The temporary production server was stopped.

## Configuration note

The checked-in application was able to reach the hosted database only after parsing the configured pooler components separately. The current `.env.local` `DATABASE_URL` contains URL-special characters in its password without percent encoding, so ordinary URL parsing misidentifies its host and database path. This did not affect the Supabase Data API clients, which use separate URL and key variables, but it will continue to break Drizzle and other standard PostgreSQL clients until a fresh correctly encoded connection string is copied from the authoritative project's Connect panel.

During diagnosis, password material from the malformed connection string became visible in transient command output. Treat the database password as exposed: rotate it in Supabase and replace the local `DATABASE_URL` before relying on that credential again. The service-role key was not printed.

## Result

B03 is complete for the current unpublished platform. The Supabase/Postgres least-privilege guidance directly shaped the fix: RLS remains the row boundary, while explicit column grants now form the answer-key boundary. Students retain only the published content surface they need; trusted server and database-backed admin paths retain grading access.

Before publishing the platform, deploy the updated application code so the live grading route matches the already-applied database permissions. Do not deploy an older build that still attempts grading-key reads through the authenticated client.
