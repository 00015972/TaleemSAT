# Practice Navigation and Submission Race Safety Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-12-practice-navigation-submission-races-design.md`

**Goal:** Keep the displayed practice question, active manifest entry, and submitted identifier consistent under overlapping navigation, while making recorded practice-answer retries idempotent through a database-backed submission key.

**Constraint:** Implement B07 without introducing the server-owned practice-session and transaction changes reserved for B08.

## Task 1: Add the submission-key database boundary

**Files:**

- Create `drizzle/sql/014_practice_submission_idempotency.sql`
- Modify `drizzle/schema.ts`
- Modify `lib/supabase/types.ts`

**Steps:**

1. Add nullable UUID `attempts.submission_key` so historical and non-practice attempts remain compatible.
2. Add a unique `(user_id, submission_key)` index. The composite key supports the replay lookup and makes duplicate insertion impossible under concurrency.
3. Mirror the column and unique index in Drizzle.
4. Add the column to Supabase Row, Insert, and Update types.
5. Keep the migration additive, idempotent, and unapplied unless access to the owner-confirmed project is available.

## Task 2: Isolate testable client race primitives

**Files:**

- Create `lib/practice/race-safety.ts`
- Create `lib/practice/race-safety.test.ts`

**Steps:**

1. Add a keyed in-flight loader that shares one promise per question identifier and removes settled promises.
2. Add a monotonic request identity helper so only the newest navigation can commit visible state.
3. Add a synchronous lock helper for answer submissions.
4. Add pending-first-submission creation that retains one UUID and one immutable answer/timing payload until completion or definite rejection.
5. Test stale completion rejection, load deduplication, lock behavior, stable replay payloads, and question identity validation.

## Task 3: Make the practice runner race-safe

**Files:**

- Modify `components/practice/practice-runner.tsx`

**Steps:**

1. Replace direct question fetches with the shared in-flight loader.
2. Give each foreground navigation a request identity and ignore stale visible-state commits.
3. Track an explicit current-question load error and render Retry for the active manifest entry.
4. Treat a question as interactive only when `current.id` matches the active manifest identifier.
5. Capture the displayed question identifier, selected answer, first-attempt timing, and stable submission key before posting.
6. Acquire the synchronous submission lock before any asynchronous work.
7. Apply results and errors to the captured question only; do not clear transient state belonging to a later navigation.
8. Preserve and restore the pending first-answer selection after an indeterminate failure.
9. Include `checking` and identity validity in buttons and keyboard shortcuts.

## Task 4: Make recorded practice answers idempotent

**Files:**

- Modify `app/api/practice/answer/route.ts`
- Modify `app/api/practice/answer.test.ts`

**Steps:**

1. Validate recorded submissions with a bounded runtime schema, including UUID question and submission identifiers, answer length, nonnegative finite timing, and boolean `recordAttempt`.
2. Insert `submission_key` with recorded attempts.
3. On the named unique-index conflict, read the existing attempt by authenticated user and submission key.
4. Return the stored result when question, answer, timing, and practice context match exactly.
5. Return `409 SUBMISSION_KEY_REUSED` when the key represents a different payload.
6. Preserve current grading-key protection, unpublished-question behavior, unrecorded learning retries, and progression responses.
7. Extend route fakes and tests for validation, insert, replay, conflict recovery, mismatch, and unrelated database failures.

## Task 5: Document and verify B07

**Files:**

- Create `docs/audits/2026-09-11/step-07-practice-navigation-submission-races.md`
- Modify `docs/launch-audit-2026-09-11.md`

**Steps:**

1. Run the race-safety and practice-answer tests, then the complete current TypeScript test set.
2. Run `pnpm typecheck`, `pnpm lint`, and a production build.
3. Run `git diff --check` and review the final diff for schema drift, accidental UI changes, and secret exposure.
4. If a local browser and database are available, exercise throttled rapid navigation, repeated Enter, fetch Retry, and response-loss replay. Otherwise record those as deployment verification requirements.
5. Record the exact validation evidence and migration/deployment status in the Step 7 audit note.
6. Update the launch audit implementation summary without rewriting the original baseline finding.
