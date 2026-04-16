-- 20260416000000_billing_records.sql
--
-- Billing records table for manual invoice/credit tracking.
-- No PayFast integration yet (post-MVP) — super admin manages records manually.
--
-- types:
--   monthly_fee    — recurring monthly subscription charge
--   setup_fee      — once-off setup / card printing fee
--   referral_credit — 1 free month credited to the referrer
--   manual_credit  — ad-hoc credit from super admin
--   payment        — payment received from company (negative amount = money in)
--
-- amount_zar: positive = charge to company, negative = credit/payment
-- status: pending → paid / waived
--
-- free_months_balance on companies:
--   Incremented by super admin when a referral is credited.
--   Company admin can see it on their settings page.

alter table companies
  add column if not exists free_months_balance integer not null default 0;

comment on column companies.free_months_balance is
  'Number of free subscription months earned via referrals. Applied to future invoices.';

create table if not exists billing_records (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  type         text not null
    check (type in ('monthly_fee','setup_fee','referral_credit','manual_credit','payment')),
  amount_zar   numeric(10,2) not null,
  description  text,
  billing_date date not null default current_date,
  status       text not null default 'pending'
    check (status in ('pending','paid','waived')),
  created_at   timestamptz not null default now()
);

alter table billing_records enable row level security;

-- Super admin can do everything
create policy "super_admin_all" on billing_records
  for all using (is_super_admin());

-- Company admin can read their own records
create policy "admin_select_own" on billing_records
  for select using (company_id = auth_company_id());

create index if not exists idx_billing_records_company on billing_records(company_id);
create index if not exists idx_billing_records_date on billing_records(billing_date desc);

comment on table billing_records is
  'Manual billing ledger. Super admin adds charges and credits. Company admins can read their own.';
