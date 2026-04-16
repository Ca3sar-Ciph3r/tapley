-- 20260415010000_pricing_v2.sql
--
-- Adds pricing v2 feature flag and QR Digital tier support to companies.
--
-- pricing_v2_enabled: when true, use PRICING_TIERS v2 (flat rate per tier, not per-card lookup).
--   When false, use legacy rate_per_card_zar / setup_fee_per_card_zar fields.
--   Never retroactively change existing contracts.
--
-- is_qr_digital: QR Digital tier — no physical NFC card, R49/card/month, no setup fee.
--   Max 15 cards. Locked to the 'QR Digital' tier.

alter table companies
  add column if not exists pricing_v2_enabled boolean not null default false,
  add column if not exists is_qr_digital boolean not null default false;

comment on column companies.pricing_v2_enabled is
  'When true, use PRICING_TIERS v2. When false, use legacy rates. Never retroactively change existing contracts.';
comment on column companies.is_qr_digital is
  'QR Digital tier: no physical NFC card. Max 15 cards. R49/card/month, no setup fee.';
