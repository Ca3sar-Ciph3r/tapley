-- 20260428010000_card_orders_delivery_fields.sql
--
-- Adds delivery and contact fields to card_orders so company-admin-initiated
-- order requests can carry shipping information to the fulfillment panel.

alter table card_orders
  add column if not exists delivery_address text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text;

-- Allow company admins to insert their own order requests.
-- The requestAdditionalCards server action uses supabaseAdmin (service role)
-- so this policy is not required for the current implementation, but is added
-- for defence-in-depth and forward compatibility.
create policy "admin_insert_own" on card_orders
  for insert with check (company_id = auth_company_id());

comment on column card_orders.delivery_address is 'Street / postal address for NFC card delivery — populated by the admin order-request form.';
comment on column card_orders.contact_name     is 'Name of person to contact for delivery coordination.';
comment on column card_orders.contact_phone    is 'Phone number of delivery contact.';
