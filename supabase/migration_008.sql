-- Migration 008: manual contact status + company LinkedIn (person vs company URLs stay separate)
alter table public.contacts
  add column if not exists status text not null default 'NEW';
alter table public.companies
  add column if not exists company_linkedin text;
