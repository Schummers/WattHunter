-- =============================================================
-- Pre-Launch Audit Migration
-- Track 2A: Treasury non-negative constraint
-- Track 3A: Missing RLS policies
-- Track 6B: Performance indexes
-- =============================================================

-- =============================================================
-- TRACK 2A — Treasury CHECK constraint
-- Prevents treasury from going negative at the DB level.
-- Any transaction that would make treasury < 0 will be rejected.
-- =============================================================
ALTER TABLE public.teams
  ADD CONSTRAINT teams_treasury_non_negative CHECK (treasury >= 0);

-- =============================================================
-- TRACK 3A — Missing RLS policies
-- =============================================================

-- league_members: users can delete their own membership (leaveLeague)
CREATE POLICY "league_members_delete_own" ON public.league_members
  FOR DELETE USING (auth.uid() = user_id);

-- auction_bids: team owners can update their own bids (cancelBid)
CREATE POLICY "auction_bids_update_own" ON public.auction_bids
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.user_id = auth.uid()
    )
  );

-- teams: owners can delete their own team (leaveLeague cleanup)
CREATE POLICY "teams_delete_own" ON public.teams
  FOR DELETE USING (auth.uid() = user_id);

-- team_policies: team owners can delete their own policies (leaveLeague cleanup)
CREATE POLICY "team_policies_delete_own" ON public.team_policies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.user_id = auth.uid()
    )
  );

-- =============================================================
-- TRACK 6B — Performance indexes
-- =============================================================

-- treasury_log dedup index for scoring
CREATE INDEX IF NOT EXISTS idx_treasury_log_team_type_created
  ON public.treasury_log(team_id, type, created_at);

-- race_results lookup for scoring
CREATE INDEX IF NOT EXISTS idx_race_results_date_points
  ON public.race_results(race_date, pcs_points);

-- contracts: last_salary_paid column (used by monthly_finance.py)
-- Add if not already present from a previous migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contracts'
      AND column_name = 'last_salary_paid'
  ) THEN
    ALTER TABLE public.contracts ADD COLUMN last_salary_paid date;
  END IF;
END $$;
