-- Migration 016: HR outreach pipeline (recruiter/hiring-manager tracking).
-- One row per LinkedIn profile: bulk-paste in, dedupe by normalized URL,
-- then move along SAVED -> VISITED -> NOTE_SENT -> CONNECTED -> MESSAGED -> REPLIED.
-- Connect notes cap at 300 chars (LinkedIn limit); sending stays manual.
create table if not exists public.hr_outreach (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id bigint references public.contacts (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  mission_job_id bigint references public.jobs (id) on delete set null,
  profile_url text not null,
  profile_key text not null,
  person_name text,
  role_title text,
  company_name text,
  email text,
  connect_note text,
  message_draft text,
  status text not null default 'SAVED'
    check (status in ('SAVED', 'VISITED', 'NOTE_SENT', 'CONNECTED', 'MESSAGED', 'REPLIED')),
  visited_at timestamptz,
  connected_at timestamptz,
  messaged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, profile_key)
);
create index if not exists idx_hroutreach_user on public.hr_outreach (user_id);
create index if not exists idx_hroutreach_status on public.hr_outreach (status);
alter table public.hr_outreach enable row level security;
drop policy if exists "hroutreach_owner" on public.hr_outreach;
create policy "hroutreach_owner" on public.hr_outreach for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
