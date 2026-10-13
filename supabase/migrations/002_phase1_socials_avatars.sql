-- Phase 1: social links on profiles and an avatars storage bucket.
-- Run once in Supabase after schema.sql.

-- Social handles, stored as {"instagram": "https://...", "email": "mailto:..."}.
alter table public.profiles
  add column socials jsonb not null default '{}'::jsonb;

-- Public bucket for profile pictures, max 2 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp']);

-- Each user may only write inside a folder named after their user id:
-- avatars/<user_id>/<file>. Reading is public because the bucket is public.
create policy "owner uploads avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = auth.uid()::text);
