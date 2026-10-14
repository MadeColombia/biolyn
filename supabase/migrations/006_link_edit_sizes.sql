-- Button sizes and pictures for links.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- "small" is the classic one-line button, "big" is a card with a picture.
alter table public.links
  add column size text not null default 'small'
    check (size in ('small', 'big')),
  add column image_url text
    check (image_url is null or image_url ~* '^https://');

-- Public bucket for link pictures, max 2 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('link-images', 'link-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp']);

-- Each user may only write inside link-images/<user_id>/<file>.
create policy "owner uploads link image" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'link-images'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes link image" on storage.objects
  for delete to authenticated
  using (bucket_id = 'link-images'
         and (storage.foldername(name))[1] = auth.uid()::text);
