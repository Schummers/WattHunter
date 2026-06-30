-- Classic League Mode tuning: squad 8 -> 10 (+2 Wildcard = underdog role) and budget 1.5M -> 2M.
--
-- Wildcards reuse the existing `underdog` role purely for its scoring multiplier
-- (stage points x clamp(pcs_rank/100, 1, 4), no final-classification bonus). The scoring
-- engine already applies it on role == 'underdog' (scoring.py), so nothing changes there.
-- We only make the role + the 10-rider cap available in classic mode, decoupled from the
-- trailing-team `underdog_eligible` flag (classic teams keep underdog_eligible = false).
--
-- Scope: classic-only. Manager mode is unchanged (cap 8, or 10 when underdog_eligible;
-- underdog role still gated on eligibility).
--
-- Reversible: see _rollback/20260630130000_classic_squad10_budget2m.down.sql.

-- ---------------------------------------------------------------------------
-- 1. enforce_gt_squad_cap: cap 10 for classic leagues OR underdog-eligible teams.
-- ---------------------------------------------------------------------------
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
  SELECT CASE WHEN t.underdog_eligible OR l.mode = 'classic' THEN 10 ELSE 8 END
    INTO v_cap
  FROM public.teams t
  JOIN public.leagues l ON l.id = t.league_id
  WHERE t.id = NEW.team_id;
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

-- ---------------------------------------------------------------------------
-- 2. gt_add_to_squad: allow the underdog role in classic leagues too.
-- ---------------------------------------------------------------------------
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
  v_league_id        uuid;
  v_league_mode      text;
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

  SELECT user_id, underdog_eligible, league_id
    INTO v_team_user_id, v_team_eligible, v_league_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT mode INTO v_league_mode FROM public.leagues WHERE id = v_league_id;

  -- Underdog role: available to underdog-eligible teams OR any classic-mode team.
  IF p_role = 'underdog'
     AND NOT (COALESCE(v_team_eligible, false) OR v_league_mode = 'classic') THEN
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

-- ---------------------------------------------------------------------------
-- 3. gt_assign_role: allow the underdog role in classic leagues too.
-- ---------------------------------------------------------------------------
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
  v_league_id    uuid;
  v_league_mode  text;
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

  SELECT user_id, underdog_eligible, league_id
    INTO v_team_user_id, v_team_eligible, v_league_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT mode INTO v_league_mode FROM public.leagues WHERE id = v_league_id;

  -- Underdog role: available to underdog-eligible teams OR any classic-mode team.
  IF p_role = 'underdog'
     AND NOT (COALESCE(v_team_eligible, false) OR v_league_mode = 'classic') THEN
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

-- ---------------------------------------------------------------------------
-- 4. place_bid: classic squad cap 8 -> 10. (Verbatim copy of 20260625000200 + that diff.)
-- ---------------------------------------------------------------------------
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
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Bounds check
  IF p_amount < 5000 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 1000 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 1000');
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

  SELECT mode INTO v_league_mode FROM leagues WHERE id = v_auction.league_id;

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

  -- 8. Co-unlock check: rider unlocked only if >= required teams have the level.
  --    required = GREATEST(2, CEIL(0.30 * team_count)) — mirrors
  --    apps/web/lib/co-unlock.ts requiredTeamsToUnlock(). See GAME_RULES §12.2.
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

    -- Classic mode: fixed squad size of 10 regardless of level.
    IF v_league_mode = 'classic' THEN
      v_max_slots := 10;
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

-- ---------------------------------------------------------------------------
-- 5. classic_phase_reset: flat budget 1.5M -> 2M.
-- ---------------------------------------------------------------------------
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
  v_budget constant int := 2000000;
  v_already int;
BEGIN
  SELECT phase_confirmed_id INTO v_already FROM teams WHERE id = p_team_id;
  IF v_already IS NULL THEN
    RAISE EXCEPTION 'Team % not found', p_team_id;
  END IF;
  IF v_already IS NOT DISTINCT FROM p_phase_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'phaseId', p_phase_id);
  END IF;

  -- Archive the previous phase's roster so the new auction starts empty.
  UPDATE contracts
     SET status = 'released',
         released_at = now(),
         available_from = now()
   WHERE team_id = p_team_id
     AND status IN ('active', 'notice');

  -- Flat budget reset + mark phase confirmed.
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

-- ---------------------------------------------------------------------------
-- 6. One-time treasury top-up for current classic teams (first-phase budget is
--    seeded at team creation, not by classic_phase_reset). Idempotent: only
--    bumps teams still at the old 1.5M flat budget.
-- ---------------------------------------------------------------------------
UPDATE public.teams t
   SET treasury = 2000000
  FROM public.leagues l
 WHERE l.id = t.league_id
   AND l.mode = 'classic'
   AND t.treasury = 1500000;
