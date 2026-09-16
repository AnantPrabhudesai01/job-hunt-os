-- Migration 010: manual application control (user is the only authority on APPLIED)
alter table public.applications
  add column if not exists applied_at timestamptz,
  add column if not exists applied_method text,
  add column if not exists email_used text,
  add column if not exists resume_used text;
alter table public.jobs
  add column if not exists applied_at timestamptz;
