-- Migration 012: achievement persistence + DSA solve log
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  xp_awarded int not null default 0,
  celebration_seen boolean not null default false,
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
drop policy if exists "ua_owner" on public.user_achievements;
create policy "ua_owner" on public.user_achievements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.dsa_solves (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  difficulty text not null default 'Easy',
  solved_at timestamptz not null default now()
);
create index if not exists idx_dsa_user on public.dsa_solves (user_id);
alter table public.dsa_solves enable row level security;
drop policy if exists "dsa_owner" on public.dsa_solves;
create policy "dsa_owner" on public.dsa_solves for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
