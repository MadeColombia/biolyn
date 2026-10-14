-- Photo galleries become items in the links list, so they can sit
-- anywhere between links and be dragged like one.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Run it before deploying the code that uses it.

-- 'link' is a normal button, 'gallery' is a block of photos.
alter table public.links
  add column kind text not null default 'link'
    check (kind in ('link', 'gallery')),
  -- How a gallery is shown. Only used when kind = 'gallery'.
  add column layout text
    check (layout is null or layout in ('carousel', 'grid')),
  alter column url drop not null,
  add constraint links_url_required check (kind = 'gallery' or url is not null);

-- Each photo belongs to one gallery item. Deleting the gallery deletes
-- its photo rows (the app removes the files from Storage first).
alter table public.photos
  add column link_id uuid references public.links (id) on delete cascade;
create index photos_link_position_idx on public.photos (link_id, position);

-- Move photos added with the first version (one gallery per page, under
-- the links) into a gallery item at the end of each page's list.
with galleries as (
  insert into public.links (profile_id, title, kind, layout, position)
  select p.id, 'Photos', 'gallery', p.gallery_layout,
         coalesce((select max(position) + 1 from public.links l
                   where l.profile_id = p.id), 0)
  from public.profiles p
  where exists (select 1 from public.photos ph where ph.profile_id = p.id)
  returning id, profile_id
)
update public.photos ph
set link_id = g.id
from galleries g
where ph.profile_id = g.profile_id;

alter table public.photos alter column link_id set not null;

-- At most 12 photos per gallery and 60 per page, even when someone skips
-- the app.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.photos where link_id = new.link_id) >= 12 then
    raise exception 'photo limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from public.photos where profile_id = new.profile_id) >= 60 then
    raise exception 'photo limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- A photo's gallery must belong to the same page as the photo.
alter table public.links
  add constraint links_id_profile_unique unique (id, profile_id);
alter table public.photos
  add constraint photos_link_same_profile
  foreign key (link_id, profile_id) references public.links (id, profile_id);
