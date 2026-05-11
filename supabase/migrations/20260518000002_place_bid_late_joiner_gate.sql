-- Add late-joiner gate to place_bid.
--
-- Rule: a team that joined after Round 1 of the current phase closed
-- cannot bid in that phase. They must wait for the next phase.
--
-- Detection: find MIN(closes_at) among non-scheduled auctions in this league
-- whose opens_at is within 14 days before the current auction opens_at.
-- This window covers the 3 rounds of one phase (consecutive days) while
-- excluding auctions from previous phases (separated by weeks).

CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_rider_id uuid,
  p_amount int,
  p_round int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_rider record;
  v_total_commitments bigint;
  v_existing_bid_id uuid;
  v_existing_bid_amount int;
  v_bid_id uuid;
  v_required_level int;
  v_qualifying_teams int;
  v_max_slots int;
  v_used_slots int;
  v_cooldown_until timestamptz;
  v_phase_round1_closes timestamptz;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Bounds check
  IF p_amount < 5000 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 100 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 100');
  END IF;
  IF p_round < 1 OR p_round > 8 THEN
    RETURN jsonb_build_object('error', 'Invalid round number');
  END IF;

  -- 3. Lookup auction + verify open
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;
  IF v_auction.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'Auction is not open');
  END IF;

  -- 4. Lookup team for this user in the auction's league + LOCK row
  SELECT * INTO v_team FROM public.teams
   WHERE user_id = v_user_id AND league_id = v_auction.league_id
   FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'No team in this league');
  END IF;

  -- 4b. Late-joiner gate: team must have joined before Round 1 of the current
  --     phase closed. Round 1 = earliest non-scheduled auction in this league
  --     within 14 days before this auction opened (same phase window).
  SELECT MIN(a.closes_at) INTO v_phase_round1_closes
  FROM public.auctions a
  WHERE a.league_id = v_auction.league_id
    AND a.status <> 'scheduled'
    AND a.opens_at >= v_auction.opens_at - interval '14 days';

  IF v_phase_round1_closes IS NOT NULL
     AND v_team.created_at > v_phase_round1_closes THEN
    RETURN jsonb_build_object(
      'error',
      'Phase already started — join before Round 1 closes to participate'
    );
  END IF;

  -- 5. Lookup rider + pool check
  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not found');
  END IF;
  IF NOT v_rider.ever_in_pool THEN
    RETURN jsonb_build_object('error', 'Rider not in playable pool');
  END IF;

  -- 5b. Cooldown check: rider recently released in this league?
  SELECT MAX(c.available_from) INTO v_cooldown_until
  FROM public.contracts c
  WHERE c.rider_id = p_rider_id
    AND c.league_id = v_auction.league_id
    AND c.status = 'released'
    AND c.available_from > now();

  IF v_cooldown_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error',
      format('Rider in cooldown until %s', to_char(v_cooldown_until, 'YYYY-MM-DD'))
    );
  END IF;

  -- 6. Level gating: rider pcs_rank must be >= poolMin for team level
  IF v_rider.pcs_rank IS NOT NULL AND v_rider.pcs_rank < (
    CASE v_team.level
      WHEN 8 THEN 1
      WHEN 7 THEN 4
      WHEN 6 THEN 10
      WHEN 5 THEN 20
      WHEN 4 THEN 30
      WHEN 3 THEN 100
      WHEN 2 THEN 200
      ELSE 300
    END
  ) THEN
    RETURN jsonb_build_object('error', 'Insufficient level for this rider');
  END IF;

  -- 7. Min salary check: bid must be >= rider monthly_salary
  IF p_amount < v_rider.monthly_salary THEN
    RETURN jsonb_build_object('error', format('Minimum bid: %s', v_rider.monthly_salary));
  END IF;

  -- 8. Co-unlock check: rider unlocked only if >= 2 teams have the required level
  v_required_level := CASE
    WHEN v_rider.pcs_rank IS NULL THEN 1
    WHEN v_rider.pcs_rank <= 1   THEN 8
    WHEN v_rider.pcs_rank <= 4   THEN 7
    WHEN v_rider.pcs_rank <= 10  THEN 6
    WHEN v_rider.pcs_rank <= 20  THEN 5
    WHEN v_rider.pcs_rank <= 30  THEN 4
    WHEN v_rider.pcs_rank <= 100 THEN 3
    WHEN v_rider.pcs_rank <= 200 THEN 2
    ELSE 1
  END;

  SELECT count(*) INTO v_qualifying_teams
  FROM public.teams
  WHERE league_id = v_auction.league_id AND level >= v_required_level;

  IF v_qualifying_teams < 2 THEN
    RETURN jsonb_build_object(
      'error',
      format('Locked — needs %s more team(s) at Lv.%s', 2 - v_qualifying_teams, v_required_level)
    );
  END IF;

  -- 9. Cross-round solvency: sum salaries + ALL active bids (not just this auction)
  SELECT COALESCE(SUM(locked_salary), 0) INTO v_total_commitments
   FROM public.contracts
   WHERE team_id = v_team.id AND status IN ('active', 'notice');

  v_total_commitments := v_total_commitments + (
    SELECT COALESCE(SUM(amount), 0) FROM public.auction_bids
     WHERE team_id = v_team.id AND status = 'active'
  );

  -- Check existing bid for this rider/round (update vs insert)
  SELECT id, amount INTO v_existing_bid_id, v_existing_bid_amount
  FROM public.auction_bids
   WHERE auction_id = p_auction_id AND team_id = v_team.id
     AND rider_id = p_rider_id AND round = p_round AND status = 'active';

  IF v_existing_bid_id IS NOT NULL THEN
    v_total_commitments := v_total_commitments - v_existing_bid_amount;
  END IF;

  IF v_total_commitments + p_amount > v_team.treasury THEN
    RETURN jsonb_build_object('error', 'Insufficient budget');
  END IF;

  -- 10. Slot check (only on new bids)
  IF v_existing_bid_id IS NULL THEN
    v_max_slots := CASE v_team.level
      WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
      WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
      WHEN 2 THEN 7 ELSE 6
    END;

    SELECT
      (SELECT count(*) FROM public.contracts
        WHERE team_id = v_team.id AND status = 'active')
      + (SELECT count(*) FROM public.auction_bids
        WHERE team_id = v_team.id AND status = 'active')
    INTO v_used_slots;

    IF v_used_slots >= v_max_slots THEN
      RETURN jsonb_build_object(
        'error',
        format('No available slots (%s/%s used)', v_used_slots, v_max_slots)
      );
    END IF;
  END IF;

  -- 11. Insert or update
  IF v_existing_bid_id IS NOT NULL THEN
    UPDATE public.auction_bids
       SET amount = p_amount, placed_at = now()
     WHERE id = v_existing_bid_id;
    v_bid_id := v_existing_bid_id;
  ELSE
    INSERT INTO public.auction_bids (auction_id, rider_id, team_id, amount, round, status, placed_at)
    VALUES (p_auction_id, p_rider_id, v_team.id, p_amount, p_round, 'active', now())
    RETURNING id INTO v_bid_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_bid(uuid, uuid, int, int) TO authenticated;
