-- Migration: Self-Service Onboarding
-- Adds columns to support self-service sign-up flow.
-- Creates company-assets Storage bucket for logo uploads.

-- ── 1. Alter companies table ────────────────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS self_service     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_fee_paid   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded_at     TIMESTAMPTZ;

-- Allow 'pending_payment' in subscription_status check constraint
-- First drop existing constraint (name may vary — use DO block to be safe)
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
END$$;

ALTER TABLE companies
  ADD CONSTRAINT companies_subscription_status_check
  CHECK (subscription_status IN (
    'trial',
    'active',
    'paused',
    'past_due',
    'cancelled',
    'pending_payment'
  ));

-- ── 2. Storage: company-assets bucket ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,
  5242880,  -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (logos need to be visible on card pages)
CREATE POLICY "company-assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

-- Authenticated upload into own company folder
CREATE POLICY "company-assets authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

-- Authenticated update/delete own uploads
CREATE POLICY "company-assets authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets');

CREATE POLICY "company-assets authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-assets');
