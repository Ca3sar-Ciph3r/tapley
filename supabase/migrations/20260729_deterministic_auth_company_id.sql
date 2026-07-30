-- 20260729_deterministic_auth_company_id.sql
--
-- Makes auth_company_id() deterministic.
--
-- The existing definition is:
--
--   select company_id from company_admins
--   where user_id = auth.uid()
--   limit 1
--
-- LIMIT without ORDER BY has no defined row order in Postgres. DATABASE.md
-- explicitly supports a user administering several companies, so the day that
-- happens this function starts returning an arbitrary company — and because it
-- backs the RLS policies on companies, staff_cards, nfc_cards, card_views and
-- contacts, RLS would silently scope that user to the wrong tenant.
--
-- No user has multiple company_admins rows today (verified against live data),
-- so this is a latent fault rather than an active one. Fixing it is a pure
-- replace of the function body — no schema change, no data change, no downtime.
--
-- Also adds `security definer` + a pinned search_path, matching the original
-- definition and preventing search_path hijacking.

create or replace function auth_company_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select company_id
  from company_admins
  where user_id = auth.uid()
    and company_id is not null
  order by created_at asc, id asc
  limit 1
$$;

-- Supporting index: this function runs inside every RLS policy evaluation, so
-- it is one of the hottest lookups in the database.
create index if not exists idx_company_admins_user_id
  on company_admins (user_id, created_at, id);
