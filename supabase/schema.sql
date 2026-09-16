-- ============================================================
-- ANANT JOB HUNT OS — MVP schema (Phase 1 + 2)
-- Run in Supabase Dashboard > SQL Editor (single run).
-- ============================================================

-- Updated-at helper
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Anant Prabhudesai',
  email text,
  phone text,
  linkedin_url text,
  github_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ---------- companies ----------
create table if not exists public.companies (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  website text,
  location text,
  industry text,
  contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.handle_updated_at();
create index if not exists idx_companies_user on public.companies (user_id);
create index if not exists idx_companies_name on public.companies (name);

-- ---------- jobs ----------
create table if not exists public.jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  mission_id text,
  title text not null,
  location text,
  work_mode text,
  employment_type text,
  experience_requirement text,
  source text,
  job_url text,
  description text,
  required_skills text,
  status text not null default 'DISCOVERED',
  priority text not null default 'Medium',
  quality_score int,
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_jobs_updated on public.jobs;
create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.handle_updated_at();
create index if not exists idx_jobs_user on public.jobs (user_id);
create index if not exists idx_jobs_status on public.jobs (status);
create index if not exists idx_jobs_mission on public.jobs (mission_id);

-- ---------- applications (missions) ----------
create table if not exists public.applications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  mission_id text,
  stage text not null default 'DISCOVERED',
  date_applied date,
  xp_earned int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_applications_updated on public.applications;
create trigger trg_applications_updated before update on public.applications
  for each row execute function public.handle_updated_at();
create index if not exists idx_applications_user on public.applications (user_id);
create index if not exists idx_applications_stage on public.applications (stage);

-- ---------- contacts ----------
create table if not exists public.contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  name text not null,
  role_title text,
  contact_type text,
  email text,
  phone text,
  linkedin_url text,
  last_contacted date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.handle_updated_at();
create index if not exists idx_contacts_user on public.contacts (user_id);

-- ---------- resume_versions ----------
create table if not exists public.resume_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  file_name text not null,
  version_label text not null default 'v1',
  has_photo boolean not null default false,
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_resumes_user on public.resume_versions (user_id);

-- ---------- email_drafts ----------
create table if not exists public.email_drafts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id bigint references public.jobs (id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'DRAFTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_drafts_updated on public.email_drafts;
create trigger trg_drafts_updated before update on public.email_drafts
  for each row execute function public.handle_updated_at();
create index if not exists idx_drafts_user on public.email_drafts (user_id);

-- ---------- xp_transactions ----------
create table if not exists public.xp_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id text,
  action text not null,
  xp int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_user on public.xp_transactions (user_id);

-- ============================================================
-- ROW LEVEL SECURITY (single-user data isolation)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.contacts enable row level security;
alter table public.resume_versions enable row level security;
alter table public.email_drafts enable row level security;
alter table public.xp_transactions enable row level security;

-- Helper macro pattern repeated per table (owner-only access)
do $$ begin
  -- profiles
  drop policy if exists "profiles_owner" on public.profiles;
  create policy "profiles_owner" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
  -- companies
  drop policy if exists "companies_owner" on public.companies;
  create policy "companies_owner" on public.companies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- jobs
  drop policy if exists "jobs_owner" on public.jobs;
  create policy "jobs_owner" on public.jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- applications
  drop policy if exists "applications_owner" on public.applications;
  create policy "applications_owner" on public.applications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- contacts
  drop policy if exists "contacts_owner" on public.contacts;
  create policy "contacts_owner" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- resume_versions
  drop policy if exists "resumes_owner" on public.resume_versions;
  create policy "resumes_owner" on public.resume_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- email_drafts
  drop policy if exists "drafts_owner" on public.email_drafts;
  create policy "drafts_owner" on public.email_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- xp_transactions
  drop policy if exists "xp_owner" on public.xp_transactions;
  create policy "xp_owner" on public.xp_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
end $$;
