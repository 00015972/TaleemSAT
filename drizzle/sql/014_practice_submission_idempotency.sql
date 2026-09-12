-- ============================================================================
-- 014_practice_submission_idempotency.sql
--
-- Give recorded practice submissions a stable client-generated identity. The
-- unique index is the final duplicate-write boundary when requests overlap or
-- a client retries after the original response is lost.
--
-- Safe to re-run. Historical and non-practice attempts keep a null key.
-- ============================================================================

alter table public.attempts
  add column if not exists submission_key uuid;

create unique index if not exists attempts_user_submission_key_unique
  on public.attempts (user_id, submission_key);

-- Post-apply verification query (read-only):
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'attempts'
--   and column_name = 'submission_key';
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'attempts'
--   and indexname = 'attempts_user_submission_key_unique';
