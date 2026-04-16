-- 20260415060000_referrals.sql
--
-- Referral system infrastructure.
-- Each company gets a unique 8-character referral code at creation.
-- referred_by_company_id is set when a new company is created via a referral link (?ref=CODE).

alter table companies
  add column if not exists referral_code text unique,
  add column if not exists referred_by_company_id uuid references companies(id) on delete set null;

create table if not exists referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_company_id   uuid not null references companies(id) on delete cascade,
  referred_company_id   uuid not null references companies(id) on delete cascade,
  status                text not null default 'pending'
    check (status in ('pending','qualified','credited')),
  credited_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique(referrer_company_id, referred_company_id)
);

alter table referrals enable row level security;

create policy "super_admin_all" on referrals
  for all using (is_super_admin());

create policy "admin_select_own" on referrals
  for select using (
    referrer_company_id = auth_company_id()
    or referred_company_id = auth_company_id()
  );

create index if not exists idx_referrals_referrer on referrals(referrer_company_id);
create index if not exists idx_referrals_referred on referrals(referred_company_id);

comment on column companies.referral_code is
  'Unique 8-character alphanumeric referral code. Generated at company creation.';
comment on column companies.referred_by_company_id is
  'The company that referred this company (set from tapley_ref cookie at creation).';
comment on table referrals is
  'Referral tracking. Status: pending → qualified → credited.';
