-- Phase 3 (features): scheduled links and YouTube/Spotify players.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- A link shows only between starts_at and ends_at (either can be empty).
alter table public.links
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint links_schedule_order
    check (starts_at is null or ends_at is null or ends_at > starts_at);

-- true = show a YouTube or Spotify link as an inline player.
alter table public.links
  add column embed boolean not null default false;
