-- Migration 011: outreach communications (email/WhatsApp/LinkedIn) + Gmail linkage
create table if not exists public.communications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  channel text not null,
  recipient_email text,
  recipient_phone text,
  profile_url text,
  subject text,
  body text,
  resume_asset_id bigint references public.assets (id) on delete set null,
  resume_file_name text,
  provider text,
  provider_message_id text,
  status text not null default 'DRAFTED',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_comms_user on public.communications (user_id);
create index if not exists idx_comms_job on public.communications (job_id);
alter table public.communications enable row level security;
drop policy if exists "comms_owner" on public.communications;
create policy "comms_owner" on public.communications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.gmail_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gmail_address text,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gmail_accounts enable row level security;
drop policy if exists "gmail_owner" on public.gmail_accounts;
create policy "gmail_owner" on public.gmail_accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
