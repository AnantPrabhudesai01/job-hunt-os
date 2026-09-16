-- Migration 015: activity + opportunity source tracker (additive only).
-- 1) my_linkedin_posts: the user's OWN LinkedIn output, fully separate from
--    LinkedIn job-opportunity posts (which live on jobs via source_type).
-- 2) sprint_days.interview_minutes: daily interview-prep minutes for the
--    30-day challenge dashboard (all other day goals already derive from rows).
create table if not exists public.my_linkedin_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text,
  title text,
  body text,
  post_type text,
  project_assoc text,
  challenge_day int,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'POSTED')),
  posted_date date,
  likes int not null default 0,
  comments int not null default 0,
  reposts int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_myposts_user on public.my_linkedin_posts (user_id);
create index if not exists idx_myposts_status on public.my_linkedin_posts (status);
alter table public.my_linkedin_posts enable row level security;
drop policy if exists "myposts_owner" on public.my_linkedin_posts;
create policy "myposts_owner" on public.my_linkedin_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.sprint_days
  add column if not exists interview_minutes int not null default 0;
