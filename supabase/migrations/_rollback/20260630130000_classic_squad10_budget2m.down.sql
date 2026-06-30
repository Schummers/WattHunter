-- Rollback for 20260630130000_classic_squad10_budget2m.sql
-- Restores: squad cap 8 (classic), underdog role gated on underdog_eligible only,
-- place_bid classic cap 8, classic budget 1.5M.
-- NOTE: the one-time treasury top-up (teams -> 2M) is NOT auto-reverted (live game data).
--       To undo it manually: UPDATE teams SET treasury = 1500000 WHERE ... (only if intended).

-- 1. enforce_gt_squad_cap (original — underdog_eligible ? 10 : 8)
CREATE OR REPLACE FUNCTION public.enforce_gt_squad_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_size INT;
  v_cap INT;
BEGIN
  SELECT CASE WHEN underdog_eligible THEN 10 ELSE 8 END
    INTO v_cap FROM public.teams WHERE id = NEW.team_id;
  v_cap := COALESCE(v_cap, 8);

  IF NEW.race_slug IS NOT NULL THEN
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND race_slug = NEW.race_slug AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND phase_id = NEW.phase_id AND year = NEW.year
      AND removed_at IS NULL;
  END IF;

  IF current_size >= v_cap THEN
    RAISE EXCEPTION 'Squad already at max (% riders)', v_cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. gt_add_to_squad (original — underdog gated on eligibility only)
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_team_eligible    boolean;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_role_count       int;
  v_cap              int;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  IF v_use_slug THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  END IF;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'Rider is already in the squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
    WHEN 'underdog'      THEN 2
  END;

  IF v_use_slug THEN
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND role = p_role AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL;
  END IF;

  IF v_role_count >= v_cap THEN
    RETURN jsonb_build_object('error', format('Role %s is at capacity (%s)', p_role, v_cap));
  END IF;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. gt_assign_role (original — underdog gated on eligibility only)
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_team_eligible boolean;
  v_squad_id     uuid;
  v_cap          int;
  v_demote       record;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  IF v_use_slug THEN
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL;
  END IF;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
    WHEN 'underdog'      THEN 2
  END;

  IF v_use_slug THEN
    IF (
      SELECT COUNT(*) FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ) >= v_cap THEN
      SELECT id, rider_id INTO v_demote
      FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

      INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
      VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique', p_race_slug);
    END IF;
  ELSE
    IF (
      SELECT COUNT(*) FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ) >= v_cap THEN
      SELECT id, rider_id INTO v_demote
      FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

      INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
      VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique');
    END IF;
  END IF;

  UPDATE public.gt_squad SET role = p_role WHERE id = v_squad_id;

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. place_bid (original — classic cap 8)
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
  v_team_count int;
  v_required_teams int;
  v_max_slots int;
  v_used_slots int;
  v_cooldown_until timestamptz;
  v_phase_round1_closes timestamptz;
  v_league_mode text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_amount < 5000 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 1000 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 1000');
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

  SELECT mode INTO v_league_mode FROM leagues WHERE id = v_auction.league_id;

  SELECT * INTO v_team FROM public.teams
   WHERE user_id = v_user_id AND league_id = v_auction.league_id
   FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'No team in this league');
  END IF;

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

  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not found');
  END IF;
  IF NOT v_rider.ever_in_pool THEN
    RETURN jsonb_build_object('error', 'Rider not in playable pool');
  END IF;

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

  SELECT count(*) INTO v_team_count
  FROM public.teams
  WHERE league_id = v_auction.league_id;

  v_required_teams := GREATEST(2, CEIL(0.30 * v_team_count))::int;

  SELECT count(*) INTO v_qualifying_teams
  FROM public.teams
  WHERE league_id = v_auction.league_id AND level >= v_required_level;

  IF v_qualifying_teams < v_required_teams THEN
    RETURN jsonb_build_object(
      'error',
      format('Locked — needs %s more team(s) at Lv.%s',
             v_required_teams - v_qualifying_teams, v_required_level)
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

    IF v_league_mode = 'classic' THEN
      v_max_slots := 8;
    END IF;

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

-- 5. classic_phase_reset (original — 1.5M)
CREATE OR REPLACE FUNCTION public.classic_phase_reset(
  p_team_id uuid,
  p_phase_id int,
  p_phase_label text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget constant int := 1500000;
  v_already int;
BEGIN
  SELECT phase_confirmed_id INTO v_already FROM teams WHERE id = p_team_id;
  IF v_already IS NULL THEN
    RAISE EXCEPTION 'Team % not found', p_team_id;
  END IF;
  IF v_already IS NOT DISTINCT FROM p_phase_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'phaseId', p_phase_id);
  END IF;

  UPDATE contracts
     SET status = 'released',
         released_at = now(),
         available_from = now()
   WHERE team_id = p_team_id
     AND status IN ('active', 'notice');

  UPDATE teams
     SET treasury = v_budget,
         phase_confirmed_id = p_phase_id,
         phase_confirmed_at = now()
   WHERE id = p_team_id;

  INSERT INTO treasury_log (team_id, type, amount, description)
  VALUES (p_team_id, 'budget_reset', v_budget,
          'Classic budget reset — ' || p_phase_label);

  RETURN jsonb_build_object('ok', true, 'skipped', false,
                            'phaseId', p_phase_id, 'budget', v_budget);
END;
$$;

GRANT EXECUTE ON FUNCTION public.classic_phase_reset(uuid, int, text)
  TO authenticated, service_role;
