-- Rename "policies" feature to "strategies" across the schema.
-- Does NOT touch RLS policies (database security concept).

-- 1. Rename tables
ALTER TABLE public.policies RENAME TO strategies;
ALTER TABLE public.team_policies RENAME TO team_strategies;

-- 2. Rename columns
ALTER TABLE public.team_strategies RENAME COLUMN policy_id TO strategy_id;
ALTER TABLE public.rider_xp_daily RENAME COLUMN policy_bonus TO strategy_bonus;

-- 3. Rename unique constraint
ALTER INDEX IF EXISTS team_policies_team_policy_unique
  RENAME TO team_strategies_team_strategy_unique;
