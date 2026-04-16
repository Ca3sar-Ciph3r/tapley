-- 20260415020000_dpa_acceptance.sql
--
-- Adds Data Processing Agreement acceptance tracking to companies.
-- DPA acceptance is implicit at company creation for MVP — the createCompany
-- server action sets these fields automatically.
-- The DPA link is shown in the super admin create form as a notice.

alter table companies
  add column if not exists dpa_accepted_at timestamptz,
  add column if not exists dpa_version text;

comment on column companies.dpa_accepted_at is
  'Timestamp when the Data Processing Agreement was accepted. Set automatically at company creation.';
comment on column companies.dpa_version is
  'Version of the DPA accepted (e.g. ''1.0''). Matches the version on /legal/dpa.';
