# Streak and XP Progression Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-08-streak-xp-progression-design.md`

**Goal:** Restore exactly-once XP, five-new-question daily streaks, progression feedback, and the dashboard's three-card Daily Momentum row using existing server-graded practice and mock attempts.

**Constraint:** Create and verify all application and migration changes locally. Do not apply the SQL migration to Supabase, deploy the application, or modify unrelated dirty-worktree files.

## Task 1: Add the progression schema, atomic award path, and historical backfill

**Files:**

- Create `drizzle/sql/012_streak_xp_progression.sql`
- Modify `drizzle/schema.ts`
- Modify `lib/supabase/types.ts`

**Steps:**

1. Add `timezone`, `total_xp`, `current_streak`, `longest_streak`, and `last_streak_date` to `users`, using `Asia/Tashkent` as the timezone fallback and zero defaults for counters.
2. Create `progression_events` with immutable attempt, question, context, correctness, XP, local-date, timezone, and timestamp snapshots.
3. Enforce unique `(user_id, question_id)` and unique `attempt_id` constraints, non-negative XP checks, expected 5-point base/bonus shapes, and indexes for user/date and user/created-at reads.
4. Create `daily_progress` with unique `(user_id, activity_date)`, qualifying count, daily XP, threshold state, and threshold-crossed timestamp, plus non-negative checks and a user/date index.
5. Enable RLS. Allow authenticated students to select only their own ledger and daily rows; do not add browser insert, update, or delete policies. Keep service-role access for server writes and maintenance.
6. Add a private database function that normalizes a stored timezone against `pg_timezone_names`, falling back safely when it is missing or invalid.
7. Add an `AFTER INSERT` attempt trigger that tries the unique progression event first. Only the successful insert may update daily and user summaries.
8. In that same transaction, award 5 XP plus a 5 XP correctness bonus, upsert local daily progress, reset an expired current streak on new activity, and extend the streak exactly once when the day crosses from four to five qualifying questions.
9. Ensure trigger/function ownership, `search_path`, grants, and revokes prevent authenticated clients from invoking internal mutation functions directly.
10. Backfill with `DISTINCT ON (user_id, question_id)` ordered by `created_at, id`, snapshot each student's saved/fallback timezone, and create immutable events without firing live attempt logic.
11. Rebuild daily summaries and user totals/streaks deterministically from the backfilled ledger. Treat Monday as the start of a local week and set stale current streaks to zero while preserving longest streak and last qualified date.
12. Create the live attempt trigger only after the idempotent backfill and summary rebuild are complete, preventing a rollout-time repeat from becoming a false first-ever event.
13. Include an admin/service-role-only summary rebuild function whose input is the existing immutable ledger. It may repair daily and user caches but must never create or delete XP events.
14. Mirror tables, columns, constraints, relations, and indexes that Drizzle can represent, then update Supabase row/insert/update/function types to match the migration.
15. Review the SQL for rerun safety, deterministic ties, concurrent duplicate attempts, timezone boundaries, RLS isolation, and rollback behavior when progression processing fails.

## Task 2: Add shared progression contracts and saved-timezone synchronization

**Files:**

- Create `lib/progression/types.ts`
- Create `lib/progression/dates.ts`
- Create `lib/progression/dates.test.ts`
- Create `lib/progression/dashboard.ts`
- Create `components/progression/timezone-sync.tsx`
- Create `app/api/profile/timezone/route.ts`
- Modify `app/(app)/layout.tsx`
- Modify `lib/supabase/server.ts`
- Modify `app/(app)/settings/page.tsx`
- Modify `components/settings-form.tsx`

**Steps:**

1. Define one shared progression response contract for a qualifying award, a familiar-question no-award result, daily goal state, and streak summary.
2. Add small, pure date helpers for IANA timezone validation, local ISO dates, previous calendar dates, and Monday-based week starts. Avoid comparing local streak dates through server-local time.
3. Cover `Asia/Tashkent`, UTC, positive/negative offsets, local-midnight boundaries, leap dates, week rollover, and invalid-timezone fallback with `tsx --test` unit cases.
4. Add a dashboard progression reader that fetches the user's cached totals and the bounded `daily_progress` rows needed for today and the current local week.
5. Derive the displayed current streak as zero when `last_streak_date` is older than local yesterday without writing anything during a dashboard request.
6. Create an authenticated timezone endpoint that accepts one IANA timezone, validates it server-side, updates only the caller's profile, and returns explicit 400/401/500 errors. It must have no attempt or progression side effects.
7. Mount a minimal client synchronizer inside the authenticated app shell. Read `Intl.DateTimeFormat().resolvedOptions().timeZone`, post only when it differs from the saved profile value, and fail silently so practice remains available offline or during a transient save error.
8. Expose the stored timezone in Settings as the student's study timezone so the calendar boundary is understandable. Keep automatic detection as the default and preserve all existing Settings save behavior.
9. Extend `getAppProfile()` only with the new fields needed by layout, settings, and dashboard callers; do not expose progression mutation capabilities through it.

## Task 3: Return authoritative progression from practice answers

**Files:**

- Modify `app/api/practice/answer/route.ts`
- Modify `components/practice/practice-runner.tsx`
- Create `components/progression/reward-feedback.tsx`

**Steps:**

1. Change the first-check attempt insert to return its attempt ID and treat an insert/trigger error as a retryable 500 instead of silently returning a graded result.
2. Read the event produced for that attempt ID and return the shared progression payload. If no event belongs to the inserted attempt, return the familiar-question no-award state.
3. Keep wrong-answer retries unrecorded through `recordAttempt: false`; they return grading feedback but no progression payload and can never add the later correctness bonus.
4. Accept only a literal boolean for `recordAttempt`; reject malformed values and never use this client flag to decide first-ever XP eligibility, which remains enforced by the ledger constraint.
5. Make the runner check `res.ok` before consuming the selected answer or marking the first result, leaving the current selection available when persistence fails.
6. Store only the confirmed reward response needed for the current question and render a compact shared feedback component beside the grading result.
7. Show `+5 XP`, `+10 XP`, `N/5 new questions`, the streak-extension celebration, or the familiar-question explanation exactly as returned by the server.
8. Use an `aria-live="polite"` status, text in addition to color, and reduced-motion-safe animation. Do not make reward display block answer review or navigation.

## Task 4: Return authoritative progression from mock submissions

**Files:**

- Modify `app/api/mock/submit/route.ts`
- Modify `components/mock/mock-runner.tsx`
- Reuse `components/progression/reward-feedback.tsx`

**Steps:**

1. Keep server-side grading and collect inserted attempt IDs mapped to question IDs.
2. Treat any bulk insert/trigger failure as a failed mock save instead of returning an apparently successful score with missing history or rewards.
3. Query progression events for the newly inserted attempt IDs and attach `isFirstEver` plus `xpAwarded` to each applicable result.
4. Return one aggregate progression summary with XP newly earned in the submission and the final daily count/streak state after all answers are processed.
5. Ensure unanswered questions, previously attempted questions, and duplicate question IDs award zero. Keep the database constraints as the concurrency authority.
6. Preserve all existing result, explanation, timing, review, and score behavior.
7. Add a reward summary to the completed mock review and annotate newly encountered questions without cluttering every familiar result.
8. Keep a failed submission in the current retryable runner state and show no XP until the full server response succeeds.

## Task 5: Restore the dashboard's Streak and XP cards

**Files:**

- Modify `app/(app)/dashboard/page.tsx`
- Modify `app/globals.css`

**Steps:**

1. Fetch the new progression dashboard snapshot in parallel with the existing profile and performance snapshot.
2. Keep general accuracy and activity analytics backed by attempts, but remove raw attempt counts from Daily Missions.
3. Restore the prior three-column Daily Momentum layout with Combo Streak, XP Collected, and Daily Missions cards.
4. Show current streak, longest streak, today's qualifying count, questions remaining to five, current-local-week XP, and lifetime XP from progression data.
5. Define mission bubbles as one-question warm-up, five-question streak goal, and ten-question stretch goal using qualifying first-ever questions only.
6. Label progression work as `new questions` so repeated practice affecting analytics but not XP is not surprising.
7. Restore or recreate the scoped `.focus-streak-*` and `.focus-xp-*` illustration styles while preserving the current Focus Arcade visual language and existing mission card.
8. Use the previous desktop three-card proportions, collapse cleanly at existing dashboard breakpoints, and keep all decorative objects hidden from assistive technology.
9. Preserve CountUp/Reveal behavior and add no motion that bypasses the existing reduced-motion rules.
10. Provide truthful zero, expired, in-progress, and protected-for-today copy; dashboard rendering must remain read-only.

## Task 6: Document the restored progression contract

**Files:**

- Modify `docs/02-database-schema.md`
- Modify `docs/03-api-reference.md`
- Modify `docs/04-feature-roadmap.md`
- Modify `docs/07-ux-flows.md`
- Modify `docs/12-testing-strategy.md`

**Steps:**

1. Document the ledger, daily summary, profile counters, unique constraints, RLS, and source-of-truth hierarchy.
2. Add practice, mock, and timezone endpoint request/response changes without exposing answer keys before grading.
3. Record the five-new-question threshold, 5+5 XP rule, Monday week start, saved-timezone behavior, and first-ever deduplication semantics.
4. Replace remaining product copy that implies Daily Question ownership of streaks or XP.
5. Document that attempt analytics and progression counts intentionally differ for repeated questions.
6. Add database, API, concurrency, backfill, timezone, accessibility, and no-progress-on-visit scenarios to the testing strategy.

## Task 7: Verify the integrated feature

**Files:** all changed files

**Steps:**

1. Run `pnpm exec tsx --test lib/progression/dates.test.ts`.
2. Run `pnpm typecheck`.
3. Run ESLint on all changed TypeScript and TSX files.
4. Run `pnpm build`.
5. Run `git diff --check` and inspect the scoped diff for answer-key exposure, optimistic reward calculation, client-writable progression data, accidental Daily Question restoration, or unrelated user changes.
6. Review the migration with representative SQL fixtures for 5/10 XP awards, cross-context deduplication, concurrent duplicates, threshold crossing, missed days, longest streak, Monday week totals, local-midnight conversion, and idempotent backfill/rebuild.
7. In an authenticated browser, verify first-correct, first-incorrect, wrong-then-correct retry, familiar practice question, mixed-new/familiar mock, fifth-question streak extension, expired streak, refreshed dashboard, and narrow layout states.
8. Confirm that visits, refreshes, logins, question loads, answer selections, and explanation reviews perform no progression writes.
9. Confirm reward feedback is announced accessibly, remains understandable without color, and respects reduced motion.
10. Report that `012_streak_xp_progression.sql` must be applied before deploying the dependent application code and that the local implementation did not apply it.
