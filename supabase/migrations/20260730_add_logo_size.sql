-- 20260730_add_logo_size.sql
--
-- Lets each company scale its own logo on the card.
--
-- One fixed size cannot serve every mark. A wide wordmark and a square icon
-- occupy the same box very differently: at a size that suits the wordmark the
-- icon looks lost, and at a size that suits the icon the wordmark overruns.
-- Rather than guess per client, the choice is theirs.
--
-- Three steps rather than a free number: a slider invites fiddling and lets a
-- client set a size that breaks the layout. Small / Medium / Large all stay
-- inside proportions that have been checked against both hero states.
--
-- Additive, defaulted, no data rewritten. Existing companies keep the current
-- appearance because 'm' is exactly what shipped before this column existed.

alter table companies
  add column if not exists logo_size text not null default 'm';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_logo_size_check'
  ) then
    alter table companies
      add constraint companies_logo_size_check
      check (logo_size in ('s', 'm', 'l'));
  end if;
end $$;

comment on column companies.logo_size is
  'Scale of the company logo on the public card: s, m or l. Applies both when the logo replaces the initials and when it sits over a photo. Default m matches the pre-column appearance.';
