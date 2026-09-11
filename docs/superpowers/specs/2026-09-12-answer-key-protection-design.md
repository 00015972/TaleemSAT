# Answer-Key Protection Design

**Date:** 12 September 2026  
**Audit scope:** B03 from `docs/launch-audit-2026-09-11.md`

## Objective

Prevent a signed-in student from reading grading keys directly through the Supabase Data API while preserving ordinary published-question access, server-side grading, and administrator authoring.

The platform is not published and currently has one user, the owner. This permits a controlled database permission change now, provided the application change is prepared first and the current database is verified immediately afterward.

## Confirmed boundary problem

`app/api/practice/answer/route.ts` currently loads `correct_answer`, `accepted_answers`, and `explanation` through the same user-scoped Supabase client available to an authenticated browser. The custom practice response may omit those values, but that does not prevent a student from calling Supabase directly if the `authenticated` database role has table-wide `SELECT` permission.

Row-Level Security filters rows, not columns. A policy that limits students to published questions can therefore still expose every column of those published rows.

## Selected approach

Use PostgreSQL column privileges for the student-facing `questions` table and use the existing server-only service-role client for grading-key reads.

This is preferred over moving answers to a new table because it closes the current boundary with a smaller, reversible migration. It is preferred over a new security-definer grading RPC because the application already has a protected server route and a server-only client, while a callable grading RPC would create another public interface to secure and test.

## Database permissions

Add the next numbered SQL migration under `drizzle/sql/`. The migration will:

- revoke table-wide `SELECT` on `public.questions` from `anon` and `authenticated`;
- grant `authenticated` access only to the columns required for published question discovery and display;
- omit `correct_answer`, `accepted_answers`, and `explanation` from the student grant;
- keep `service_role` access intact;
- leave row-level policies responsible for hiding draft and archived rows;
- preserve the columns used by the security-invoker `get_practice_overview` and `get_practice_run` functions; and
- be safe to re-run where practical.

The student-readable set will include question identity and taxonomy fields, passage and question content, figures/tables, type and options, difficulty, status, tags, and ordering/filter metadata needed by current practice queries. Internal authoring provenance will not be granted unless an existing student path demonstrably requires it.

PostgreSQL table-wide grants override narrower column revocations, so the migration must revoke table-wide `SELECT` before issuing the explicit column grant.

## Application access paths

The practice answer route will authenticate the caller first, validate the request as it does today, and then use `createAdminClient()` only for the minimal grading-key query and the existing trusted attempt write. It will continue to reject missing or unpublished questions and will preserve the current response contract: wrong guesses do not receive the key; correct guesses receive the canonical answer and explanation.

Any administrator page that needs protected answer columns will use the service-role client only after a page-local database-backed admin check. It must not rely solely on editable authentication metadata or on a parent layout check before initiating a privileged query.

Student-safe question routes and practice RPCs will remain on the user-scoped client so RLS continues to constrain published content.

Mock grading remains unavailable under Audit Step 02. Its disabled handlers must continue to perform no question reads or attempt writes.

## Broader B03 verification

The verification covers the full acceptance boundary named by the launch audit:

- answer keys and explanations are unreadable through direct student Supabase requests;
- draft and archived questions remain unreadable;
- one student cannot read another student's attempts, progression records, profile, or subscription;
- students cannot update `role`, `tier`, XP, streak, or subscription fields;
- import staging data remains inaccessible; and
- practice grading still succeeds through the authorized server route.

No unrelated policy redesign is included. A discovered failure in these adjacent checks will be fixed only when the required change is narrow and part of the same authorization boundary; otherwise it will be recorded as a remaining blocker.

## Test strategy

Add focused route tests with fail-fast fake clients to prove:

- authentication happens before privileged database access;
- the grading-key read uses only the server-only client;
- missing and unpublished questions do not create attempts;
- correct and incorrect MCQ/grid-in results preserve the response contract; and
- database or attempt-write failures return predictable errors.

Add a SQL verification script or documented query set that checks effective column privileges for `anon`, `authenticated`, and `service_role`. Repository validation will run focused tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

After the project changes pass locally, apply the migration to the current Supabase project. Verify direct access with two disposable non-admin identities when possible. Because the project currently contains only the owner account, disposable test users may be created and removed as part of verification without modifying the owner's profile or attempts. If account creation, email confirmation, or database connectivity blocks two-user verification, record the exact gap rather than claiming full acceptance.

## Rollout and rollback

Prepare and validate application code before changing Supabase. Then apply the permission migration and immediately verify student question loading, grading, and admin editing against the current project.

If grading or authoring fails, restore the previous table-wide `SELECT` grant only as a temporary rollback while correcting the code. The rollback reopens the answer-key exposure, so it is not an acceptable final state.

No question content, owner data, or existing attempts will be edited by the migration.

## Documentation

Create `docs/audits/2026-09-11/step-03-answer-key-protection.md` containing:

- the confirmed original exposure;
- the code and migration changes;
- the exact local and hosted checks performed;
- whether two-account isolation was fully demonstrated;
- any connectivity or hosted-configuration limitation; and
- the final B03 status without overstating unverified behavior.

Update the launch audit implementation summary to link Step 03 and identify the next unfinished release gate.

## Acceptance criteria

- An authenticated student cannot select `correct_answer`, `accepted_answers`, or `explanation` directly from `public.questions`.
- Authenticated students can still load published practice manifests and question content.
- Draft and archived questions remain hidden from students.
- Practice grading reads protected values only through trusted server authorization and preserves current behavior.
- Admin question editing can still load and save answer keys after an explicit database-backed admin check.
- Direct student access cannot read another user's protected records or update privileged account/progression fields.
- Mock endpoints remain disabled and do not access grading data.
- The migration is applied to the current Supabase project and its effective privileges are verified, or a precise external blocker is documented.
- Focused tests, typecheck, lint, and production build pass, or any unrelated pre-existing failure is reported precisely.
