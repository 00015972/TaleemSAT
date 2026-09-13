-- Pulse Command: bounded user-directory analytics and private admin notes.

create table if not exists public.admin_user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint admin_user_notes_body_length_chk
    check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists admin_user_notes_user_created_idx
  on public.admin_user_notes (user_id, created_at desc);

create index if not exists admin_user_notes_author_idx
  on public.admin_user_notes (author_user_id);

alter table public.admin_user_notes enable row level security;
revoke all on table public.admin_user_notes from anon, authenticated;
grant select, insert on table public.admin_user_notes to service_role;

create or replace function public.admin_users_summary()
returns table (
  total_users bigint,
  paid_access bigint,
  weekly_active bigint,
  needs_attention bigint,
  workspace_health integer,
  renewal_risk bigint,
  inactive_paid bigint,
  recent_upgrades bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with user_flags as (
    select
      u.id,
      u.tier,
      u.subscription_status in ('past_due', 'incomplete') as is_renewal_risk,
      u.tier in ('pro', 'elite')
        and u.created_at <= now() - interval '14 days'
        and not exists (
          select 1
          from public.attempts a
          where a.user_id = u.id
            and a.created_at >= now() - interval '14 days'
        ) as is_inactive_paid,
      exists (
        select 1
        from public.attempts a
        where a.user_id = u.id
          and a.created_at >= now() - interval '7 days'
      ) as is_weekly_active
    from public.users u
  ),
  upgrade_ids as (
    select s.user_id
    from public.subscriptions s
    where s.tier in ('pro', 'elite')
      and s.status in ('active', 'trialing')
      and s.created_at >= now() - interval '7 days'
    union
    select a.target_id
    from public.audit_log a
    where a.target_type = 'user'
      and a.action = 'user.update'
      and a.target_id is not null
      and a.created_at >= now() - interval '7 days'
      and a.before ->> 'tier' = 'free'
      and a.after ->> 'tier' in ('pro', 'elite')
  ),
  totals as (
    select
      count(*)::bigint as total_users,
      count(*) filter (where tier in ('pro', 'elite'))::bigint as paid_access,
      count(*) filter (where is_weekly_active)::bigint as weekly_active,
      count(*) filter (where is_renewal_risk or is_inactive_paid)::bigint as needs_attention,
      count(*) filter (where is_renewal_risk)::bigint as renewal_risk,
      count(*) filter (where is_inactive_paid)::bigint as inactive_paid
    from user_flags
  )
  select
    t.total_users,
    t.paid_access,
    t.weekly_active,
    t.needs_attention,
    case
      when t.paid_access = 0 then 100
      else greatest(
        0,
        least(100, round(100.0 * (t.paid_access - t.needs_attention) / t.paid_access)::integer)
      )
    end as workspace_health,
    t.renewal_risk,
    t.inactive_paid,
    (select count(*)::bigint from upgrade_ids) as recent_upgrades
  from totals t;
$$;

revoke all on function public.admin_users_summary() from public, anon, authenticated;
grant execute on function public.admin_users_summary() to service_role;

create or replace function public.admin_users_directory(
  p_search text default null,
  p_role public.user_role default null,
  p_tier public.user_tier default null,
  p_segment text default null,
  p_sort text default 'newest',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  tier public.user_tier,
  created_at timestamptz,
  subscription_status public.subscription_status,
  last_active_at timestamptz,
  attempts_7d bigint,
  total_attempts bigint,
  correct_attempts bigint,
  accuracy numeric,
  daily_activity jsonb,
  filtered_total bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' as today_utc
  ),
  upgrade_ids as (
    select s.user_id
    from public.subscriptions s
    where s.tier in ('pro', 'elite')
      and s.status in ('active', 'trialing')
      and s.created_at >= now() - interval '7 days'
    union
    select a.target_id
    from public.audit_log a
    where a.target_type = 'user'
      and a.action = 'user.update'
      and a.target_id is not null
      and a.created_at >= now() - interval '7 days'
      and a.before ->> 'tier' = 'free'
      and a.after ->> 'tier' in ('pro', 'elite')
  ),
  enriched as (
    select
      u.id,
      u.email,
      u.full_name,
      u.role,
      u.tier,
      u.created_at,
      u.subscription_status,
      stats.last_active_at,
      stats.attempts_7d,
      stats.total_attempts,
      stats.correct_attempts,
      case
        when stats.total_attempts = 0 then null
        else round(100.0 * stats.correct_attempts / stats.total_attempts, 1)
      end as accuracy,
      stats.daily_activity,
      u.subscription_status in ('past_due', 'incomplete') as is_renewal_risk,
      u.tier in ('pro', 'elite')
        and u.created_at <= now() - interval '14 days'
        and (stats.last_active_at is null or stats.last_active_at < now() - interval '14 days')
        as is_inactive_paid,
      exists (select 1 from upgrade_ids x where x.user_id = u.id) as is_recent_upgrade
    from public.users u
    cross join bounds b
    cross join lateral (
      select
        max(a.created_at) as last_active_at,
        count(*) filter (where a.created_at >= now() - interval '7 days')::bigint as attempts_7d,
        count(*)::bigint as total_attempts,
        count(*) filter (where a.is_correct)::bigint as correct_attempts,
        jsonb_build_array(
          count(*) filter (where a.created_at >= b.today_utc - interval '6 days' and a.created_at < b.today_utc - interval '5 days'),
          count(*) filter (where a.created_at >= b.today_utc - interval '5 days' and a.created_at < b.today_utc - interval '4 days'),
          count(*) filter (where a.created_at >= b.today_utc - interval '4 days' and a.created_at < b.today_utc - interval '3 days'),
          count(*) filter (where a.created_at >= b.today_utc - interval '3 days' and a.created_at < b.today_utc - interval '2 days'),
          count(*) filter (where a.created_at >= b.today_utc - interval '2 days' and a.created_at < b.today_utc - interval '1 day'),
          count(*) filter (where a.created_at >= b.today_utc - interval '1 day' and a.created_at < b.today_utc),
          count(*) filter (where a.created_at >= b.today_utc and a.created_at < b.today_utc + interval '1 day')
        ) as daily_activity
      from public.attempts a
      where a.user_id = u.id
    ) stats
    where (p_role is null or u.role = p_role)
      and (p_tier is null or u.tier = p_tier)
      and (
        nullif(btrim(p_search), '') is null
        or u.id::text = btrim(p_search)
        or u.email ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
        or coalesce(u.full_name, '') ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
  ),
  filtered as (
    select *
    from enriched e
    where nullif(p_segment, '') is null
      or (p_segment = 'attention' and (e.is_renewal_risk or e.is_inactive_paid))
      or (p_segment = 'renewal-risk' and e.is_renewal_risk)
      or (p_segment = 'inactive-paid' and e.is_inactive_paid)
      or (p_segment = 'recent-upgrade' and e.is_recent_upgrade)
  )
  select
    f.id,
    f.email,
    f.full_name,
    f.role,
    f.tier,
    f.created_at,
    f.subscription_status,
    f.last_active_at,
    f.attempts_7d,
    f.total_attempts,
    f.correct_attempts,
    f.accuracy,
    f.daily_activity,
    count(*) over()::bigint as filtered_total
  from filtered f
  order by
    case when p_sort = 'newest' then f.created_at end desc,
    case when p_sort = 'oldest' then f.created_at end asc,
    case when p_sort = 'recent-activity' then f.last_active_at end desc nulls last,
    case when p_sort = 'lowest-accuracy' then f.accuracy end asc nulls last,
    f.created_at desc,
    f.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 10000);
$$;

revoke all on function public.admin_users_directory(text, public.user_role, public.user_tier, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_users_directory(text, public.user_role, public.user_tier, text, text, integer, integer)
  to service_role;
