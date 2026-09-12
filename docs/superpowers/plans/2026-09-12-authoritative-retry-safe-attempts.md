# Authoritative, Retry-Safe Attempts Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-12-authoritative-retry-safe-attempts-design.md`

**Goal:** Make practice first answers and mock final submissions server-authoritative, transactionally idempotent, and successful even when only the progression display read fails.

**Constraint:** Keep mock routes disabled at their existing launch gate while implementing and testing the secure behavior behind it. Preserve the in-progress Step 7 replay-hardening changes already present in the working tree.

## Task 1: Add the assessment-session database model

**Files:**

- Create `drizzle/sql/015_authoritative_attempt_sessions.sql`
- Modify `drizzle/schema.ts`
- Modify `lib/supabase/types.ts`

**Steps:**

1. Add assessment session/context/status enums and tables for owned sessions and immutable ordered question rosters.
2. Give every session question a server-generated submission UUID and optional linked attempt.
3. Add nullable `session_id` to historical attempts, make mock unanswered responses representable, and enforce unique `(session_id, question_id)` attempts.
4. Add protected database functions for practice-session creation, practice answer claiming/replay, mock-session creation, and one-time mock finalization.
5. Lock the relevant session rows inside write functions and revoke browser execution for trusted grading/finalization functions.
6. Mirror the migration in Drizzle and generated Supabase types.

## Task 2: Define bounded server-authoritative contracts

**Files:**

- Modify `lib/validation/schemas.ts`
- Modify `lib/validation/schemas.test.ts`
- Modify `components/practice/types.ts`
- Add shared assessment/mock types as needed

**Steps:**

1. Replace practice `questionId`, `recordAttempt`, and client-generated key input with server-issued session and submission UUIDs.
2. Extend practice bootstrap types with the session and per-question identifiers.
3. Define bounded mock-start and mock-finalization inputs keyed by server-issued identifiers.
4. Reject duplicate identifiers, unknown fields, invalid answers, and invalid timing before privileged access.

## Task 3: Issue and consume authoritative practice sessions

**Files:**

- Modify `app/api/practice/manifest/route.ts`
- Modify `app/api/practice/answer/route.ts`
- Modify `app/api/practice/answer.test.ts`
- Modify `components/practice/practice-runner.tsx`
- Modify `lib/practice/race-safety.ts`
- Modify `lib/practice/race-safety.test.ts`

**Steps:**

1. Create the practice session and roster at manifest load and return server-issued IDs.
2. Resolve the graded question only through an owned session-question row.
3. Atomically record the first response or classify later responses as learning retries.
4. Reconcile ambiguous database errors through the durable session identifiers.
5. Return both current correctness and authoritative first-result state.
6. Make progression-read failure a successful grading response with a non-blocking warning.
7. Update the runner to send only server-issued identifiers, trust server recording state, and preserve exact indeterminate retries.
8. Cover ownership, roster, first answer, learning retry, replay, concurrency-shaped conflicts, and progression failure.

## Task 4: Implement the hardened mock flow behind its gate

**Files:**

- Modify `app/api/mock/start/route.ts`
- Modify `app/api/mock/submit/route.ts`
- Add focused mock route/service tests
- Modify `components/mock/mock-runner.tsx`

**Steps:**

1. Keep the disabled check before all database/question work.
2. Behind the check, create and return a server-owned mock roster with submission identifiers.
3. Validate final answers against that roster and grade every assigned question, treating omissions as unanswered.
4. Finalize all attempts and session state atomically and replay completed sessions without writes.
5. Return authoritative totals and results even when progression display loading fails.
6. Update the dormant runner contract so re-enabling the gate cannot revive client-authoritative totals or duplicate retries.
7. Test both the no-work 403 boundary and the enabled secure implementation.

## Task 5: Update documentation and verification

**Files:**

- Modify `docs/02-database-schema.md`
- Modify `docs/03-api-reference.md`
- Create `docs/audits/2026-09-11/step-08-authoritative-retry-safe-attempts.md`
- Modify `docs/launch-audit-2026-09-11.md`

**Steps:**

1. Document the session model, server-owned API contracts, replay behavior, and nullable mock response meaning.
2. Run focused tests, then the complete TypeScript test suite.
3. Run type checking, linting, a production build, and `git diff --check`.
4. Review the final diff for accidental answer-key exposure, legacy recording controls, unsafe grants, schema/type drift, and interference with existing working-tree changes.
5. Apply migration 015 only if the owner-confirmed database connection is safely available; otherwise record it as pending.
6. Record exact evidence and update B08 status without rewriting the original audit finding.
