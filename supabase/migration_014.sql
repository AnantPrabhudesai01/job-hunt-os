-- Migration 014: group posts inbox (WhatsApp/Telegram job groups, deduped).
-- One row per unique forwarded post. Duplicates (same normalized text from the
-- same platform) are rejected by the unique key and reported as already visited.
create table if not exists public.group_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('WHATSAPP', 'TELEGRAM')),
  group_name text not null,
  sender_name text,
  body text not null,
  body_hash text not null,
  external_id text,
  status text not null default 'NEW' check (status in ('NEW', 'VISITED', 'INGESTED')),
  mission_job_id bigint references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, platform, body_hash)
);
create index if not exists idx_groupposts_user on public.group_posts (user_id);
create index if not exists idx_groupposts_status on public.group_posts (status);
alter table public.group_posts enable row level security;
drop policy if exists "groupposts_owner" on public.group_posts;
create policy "groupposts_owner" on public.group_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
