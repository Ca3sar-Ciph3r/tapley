-- 20260729_add_location.sql
--
-- The card's meta line reads "Company | Location", but no location field existed
-- anywhere in the schema.
--
-- Both columns are nullable and additive. No existing row changes, no data is
-- rewritten, nothing is dropped — safe to run against live client data.
--
-- Resolution order on the card is `staff_cards.location ?? companies.location`,
-- and the separator is omitted entirely when neither is set.

alter table companies   add column if not exists location text;
alter table staff_cards add column if not exists location text;

comment on column companies.location is
  'Office location shown on the card meta line, e.g. "Ballito, South Africa". Set once at onboarding.';

comment on column staff_cards.location is
  'Optional per-staff override of companies.location, for remote or regional staff.';
