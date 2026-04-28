-- Migration: Billing subscription columns — Stage 22
--
-- 1. Add missing columns:  trial_ends_at, subscription_renewed_at, billing_email
-- 2. Migrate legacy status values to canonical Stage 22 values:
--    trialing  → trial
--    paused    → suspended
--    past_due  → payment_failed
-- 3. Replace subscription_status CHECK constraint with the Stage 22 set:
--    pending_payment | trial | active | payment_failed | cancelled | suspended

-- ── 1. New columns ────────────────────────────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email           TEXT;

-- ── 2. Status data migration ──────────────────────────────────────────────────

UPDATE companies SET subscription_status = 'trial'          WHERE subscription_status = 'trialing';
UPDATE companies SET subscription_status = 'suspended'      WHERE subscription_status = 'paused';
UPDATE companies SET subscription_status = 'payment_failed' WHERE subscription_status = 'past_due';

-- ── 3. Replace CHECK constraint ───────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'companies'
      AND constraint_name = 'companies_subscription_status_check'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_subscription_status_check;
  END IF;
END $$;

ALTER TABLE companies
  ADD CONSTRAINT companies_subscription_status_check
  CHECK (subscription_status IN (
    'pending_payment',
    'trial',
    'active',
    'payment_failed',
    'cancelled',
    'suspended'
  ));

-- ── NOTE: subscription_plan check constraint intentionally omitted ────────────
-- Live data includes V2 plan 'solo' which is valid per pricing.ts but outside
-- the legacy ('starter','growth','enterprise') set. Constraint would violate
-- that row. Validation enforced at the application layer instead.
