-- Chantier B (demo mode) — anon SELECT policies.
-- The `anon` role can read the demo league only:
--   Tier A: tables with league_id  → USING (league_id = demo_league_id())
--   Tier B: tables with team_id    → USING (EXISTS demo team)
--   Tier C: public.users           → USING (id IN demo members)
--   Tier D: public reference data  → USING (true)
-- Policies are additive: authenticated users keep their existing access.

------------------------------------------------------------------------------
-- Tier A — direct league_id
------------------------------------------------------------------------------

CREATE POLICY leagues_anon_demo
  ON public.leagues FOR SELECT TO anon
  USING (id = public.demo_league_id());

CREATE POLICY league_members_anon_demo
  ON public.league_members FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY teams_anon_demo
  ON public.teams FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY auctions_anon_demo
  ON public.auctions FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY contracts_anon_demo
  ON public.contracts FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY draft_bids_anon_demo
  ON public.draft_bids FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY gt_emergency_bids_anon_demo
  ON public.gt_emergency_bids FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY remontada_boost_triggers_anon_demo
  ON public.remontada_boost_triggers FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY remontada_boosts_anon_demo
  ON public.remontada_boosts FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

------------------------------------------------------------------------------
-- Tier B — team_id only (EXISTS subquery scoped to demo teams)
------------------------------------------------------------------------------

CREATE POLICY auction_bids_anon_demo
  ON public.auction_bids FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = auction_bids.team_id
      AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_squad_anon_demo
  ON public.gt_squad FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_squad.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_role_assignments_anon_demo
  ON public.gt_role_assignments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_role_assignments.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_tactic_activations_anon_demo
  ON public.gt_tactic_activations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_tactic_activations.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY rider_xp_daily_anon_demo
  ON public.rider_xp_daily FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = rider_xp_daily.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY sponsor_bonuses_anon_demo
  ON public.sponsor_bonuses FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_bonuses.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY sponsor_goal_completions_anon_demo
  ON public.sponsor_goal_completions FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_goal_completions.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_ranking_daily_anon_demo
  ON public.team_ranking_daily FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_ranking_daily.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_sponsors_anon_demo
  ON public.team_sponsors FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_sponsors.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_strategies_anon_demo
  ON public.team_strategies FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_strategies.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_xp_adjustments_anon_demo
  ON public.team_xp_adjustments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_xp_adjustments.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY treasury_log_anon_demo
  ON public.treasury_log FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = treasury_log.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY round_validations_anon_demo
  ON public.round_validations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = round_validations.team_id AND t.league_id = public.demo_league_id()
  ));

------------------------------------------------------------------------------
-- Tier C — users (only the 8 ghost demo accounts)
------------------------------------------------------------------------------

CREATE POLICY users_anon_demo
  ON public.users FOR SELECT TO anon
  USING (
    id IN (
      SELECT user_id FROM public.league_members
      WHERE league_id = public.demo_league_id()
    )
  );

------------------------------------------------------------------------------
-- Tier D — public reference / catalog data (anon SELECT true)
------------------------------------------------------------------------------

CREATE POLICY riders_anon_select
  ON public.riders FOR SELECT TO anon USING (true);

CREATE POLICY race_results_anon_select
  ON public.race_results FOR SELECT TO anon USING (true);

CREATE POLICY rider_season_rankings_anon_select
  ON public.rider_season_rankings FOR SELECT TO anon USING (true);

CREATE POLICY race_startlists_anon_select
  ON public.race_startlists FOR SELECT TO anon USING (true);

CREATE POLICY rider_teams_anon_select
  ON public.rider_teams FOR SELECT TO anon USING (true);

CREATE POLICY rider_pcs_history_anon_select
  ON public.rider_pcs_history FOR SELECT TO anon USING (true);

CREATE POLICY gt_daily_classifications_anon_select
  ON public.gt_daily_classifications FOR SELECT TO anon USING (true);

CREATE POLICY gt_rescue_windows_anon_select
  ON public.gt_rescue_windows FOR SELECT TO anon USING (true);

CREATE POLICY sponsors_anon_select
  ON public.sponsors FOR SELECT TO anon USING (true);

CREATE POLICY strategies_anon_select
  ON public.strategies FOR SELECT TO anon USING (true);
