-- ============================================================================
-- 012_streak_xp_progression.sql
--
-- Restores Streak and XP as attempt-driven progression. The immutable event
-- ledger awards a question once per student, while daily/user summaries keep
-- dashboard reads bounded. Existing attempts are backfilled before the live
-- trigger is enabled.
--
-- Apply via the Supabase SQL Editor, or:
--   psql "$DATABASE_URL" -f drizzle/sql/012_streak_xp_progression.sql
--
-- Safe to re-run. Application code that reads progression requires this SQL.
-- This repository task creates the migration locally; it does not apply it.
-- ============================================================================

alter table public.users
  add column if not exists timezone text not null default 'Asia/Tashkent',
  add column if not exists total_xp integer not null default 0,
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_streak_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_progression_counters_nonnegative_chk'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_progression_counters_nonnegative_chk check (
        total_xp >= 0
        and current_streak >= 0
        and longest_streak >= 0
        and longest_streak >= current_streak
      );
  end if;
end $$;

create table if not exists public.progression_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  question_id         uuid not null references public.questions(id) on delete restrict,
  attempt_id          uuid not null references public.attempts(id) on delete restrict,
  context             public.attempt_context not null,
  is_correct          boolean not null,
  base_xp             integer not null default 5,
  correct_bonus_xp    integer not null default 0,
  xp_delta            integer not null,
  activity_date       date not null,
  timezone            text not null,
  streak_extended     boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint progression_events_user_question_unique unique (user_id, question_id),
  constraint progression_events_attempt_unique unique (attempt_id),
  constraint progression_events_xp_shape_chk check (
    base_xp = 5
    and correct_bonus_xp in (0, 5)
    and correct_bonus_xp = case when is_correct then 5 else 0 end
    and xp_delta = base_xp + correct_bonus_xp
  )
);

create index if not exists progression_events_user_activity_idx
  on public.progression_events (user_id, activity_date, created_at);

create index if not exists progression_events_user_created_at_idx
  on public.progression_events (user_id, created_at);

create index if not exists progression_events_question_id_idx
  on public.progression_events (question_id);

create table if not exists public.daily_progress (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.users(id) on delete cascade,
  activity_date              date not null,
  qualifying_question_count  integer not null default 0,
  xp_earned                  integer not null default 0,
  streak_earned              boolean not null default false,
  streak_crossed_at          timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint daily_progress_user_date_unique unique (user_id, activity_date),
  constraint daily_progress_counts_nonnegative_chk check (
    qualifying_question_count >= 0 and xp_earned >= 0
  ),
  constraint daily_progress_streak_state_chk check (
    (streak_earned and qualifying_question_count >= 5 and streak_crossed_at is not null)
    or (not streak_earned and streak_crossed_at is null)
  )
);

comment on table public.progression_events is
  'Immutable XP ledger. Exactly one event exists for the first scored attempt of each user/question pair.';
comment on table public.daily_progress is
  'Rebuildable local-calendar summary used by streaks, XP cards, and daily missions.';

alter table public.progression_events enable row level security;
alter table public.daily_progress enable row level security;

drop policy if exists progression_events_select_own on public.progression_events;
create policy progression_events_select_own
  on public.progression_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists daily_progress_select_own on public.daily_progress;
create policy daily_progress_select_own
  on public.daily_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.progression_events from anon, authenticated;
revoke all on table public.daily_progress from anon, authenticated;
grant select on table public.progression_events to authenticated;
grant select on table public.daily_progress to authenticated;
grant all on table public.progression_events to service_role;
grant all on table public.daily_progress to service_role;

-- Attempts are graded and inserted by protected server routes. Revoking the
-- browser role's insert privilege prevents a student from spoofing is_correct
-- and letting the progression trigger award an unverified bonus.
revoke insert on table public.attempts from anon, authenticated;

-- RLS limits which user row a student can update, but it does not limit which
-- columns on that row they can change. Keep profile editing available while
-- reserving XP/streak counters and account entitlements for trusted code.
revoke update on table public.users from anon, authenticated;
grant update (
  full_name,
  target_sat_score,
  exam_date,
  marketing_opt_in,
  timezone
) on table public.users to authenticated;

create or replace function public.progression_timezone(p_timezone text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when exists (
      select 1
      from pg_catalog.pg_timezone_names tz
      where tz.name = coalesce(nullif(btrim(p_timezone), ''), 'Asia/Tashkent')
    ) then coalesce(nullif(btrim(p_timezone), ''), 'Asia/Tashkent')
    else 'Asia/Tashkent'
  end;
$function$;

revoke all on function public.progression_timezone(text) from public, anon, authenticated;
grant execute on function public.progression_timezone(text) to service_role;

create or replace function public.rebuild_progression_summaries()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.daily_progress;

  insert into public.daily_progress (
    user_id,
    activity_date,
    qualifying_question_count,
    xp_earned,
    streak_earned,
    streak_crossed_at,
    created_at,
    updated_at
  )
  with ranked as (
    select
      e.*,
      row_number() over (
        partition by e.user_id, e.activity_date
        order by e.created_at, e.id
      ) as day_number
    from public.progression_events e
  )
  select
    r.user_id,
    r.activity_date,
    count(*)::integer,
    sum(r.xp_delta)::integer,
    count(*) >= 5,
    min(r.created_at) filter (where r.day_number = 5),
    min(r.created_at),
    now()
  from ranked r
  group by r.user_id, r.activity_date;

  update public.users
  set
    total_xp = 0,
    current_streak = 0,
    longest_streak = 0,
    last_streak_date = null,
    updated_at = now();

  with qualified as (
    select
      d.user_id,
      d.activity_date,
      d.activity_date - (
        row_number() over (partition by d.user_id order by d.activity_date)
      )::integer as run_group
    from public.daily_progress d
    where d.streak_earned
  ),
  runs as (
    select
      q.user_id,
      min(q.activity_date) as run_start,
      max(q.activity_date) as run_end,
      count(*)::integer as run_length
    from qualified q
    group by q.user_id, q.run_group
  ),
  run_totals as (
    select
      r.user_id,
      max(r.run_length)::integer as longest_streak,
      max(r.run_end) as last_streak_date
    from runs r
    group by r.user_id
  ),
  latest_runs as (
    select distinct on (r.user_id)
      r.user_id,
      r.run_end,
      r.run_length
    from runs r
    order by r.user_id, r.run_end desc
  ),
  xp_totals as (
    select e.user_id, sum(e.xp_delta)::integer as total_xp
    from public.progression_events e
    group by e.user_id
  )
  update public.users u
  set
    total_xp = coalesce(x.total_xp, 0),
    current_streak = case
      when t.last_streak_date >=
        (pg_catalog.timezone(public.progression_timezone(u.timezone), now())::date - 1)
      then coalesce(l.run_length, 0)
      else 0
    end,
    longest_streak = coalesce(t.longest_streak, 0),
    last_streak_date = t.last_streak_date,
    updated_at = now()
  from xp_totals x
  left join run_totals t on t.user_id = x.user_id
  left join latest_runs l on l.user_id = x.user_id
  where u.id = x.user_id;
end;
$function$;

revoke all on function public.rebuild_progression_summaries() from public, anon, authenticated;
grant execute on function public.rebuild_progression_summaries() to service_role;

create or replace function public.handle_attempt_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_timezone text;
  v_activity_date date;
  v_event_id uuid;
  v_xp integer := case when new.is_correct then 10 else 5 end;
  v_daily_count integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_last_streak_date date;
  v_next_streak integer;
begin
  -- One user-row lock serializes summary changes for concurrent practice/mock
  -- submissions without locking unrelated students.
  select
    public.progression_timezone(u.timezone),
    u.current_streak,
    u.longest_streak,
    u.last_streak_date
  into
    v_timezone,
    v_current_streak,
    v_longest_streak,
    v_last_streak_date
  from public.users u
  where u.id = new.user_id
  for update;

  v_activity_date := pg_catalog.timezone(v_timezone, new.created_at)::date;

  insert into public.progression_events (
    user_id,
    question_id,
    attempt_id,
    context,
    is_correct,
    base_xp,
    correct_bonus_xp,
    xp_delta,
    activity_date,
    timezone,
    created_at
  ) values (
    new.user_id,
    new.question_id,
    new.id,
    new.context,
    new.is_correct,
    5,
    case when new.is_correct then 5 else 0 end,
    v_xp,
    v_activity_date,
    v_timezone,
    new.created_at
  )
  on conflict (user_id, question_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return new;
  end if;

  insert into public.daily_progress (
    user_id,
    activity_date,
    qualifying_question_count,
    xp_earned,
    streak_earned,
    streak_crossed_at
  ) values (
    new.user_id,
    v_activity_date,
    1,
    v_xp,
    false,
    null
  )
  on conflict (user_id, activity_date) do update
  set
    qualifying_question_count = public.daily_progress.qualifying_question_count + 1,
    xp_earned = public.daily_progress.xp_earned + excluded.xp_earned,
    streak_earned = public.daily_progress.streak_earned
      or public.daily_progress.qualifying_question_count + 1 >= 5,
    streak_crossed_at = case
      when not public.daily_progress.streak_earned
        and public.daily_progress.qualifying_question_count + 1 >= 5
      then new.created_at
      else public.daily_progress.streak_crossed_at
    end,
    updated_at = now()
  returning qualifying_question_count into v_daily_count;

  if v_last_streak_date is not null
    and v_last_streak_date < v_activity_date - 1 then
    v_current_streak := 0;
  end if;

  update public.users
  set
    total_xp = total_xp + v_xp,
    current_streak = v_current_streak,
    updated_at = now()
  where id = new.user_id;

  if v_daily_count = 5 then
    v_next_streak := case
      when v_last_streak_date = v_activity_date then greatest(v_current_streak, 1)
      when v_last_streak_date = v_activity_date - 1 then v_current_streak + 1
      else 1
    end;

    update public.users
    set
      current_streak = v_next_streak,
      longest_streak = greatest(v_longest_streak, v_next_streak),
      last_streak_date = v_activity_date,
      updated_at = now()
    where id = new.user_id;

    update public.progression_events
    set streak_extended = true
    where id = v_event_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.handle_attempt_progression() from public, anon, authenticated;

-- Disable the live trigger while the idempotent historical event set and its
-- summaries are rebuilt. ALTER TABLE's lock prevents attempt inserts from
-- slipping through this controlled migration window.
drop trigger if exists attempts_award_progression on public.attempts;

with first_attempts as (
  select distinct on (a.user_id, a.question_id)
    a.id as attempt_id,
    a.user_id,
    a.question_id,
    a.context,
    a.is_correct,
    a.created_at,
    public.progression_timezone(u.timezone) as event_timezone
  from public.attempts a
  join public.users u on u.id = a.user_id
  order by a.user_id, a.question_id, a.created_at, a.id
),
dated as (
  select
    f.*,
    pg_catalog.timezone(f.event_timezone, f.created_at)::date as activity_date
  from first_attempts f
),
ranked as (
  select
    d.*,
    row_number() over (
      partition by d.user_id, d.activity_date
      order by d.created_at, d.attempt_id
    ) as day_number
  from dated d
)
insert into public.progression_events (
  user_id,
  question_id,
  attempt_id,
  context,
  is_correct,
  base_xp,
  correct_bonus_xp,
  xp_delta,
  activity_date,
  timezone,
  streak_extended,
  created_at
)
select
  r.user_id,
  r.question_id,
  r.attempt_id,
  r.context,
  r.is_correct,
  5,
  case when r.is_correct then 5 else 0 end,
  case when r.is_correct then 10 else 5 end,
  r.activity_date,
  r.event_timezone,
  r.day_number = 5,
  r.created_at
from ranked r
on conflict (user_id, question_id) do nothing;

select public.rebuild_progression_summaries();

create trigger attempts_award_progression
  after insert on public.attempts
  for each row execute function public.handle_attempt_progression();
