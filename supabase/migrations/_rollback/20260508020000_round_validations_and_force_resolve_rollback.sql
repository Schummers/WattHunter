-- Rollback: round_validations table + restore prior validate_round (with no-lifecycle behavior).
-- This rollback restores the validate_round body that was in production via the manual
-- rollback applied 2026-05-08 (file: _rollback/20260508000000_round_lifecycle_rollback.sql).
-- After running this rollback the schema looks like before this migration was applied.

DROP TABLE IF EXISTS public.round_validations CASCADE;

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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

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

  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
  FROM public.auction_bids
  WHERE auction_id = v_auction.id AND team_id = v_team.id;

  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_drafts_total, v_drafts_count
  FROM public.draft_bids
  WHERE team_id = v_team.id AND league_id = p_league_id;

  SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
  INTO v_active_salaries, v_roster_count
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  SELECT COALESCE(s.monthly_budget, 0) INTO v_sponsor_income
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = v_team.id;

  IF NOT FOUND THEN
    v_sponsor_income := 0;
  END IF;

  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    v_purchasing_power := v_team.treasury;
    v_available := v_team.treasury - v_drafts_total;
  ELSE
    v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
    v_available := v_purchasing_power - v_drafts_total;
  END IF;

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

  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE auction_id = v_auction.id
    AND team_id = v_team.id
    AND status = 'active';

  INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
  SELECT v_auction.id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
  FROM public.draft_bids db
  WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;
