-- Migration: PayFast payment columns
-- Adds four columns to support PayFast ITN activation and future subscription billing.
--
-- Existing columns (already added in 20260425000000_self_service_onboarding.sql):
--   setup_fee_paid       BOOLEAN  NOT NULL DEFAULT false  ← already exists, do not re-add
--   subscription_status  TEXT     (in original schema)    ← already exists
--
-- New columns added here:
--   setup_fee_paid_at         TIMESTAMPTZ  — timestamp when PayFast COMPLETE ITN received
--   setup_fee_payfast_token   TEXT         — PayFast pf_payment_id for the setup fee
--   payfast_subscription_token TEXT        — reserved for future PayFast recurring billing token
--   subscription_start         TIMESTAMPTZ — date the active subscription period begins

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS setup_fee_paid_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_fee_payfast_token    TEXT,
  ADD COLUMN IF NOT EXISTS payfast_subscription_token TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start         TIMESTAMPTZ;
