-- 20260415040000_billing_cycle.sql
--
-- Adds billing_cycle to companies.
-- 'monthly' = standard monthly billing
-- 'annual'  = pay 10 months upfront, get 2 months free (annualDiscountedTotalZar = monthly * 10)

alter table companies
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));

comment on column companies.billing_cycle is
  'Billing frequency. annual = 10 months charged (2 months free). Default: monthly.';
