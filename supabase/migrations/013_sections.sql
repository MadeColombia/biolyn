-- Sections: a title with links inside it, shown as a list or as a row
-- of cards people swipe (a carousel). Also makes room for the next
-- blocks (text, divider, countdown, contact, location), so they won't
-- need another update.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Run it before deploying the code that uses it. Existing pages don't
-- change: every current row stays at the top level.

alter table public.links
  drop constraint links_kind_check,
  add constraint links_kind_check check (kind in (
    'link', 'gallery', 'section', 'text', 'divider',
    'countdown', 'contact', 'location'
  )),
  -- Galleries use carousel or grid; sections use list, carousel or grid.
  drop constraint links_layout_check,
  add constraint links_layout_check
    check (layout is null or layout in ('list', 'carousel', 'grid')),
  drop constraint links_url_required,
  add constraint links_url_required check (kind <> 'link' or url is not null),
  -- A section or divider may have no title; links still need one.
  alter column title drop not null,
  add constraint links_title_required check (kind <> 'link' or title is not null),
  -- The section a row sits in. Empty means the top level of the page.
  add column parent_id uuid,
  -- Small options for each kind of block, like a countdown's date.
  add column settings jsonb not null default '{}'::jsonb,
  add constraint links_settings_object check (
    jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 4096
  ),
  -- The section must be on the same page. Deleting a section never
  -- deletes its links: they fall back to the top level.
  add constraint links_parent_same_profile
    foreign key (parent_id, profile_id)
    references public.links (id, profile_id)
    on delete set null (parent_id);

create index links_parent_position_idx
  on public.links (profile_id, parent_id, position);

-- One level only: a row's parent must be a section at the top level,
-- only links go inside sections, and a section holds at most 24 links.
-- Holds even when someone skips the app.
create or replace function public.enforce_section_nesting()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.kind <> 'link' then
    raise exception 'only links go in sections' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.links s
    where s.id = new.parent_id and s.kind = 'section' and s.parent_id is null
  ) then
    raise exception 'parent must be a section' using errcode = 'P0001';
  end if;
  if (select count(*) from public.links
      where parent_id = new.parent_id and id <> new.id) >= 24 then
    raise exception 'section is full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger links_nesting
  before insert or update of parent_id, kind on public.links
  for each row execute function public.enforce_section_nesting();
