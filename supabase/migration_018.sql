-- Migration 018: mail-shot directory (bulk outreach, NOT missions).
-- One row per unique mail. Sending stays manual (user Gmail);
-- I SENT IT flips status, never touches applications/stages.
create table if not exists public.mail_directory (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  company text,
  person text,
  title text,
  phone text,
  sources text,
  status text not null default 'NEW',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);
create index if not exists idx_maildir_user on public.mail_directory (user_id);
create index if not exists idx_maildir_status on public.mail_directory (status);
create index if not exists idx_maildir_company on public.mail_directory (company);
alter table public.mail_directory enable row level security;
drop policy if exists "maildir_owner" on public.mail_directory;
create policy "maildir_owner" on public.mail_directory for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
