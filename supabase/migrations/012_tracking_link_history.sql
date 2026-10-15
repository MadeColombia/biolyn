-- Tracking links: deleting one keeps its history, and only links the
-- owner created are counted.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Run it before deploying the code that uses it.

-- 1. A deleted tracking link is hidden, not erased, so Analytics can still
-- show "TikTok bio (deleted)" for the visits it brought.
alter table public.sources add column deleted_at timestamptz;

-- The limit of 20 counts only links that are still active.
create or replace function public.limit_sources()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.sources
      where profile_id = new.profile_id and deleted_at is null) >= 20 then
    raise exception 'too many source links';
  end if;
  return new;
end;
$$;

-- 2. Only count a visit's source when it is one of the page's active
-- tracking links. A hand-edited address (?s=anything), a UTM tag or a
-- deleted link is stored without a source, so it falls back to the site
-- the visitor came from, or "Direct or unknown".
create or replace function public.log_view(
  p_profile_id uuid, p_referrer text, p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.views (profile_id, referrer, source)
  select p.id, left(p_referrer, 200), s.code
  from public.profiles p
  left join public.sources s
    on s.profile_id = p.id and s.code = p_source and s.deleted_at is null
  where p.id = p_profile_id;
$$;

create or replace function public.log_click(
  p_link_id uuid, p_referrer text, p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.clicks (link_id, referrer, source)
  select l.id, left(p_referrer, 500), s.code
  from public.links l
  left join public.sources s
    on s.profile_id = l.profile_id and s.code = p_source and s.deleted_at is null
  where l.id = p_link_id and l.is_visible;
$$;
