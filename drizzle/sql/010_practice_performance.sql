-- ============================================================================
-- 010_practice_performance.sql
--
-- Moves Question Bank progress aggregation into Postgres, combines a practice
-- manifest with its first safe question, and adds indexes matching those read
-- paths. Application code depends on both RPCs after this migration is applied.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/010_practice_performance.sql
--
-- Safe to re-run. This repository task creates the migration locally only; it
-- must not be applied to a live project as part of the implementation.
-- ============================================================================

-- The final `difficulty` key makes each index cover the manifest's selected
-- fields. It follows the ordering keys, so the all-difficulty order remains
-- `(created_at, id)`. Drizzle 0.45 cannot represent PostgreSQL INCLUDE columns,
-- so a final key keeps the SQL migration and declarative schema aligned.
create index if not exists questions_published_subject_manifest_idx
  on public.questions (subject_id, created_at, id, difficulty)
  where status = 'published';

create index if not exists questions_published_category_manifest_idx
  on public.questions (category_id, created_at, id, difficulty)
  where status = 'published';

create index if not exists questions_published_topic_manifest_idx
  on public.questions (topic_id, created_at, id, difficulty)
  where status = 'published';

create index if not exists attempts_user_question_idx
  on public.attempts (user_id, question_id);

-- One compact row per topic. Subject/category totals are aggregated separately
-- so legacy questions whose topic_id is null still count at their broader
-- levels. Repeated answers count once through attempted_questions.
create or replace function public.get_practice_overview()
returns table (
  subject_id uuid,
  subject_slug text,
  subject_name text,
  subject_display_order integer,
  category_id uuid,
  category_slug text,
  category_name text,
  category_display_order integer,
  topic_id uuid,
  topic_slug text,
  topic_name text,
  topic_display_order integer,
  subject_question_counts jsonb,
  subject_attempted_counts jsonb,
  category_question_counts jsonb,
  category_attempted_counts jsonb,
  topic_question_counts jsonb,
  topic_attempted_counts jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with
  published_questions as materialized (
    select q.id, q.subject_id, q.category_id, q.topic_id, q.difficulty
    from public.questions q
    where q.status = 'published'
  ),
  question_counts as (
    select
      'subject'::text as scope_kind,
      p.subject_id as scope_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where p.difficulty = 'easy'),
        'medium', count(*) filter (where p.difficulty = 'medium'),
        'hard', count(*) filter (where p.difficulty = 'hard')
      ) as counts
    from published_questions p
    group by p.subject_id

    union all

    select
      'category'::text,
      p.category_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where p.difficulty = 'easy'),
        'medium', count(*) filter (where p.difficulty = 'medium'),
        'hard', count(*) filter (where p.difficulty = 'hard')
      )
    from published_questions p
    group by p.category_id

    union all

    select
      'topic'::text,
      p.topic_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where p.difficulty = 'easy'),
        'medium', count(*) filter (where p.difficulty = 'medium'),
        'hard', count(*) filter (where p.difficulty = 'hard')
      )
    from published_questions p
    where p.topic_id is not null
    group by p.topic_id
  ),
  attempted_questions as materialized (
    select distinct
      q.id as question_id,
      q.subject_id,
      q.category_id,
      q.topic_id,
      q.difficulty
    from public.attempts a
    join public.questions q on q.id = a.question_id
    where a.user_id = (select auth.uid())
      and q.status = 'published'
  ),
  attempt_counts as (
    select
      'subject'::text as scope_kind,
      a.subject_id as scope_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where a.difficulty = 'easy'),
        'medium', count(*) filter (where a.difficulty = 'medium'),
        'hard', count(*) filter (where a.difficulty = 'hard')
      ) as counts
    from attempted_questions a
    group by a.subject_id

    union all

    select
      'category'::text,
      a.category_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where a.difficulty = 'easy'),
        'medium', count(*) filter (where a.difficulty = 'medium'),
        'hard', count(*) filter (where a.difficulty = 'hard')
      )
    from attempted_questions a
    group by a.category_id

    union all

    select
      'topic'::text,
      a.topic_id,
      jsonb_build_object(
        'all', count(*),
        'easy', count(*) filter (where a.difficulty = 'easy'),
        'medium', count(*) filter (where a.difficulty = 'medium'),
        'hard', count(*) filter (where a.difficulty = 'hard')
      )
    from attempted_questions a
    where a.topic_id is not null
    group by a.topic_id
  ),
  zero_counts as (
    select '{"all": 0, "easy": 0, "medium": 0, "hard": 0}'::jsonb as value
  )
  select
    s.id,
    s.slug,
    s.name,
    s.display_order,
    c.id,
    c.slug,
    c.name,
    c.display_order,
    t.id,
    t.slug,
    t.name,
    t.display_order,
    coalesce(sq.counts, z.value),
    coalesce(sa.counts, z.value),
    coalesce(cq.counts, z.value),
    coalesce(ca.counts, z.value),
    coalesce(tq.counts, z.value),
    coalesce(ta.counts, z.value)
  from public.topics t
  join public.categories c on c.id = t.category_id
  join public.subjects s on s.id = c.subject_id
  cross join zero_counts z
  left join question_counts sq
    on sq.scope_kind = 'subject' and sq.scope_id = s.id
  left join attempt_counts sa
    on sa.scope_kind = 'subject' and sa.scope_id = s.id
  left join question_counts cq
    on cq.scope_kind = 'category' and cq.scope_id = c.id
  left join attempt_counts ca
    on ca.scope_kind = 'category' and ca.scope_id = c.id
  left join question_counts tq
    on tq.scope_kind = 'topic' and tq.scope_id = t.id
  left join attempt_counts ta
    on ta.scope_kind = 'topic' and ta.scope_id = t.id
  order by s.display_order, c.display_order, t.display_order;
$function$;

revoke all on function public.get_practice_overview() from public;
revoke all on function public.get_practice_overview() from anon;
grant execute on function public.get_practice_overview() to authenticated;
grant execute on function public.get_practice_overview() to service_role;

-- Resolve a scope and return both its lightweight ordered manifest and the
-- first student-safe question. Correct answers, accepted answers, and
-- explanations are intentionally absent from the JSON object.
create or replace function public.get_practice_run(
  p_scope_kind text,
  p_scope_slug text,
  p_difficulty public.difficulty default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_scope_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_scope_slug is null or btrim(p_scope_slug) = '' then
    raise exception 'Scope slug is required' using errcode = '22023';
  end if;

  case p_scope_kind
    when 'subject' then
      select s.id into v_scope_id
      from public.subjects s
      where s.slug = p_scope_slug;
    when 'category' then
      select c.id into v_scope_id
      from public.categories c
      where c.slug = p_scope_slug;
    when 'topic' then
      select t.id into v_scope_id
      from public.topics t
      where t.slug = p_scope_slug;
    else
      raise exception 'Invalid scope kind' using errcode = '22023';
  end case;

  if v_scope_id is null then
    return null;
  end if;

  return (
    with eligible as materialized (
      select
        q.id,
        q.difficulty,
        q.created_at
      from public.questions q
      where q.status = 'published'
        and (
          (p_scope_kind = 'subject' and q.subject_id = v_scope_id) or
          (p_scope_kind = 'category' and q.category_id = v_scope_id) or
          (p_scope_kind = 'topic' and q.topic_id = v_scope_id)
        )
        and (p_difficulty is null or q.difficulty = p_difficulty)
    )
    select jsonb_build_object(
      'ids', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('id', e.id, 'difficulty', e.difficulty)
            order by e.created_at, e.id
          )
          from eligible e
        ),
        '[]'::jsonb
      ),
      'question', (
        select jsonb_build_object(
          'id', q.id,
          'passage', q.passage,
          'question_text', q.question_text,
          'question_image_url', q.question_image_url,
          'chart_svg', q.chart_svg,
          'tables', to_jsonb(q.tables),
          'question_type', q.question_type,
          'options', q.options,
          'difficulty', q.difficulty,
          'tags', to_jsonb(q.tags)
        )
        from public.questions q
        join eligible e on e.id = q.id
        order by e.created_at, e.id
        limit 1
      )
    )
  );
end;
$function$;

revoke all on function public.get_practice_run(text, text, public.difficulty) from public;
revoke all on function public.get_practice_run(text, text, public.difficulty) from anon;
grant execute on function public.get_practice_run(text, text, public.difficulty) to authenticated;
grant execute on function public.get_practice_run(text, text, public.difficulty) to service_role;
