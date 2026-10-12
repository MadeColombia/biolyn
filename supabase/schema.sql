-- Biolyn database schema.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text,
  bio text check (char_length(bio) <= 160),
  avatar_url text,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (url ~* '^https?://'),
  position int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index links_profile_position_idx on public.links (profile_id, position);

create table public.clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.links (id) on delete cascade,
  referrer text,
  created_at timestamptz not null default now()
);
create index clicks_link_idx on public.clicks (link_id, created_at);

-- Row Level Security: who can read and write what.
alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.clicks enable row level security;

-- Anyone can view profiles and visible links (public pages).
create policy "profiles are public" on public.profiles
  for select using (true);
create policy "visible links are public" on public.links
  for select using (
    is_visible or exists (
      select 1 from public.profiles p
      where p.id = links.profile_id and p.user_id = auth.uid()
    )
  );

-- Owners manage their own profile and links.
create policy "owner inserts profile" on public.profiles
  for insert with check (user_id = auth.uid());
create policy "owner updates profile" on public.profiles
  for update using (user_id = auth.uid());
create policy "owner manages links" on public.links
  for all using (
    exists (select 1 from public.profiles p
            where p.id = links.profile_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = links.profile_id and p.user_id = auth.uid())
  );

-- Owners can read clicks on their links.
create policy "owner reads clicks" on public.clicks
  for select using (
    exists (select 1 from public.links l
            join public.profiles p on p.id = l.profile_id
            where l.id = clicks.link_id and p.user_id = auth.uid())
  );

-- Visitors log clicks through this function only (no direct insert access).
create or replace function public.log_click(p_link_id uuid, p_referrer text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.clicks (link_id, referrer)
  select id, left(p_referrer, 500) from public.links
  where id = p_link_id and is_visible;
$$;
grant execute on function public.log_click(uuid, text) to anon, authenticated;
