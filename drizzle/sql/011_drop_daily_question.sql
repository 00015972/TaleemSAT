-- ============================================================================
-- 011_drop_daily_question.sql
--
-- The Daily Question ("QOD") feature has been removed from the app — no more
-- student-facing /qod page, admin scheduler, or answer/points-award APIs.
-- Drops its tables and the users columns it exclusively fed (points,
-- streak_days were only ever written by the QOD answer route; nothing else
-- in the app awards them, so they go too rather than sit frozen).
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/011_drop_daily_question.sql
--
-- Safe to re-run. After applying, regenerate lib/supabase/types.ts (Supabase
-- type generation) to confirm it matches — it was already hand-edited to
-- drop these in the same change that removed the feature's code.
--
-- Not handled here: the `attempt_context` enum still has a 'qod' value
-- (`attempts.context` never actually used it — QOD answers were recorded in
-- qod_answers, not attempts — so nothing reads or writes it). Postgres can't
-- drop a single enum value without rebuilding the type and repointing the
-- `attempts.context` column, which isn't worth the risk for an inert value;
-- it's left in place as harmless legacy, same spirit as 009's note about the
-- source-pdfs bucket.
-- ============================================================================

drop table if exists qod_answers;
drop table if exists qod_schedule;
drop table if exists points_ledger;

alter table users
  drop column if exists points,
  drop column if exists streak_days,
  drop column if exists last_qod_answered_at;
