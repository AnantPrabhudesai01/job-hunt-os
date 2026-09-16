-- Migration 002: interview prep + follow-ups (powers progress + quests honestly)
create table if not exists public.interview_preps (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  pdf_path text,
  status text not null default 'READY',
  research_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_preps_user on public.interview_preps (user_id);
create index if not exists idx_preps_job on public.interview_preps (job_id);
alter table public.interview_preps enable row level security;
drop policy if exists "preps_owner" on public.interview_preps;
create policy "preps_owner" on public.interview_preps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.follow_ups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  contact_name text,
  channel text,
  due_date date,
  status text not null default 'PENDING',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_followups_user on public.follow_ups (user_id);
alter table public.follow_ups enable row level security;
drop policy if exists "followups_owner" on public.follow_ups;
create policy "followups_owner" on public.follow_ups for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
