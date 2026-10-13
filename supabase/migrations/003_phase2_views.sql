-- Phase 2: page views, so owners can see visits and where visitors come from.

create table public.views (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  referrer text, -- hostname only, e.g. "l.instagram.com"
  created_at timestamptz not null default now()
);
create index views_profile_created_idx on public.views (profile_id, created_at);

alter table public.views enable row level security;

create policy "owner reads views" on public.views
  for select using (
    exists (select 1 from public.profiles p
            where p.id = views.profile_id and p.user_id = auth.uid())
  );

-- Visitors log views through this function only (no direct insert access).
create or replace function public.log_view(p_profile_id uuid, p_referrer text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.views (profile_id, referrer)
  select id, left(p_referrer, 200) from public.profiles
  where id = p_profile_id;
$$;
grant execute on function public.log_view(uuid, text) to anon, authenticated;
