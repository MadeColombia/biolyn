-- Bios can now have formatting (bold, italic, links...), stored as a small
-- set of tags like <b>...</b>. The app still keeps the visible text to 160
-- characters; this only gives the tags room. Fonts need no change: the
-- choice is stored in the existing theme column.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
alter table public.profiles
  drop constraint profiles_bio_check,
  add constraint profiles_bio_check check (char_length(bio) <= 1000);
