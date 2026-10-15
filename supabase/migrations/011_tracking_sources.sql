-- Tracking links: owners name the places they share their page
-- (biolyn.link/ethan?s=tiktok), and every view and click remembers
-- which one the visitor came through. Also adds one function that
-- counts views and clicks per day for the analytics chart.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Run it before deploying the code that uses it.

-- 1. Named source links, managed by the page owner.
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- The tag in the address: ?s=<code>. Same rules as cleanSource() in
  -- src/lib/sources.ts.
  code text not null check (code ~ '^[a-z0-9-]{1,30}$'),
  label text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (profile_id, code)
);

alter table public.sources enable row level security;

create policy "owner manages sources" on public.sources
  for all using (
    exists (select 1 from public.profiles p
            where p.id = sources.profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = sources.profile_id and p.user_id = auth.uid())
  );

-- At most 20 source links per page, even when someone skips the app.
create or replace function public.limit_sources()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.sources where profile_id = new.profile_id) >= 20 then
    raise exception 'too many source links';
  end if;
  return new;
end;
$$;
create trigger sources_limit before insert on public.sources
  for each row execute function public.limit_sources();

-- 2. Every view and click remembers its source code (null when the
-- visitor had none). Any code is accepted, also ones the owner never
-- created, so UTM tags (?utm_source=newsletter) show up too.
alter table public.views add column source text
  check (source is null or source ~ '^[a-z0-9-]{1,30}$');
alter table public.clicks add column source text
  check (source is null or source ~ '^[a-z0-9-]{1,30}$');

-- Visitors log through these functions only (no direct insert access).
-- The old two-argument versions are replaced.
drop function if exists public.log_view(uuid, text);
create or replace function public.log_view(
  p_profile_id uuid, p_referrer text, p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.views (profile_id, referrer, source)
  select id, left(p_referrer, 200),
         case when p_source ~ '^[a-z0-9-]{1,30}$' then p_source end
  from public.profiles
  where id = p_profile_id;
$$;
grant execute on function public.log_view(uuid, text, text) to anon, authenticated;

drop function if exists public.log_click(uuid, text);
create or replace function public.log_click(
  p_link_id uuid, p_referrer text, p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.clicks (link_id, referrer, source)
  select id, left(p_referrer, 500),
         case when p_source ~ '^[a-z0-9-]{1,30}$' then p_source end
  from public.links
  where id = p_link_id and is_visible;
$$;
grant execute on function public.log_click(uuid, text, text) to anon, authenticated;

-- 3. Views and clicks counted per day (UTC), source, site and link,
-- returned as one JSON list so long histories aren't cut at 1000 rows.
-- "security invoker" keeps Row Level Security on: owners only ever
-- count their own rows.
create index if not exists views_profile_created_idx
  on public.views (profile_id, created_at);

create or replace function public.analytics_daily(
  p_profile_id uuid, p_since timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select (v.created_at at time zone 'utc')::date as d, 'v' as k,
           null::uuid as l, v.source as s, v.referrer as r, count(*) as n
    from public.views v
    where v.profile_id = p_profile_id and v.created_at >= p_since
    group by 1, 4, 5
    union all
    select (c.created_at at time zone 'utc')::date, 'c',
           c.link_id, c.source, c.referrer, count(*)
    from public.clicks c
    join public.links li on li.id = c.link_id
    where li.profile_id = p_profile_id and c.created_at >= p_since
    group by 1, 3, 4, 5
  ) t;
$$;
grant execute on function public.analytics_daily(uuid, timestamptz) to authenticated;
