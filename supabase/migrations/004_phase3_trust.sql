-- Phase 3 (trust): suspended profiles, visitor reports, rate limits.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Order: add SUPABASE_SERVICE_ROLE_KEY in Vercel, run this file, then deploy
-- the Phase 3 code. Until the new code is live, views and clicks are not
-- counted, because this file stops the public key from logging them.

-- Set to true (Table Editor > profiles) to hide a page that breaks the rules.
alter table public.profiles
  add column is_suspended boolean not null default false;

-- Reports from visitors. RLS is on with no policies, so only you can read
-- them in the Supabase dashboard; visitors write through submit_report().
create table public.reports (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'scam', 'impersonation', 'adult', 'other')),
  details text check (char_length(details) <= 500),
  contact_email text check (char_length(contact_email) <= 200),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);
alter table public.reports enable row level security;

-- Fixed-window counters, one row per key per window. Keys are hashed
-- (never raw IP addresses). No policies: only the functions below touch it.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Counts one hit for `p_key` and returns true while it is within the limit.
create or replace function public.rate_limit_hit(
  p_key text, p_limit int, p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  n int;
begin
  insert into public.rate_limits (key, window_start)
  values (left(p_key, 200), w)
  on conflict (key, window_start)
  do update set hits = rate_limits.hits + 1
  returning hits into n;

  -- Now and then, clear windows older than a day so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return n <= p_limit;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- The app's server reports a page here. At most 5 reports per hour per visitor.
create or replace function public.submit_report(
  p_username text, p_reason text, p_details text, p_contact text, p_visitor text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if not public.rate_limit_hit('report:' || p_visitor, 5, 3600) then
    return 'rate_limited';
  end if;
  select id into pid from public.profiles where username = lower(p_username);
  if pid is null then
    return 'not_found';
  end if;
  insert into public.reports (profile_id, reason, details, contact_email)
  values (pid, p_reason, left(nullif(p_details, ''), 500), left(nullif(p_contact, ''), 200));
  return 'ok';
end;
$$;
revoke execute on function public.submit_report(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_report(text, text, text, text, text) to service_role;

-- Views and clicks are now logged only by the app's server, which applies
-- the rate limits. Calling these with the public key stops working.
revoke execute on function public.log_view(uuid, text) from public, anon, authenticated;
revoke execute on function public.log_click(uuid, text) from public, anon, authenticated;
grant execute on function public.log_view(uuid, text) to service_role;
grant execute on function public.log_click(uuid, text) to service_role;

-- At most 100 links per page, even when someone skips the app and calls
-- the database directly.
create or replace function public.enforce_link_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.links where profile_id = new.profile_id) >= 100 then
    raise exception 'link limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger links_limit before insert on public.links
  for each row execute function public.enforce_link_limit();

-- No links to local machines or raw IP addresses.
alter table public.links add constraint links_url_public_host
  check (url !~* '^https?://(localhost([:/]|$)|\[|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+([:/]|$))');
