-- Migration: Add drip email sent flags to companies
--
-- Tracks whether the Day 5 tap nudge and Day 14 analytics snapshot
-- emails have been sent. Set to true by the /api/cron/email-drip
-- route after a successful send, preventing duplicate sends.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS drip_day5_sent  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drip_day14_sent boolean NOT NULL DEFAULT false;
