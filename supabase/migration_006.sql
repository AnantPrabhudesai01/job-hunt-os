-- Migration 006: LinkedIn evidence links on jobs (embed = official LinkedIn iframe)
alter table public.jobs
  add column if not exists linkedin_post_url text,
  add column if not exists linkedin_embed_url text;
