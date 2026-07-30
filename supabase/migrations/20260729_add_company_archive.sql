-- 20260729_add_company_archive.sql
--
-- Lets a pilot or dead company be hidden from the admin list without deleting
-- anything.
--
-- The alternative on the table was deleteCompany, which hard-deletes nfc_cards
-- and cascades card_views and contacts. For the three companies being tidied
-- away that would have destroyed real consented lead data and the whole view
-- history — and it contradicts two CLAUDE.md rules (never delete nfc_cards,
-- never touch card_views). Archiving is reversible and destroys nothing.
--
-- Deliberately does NOT affect public card pages. Archiving is an admin-list
-- concern; a physical card already in someone's wallet must keep working.
--
-- Nullable, additive, no data rewritten.

alter table companies add column if not exists archived_at timestamptz;

comment on column companies.archived_at is
  'When set, the company is hidden from the super admin list and company switcher. Reversible. Does not affect public card pages, billing, or any child data.';

create index if not exists idx_companies_archived_at
  on companies (archived_at)
  where archived_at is null;
