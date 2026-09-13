-- ============================================================================
-- 016_dashboard_snapshot.sql
--
-- Collapses the student dashboard's read path into one round trip.
--
-- computeDashboardSnapshot previously issued eight queries in two dependent
-- waves: four in parallel (subjects, all-time attempt count, all-time correct
-- count, a 63-day row scan), then two more per subject for that subject's
-- all-time totals — which could not start until the subjects list came back.
-- computeProgressionSnapshot added two more sequential queries on top.
--
-- Every one of those is a network round trip, and a warm round trip to the
-- Supabase project measures 300-700 ms from Tashkent. The queries themselves
-- are indexed and fast; the latency was almost entirely the waiting. Doing
-- the same aggregation in one function turns roughly 1.5 s of serial waiting
-- into a single hop.
--
-- Date boundaries are passed in rather than derived here on purpose: the
-- timezone-aware "today" and Monday-week-start rules already live in
-- lib/progression/dates.ts behind unit tests, and duplicating them in SQL
-- would give the two copies room to disagree.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/016_dashboard_snapshot.sql
--
-- Safe to re-run.
-- ============================================================================

-- Covers the all-time is_correct tallies, which otherwise scan every attempt
-- row a long-running user owns. attempts_user_id_created_at_idx already covers
-- the 63-day window scan.
create index if not exists attempts_user_correct_idx
  on public.attempts (user_id, is_correct);

create or replace function public.get_dashboard_snapshot(
  p_timezone text,
  p_today date,
  p_week_start date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with
  me as (
    select (select auth.uid()) as user_id
  ),
  -- 63 days covers the widest window any caller reads: a 60-day subject
  -- comparison, a 28-day activity map, and the latest-30-attempts trend.
  window_rows as materialized (
    select
      a.is_correct,
      a.created_at,
      s.slug as subject_slug,
      (a.created_at at time zone p_timezone)::date as local_date
    from public.attempts a
    join public.questions q on q.id = a.question_id
    left join public.subjects s on s.id = q.subject_id
    where a.user_id = (select user_id from me)
      and a.created_at >= (now() - interval '63 days')
  ),
  totals as (
    select
      count(*) as total_attempts,
      count(*) filter (where a.is_correct) as total_correct
    from public.attempts a
    where a.user_id = (select user_id from me)
  ),
  -- All-time per-subject accuracy. This must cover the user's whole history,
  -- not just the window above. The aggregate is driven from the user's own
  -- attempts and only then joined out to subjects — grouping the other way
  -- round would walk every published question per subject to find the few
  -- this student has answered.
  subject_totals as (
    select
      q.subject_id,
      count(*) as attempts,
      count(*) filter (where a.is_correct) as correct
    from public.attempts a
    join public.questions q on q.id = a.question_id
    where a.user_id = (select user_id from me)
    group by q.subject_id
  ),
  by_subject as (
    select
      s.slug,
      s.name,
      coalesce(st.attempts, 0) as attempts,
      coalesce(st.correct, 0) as correct
    from public.subjects s
    left join subject_totals st on st.subject_id = s.id
  ),
  subject_trend as (
    select
      s.slug,
      s.name,
      avg(case when w.created_at > now() - interval '30 days'
               then (w.is_correct)::int end) as last30,
      avg(case when w.created_at > now() - interval '60 days'
                and w.created_at <= now() - interval '30 days'
               then (w.is_correct)::int end) as prior30
    from public.subjects s
    left join window_rows w on w.subject_slug = s.slug
    group by s.id, s.slug, s.name
  ),
  -- Every day in the 28-day map, including the ones with no activity, so the
  -- caller renders a complete grid without back-filling gaps itself.
  activity_days as (
    select d::date as day
    from generate_series(p_today - 27, p_today, interval '1 day') d
  ),
  daily_activity as (
    select
      ad.day,
      count(w.created_at) as count
    from activity_days ad
    left join window_rows w on w.local_date = ad.day
    group by ad.day
  ),
  -- 34, not 30: the caller charts the latest 30 attempts but each point is a
  -- five-attempt rolling average, so the oldest charted point needs the four
  -- attempts before it to average over. Returning only 30 would quietly
  -- shrink the window on the left edge of the chart.
  recent as (
    select w.created_at, w.is_correct
    from window_rows w
    order by w.created_at desc
    limit 34
  ),
  progression_profile as (
    select u.total_xp, u.current_streak, u.longest_streak, u.last_streak_date
    from public.users u
    where u.id = (select user_id from me)
  ),
  progression_days as (
    select
      dp.activity_date,
      dp.qualifying_question_count,
      dp.xp_earned,
      dp.streak_earned
    from public.daily_progress dp
    where dp.user_id = (select user_id from me)
      and dp.activity_date >= p_week_start
      and dp.activity_date <= p_today
  )
  select jsonb_build_object(
    'total_attempts', (select total_attempts from totals),
    -- Position of the charted attempts within the 63-day window, so the
    -- caller can keep numbering its trend points the way it always has.
    'window_attempts', (select count(*) from window_rows),
    'total_correct', (select total_correct from totals),
    'by_subject', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', b.slug,
        'name', b.name,
        'attempts', b.attempts,
        'correct', b.correct
      ) order by b.attempts desc)
      from by_subject b
    ), '[]'::jsonb),
    'subject_trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug,
        'name', t.name,
        'last30', t.last30,
        'prior30', t.prior30
      ))
      from subject_trend t
    ), '[]'::jsonb),
    'daily_activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'count', d.count
      ) order by d.day)
      from daily_activity d
    ), '[]'::jsonb),
    -- Oldest first, matching the order the trend chart plots. Includes the
    -- four lead-in attempts described above.
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', r.created_at,
        'is_correct', r.is_correct
      ) order by r.created_at)
      from recent r
    ), '[]'::jsonb),
    'progression', jsonb_build_object(
      'total_xp', coalesce((select total_xp from progression_profile), 0),
      'current_streak', coalesce((select current_streak from progression_profile), 0),
      'longest_streak', coalesce((select longest_streak from progression_profile), 0),
      'last_streak_date', (select last_streak_date from progression_profile),
      'days', coalesce((
        select jsonb_agg(jsonb_build_object(
          'activity_date', to_char(p.activity_date, 'YYYY-MM-DD'),
          'qualifying_question_count', p.qualifying_question_count,
          'xp_earned', p.xp_earned,
          'streak_earned', p.streak_earned
        ) order by p.activity_date)
        from progression_days p
      ), '[]'::jsonb)
    )
  );
$function$;

revoke all on function public.get_dashboard_snapshot(text, date, date) from public;
revoke all on function public.get_dashboard_snapshot(text, date, date) from anon;
grant execute on function public.get_dashboard_snapshot(text, date, date) to authenticated;
grant execute on function public.get_dashboard_snapshot(text, date, date) to service_role;

-- ============================================================================
-- Admin import list: grouped item counts in one call.
--
-- The imports page listed 50 jobs and then issued two count-only queries per
-- job — 101 round trips to render one table. The per-job queries existed
-- because a single row-select across every job's items is truncated by
-- PostgREST's default row cap, which undercounts whichever jobs fell past the
-- cutoff. Aggregating server-side sidesteps the cap without the fan-out.
-- ============================================================================

-- Already declared in drizzle/schema.ts; repeated here so this file applies
-- cleanly against a database that predates it.
create index if not exists import_job_items_job_status_idx
  on public.import_job_items (job_id, status);

create or replace function public.get_import_job_item_counts(p_job_ids uuid[])
returns table (
  job_id uuid,
  success_count bigint,
  failed_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    i.job_id,
    count(*) filter (where i.status in ('pending_review', 'approved')) as success_count,
    count(*) filter (where i.status = 'verification_failed') as failed_count
  from public.import_job_items i
  where i.job_id = any(p_job_ids)
  group by i.job_id;
$function$;

revoke all on function public.get_import_job_item_counts(uuid[]) from public;
revoke all on function public.get_import_job_item_counts(uuid[]) from anon;
grant execute on function public.get_import_job_item_counts(uuid[]) to authenticated;
grant execute on function public.get_import_job_item_counts(uuid[]) to service_role;
