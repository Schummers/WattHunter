-- Phase-based changes: all changes made during phase N take effect at phase N+1
-- Adds pending state columns to contracts, team_policies, and team_sponsors

-- contracts: phase-based release instead of 30-day calendar
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS effective_phase_id int;

COMMENT ON COLUMN public.contracts.effective_phase_id IS 'Phase ID when the release takes effect (rider leaves roster)';

-- team_policies: pending state for phase-deferred changes
ALTER TABLE public.team_policies
  ADD COLUMN IF NOT EXISTS pending_is_active boolean,
  ADD COLUMN IF NOT EXISTS pending_config jsonb,
  ADD COLUMN IF NOT EXISTS effective_phase_id int;

COMMENT ON COLUMN public.team_policies.pending_is_active IS 'Future is_active state, applied at phase transition';
COMMENT ON COLUMN public.team_policies.pending_config IS 'Future config, applied at phase transition';
COMMENT ON COLUMN public.team_policies.effective_phase_id IS 'Phase ID when pending changes take effect';

-- team_sponsors: add effective_phase_id (pending_sponsor_id and status already exist)
ALTER TABLE public.team_sponsors
  ADD COLUMN IF NOT EXISTS effective_phase_id int;

COMMENT ON COLUMN public.team_sponsors.effective_phase_id IS 'Phase ID when the sponsor swap takes effect';
