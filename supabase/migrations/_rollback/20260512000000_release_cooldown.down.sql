-- Rollback: remove release cooldown feature

-- 1. Drop column
ALTER TABLE public.contracts DROP COLUMN IF EXISTS available_from;

-- 2. Restore release_rider without cooldown (from 20260510000000_gt_squad_builder_v2.sql)
CREATE OR REPLACE FUNCTION public.release_rider(
  p_contract_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_contract record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT c.*, t.user_id AS team_user_id, t.league_id
  INTO v_contract
  FROM public.contracts c
  JOIN public.teams t ON t.id = c.team_id
  WHERE c.id = p_contract_id;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('error', 'Contract not found');
  END IF;

  IF v_contract.team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF v_contract.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'Contract is not active');
  END IF;

  IF v_contract.phase_recruited_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Cannot release a rider recruited during the current phase');
  END IF;

  UPDATE public.contracts
  SET status = 'released', released_at = now()
  WHERE id = p_contract_id;

  DELETE FROM public.draft_bids
  WHERE team_id = v_contract.team_id
    AND rider_id = v_contract.rider_id;

  UPDATE public.gt_squad
  SET removed_at = now()
  WHERE rider_id = v_contract.rider_id
    AND team_id = v_contract.team_id
    AND removed_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_rider(uuid, int) TO authenticated;

-- 3. Restore place_bid without cooldown check (from 20260508000000_round_lifecycle.sql)
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
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_amount < 5000 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 100 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 100');
  END IF;
  IF p_round < 1 OR p_round > 8 THEN
    RETURN jsonb_build_object('error', 'Invalid round number');
  END IF;

  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;
  IF v_auction.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'Auction is not open');
  END IF;

  SELECT * INTO v_team FROM public.teams
   WHERE user_id = v_user_id AND league_id = v_auction.league_id
   FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'No team in this league');
  END IF;

  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not found');
  END IF;
  IF NOT v_rider.ever_in_pool THEN
    RETURN jsonb_build_object('error', 'Rider not in playable pool');
  END IF;

  IF v_rider.pcs_rank IS NOT NULL AND v_rider.pcs_rank < (
    CASE v_team.level
      WHEN 8 THEN 1 WHEN 7 THEN 4 WHEN 6 THEN 10
      WHEN 5 THEN 20 WHEN 4 THEN 30 WHEN 3 THEN 100
      WHEN 2 THEN 200 ELSE 300
    END
  ) THEN
    RETURN jsonb_build_object('error', 'Insufficient level for this rider');
  END IF;

  IF p_amount < v_rider.monthly_salary THEN
    RETURN jsonb_build_object('error', format('Minimum bid: %s', v_rider.monthly_salary));
  END IF;

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

  SELECT COALESCE(SUM(locked_salary), 0) INTO v_total_commitments
   FROM public.contracts
   WHERE team_id = v_team.id AND status IN ('active', 'notice');

  v_total_commitments := v_total_commitments + (
    SELECT COALESCE(SUM(amount), 0) FROM public.auction_bids
     WHERE team_id = v_team.id AND status = 'active'
  );

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
