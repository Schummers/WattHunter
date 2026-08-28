-- Issue 03 (scoring-vuelta-refonte, 2026-08) — traceability columns for the new
-- in-race event scoring terms: KOM crossings and intermediate sprints, stored
-- separately (same pattern as assist_bonus, migration 20260703100000). Additive
-- terms inside the formula's parenthesis — under nemesis_modifier, NOT multiplied
-- by strategy_bonus nor by the underdog boost.
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS kom_event_bonus    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprint_event_bonus numeric NOT NULL DEFAULT 0;
