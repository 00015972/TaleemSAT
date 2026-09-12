-- ============================================================================
-- 015_authoritative_attempt_sessions.sql
--
-- Makes practice and mock attempt recording server-authoritative. A trusted
-- route creates an immutable question roster, then short database functions
-- serialize first-answer claims and one-time mock finalization.
--
-- Safe to re-run. Historical attempts remain valid with a null session_id.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_session_status') then
    create type public.assessment_session_status as enum ('active', 'completed');
  end if;
end $$;

create table if not exists public.assessment_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  context       public.attempt_context not null,
  status        public.assessment_session_status not null default 'active',
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  constraint assessment_sessions_config_object_chk
    check (jsonb_typeof(config) = 'object'),
  constraint assessment_sessions_completion_chk
    check (
      (status = 'active' and completed_at is null)
      or (status = 'completed' and completed_at is not null)
    )
);

create index if not exists assessment_sessions_user_created_idx
  on public.assessment_sessions (user_id, created_at desc);

create table if not exists public.assessment_session_questions (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.assessment_sessions(id) on delete cascade,
  question_id    uuid not null references public.questions(id) on delete restrict,
  position       integer not null,
  submission_id  uuid not null default gen_random_uuid(),
  attempt_id     uuid references public.attempts(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint assessment_session_questions_position_chk check (position >= 0),
  constraint assessment_session_questions_session_question_unique unique (session_id, question_id),
  constraint assessment_session_questions_session_position_unique unique (session_id, position),
  constraint assessment_session_questions_submission_unique unique (submission_id),
  constraint assessment_session_questions_attempt_unique unique (attempt_id)
);

create index if not exists assessment_session_questions_question_idx
  on public.assessment_session_questions (question_id);

alter table public.attempts
  add column if not exists session_id uuid;

alter table public.attempts
  alter column selected_answer drop not null;

-- Legacy MCQ-only databases still carry this constraint even though practice
-- and mock grading now support bounded grid-in text responses.
alter table public.attempts
  drop constraint if exists attempts_selected_answer_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attempts_session_id_fkey'
      and conrelid = 'public.attempts'::regclass
  ) then
    alter table public.attempts
      add constraint attempts_session_id_fkey
      foreign key (session_id) references public.assessment_sessions(id) on delete cascade;
  end if;
end $$;

create unique index if not exists attempts_session_question_unique
  on public.attempts (session_id, question_id)
  where session_id is not null;

alter table public.assessment_sessions enable row level security;
alter table public.assessment_session_questions enable row level security;

drop policy if exists assessment_sessions_select_own on public.assessment_sessions;
create policy assessment_sessions_select_own
  on public.assessment_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists assessment_session_questions_select_own
  on public.assessment_session_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assessment_sessions s
      where s.id = assessment_session_questions.session_id
        and s.user_id = (select auth.uid())
    )
  );

revoke all on table public.assessment_sessions from anon, authenticated;
revoke all on table public.assessment_session_questions from anon, authenticated;
grant select on table public.assessment_sessions to authenticated;
grant select on table public.assessment_session_questions to authenticated;
grant all on table public.assessment_sessions to service_role;
grant all on table public.assessment_session_questions to service_role;

create or replace function public.create_assessment_session(
  p_user_id uuid,
  p_context public.attempt_context,
  p_question_ids uuid[],
  p_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_question_count integer;
  v_distinct_count integer;
  v_published_count integer;
  v_questions jsonb;
begin
  if p_user_id is null or p_context is null then
    raise exception 'Session owner and context are required' using errcode = '22023';
  end if;

  v_question_count := coalesce(cardinality(p_question_ids), 0);
  if v_question_count < 1 or v_question_count > 2000 then
    raise exception 'Session question count is out of range' using errcode = '22023';
  end if;

  select count(distinct question_id)::integer
  into v_distinct_count
  from unnest(p_question_ids) as question_ids(question_id);

  if v_distinct_count <> v_question_count then
    raise exception 'Session question identifiers must be unique' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_published_count
  from public.questions q
  where q.id = any(p_question_ids)
    and q.status = 'published';

  if v_published_count <> v_question_count then
    raise exception 'Every session question must be published' using errcode = '22023';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Session config must be an object' using errcode = '22023';
  end if;

  insert into public.assessment_sessions (user_id, context, config)
  values (p_user_id, p_context, p_config)
  returning id into v_session_id;

  insert into public.assessment_session_questions (session_id, question_id, position)
  select v_session_id, item.question_id, (item.ordinality - 1)::integer
  from unnest(p_question_ids) with ordinality as item(question_id, ordinality)
  order by item.ordinality;

  select jsonb_agg(
    jsonb_build_object(
      'questionId', sq.question_id,
      'submissionId', sq.submission_id,
      'position', sq.position
    )
    order by sq.position
  )
  into v_questions
  from public.assessment_session_questions sq
  where sq.session_id = v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.create_assessment_session(uuid, public.attempt_context, uuid[], jsonb)
  from public, anon, authenticated;
grant execute on function public.create_assessment_session(uuid, public.attempt_context, uuid[], jsonb)
  to service_role;

create or replace function public.record_practice_session_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_submission_id uuid,
  p_selected_answer text,
  p_is_correct boolean,
  p_time_taken_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_question_id uuid;
  v_attempt_id uuid;
  v_attempt public.attempts%rowtype;
  v_is_first boolean := false;
  v_is_replay boolean := false;
begin
  if p_selected_answer is null or btrim(p_selected_answer) = '' or p_is_correct is null then
    raise exception 'A practice answer and correctness are required' using errcode = '22023';
  end if;
  if p_time_taken_ms is not null and (p_time_taken_ms < 0 or p_time_taken_ms > 86400000) then
    raise exception 'Practice timing is out of range' using errcode = '22023';
  end if;

  select sq.question_id, sq.attempt_id
  into v_question_id, v_attempt_id
  from public.assessment_session_questions sq
  join public.assessment_sessions s on s.id = sq.session_id
  where sq.session_id = p_session_id
    and sq.submission_id = p_submission_id
    and s.user_id = p_user_id
    and s.context = 'practice'
    and s.status = 'active'
  for update of sq;

  if v_question_id is null then
    raise exception 'Practice session submission was not found' using errcode = 'P0002';
  end if;

  if v_attempt_id is null then
    insert into public.attempts (
      user_id,
      question_id,
      selected_answer,
      is_correct,
      time_taken_ms,
      submission_key,
      session_id,
      context
    ) values (
      p_user_id,
      v_question_id,
      p_selected_answer,
      p_is_correct,
      p_time_taken_ms,
      p_submission_id,
      p_session_id,
      'practice'
    )
    returning * into v_attempt;

    update public.assessment_session_questions
    set attempt_id = v_attempt.id
    where session_id = p_session_id
      and submission_id = p_submission_id;

    v_is_first := true;
  else
    select * into strict v_attempt
    from public.attempts a
    where a.id = v_attempt_id
      and a.user_id = p_user_id
      and a.session_id = p_session_id
      and a.question_id = v_question_id;

    v_is_replay := v_attempt.selected_answer = p_selected_answer
      and v_attempt.is_correct = p_is_correct
      and v_attempt.time_taken_ms is not distinct from p_time_taken_ms
      and v_attempt.submission_key = p_submission_id
      and v_attempt.context = 'practice';
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'questionId', v_attempt.question_id,
    'selectedAnswer', v_attempt.selected_answer,
    'isCorrect', v_attempt.is_correct,
    'timeTakenMs', v_attempt.time_taken_ms,
    'isFirstAnswer', v_is_first,
    'isReplay', v_is_replay,
    'isLearningRetry', not v_is_first and not v_is_replay
  );
end;
$function$;

revoke all on function public.record_practice_session_answer(uuid, uuid, uuid, text, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.record_practice_session_answer(uuid, uuid, uuid, text, boolean, integer)
  to service_role;

create or replace function public.finalize_mock_session(
  p_user_id uuid,
  p_session_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status public.assessment_session_status;
  v_roster_count integer;
  v_result_count integer;
  v_distinct_count integer;
  v_attempts jsonb;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'Mock results must be an array' using errcode = '22023';
  end if;

  select s.status
  into v_status
  from public.assessment_sessions s
  where s.id = p_session_id
    and s.user_id = p_user_id
    and s.context = 'mock'
  for update;

  if v_status is null then
    raise exception 'Mock session was not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.assessment_session_questions sq
  where sq.session_id = p_session_id
  order by sq.submission_id
  for update;

  if v_status = 'active' then
    select count(*)::integer
    into v_roster_count
    from public.assessment_session_questions sq
    where sq.session_id = p_session_id;

    select count(*)::integer, count(distinct r.submission_id)::integer
    into v_result_count, v_distinct_count
    from jsonb_to_recordset(p_results) as r(
      submission_id uuid,
      selected_answer text,
      is_correct boolean,
      time_taken_ms integer
    );

    if v_result_count <> v_roster_count or v_distinct_count <> v_roster_count then
      raise exception 'Mock results must cover the complete roster exactly once' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_results) as r(
        submission_id uuid,
        selected_answer text,
        is_correct boolean,
        time_taken_ms integer
      )
      left join public.assessment_session_questions sq
        on sq.session_id = p_session_id
       and sq.submission_id = r.submission_id
      where sq.id is null
        or r.is_correct is null
        or (r.time_taken_ms is not null and (r.time_taken_ms < 0 or r.time_taken_ms > 86400000))
    ) then
      raise exception 'Mock results contain an invalid roster entry' using errcode = '22023';
    end if;

    with supplied as (
      select *
      from jsonb_to_recordset(p_results) as r(
        submission_id uuid,
        selected_answer text,
        is_correct boolean,
        time_taken_ms integer
      )
    ), inserted as (
      insert into public.attempts (
        user_id,
        question_id,
        selected_answer,
        is_correct,
        time_taken_ms,
        submission_key,
        session_id,
        context
      )
      select
        p_user_id,
        sq.question_id,
        supplied.selected_answer,
        supplied.is_correct,
        supplied.time_taken_ms,
        sq.submission_id,
        p_session_id,
        'mock'
      from public.assessment_session_questions sq
      join supplied on supplied.submission_id = sq.submission_id
      where sq.session_id = p_session_id
      order by sq.question_id
      returning id, question_id
    )
    update public.assessment_session_questions sq
    set attempt_id = inserted.id
    from inserted
    where sq.session_id = p_session_id
      and sq.question_id = inserted.question_id;

    update public.assessment_sessions
    set status = 'completed', completed_at = now()
    where id = p_session_id;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'attemptId', a.id,
      'questionId', a.question_id,
      'submissionId', sq.submission_id,
      'selectedAnswer', a.selected_answer,
      'isCorrect', a.is_correct,
      'timeTakenMs', a.time_taken_ms
    )
    order by sq.position
  )
  into v_attempts
  from public.assessment_session_questions sq
  join public.attempts a on a.id = sq.attempt_id
  where sq.session_id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'replayed', v_status = 'completed',
    'attempts', coalesce(v_attempts, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.finalize_mock_session(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_mock_session(uuid, uuid, jsonb)
  to service_role;

-- A finalized mock records unanswered questions as attempts for honest score
-- history, but skipped questions are not effort and must not mint XP.
drop trigger if exists attempts_award_progression on public.attempts;
create trigger attempts_award_progression
  after insert on public.attempts
  for each row
  when (new.selected_answer is not null)
  execute function public.handle_attempt_progression();

-- Post-apply verification:
-- select table_name from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('assessment_sessions', 'assessment_session_questions');
-- select indexname, indexdef from pg_indexes
-- where schemaname = 'public'
--   and indexname in ('attempts_session_question_unique',
--                     'assessment_sessions_user_created_idx');
