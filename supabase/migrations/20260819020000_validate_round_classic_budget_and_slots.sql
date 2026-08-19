-- Fix two classic-mode holes in validate_round, aligning it with place_bid.
--
-- validate_round is the gate on the main bidding path (Market -> draft_bids ->
-- validate). place_bid guards the same two rules correctly; validate_round did not,
-- so the authoritative check was the weaker of the two.
--
-- 1. SQUAD CAP. The slot check derived max slots from the team level only
--    (level 8 -> 12), with no classic branch, while place_bid caps classic at 10
--    (CLASSIC_SQUAD_SIZE). A classic team could validate 12 riders. Latent so far
--    only because the front caps drafts at 10.
--
-- 2. BUDGET. The purchasing-power branch keyed off phase_confirmed_id:
--
--      IF phase_confirmed_id = current_phase THEN treasury
--      ELSE treasury + sponsor - active_salaries
--
--    That distinction is manager-mode logic: after payday, treasury has already
--    been debited of salaries, so subtracting them again would double-count.
--    Classic mode works differently — classic_phase_reset writes a flat budget and
--    forceResolveRound never debits treasury on purchase (deliberately, see its
--    step 7i), so treasury stays at the flat value all phase while contracts pile
--    up. Taking the first branch therefore handed a classic team its full budget
--    again on every round after the first.
--
--    This stayed invisible until now: phase_confirmed_id was NULL for every team of
--    the classic league (no phase transition had ever completed, see
--    20260819000100), and `NULL = <int>` is NULL rather than true, so the ELSE
--    branch ran and the budget was correct by accident. The first successful
--    classic_phase_reset flipped the league onto the broken branch.
--
--    Classic now gets its own branch: flat treasury minus what the roster already
--    commits. Manager-mode behaviour is untouched.

CREATE OR REPLACE FUNCTION public.validate_round(
  p_league_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_auction_round int;
  v_drafts_total bigint := 0;
  v_drafts_count int := 0;
  v_active_salaries bigint := 0;
  v_sponsor_income bigint := 0;
  v_available bigint;
  v_purchasing_power bigint;
  v_max_slots int;
  v_roster_count int;
  v_inserted int := 0;
  v_league_mode text;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Resolve team for this user in the league + LOCK row
  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.league_members lm ON lm.team_id = t.id
  WHERE lm.league_id = p_league_id
    AND lm.user_id = v_user_id
    AND t.user_id = v_user_id
  FOR UPDATE OF t;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  SELECT mode INTO v_league_mode FROM public.leagues WHERE id = p_league_id;

  -- 3. Find open auction for this league + LOCK row
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  -- Determine round (per-team submission version inside this auction)
  SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
  FROM public.auction_bids
  WHERE auction_id = v_auction.id AND team_id = v_team.id;

  -- 4. Sum draft bids for this team + league
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_drafts_total, v_drafts_count
  FROM public.draft_bids
  WHERE team_id = v_team.id AND league_id = p_league_id;

  -- 5. Sum active contract salaries
  SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
  INTO v_active_salaries, v_roster_count
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  -- 6. Get sponsor income
  SELECT COALESCE(s.monthly_budget, 0) INTO v_sponsor_income
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = v_team.id;

  IF NOT FOUND THEN
    v_sponsor_income := 0;
  END IF;

  -- 7. Budget check
  IF v_league_mode = 'classic' THEN
    -- Flat per-phase budget, never debited by purchases: the roster's locked
    -- salaries are the only draw on it.
    v_purchasing_power := v_team.treasury - v_active_salaries;
  ELSIF v_team.phase_confirmed_id = p_current_phase_id THEN
    -- Manager mode, post-payday: treasury is already net of salaries.
    v_purchasing_power := v_team.treasury;
  ELSE
    -- Manager mode, pre-payday: project the upcoming payday.
    v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
  END IF;

  v_available := v_purchasing_power - v_drafts_total;

  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'error',
      format(
        'Budget exceeded: your draft bids total %s € but your purchasing power is only %s €. Please reduce bids by %s €.',
        v_drafts_total,
        v_purchasing_power,
        -v_available
      )
    );
  END IF;

  -- 8. Slot check
  v_max_slots := CASE v_team.level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;

  -- Classic mode: fixed squad size regardless of level (mirrors place_bid).
  IF v_league_mode = 'classic' THEN
    v_max_slots := 10;
  END IF;

  IF v_roster_count + v_drafts_count > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your squad allows %s slots',
             v_roster_count, v_drafts_count, v_roster_count + v_drafts_count, v_max_slots)
    );
  END IF;

  -- 9. Cancel previous active bids for this team in this auction
  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE auction_id = v_auction.id
    AND team_id = v_team.id
    AND status = 'active';

  -- 10. Insert new auction_bids from draft_bids
  INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
  SELECT v_auction.id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
  FROM public.draft_bids db
  WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 10b. Auto-validate any other team in the league that can't place a useful bid.
  --      The helper inserts round_validations with auto_validated=true.
  PERFORM public.auto_validate_unactionable_teams(v_auction.id, p_league_id, p_current_phase_id);

  -- 11. Record validation marker (idempotent — re-validate just refreshes timestamp)
  INSERT INTO public.round_validations (auction_id, team_id, validated_at)
  VALUES (v_auction.id, v_team.id, now())
  ON CONFLICT (auction_id, team_id) DO UPDATE SET validated_at = now();

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;
