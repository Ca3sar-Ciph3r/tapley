-- 20260415030000_data_deletion_log.sql
--
-- Data deletion scheduling infrastructure (POPIA compliance).
-- Actual execution of deletion is out of scope — this is scheduling and logging only.
--
-- data_deletion_log: records when a deletion was scheduled, who triggered it, and when it was executed.
-- companies.deletion_scheduled_at: set to now() + 30 days when scheduleDataDeletion is called.

create table if not exists data_deletion_log (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  scheduled_at      timestamptz not null,
  executed_at       timestamptz,
  triggered_by      uuid references auth.users(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table data_deletion_log enable row level security;

create policy "super_admin_all" on data_deletion_log
  for all using (is_super_admin());

create index if not exists idx_data_deletion_log_company_id on data_deletion_log(company_id);

-- Add deletion_scheduled_at to companies
alter table companies
  add column if not exists deletion_scheduled_at timestamptz;

comment on column companies.deletion_scheduled_at is
  'When set, marks this company for data deletion on this date (30 days after cancellation).';
comment on table data_deletion_log is
  'POPIA compliance: audit log of all scheduled data deletions. Actual deletion runs separately.';
