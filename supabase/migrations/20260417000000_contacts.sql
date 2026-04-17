-- 20260417000000_contacts.sql
--
-- CRM contacts table.
-- Each contact is associated with a company and optionally with the staff card
-- that introduced them (i.e. whose digital card they tapped).
--
-- Source values:
--   card_tap  — contact came via a card tap (future: "Leave your details" form on public card page)
--   manual    — manually added by company admin via the CRM dashboard
--   import    — bulk-imported via CSV
--
-- The "Leave your details" form on /c/[slug] is post-MVP.
-- For MVP: contacts can only be added manually or via import.
-- The table is built now so the dashboard CRM is ready when the form ships.
--
-- RLS:
--   super_admin_all       — super admin reads and writes all rows
--   admin_select_own      — company admin reads only their own contacts
--   admin_insert_own      — company admin inserts only into their own company
--   admin_update_own      — company admin updates only their own company's contacts
--   admin_delete_own      — company admin deletes only their own company's contacts

create table if not exists contacts (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  staff_card_id    uuid references staff_cards(id) on delete set null,
  full_name        text,
  email            text,
  phone            text,
  whatsapp_number  text,
  company_name     text,
  job_title        text,
  notes            text,
  source           text not null default 'manual'
    check (source in ('card_tap','manual','import')),
  created_at       timestamptz not null default now()
);

alter table contacts enable row level security;

-- Super admin: full access across all companies
create policy "super_admin_all" on contacts
  for all using (is_super_admin());

-- Company admin: read their own
create policy "admin_select_own" on contacts
  for select using (company_id = auth_company_id());

-- Company admin: insert into their own
create policy "admin_insert_own" on contacts
  for insert with check (company_id = auth_company_id());

-- Company admin: update their own
create policy "admin_update_own" on contacts
  for update using (company_id = auth_company_id());

-- Company admin: delete their own
create policy "admin_delete_own" on contacts
  for delete using (company_id = auth_company_id());

-- Indexes
create index if not exists idx_contacts_company on contacts(company_id);
create index if not exists idx_contacts_staff_card on contacts(staff_card_id);
create index if not exists idx_contacts_created on contacts(company_id, created_at desc);

comment on table contacts is
  'CRM contacts per company. Linked to the staff card that introduced them. Source tracks how the contact was added.';
comment on column contacts.staff_card_id is
  'The staff card whose public page this contact was captured from. NULL if added manually or source is import.';
comment on column contacts.source is
  'card_tap: captured via public card page (post-MVP). manual: entered by admin. import: bulk CSV import.';
