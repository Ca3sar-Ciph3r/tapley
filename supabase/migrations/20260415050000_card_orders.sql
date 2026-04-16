-- 20260415050000_card_orders.sql
--
-- NFC card fulfillment tracking.
-- A card_orders row is created automatically when a company is onboarded with nfcCardsOrdered > 0.
-- Super admins manage orders via /admin/fulfillment.

create table if not exists card_orders (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  quantity            integer not null check (quantity > 0),
  order_date          timestamptz not null default now(),
  supplier            text,
  cost_per_card       numeric(10,2),
  total_cost          numeric(10,2),
  status              text not null default 'pending'
    check (status in ('pending','ordered','printing','shipped','delivered','replacement')),
  tracking_number     text,
  estimated_delivery  date,
  actual_delivery     date,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table card_orders enable row level security;

create policy "super_admin_all" on card_orders
  for all using (is_super_admin());

create policy "admin_select_own" on card_orders
  for select using (company_id = auth_company_id());

create index if not exists idx_card_orders_company_id on card_orders(company_id);
create index if not exists idx_card_orders_status on card_orders(status);

comment on table card_orders is
  'NFC card fulfillment tracking. Auto-created from createCompany when nfcCardsOrdered > 0.';
