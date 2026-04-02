-- Migration: Phase Economy — payday confirmation model
-- Contracts: remove notice status, add released_at + phase_recruited_id
-- Teams: add phase_confirmed_at + pending_sponsor_id, fix defaults
-- Treasury_log: add release_fee, transfer_bonus, payday_salary types
-- Team_policies: drop effective_phase_id (payday replaces phase transitions)

-- ---------------------------------------------------------------------------
-- 1. Contracts — remove notice status, simplify
-- ---------------------------------------------------------------------------

-- Convert any existing 'notice' contracts to 'released'
UPDATE public.contracts SET status = 'released' WHERE status = 'notice';

-- Replace status check constraint (remove 'notice')
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN ('active', 'released'));

-- Add released_at timestamp (replaces release_date)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Backfill released_at from release_date for existing released contracts
UPDATE public.contracts
  SET released_at = release_date::timestamptz
  WHERE status = 'released' AND release_date IS NOT NULL AND released_at IS NULL;

-- Add phase_recruited_id to enforce lock (can't release in same phase as recruitment)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS phase_recruited_id int;

-- Drop deprecated columns
ALTER TABLE public.contracts DROP COLUMN IF EXISTS notice_date;
ALTER TABLE public.contracts DROP COLUMN IF EXISTS effective_phase_id;

-- Keep release_date for now (used by scoring date filter) — mark deprecated
COMMENT ON COLUMN public.contracts.release_date IS 'DEPRECATED — use released_at. Kept for scoring backward compat.';

-- ---------------------------------------------------------------------------
-- 2. Teams — add payday tracking + pending sponsor
-- ---------------------------------------------------------------------------

-- Track when player last confirmed phase setup
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS phase_confirmed_at timestamptz;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS phase_confirmed_id int;

COMMENT ON COLUMN public.teams.phase_confirmed_at IS 'Timestamp of last payday confirmation';
COMMENT ON COLUMN public.teams.phase_confirmed_id IS 'Phase ID of last confirmed payday';

-- Pending sponsor (effective at next payday)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS pending_sponsor_id uuid
  REFERENCES public.sponsors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.pending_sponsor_id IS 'Sponsor to activate at next payday. NULL = no change pending.';

-- Fix default treasury for new teams (0 instead of 500K — first sponsor payment replaces starting fund)
ALTER TABLE public.teams ALTER COLUMN treasury SET DEFAULT 0;

-- Fix level check constraint (1-8 instead of 1-10)
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_level_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_level_check CHECK (level BETWEEN 1 AND 8);

-- ---------------------------------------------------------------------------
-- 3. Treasury_log — add new types for phase economy
-- ---------------------------------------------------------------------------

ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log
  ADD CONSTRAINT treasury_log_type_check
  CHECK (type IN (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',      -- deprecated, kept for existing data
    'rider_revenue',       -- deprecated, kept for existing data
    'sponsor_payment',
    'bankruptcy_release',
    'monthly_bonus',       -- deprecated, kept for existing data
    'phase_salary',        -- deprecated, kept for existing data
    'phase_sponsor_base',  -- deprecated, kept for existing data
    'sponsor_bonus',
    'release_fee',         -- NEW: -5000 flat fee on release
    'transfer_bonus',      -- NEW: +bonus when releasing appreciated rider
    'payday_salary'        -- NEW: bulk salary deduction at phase confirmation
  ));

-- ---------------------------------------------------------------------------
-- 4. Team_policies — drop phase dependency
-- ---------------------------------------------------------------------------

ALTER TABLE public.team_policies DROP COLUMN IF EXISTS effective_phase_id;

COMMENT ON COLUMN public.team_policies.pending_is_active IS 'Pending state applied at next payday confirmation. NULL = no change pending.';
COMMENT ON COLUMN public.team_policies.pending_config IS 'Pending config applied at next payday confirmation. NULL = no change pending.';
