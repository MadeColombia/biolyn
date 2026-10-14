-- The page's own share picture (og:image), used by big buttons that have
-- no uploaded picture. Filled in by the server when a link is saved.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
alter table public.links
  add column preview_url text
    check (preview_url is null or preview_url ~* '^https://');
