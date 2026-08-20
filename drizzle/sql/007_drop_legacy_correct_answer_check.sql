-- ============================================================================
-- 007_drop_legacy_correct_answer_check.sql
--
-- Drops a legacy constraint — `questions_correct_answer_check` — that isn't
-- defined anywhere in this repo's migrations, so it must predate them: almost
-- certainly Postgres's auto-generated name for an inline column check from
-- the original `create table questions (... correct_answer text check (...
-- in ('A','B','C','D')) ...)`, before grid-in questions existed.
--
-- 001_import_pipeline.sql added the real, question_type-aware constraint —
-- questions_type_shape_chk — which already allows a grid-in's correct_answer
-- to be any canonical value, not just A-D. But it never dropped the original
-- one, so both were active: the old, unconditional one silently rejected
-- every grid-in question regardless of what the new one allowed.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/007_drop_legacy_correct_answer_check.sql
--
-- Safe to re-run.
-- ============================================================================

alter table questions
  drop constraint if exists questions_correct_answer_check;
