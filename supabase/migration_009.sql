-- Migration 009: source intelligence (origin distinct from profile/company/apply URLs)
alter table public.jobs
  add column if not exists source_type text,
  add column if not exists post_author text,
  add column if not exists post_author_role text,
  add column if not exists post_date_display text,
  add column if not exists post_date_note text;
