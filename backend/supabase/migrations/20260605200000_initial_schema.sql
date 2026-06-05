create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz,
  status text not null check (status in ('draft', 'active', 'archived', 'completed')),
  current_day integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists plans_one_active_per_user_idx
  on public.plans (user_id)
  where status = 'active';

create table if not exists public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  name text not null,
  day_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.plan_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  target_sets integer not null,
  target_reps integer not null,
  rest_seconds integer not null default 0,
  notes text
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  plan_day_id uuid not null references public.plan_days(id),
  workout_date timestamptz not null,
  notes text,
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  plan_exercise_id uuid references public.plan_exercises(id)
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric(8,2) not null,
  reps integer not null,
  rir integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

create policy "users_manage_own_plans" on public.plans
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_manage_own_plan_days" on public.plan_days
  using (
    exists (
      select 1 from public.plans
      where plans.id = plan_days.plan_id and plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.plans
      where plans.id = plan_days.plan_id and plans.user_id = auth.uid()
    )
  );

create policy "users_manage_own_plan_exercises" on public.plan_exercises
  using (
    exists (
      select 1
      from public.plan_days
      join public.plans on plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id and plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.plan_days
      join public.plans on plans.id = plan_days.plan_id
      where plan_days.id = plan_exercises.plan_day_id and plans.user_id = auth.uid()
    )
  );

create policy "users_manage_own_sessions" on public.workout_sessions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_manage_own_workout_exercises" on public.workout_exercises
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "users_manage_own_workout_sets" on public.workout_sets
  using (
    exists (
      select 1
      from public.workout_exercises
      join public.workout_sessions on workout_sessions.id = workout_exercises.workout_session_id
      where workout_exercises.id = workout_sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises
      join public.workout_sessions on workout_sessions.id = workout_exercises.workout_session_id
      where workout_exercises.id = workout_sets.workout_exercise_id
        and workout_sessions.user_id = auth.uid()
    )
  );
