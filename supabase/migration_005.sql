-- Migration 005: typed private buckets + documents registry (canonical file store)
do $$
declare b text;
begin
  foreach b in array array[
    'resumes','interview-preparation','people-research','company-research',
    'job-descriptions','uploads','application-assets','profile-assets'] loop
    insert into storage.buckets (id, name, public)
    values (b, b, false)
    on conflict (id) do nothing;
  end loop;
end $$;

-- Owner-folder policies for every typed bucket (first path segment = auth.uid())
do $$
declare b text;
begin
  foreach b in array array[
    'resumes','interview-preparation','people-research','company-research',
    'job-descriptions','uploads','application-assets','profile-assets'] loop
    execute format('drop policy if exists %I on storage.objects;', b || '_owner_all');
    execute format(
      'create policy %I on storage.objects for all to authenticated '
      'using (bucket_id = %L and (storage.foldername(name))[1] = (auth.uid())::text) '
      'with check (bucket_id = %L and (storage.foldername(name))[1] = (auth.uid())::text);',
      b || '_owner_all', b, b);
  end loop;
end $$;

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  job_id bigint references public.jobs (id) on delete set null,
  application_id bigint references public.applications (id) on delete set null,
  document_type text not null,
  bucket_name text not null,
  storage_path text,
  file_name text not null,
  mime_type text,
  file_size bigint,
  version int not null default 1,
  is_current boolean not null default true,
  checksum text,
  description text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz
);
drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.handle_updated_at();
create index if not exists idx_documents_user on public.documents (user_id);
create index if not exists idx_documents_job on public.documents (job_id);
create index if not exists idx_documents_type on public.documents (document_type);
alter table public.documents enable row level security;
drop policy if exists "documents_owner" on public.documents;
create policy "documents_owner" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Current-version flag on resume_versions (additive, history preserved)
alter table public.resume_versions
  add column if not exists is_current boolean not null default false;
