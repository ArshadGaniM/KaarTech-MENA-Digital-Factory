-- FEAT-24: fuzzy search across table cells uses pg_trgm's word_similarity, so a
-- near-miss spelling ("Nithyasri" for "Nithyashri S") still finds the row.
create extension if not exists pg_trgm with schema extensions;
