-- Rollback: 20260508000000_round_lifecycle
-- Restores validate_round and place_bid to their pre-patch versions
-- (before FOR UPDATE on auctions and scalar subquery in step 12)

-- ============================================================
-- RPC validate_round (original — no FOR UPDATE on auctions, no step 11/12)
-- ============================================================
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
  v_draft record;
  v_drafts_total bigint := 0;
  v_drafts_count int := 0;
  v_active_salaries bigint := 0;
  v_sponsor_income bigint := 0;
  v_available bigint;
  v_max_slots int;
  v_roster_count int;
  v_inserted int := 0;
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

  -- 3. Find open auction for this league
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  -- Determine round: max round this team has used + 1, or 1 if first time
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

  -- 7. Budget check (pre-payday vs post-payday)
  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    -- Post-payday: treasury already includes sponsor - salaries
    v_available := v_team.treasury - v_drafts_total;
  ELSE
    -- Pre-payday: project sponsor income and salary deductions
    v_available := v_team.treasury + v_sponsor_income - v_active_salaries - v_drafts_total;
  END IF;

  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'error',
      format('Budget exceeded: you cannot afford %s € of drafts with your current purchasing power.', v_drafts_total)
    );
  END IF;

  -- 8. Slot check
  v_max_slots := CASE v_team.level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;

  IF v_roster_count + v_drafts_count > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your level allows %s slots',
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

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;

-- ============================================================
-- RPC place_bid (original — with closes_at deadline check)
-- ============================================================
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
  IF v_auction.closes_at < now() THEN
    RETURN jsonb_build_object('error', 'Auction window closed');
  END IF;

  -- 4. Lookup team for this user in the auction's league + LOCK row
  SELECT * INTO v_team FROM public.teams
   WHERE user_id = v_user_id AND league_id = v_auction.league_id
   FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'No team in this league');
  END IF;

  -- 5. Lookup rider + pool check
  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not found');
  END IF;
  IF NOT v_rider.ever_in_pool THEN
    RETURN jsonb_build_object('error', 'Rider not in playable pool');
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
