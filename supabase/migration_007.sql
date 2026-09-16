-- Migration 007: real-time date/time tracking (Asia/Kolkata default, UTC storage)
alter table public.jobs
  add column if not exists posted_at timestamptz,
  add column if not exists posted_at_display text,
  add column if not exists posted_at_precision text,
  add column if not exists posted_at_confidence text,
  add column if not exists posted_at_source text,
  add column if not exists status_changed_at timestamptz;

alter table public.email_drafts
  add column if not exists sent_at timestamptz;
alter table public.follow_ups
  add column if not exists sent_at timestamptz;

create table if not exists public.application_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  application_id bigint references public.applications (id) on delete set null,
  event_type text not null,
  event_timestamp timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_user on public.application_events (user_id);
create index if not exists idx_events_job on public.application_events (job_id);
create index if not exists idx_events_time on public.application_events (event_timestamp);
alter table public.application_events enable row level security;
drop policy if exists "events_owner" on public.application_events;
create policy "events_owner" on public.application_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
