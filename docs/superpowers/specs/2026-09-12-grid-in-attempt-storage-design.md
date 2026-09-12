# Grid-In Attempt Storage Compatibility Design

**Date:** 12 September 2026  
**Audit scope:** Follow-up to B06 and B07 in `docs/launch-audit-2026-09-11.md`

## Problem

Grid-in responses pass the shared runtime schema and strict numeric grader, but recorded practice attempts fail with HTTP 500. The live `public.attempts` table still has the legacy constraint `attempts_selected_answer_check`, which permits only `A`, `B`, `C`, or `D` in `selected_answer`.

This explains the format-specific behavior: multiple-choice attempts satisfy the constraint, while valid grid-in responses such as `3`, `1.5`, and `3/2` are rejected by PostgreSQL. The constraint is not represented in the current Drizzle schema, whose `selected_answer` column is intentionally unrestricted `text` with a non-null requirement.

## Objective

Allow valid grid-in responses to be recorded through the existing trusted practice-answer route without changing grading, idempotency, progression, or the stored response form.

## Non-goals

- Change the supported grid-in grammar or numeric-equivalence tolerance.
- Normalize a student's response before storage.
- Change multiple-choice storage or response contracts.
- Add another browser-visible error format.
- Re-enable direct authenticated inserts into `public.attempts`.

## Considered approaches

### 1. Remove the legacy A–D constraint

Drop only `attempts_selected_answer_check` with an idempotent migration. Continue to rely on the existing strict API schema and grid-in parser before the trusted service-role write.

This is the selected approach because it aligns the live table with the current Drizzle schema, supports both question types, and preserves the exact submitted string required by submission-key replay checks.

### 2. Replace it with a database regex constraint

A PostgreSQL expression could allow A–D plus some numeric forms. This duplicates the application grammar, cannot express all semantic checks cleanly, and could drift from `lib/grading/grid-in.ts`.

### 3. Normalize grid-in responses before insert

The route could convert grid-in values to a canonical decimal. That would discard the student's original response and complicate exact idempotent replay comparisons. It also avoids rather than fixes the incorrect database contract.

## Database change

Add `drizzle/sql/015_drop_legacy_attempt_answer_check.sql` containing one idempotent schema operation:

```sql
alter table public.attempts
  drop constraint if exists attempts_selected_answer_check;
```

No rows are rewritten, no column type changes, and no new privileges are granted. The migration is safe to rerun. Existing service-role-only attempt insertion remains enforced by migration 012, which revoked insert access from `anon` and `authenticated`.

Rollback, if required, must first prove that every stored response is A–D. Because valid grid-in attempts will intentionally violate the old rule, automatically recreating the constraint is not part of this migration.

## Application behavior

The browser continues sending the trimmed student response through `selectedAnswer`. The practice route continues to:

1. authenticate the student;
2. validate the request with the bounded `practiceAnswerSchema`;
3. load the protected question key through the server-only client;
4. grade grid-ins with `gridInAnswerMatches`;
5. store the original validated response and submission key; and
6. return correctness and progression.

Multiple-choice submissions continue storing A–D. Grid-in submissions store their valid original form, such as `3`, `1.5`, or `3/2`.

## Error handling

The existing database-backed submission-key reconciliation remains unchanged. If an insert response is ambiguous, the route looks up the durable key and returns an exact stored replay. If the database rejects an insert and no matching keyed row exists, the route retains `500 ATTEMPT_SAVE_FAILED` and emits only sanitized server diagnostics.

After this migration, a valid grid-in response must not reach that failure path because of answer format.

## Verification

- Before applying the migration, query `pg_constraint` and capture the legacy constraint definition.
- Apply migration 015 through the owner-confirmed database connection.
- Verify `attempts_selected_answer_check` no longer exists and that attempt insert permissions remain restricted.
- Run an insert-and-return check under `service_role` inside a rolled-back transaction using a valid numeric response.
- Submit one valid grid-in response through the authenticated local practice UI and confirm it returns correctness/progression rather than HTTP 500.
- Confirm an MCQ submission still succeeds.
- Run the complete TypeScript tests, `pnpm typecheck`, `pnpm lint`, the webpack production build, and `git diff --check`.
- Update the Step 06 and Step 07 audit notes with the database compatibility fix and final evidence.

## Acceptance criteria

- Valid integer, decimal, and fraction grid-in responses can be stored in `public.attempts.selected_answer`.
- Multiple-choice responses continue to store and grade normally.
- The exact submitted grid-in string is preserved for auditability and idempotent replay comparison.
- Invalid grid-in syntax remains rejected by the application before privileged database access.
- Direct attempt insertion remains unavailable to `anon` and `authenticated` roles.
- Migration 015 is idempotent and performs no data rewrite.
