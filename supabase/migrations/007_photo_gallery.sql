-- Photo gallery: pictures shown on the public page as a carousel or a grid.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Run it after 006_link_edit_sizes.sql and before deploying the gallery code.

-- How the gallery is shown: 'carousel' (swipe one by one) or 'grid'.
alter table public.profiles
  add column gallery_layout text not null default 'carousel'
    check (gallery_layout in ('carousel', 'grid'));

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Public URL of the file in the photos bucket.
  url text not null check (url ~* '^https://'),
  -- Short description for screen readers.
  alt text not null default '' check (char_length(alt) <= 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index photos_profile_position_idx on public.photos (profile_id, position);

alter table public.photos enable row level security;

-- Anyone can see photos (they're on public pages); owners manage their own.
create policy "photos are public" on public.photos
  for select using (true);
create policy "owner manages photos" on public.photos
  for all using (
    exists (select 1 from public.profiles p
            where p.id = photos.profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = photos.profile_id and p.user_id = auth.uid())
  );

-- At most 12 photos per page, even when someone skips the app.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.photos where profile_id = new.profile_id) >= 12 then
    raise exception 'photo limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger photos_limit before insert on public.photos
  for each row execute function public.enforce_photo_limit();

-- Public bucket for gallery pictures, max 5 MB each, images only.
-- The app shrinks photos in the browser first, so most are well under 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

-- Each user may only write inside photos/<user_id>/.
create policy "owner uploads photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
