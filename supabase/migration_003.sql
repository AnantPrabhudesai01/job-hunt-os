-- Migration 003: private document vault (resumes + prep PDFs).
-- Files live at documents/<user-uuid>/<kind>/<filename>.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "vault_owner_read" on storage.objects;
create policy "vault_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "vault_owner_write" on storage.objects;
create policy "vault_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "vault_owner_update" on storage.objects;
create policy "vault_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "vault_owner_delete" on storage.objects;
create policy "vault_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents'
    and (storage.foldername(name))[1] = (auth.uid())::text);
