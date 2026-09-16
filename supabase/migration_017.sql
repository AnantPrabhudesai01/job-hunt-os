-- Migration 017: walk-in reports (post-visit field notes live here, not in chat).
-- One row per mission: did you go, what rounds/questions you faced, outcome.
-- Statuses never change from here (NOT APPLIED stays until YOU mark it).
create table if not exists public.walkin_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_job_id bigint not null references public.jobs (id) on delete cascade,
  attended boolean not null default false,
  visited_date date,
  rounds text,
  questions_asked text,
  crowd_notes text,
  outcome text not null default 'UPCOMING'
    check (outcome in ('UPCOMING', 'ATTENDED', 'SHORTLISTED', 'REJECTED', 'WAITING', 'SKIPPED')),
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_job_id)
);
create index if not exists idx_walkins_user on public.walkin_reports (user_id);
create index if not exists idx_walkins_outcome on public.walkin_reports (outcome);
alter table public.walkin_reports enable row level security;
drop policy if exists "walkins_owner" on public.walkin_reports;
create policy "walkins_owner" on public.walkin_reports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
