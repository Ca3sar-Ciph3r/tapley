-- ============================================================
-- Tapley — Schema Reset (safe to re-run)
-- Run this if you get "policy already exists" errors
-- ============================================================

-- Drop existing policies if they exist
do $$ begin
  drop policy if exists "operator_all" on businesses;
  drop policy if exists "operator_all" on tiers;
  drop policy if exists "operator_all" on cards;
  drop policy if exists "operator_all" on customers;
  drop policy if exists "operator_all" on customer_cards;
  drop policy if exists "operator_all" on visits;
  drop policy if exists "operator_all" on redemptions;
  drop policy if exists "operator_all" on whatsapp_messages;
  drop policy if exists "operator_all" on fraud_alerts;
  drop policy if exists "operator_all" on audit_log;
  drop policy if exists "owner_reads_own_business" on businesses;
  drop policy if exists "owner_reads_own_tiers" on tiers;
  drop policy if exists "owner_reads_own_customers" on customers;
  drop policy if exists "owner_reads_own_visits" on visits;
  drop policy if exists "owner_reads_own_redemptions" on redemptions;
  drop policy if exists "owner_reads_own_fraud_alerts" on fraud_alerts;
exception when others then null;
end $$;

-- ─── Tables (create if not exists) ───────────────────────────

create table if not exists businesses (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  name                 text not null,
  type                 text,
  brand_color          text default '#1A1A1A',
  logo_url             text,
  hero_image_url       text,
  whatsapp_phone       text,
  owner_email          text,
  monthly_subscription numeric default 800,
  status               text default 'pipeline' check (status in ('pipeline','live','suspended')),
  booking_url          text,
  created_at           timestamptz default now()
);

create table if not exists tiers (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid references businesses(id) on delete cascade,
  name                 text not null,
  level                integer not null,
  visit_threshold      integer not null,
  reward_description   text,
  stamp_cooldown_hours integer default 12,
  daily_stamp_limit    integer default 1,
  created_at           timestamptz default now(),
  unique(business_id, level)
);

create table if not exists customers (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references businesses(id),
  first_name        text,
  whatsapp_number   text,
  whatsapp_opt_in   boolean default true,
  opt_in_at         timestamptz,
  created_at        timestamptz default now()
);

create table if not exists cards (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references businesses(id),
  card_uuid    uuid unique not null default gen_random_uuid(),
  customer_id  uuid references customers(id),
  status       text default 'unactivated' check (status in ('unactivated','active','blacklisted','replaced')),
  activated_at timestamptz,
  created_at   timestamptz default now()
);

create table if not exists customer_cards (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  card_id     uuid references cards(id),
  is_primary  boolean default true,
  linked_at   timestamptz default now()
);

create table if not exists visits (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references customers(id),
  business_id     uuid references businesses(id),
  card_id         uuid references cards(id),
  status          text default 'pending' check (status in ('pending','confirmed','cancelled','expired')),
  confirmed_at    timestamptz,
  expires_at      timestamptz default (now() + interval '5 minutes'),
  staff_device_id text,
  created_at      timestamptz default now()
);

create table if not exists redemptions (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid references customers(id),
  business_id        uuid references businesses(id),
  tier_id            uuid references tiers(id),
  reward_description text,
  redeemed_at        timestamptz default now(),
  confirmed_by       text
);

create table if not exists whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id),
  business_id   uuid references businesses(id),
  template_name text,
  payload       jsonb,
  status        text default 'queued',
  sent_at       timestamptz,
  created_at    timestamptz default now()
);

create table if not exists fraud_alerts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  card_id     uuid references cards(id),
  customer_id uuid references customers(id),
  alert_type  text,
  description text,
  status      text default 'open' check (status in ('open','investigating','dismissed','resolved')),
  created_at  timestamptz default now()
);

create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references businesses(id),
  actor        text,
  action       text,
  entity_type  text,
  entity_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  reason       text,
  created_at   timestamptz default now()
);

-- ─── RLS ─────────────────────────────────────────────────────

alter table businesses        enable row level security;
alter table tiers             enable row level security;
alter table cards             enable row level security;
alter table customers         enable row level security;
alter table customer_cards    enable row level security;
alter table visits            enable row level security;
alter table redemptions       enable row level security;
alter table whatsapp_messages enable row level security;
alter table fraud_alerts      enable row level security;
alter table audit_log         enable row level security;

create policy "operator_all" on businesses       for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on tiers            for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on cards            for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on customers        for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on customer_cards   for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on visits           for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on redemptions      for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on whatsapp_messages for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on fraud_alerts     for all using (auth.jwt()->>'role' = 'operator');
create policy "operator_all" on audit_log        for all using (auth.jwt()->>'role' = 'operator');

create policy "owner_reads_own_business" on businesses
  for select using (owner_email = auth.jwt()->>'email');

create policy "owner_reads_own_tiers" on tiers
  for select using (
    business_id in (select id from businesses where owner_email = auth.jwt()->>'email')
  );

create policy "owner_reads_own_customers" on customers
  for select using (
    business_id in (select id from businesses where owner_email = auth.jwt()->>'email')
  );

create policy "owner_reads_own_visits" on visits
  for select using (
    business_id in (select id from businesses where owner_email = auth.jwt()->>'email')
  );

create policy "owner_reads_own_redemptions" on redemptions
  for select using (
    business_id in (select id from businesses where owner_email = auth.jwt()->>'email')
  );

create policy "owner_reads_own_fraud_alerts" on fraud_alerts
  for select using (
    business_id in (select id from businesses where owner_email = auth.jwt()->>'email')
  );

-- ─── Seed Data ────────────────────────────────────────────────

insert into businesses (slug, name, type, brand_color, status, owner_email)
values ('spindlers', 'Spindler''s Barbers', 'barber', '#1A1A1A', 'live', 'brad@spindlers.co.za')
on conflict (slug) do nothing;

insert into tiers (business_id, name, level, visit_threshold, reward_description, stamp_cooldown_hours, daily_stamp_limit)
select id, 'Apprentice', 1, 3, '10% off your next cut', 12, 1
from businesses where slug = 'spindlers'
on conflict (business_id, level) do nothing;

insert into tiers (business_id, name, level, visit_threshold, reward_description, stamp_cooldown_hours, daily_stamp_limit)
select id, 'Journeyman', 2, 7, 'Free beard trim', 12, 1
from businesses where slug = 'spindlers'
on conflict (business_id, level) do nothing;

insert into tiers (business_id, name, level, visit_threshold, reward_description, stamp_cooldown_hours, daily_stamp_limit)
select id, 'Master', 3, 15, '20% off all services', 12, 1
from businesses where slug = 'spindlers'
on conflict (business_id, level) do nothing;

insert into tiers (business_id, name, level, visit_threshold, reward_description, stamp_cooldown_hours, daily_stamp_limit)
select id, 'Legend', 4, 30, 'Free quarterly cut', 12, 1
from businesses where slug = 'spindlers'
on conflict (business_id, level) do nothing;

do $$
declare
  business_id_val uuid;
  card_count int;
begin
  select id into business_id_val from businesses where slug = 'spindlers';
  select count(*) into card_count from cards where business_id = business_id_val;
  if card_count < 50 then
    for i in 1..(50 - card_count) loop
      insert into cards (business_id, status) values (business_id_val, 'unactivated');
    end loop;
  end if;
end $$;
