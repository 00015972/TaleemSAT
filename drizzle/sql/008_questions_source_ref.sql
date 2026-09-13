-- ============================================================================
-- 008_questions_source_ref.sql
--
-- Bug: re-uploading an HTML question bank that included previously-imported
-- questions created duplicate rows in `questions` — the College Board source
-- ID was captured on `import_job_items.source_ref` but dropped at promotion,
-- and `questions` had no ID to check against. See app/api/admin/import-jobs/
-- [id]/promote/route.ts, which now checks this column before inserting.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/008_questions_source_ref.sql
--
-- Safe to re-run. NOTE: if duplicate rows already exist for the same source_ref
-- (as they did when this was written — 18 pairs from a repeated HTML upload),
-- resolve them before applying, or the unique index below will fail to create.
-- ============================================================================

alter table questions
  add column if not exists source_ref text;

comment on column questions.source_ref is
  'College Board''s own question ID (e.g. "0147b080"), carried over from import_job_items.source_ref at promotion time. Null for hand-authored questions. Unique when present — the promote route checks this before inserting to prevent re-importing the same question twice.';

-- Backfill from already-promoted staging rows.
update questions q
set source_ref = iji.source_ref
from import_job_items iji
where iji.question_id = q.id
  and q.source_ref is null
  and iji.source_ref is not null
  and iji.source_ref !~ '^unknown-';

create unique index if not exists questions_source_ref_unique_idx
  on questions (source_ref)
  where source_ref is not null;
