-- ============================================================================
-- RLS LOCKDOWN — run in Supabase SQL Editor ONLY AFTER the server-side /api
-- routes are verified working (i.e. SUPABASE_SECRET_KEY is set and reads/writes
-- succeed through the app).
--
-- Effect: removes the "allow everyone everything" policies. RLS stays enabled,
-- so with no policies the public/publishable (anon) key can do NOTHING.
-- The server uses the SECRET key, which bypasses RLS entirely — so the app
-- keeps working, but a stranger who extracts the browser key can't touch the DB.
-- ============================================================================

drop policy if exists "Allow all on facilities" on facilities;
drop policy if exists "Allow all on posts" on posts;
drop policy if exists "Allow all on own_account_profile" on own_account_profile;

-- Keep RLS enabled (this is the default after the schema; re-assert to be safe).
alter table facilities enable row level security;
alter table posts enable row level security;
alter table own_account_profile enable row level security;

-- Sanity check: this should list ZERO policies after running the above.
-- select tablename, policyname from pg_policies
--   where tablename in ('facilities','posts','own_account_profile');
