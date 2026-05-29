-- Chantier B (demo mode) — extend anon SELECT policies to authenticated role too.
--
-- Why: an authenticated user (e.g. someone with an active session) browsing
-- /league/demo would otherwise hit the `TO anon` policies, which don't apply
-- to the `authenticated` role. The existing per-league authenticated policies
-- gate on `is_league_member` — and the visitor is not a member of the demo
-- league. Result: "Demo unavailable" for any signed-in user.
--
-- Fix: drop + recreate every demo policy with `TO anon, authenticated`.
-- Demo league data is meant to be visible to everyone, signed-in or not.

-- Tier A — direct league_id
DROP POLICY IF EXISTS leagues_anon_demo ON public.leagues;
CREATE POLICY leagues_anon_demo ON public.leagues
  FOR SELECT TO anon, authenticated
  USING (id = public.demo_league_id());

DROP POLICY IF EXISTS league_members_anon_demo ON public.league_members;
CREATE POLICY league_members_anon_demo ON public.league_members
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS teams_anon_demo ON public.teams;
CREATE POLICY teams_anon_demo ON public.teams
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS auctions_anon_demo ON public.auctions;
CREATE POLICY auctions_anon_demo ON public.auctions
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS contracts_anon_demo ON public.contracts;
CREATE POLICY contracts_anon_demo ON public.contracts
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS draft_bids_anon_demo ON public.draft_bids;
CREATE POLICY draft_bids_anon_demo ON public.draft_bids
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS gt_emergency_bids_anon_demo ON public.gt_emergency_bids;
CREATE POLICY gt_emergency_bids_anon_demo ON public.gt_emergency_bids
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS remontada_boost_triggers_anon_demo ON public.remontada_boost_triggers;
CREATE POLICY remontada_boost_triggers_anon_demo ON public.remontada_boost_triggers
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

DROP POLICY IF EXISTS remontada_boosts_anon_demo ON public.remontada_boosts;
CREATE POLICY remontada_boosts_anon_demo ON public.remontada_boosts
  FOR SELECT TO anon, authenticated
  USING (league_id = public.demo_league_id());

-- Tier B — team_id only
DROP POLICY IF EXISTS auction_bids_anon_demo ON public.auction_bids;
CREATE POLICY auction_bids_anon_demo ON public.auction_bids
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = auction_bids.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS gt_squad_anon_demo ON public.gt_squad;
CREATE POLICY gt_squad_anon_demo ON public.gt_squad
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_squad.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS gt_role_assignments_anon_demo ON public.gt_role_assignments;
CREATE POLICY gt_role_assignments_anon_demo ON public.gt_role_assignments
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_role_assignments.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS gt_tactic_activations_anon_demo ON public.gt_tactic_activations;
CREATE POLICY gt_tactic_activations_anon_demo ON public.gt_tactic_activations
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_tactic_activations.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS rider_xp_daily_anon_demo ON public.rider_xp_daily;
CREATE POLICY rider_xp_daily_anon_demo ON public.rider_xp_daily
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = rider_xp_daily.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS sponsor_bonuses_anon_demo ON public.sponsor_bonuses;
CREATE POLICY sponsor_bonuses_anon_demo ON public.sponsor_bonuses
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_bonuses.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS sponsor_goal_completions_anon_demo ON public.sponsor_goal_completions;
CREATE POLICY sponsor_goal_completions_anon_demo ON public.sponsor_goal_completions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_goal_completions.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS team_ranking_daily_anon_demo ON public.team_ranking_daily;
CREATE POLICY team_ranking_daily_anon_demo ON public.team_ranking_daily
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_ranking_daily.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS team_sponsors_anon_demo ON public.team_sponsors;
CREATE POLICY team_sponsors_anon_demo ON public.team_sponsors
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_sponsors.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS team_strategies_anon_demo ON public.team_strategies;
CREATE POLICY team_strategies_anon_demo ON public.team_strategies
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_strategies.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS team_xp_adjustments_anon_demo ON public.team_xp_adjustments;
CREATE POLICY team_xp_adjustments_anon_demo ON public.team_xp_adjustments
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_xp_adjustments.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS treasury_log_anon_demo ON public.treasury_log;
CREATE POLICY treasury_log_anon_demo ON public.treasury_log
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = treasury_log.team_id AND t.league_id = public.demo_league_id()
  ));

DROP POLICY IF EXISTS round_validations_anon_demo ON public.round_validations;
CREATE POLICY round_validations_anon_demo ON public.round_validations
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = round_validations.team_id AND t.league_id = public.demo_league_id()
  ));

-- Tier C — users (only the 8 ghost demo accounts)
DROP POLICY IF EXISTS users_anon_demo ON public.users;
CREATE POLICY users_anon_demo ON public.users
  FOR SELECT TO anon, authenticated
  USING (
    id IN (
      SELECT user_id FROM public.league_members
      WHERE league_id = public.demo_league_id()
    )
  );

-- Tier D — public reference / catalog data
-- Already had FOR SELECT TO anon USING (true); authenticated already has
-- its own policies on these tables. Skipping — no change needed.
