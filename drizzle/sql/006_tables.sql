-- ============================================================================
-- 006_tables.sql
--
-- The HTML import path used to flatten a question's <table> into
-- "Row 1: Column: value; ..." pseudo-text, since neither the staging nor the
-- live questions table had anywhere to keep real markup — and the practice
-- UI has never split question_text back into paragraphs, so the flattened
-- text rendered as one unreadable run-on blob. lib/import/html-questions.ts
-- now extracts and sanitizes the <table> itself (lib/import/table-sanitize.ts)
-- instead, leaving a `[[table:N]]` token in question_text at the table's
-- original position, so both staging and the live questions table need
-- somewhere to keep the real markup — mirrors chart_svg (005_chart_svg.sql).
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/006_tables.sql
--
-- Safe to re-run.
-- ============================================================================

alter table import_job_items
  add column if not exists tables text[] not null default '{}';

alter table questions
  add column if not exists tables text[] not null default '{}';

comment on column import_job_items.tables is
  'Sanitized <table> markup extracted from an HTML import, in document order. question_text carries a [[table:N]] token at each table''s original position.';
comment on column questions.tables is
  'Sanitized <table> markup, in document order — rendered inline by components/reading/question-body.tsx wherever question_text has a [[table:N]] token.';
