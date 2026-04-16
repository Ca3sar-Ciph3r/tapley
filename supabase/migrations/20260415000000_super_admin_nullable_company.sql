-- Migration: super_admin_nullable_company
--
-- Problem:
--   company_admins.company_id is NOT NULL with ON DELETE CASCADE.
--   The super admin (Luke / platform owner) was stored with a company_id pointing
--   to a client company. Deleting that company cascaded and deleted the super admin's
--   row, locking them out of /admin. A band-aid in deleteCompany() tried to reassign
--   the super admin to another company first, but failed when there was only one company.
--
-- Fix:
--   Make company_id nullable. The super admin's row gets company_id = NULL.
--   A nullable FK with ON DELETE CASCADE behaves correctly:
--     - Rows with company_id = <id>  → still cascade when that company is deleted
--     - Rows with company_id = NULL  → no FK relationship → survive all company deletions
--
--   The existing is_super_admin() helper function already checks only role = 'super_admin'
--   and does not require a company_id, so all RLS policies continue to work unchanged.
--
--   The dashboard layout already handles a null companies join gracefully:
--   it falls back to displaying 'Tapley Connect' as the company name.
--
-- Steps:
--   1. Drop the NOT NULL constraint on company_id
--   2. Add a partial unique index to prevent duplicate null-company rows per user
--      (the existing UNIQUE(user_id, company_id) constraint treats NULLs as distinct
--       in PostgreSQL, so without this index you could insert two null-company rows
--       for the same user)
--   3. Set all super_admin rows to company_id = NULL — they are no longer tied to
--      any specific client company

-- Step 1: Make company_id nullable
ALTER TABLE company_admins
  ALTER COLUMN company_id DROP NOT NULL;

-- Step 2: Prevent duplicate null-company rows per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_admins_user_null_company
  ON company_admins(user_id)
  WHERE company_id IS NULL;

-- Step 3: Detach existing super_admin rows from client companies
UPDATE company_admins
  SET company_id = NULL
  WHERE role = 'super_admin';
