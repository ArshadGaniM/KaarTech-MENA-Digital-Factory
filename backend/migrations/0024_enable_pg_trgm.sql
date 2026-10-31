-- FEAT-24: fuzzy search across table cells uses pg_trgm's word_similarity, so a
-- near-miss spelling ("Nithyasri" for "Nithyashri S") still finds the row.
-- In `public`, not `extensions`: the backend's database role has no USAGE on the
-- `extensions` schema, so a function there fails with "permission denied for
-- schema extensions" (seen live on the first deploy).
create extension if not exists pg_trgm with schema public;
