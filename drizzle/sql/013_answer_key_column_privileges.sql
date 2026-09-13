-- ============================================================================
-- 013_answer_key_column_privileges.sql
--
-- Prevent authenticated browser clients from selecting grading keys directly
-- from public.questions. RLS continues to decide which rows are visible; these
-- grants decide which columns a visible row may expose.
--
-- Apply only after app/api/practice/answer uses the service-role client for its
-- grading-key read. Safe to re-run.
-- ============================================================================

-- A table-wide SELECT grant makes every column readable and overrides narrower
-- column revocations. Browser roles also do not need direct question writes or
-- ownership-style privileges: all authoring goes through admin-gated service
-- routes. Remove the broad table grants and any historical column grants before
-- granting the explicit student-safe surface.
revoke all privileges on table public.questions from anon, authenticated;
revoke select (
  id,
  subject_id,
  category_id,
  passage,
  question_text,
  question_image_url,
  chart_svg,
  tables,
  question_type,
  options,
  correct_answer,
  accepted_answers,
  explanation,
  difficulty,
  status,
  tags,
  topic_id,
  created_by,
  source_ref,
  created_at,
  updated_at
) on public.questions from anon, authenticated;

-- These are the columns used by the published-question routes and the
-- security-invoker get_practice_overview/get_practice_run functions.
grant select (
  id,
  subject_id,
  category_id,
  passage,
  question_text,
  question_image_url,
  chart_svg,
  tables,
  question_type,
  options,
  difficulty,
  status,
  tags,
  topic_id,
  created_at
) on public.questions to authenticated;

-- Trusted server code and explicitly authorized admin paths retain full reads.
grant select on table public.questions to service_role;

-- Fail the migration if a broad grant or sensitive column access was restored
-- accidentally. has_column_privilege includes access inherited from table-level
-- privileges, which is exactly the effective permission that matters here.
do $migration_check$
begin
  if has_table_privilege('anon', 'public.questions', 'select') then
    raise exception 'anon retains table-wide SELECT on public.questions';
  end if;

  if has_table_privilege('authenticated', 'public.questions', 'select') then
    raise exception 'authenticated retains table-wide SELECT on public.questions';
  end if;

  if has_column_privilege('authenticated', 'public.questions', 'correct_answer', 'select')
     or has_column_privilege('authenticated', 'public.questions', 'accepted_answers', 'select')
     or has_column_privilege('authenticated', 'public.questions', 'explanation', 'select') then
    raise exception 'authenticated retains grading-key column access';
  end if;

  if not has_column_privilege('authenticated', 'public.questions', 'question_text', 'select')
     or not has_column_privilege('authenticated', 'public.questions', 'options', 'select') then
    raise exception 'authenticated is missing required published-question columns';
  end if;

  if not has_column_privilege('service_role', 'public.questions', 'correct_answer', 'select') then
    raise exception 'service_role cannot read grading keys';
  end if;
end
$migration_check$;

-- Post-apply verification query (read-only):
-- select
--   grantee,
--   bool_or(column_name = 'question_text') as can_read_question_text,
--   bool_or(column_name = 'correct_answer') as can_read_correct_answer,
--   bool_or(column_name = 'accepted_answers') as can_read_accepted_answers,
--   bool_or(column_name = 'explanation') as can_read_explanation
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'questions'
--   and privilege_type = 'SELECT'
--   and grantee in ('anon', 'authenticated', 'service_role')
-- group by grantee
-- order by grantee;
