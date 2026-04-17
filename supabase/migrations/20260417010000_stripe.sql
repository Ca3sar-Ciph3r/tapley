-- 20260417010000_stripe.sql
--
-- Adds Stripe billing columns to the companies table.
-- Stripe is used for recurring subscription billing in ZAR.
--
-- stripe_customer_id    — Stripe customer ID (cus_...)
-- stripe_subscription_id — Stripe subscription ID (sub_...)
-- stripe_price_id        — Stripe price ID (price_...) used for this company's subscription
--
-- These are set by the createStripeCustomer and activateSubscription server actions.
-- The webhook at /api/webhooks/stripe syncs invoice events back into billing_records.
--
-- SA-specific billing approach:
--   - Collection method: "send_invoice" (not automatic charge)
--   - Stripe sends a PDF invoice; client pays via EFT
--   - Currency: ZAR
--   - Stripe supports ZAR natively

alter table companies
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_price_id        text;

comment on column companies.stripe_customer_id is
  'Stripe customer ID (cus_...). Created by createStripeCustomer server action.';
comment on column companies.stripe_subscription_id is
  'Stripe subscription ID (sub_...). Created by activateSubscription server action.';
comment on column companies.stripe_price_id is
  'Stripe price ID (price_...) used for this company. Matches the per-card recurring price in the Stripe dashboard.';
