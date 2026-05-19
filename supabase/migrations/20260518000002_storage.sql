-- Storage bucket for PDFs (CVs generated per application).
-- Run after the schema migration.

insert into storage.buckets (id, name, public)
values ('career-ops', 'career-ops', false)
on conflict (id) do nothing;

-- Allow authenticated users to read/write their own folder: career-ops/{user_id}/...
create policy "career-ops select own"
  on storage.objects for select
  using (bucket_id = 'career-ops' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "career-ops insert own"
  on storage.objects for insert
  with check (bucket_id = 'career-ops' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "career-ops update own"
  on storage.objects for update
  using (bucket_id = 'career-ops' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "career-ops delete own"
  on storage.objects for delete
  using (bucket_id = 'career-ops' and (storage.foldername(name))[1] = auth.uid()::text);
