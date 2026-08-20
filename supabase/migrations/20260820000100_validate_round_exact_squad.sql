-- Classic mode: a team must validate a round with a FULL squad, not merely a legal one.
--
-- Teams were ending a phase with 8 riders while others fielded 10, which is a flat
-- scoring handicap that no later round can undo. The ceiling was already enforced
-- (20260819020000); this adds the floor, making the rule "exactly 10" rather than
-- "at most 10": active contracts + pending drafts must fill every slot.
--
-- Why this cannot soft-lock a team, even though a blocked validation would freeze the
-- whole league (rounds close on unanimous validation):
--
--   Each round demands exactly 10 bids for at most the flat budget, and every bid is
--   at least the 5000 salary floor. Losing L duels therefore frees at least 5000 * L,
--   so a team always retains at least 5000 of budget per empty slot — exactly what it
--   takes to refill each one at the floor. The "9 riders and nothing left to spend"
--   dead end is unreachable, not merely unlikely.
--
-- Manager mode is untouched: its squad size varies with level (6 to 12), so a fixed
-- floor of 10 would be unsatisfiable for a low-level team.

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
  v_total_slots int;
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

  -- 8. Slot check. Shared ceiling (team_max_slots), so this function, the
  --    auto-validation helper and the early-finish check cannot drift apart.
  v_max_slots := public.team_max_slots(v_team.id);
  v_total_slots := v_roster_count + v_drafts_count;

  IF v_total_slots > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your squad allows %s slots',
             v_roster_count, v_drafts_count, v_total_slots, v_max_slots)
    );
  END IF;

  -- 8b. Classic only: the squad must be FULL, not just legal.
  IF v_league_mode = 'classic' AND v_total_slots < v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Fill your squad: %s/%s riders. Add %s more bid(s) to validate.',
             v_total_slots, v_max_slots, v_max_slots - v_total_slots)
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
