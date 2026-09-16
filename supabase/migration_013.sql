-- Migration 013: 30-day career sprint (F-009). Challenge runs, per-day logs for
-- LeetCode (5 slots), mini-projects, LinkedIn posts, GitHub activity.
-- Applications are NEVER duplicated here — sprint reads existing jobs/applications.
-- All tables owner-only RLS, same convention as 002..012.

create table if not exists public.sprint_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '30-Day Career Sprint',
  start_date date not null,
  status text not null default 'ACTIVE',
  daily_app_target integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists idx_sprint_runs_user on public.sprint_runs (user_id);
alter table public.sprint_runs enable row level security;
drop policy if exists "sprint_runs_owner" on public.sprint_runs;
create policy "sprint_runs_owner" on public.sprint_runs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sprint_days (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id bigint not null references public.sprint_runs (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  day_date date not null,
  status text not null default 'LOCKED',
  notes text,
  created_at timestamptz not null default now(),
  unique (run_id, day_number)
);
create index if not exists idx_sprint_days_run on public.sprint_days (run_id);
alter table public.sprint_days enable row level security;
drop policy if exists "sprint_days_owner" on public.sprint_days;
create policy "sprint_days_owner" on public.sprint_days for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sprint_leetcode (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id bigint not null references public.sprint_runs (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  slot text not null check (slot in ('L1','L2','L3','L4','L5')),
  title text not null default '',
  url text,
  category text,
  difficulty text,
  status text not null default 'TODO',
  attempts integer not null default 0,
  time_minutes integer not null default 0,
  notes text,
  approach text,
  is_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, day_number, slot)
);
create index if not exists idx_sprint_lc_run_day on public.sprint_leetcode (run_id, day_number);
alter table public.sprint_leetcode enable row level security;
drop policy if exists "sprint_lc_owner" on public.sprint_leetcode;
create policy "sprint_lc_owner" on public.sprint_leetcode for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sprint_projects (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id bigint not null references public.sprint_runs (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  name text not null default '',
  category text,
  problem text,
  tech text,
  repo_url text,
  demo_url text,
  readme_done boolean not null default false,
  screenshot_url text,
  status text not null default 'PLANNED',
  started_at timestamptz,
  completed_at timestamptz,
  lessons text,
  created_at timestamptz not null default now(),
  unique (run_id, day_number)
);
create index if not exists idx_sprint_proj_run on public.sprint_projects (run_id);
alter table public.sprint_projects enable row level security;
drop policy if exists "sprint_proj_owner" on public.sprint_projects;
create policy "sprint_proj_owner" on public.sprint_projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sprint_linkedin_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id bigint not null references public.sprint_runs (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  title text,
  body text,
  post_url text,
  project_assoc text,
  repo_url text,
  status text not null default 'IDEA',
  published_at timestamptz,
  screenshot_url text,
  engagement text,
  created_at timestamptz not null default now(),
  unique (run_id, day_number)
);
create index if not exists idx_sprint_li_run on public.sprint_linkedin_posts (run_id);
alter table public.sprint_linkedin_posts enable row level security;
drop policy if exists "sprint_li_owner" on public.sprint_linkedin_posts;
create policy "sprint_li_owner" on public.sprint_linkedin_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sprint_github (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id bigint not null references public.sprint_runs (id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  repo text,
  commit_url text,
  commit_hash text,
  commit_message text,
  pr_url text,
  project_assoc text,
  status text not null default 'PLANNED',
  created_at timestamptz not null default now(),
  unique (run_id, day_number)
);
create index if not exists idx_sprint_gh_run on public.sprint_github (run_id);
alter table public.sprint_github enable row level security;
drop policy if exists "sprint_gh_owner" on public.sprint_github;
create policy "sprint_gh_owner" on public.sprint_github for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
