# Answer-Key Protection Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-12-answer-key-protection-design.md`

**Goal:** Close audit gate B03 by preventing authenticated students from selecting grading-key columns directly while preserving published-question reads, trusted grading, and admin authoring.

**Constraint:** Preserve unrelated framework, mock-restriction, and authentication work already present in the shared working tree. Prepare and validate code before applying the permission migration to the current Supabase project.

## Task 1: Add the least-privilege question grant migration

**Files:**

- Create `drizzle/sql/013_answer_key_column_privileges.sql`

**Steps:**

1. Revoke table-wide question reads from `anon` and `authenticated` before defining column privileges.
2. Grant `authenticated` only the question columns required by current student routes and security-invoker practice RPCs.
3. Keep `correct_answer`, `accepted_answers`, `explanation`, and internal provenance out of the student grant.
4. Preserve full `service_role` access and document the required published-row RLS dependency.
5. Include catalog queries that verify effective table and column privileges after application.

## Task 2: Move grading and protected admin reads behind trusted server authorization

**Files:**

- Modify `app/api/practice/answer/route.ts`
- Modify `app/(admin)/admin/questions/[id]/edit/page.tsx`
- Modify or extend `lib/admin/require-admin.ts`

**Steps:**

1. Authenticate and validate a practice submission before creating the service-role client.
2. Read only the grading columns required for one question with the service-role client.
3. Reuse that same trusted client for the existing attempt write and progression read.
4. Add a page-compatible database-backed admin gate.
5. Run the admin gate before the edit page creates a service-role client or queries protected answers.
6. Preserve current HTTP and UI contracts, including the disabled mock endpoints.

## Task 3: Add focused regression tests

**Files:**

- Create `app/api/practice/answer.test.ts`

**Steps:**

1. Mock authenticated identity, the user-scoped client, and the service-role client independently.
2. Prove signed-out and malformed requests do not reach the privileged client.
3. Prove grading-key reads and attempt writes use only the privileged client.
4. Cover published/unpublished questions, MCQ and grid-in grading, wrong-answer key withholding, successful first-attempt persistence, and database failures.
5. Assert selected answer fields and response shapes do not regress.

## Task 4: Validate locally and inspect the scoped diff

**Steps:**

1. Run the focused practice-answer and mock-access tests.
2. Run all existing unit tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
3. Run `git diff --check` and inspect every changed B03 path for accidental answer exposure or privileged access before authorization.
4. Confirm the student-safe route/RPC column lists fit the migration grant.

## Task 5: Apply and verify the current Supabase project

**Steps:**

1. Resolve the configured project without exposing credentials.
2. Apply migration 013 through a direct database connection or the authenticated Supabase SQL editor.
3. Inspect effective privileges for `anon`, `authenticated`, and `service_role`.
4. Verify direct authenticated reads cannot return answer keys, explanations, drafts, import staging data, or another user's protected records.
5. Verify privileged profile/progression fields cannot be updated.
6. Verify published question loading, practice grading, and admin answer editing still work.
7. Use two disposable non-admin accounts if account creation and confirmation are available; remove them afterward when safe.

## Task 6: Record the audit result

**Files:**

- Create `docs/audits/2026-09-11/step-03-answer-key-protection.md`
- Modify `docs/launch-audit-2026-09-11.md`

**Steps:**

1. Document the original boundary, migration, server changes, test results, hosted verification, and any remaining limitation.
2. State B03 as complete only if the database permission and grading behavior are both verified.
3. Link Step 03 from the launch-audit implementation summary and identify the next unfinished gate without rewriting the historical baseline.
