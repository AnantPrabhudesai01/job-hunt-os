-- Migration 004: evidence assets + structured emails (trust model: every fact has a source)
create table if not exists public.assets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  asset_type text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  local_path text,
  storage_path text,
  sync_status text not null default 'LOCAL_ONLY',
  source text,
  source_detail text,
  confidence text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_assets_user on public.assets (user_id);
create index if not exists idx_assets_job on public.assets (job_id);
alter table public.assets enable row level security;
drop policy if exists "assets_owner" on public.assets;
create policy "assets_owner" on public.assets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.emails (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  email_address text not null,
  email_type text,
  display_name text,
  source text,
  source_detail text,
  confidence text,
  context text,
  created_at timestamptz not null default now()
);
create index if not exists idx_emails_user on public.emails (user_id);
create index if not exists idx_emails_job on public.emails (job_id);
alter table public.emails enable row level security;
drop policy if exists "emails_owner" on public.emails;
create policy "emails_owner" on public.emails for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
