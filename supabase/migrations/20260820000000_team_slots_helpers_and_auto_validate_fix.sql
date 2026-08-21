-- Single source of truth for "how many slots does this team have" / "is it full",
-- plus the fix for the auto-validation bug that costs a player their round.
--
-- THE BUG. auto_validate_unactionable_teams marks a team as validated when it judges
-- the team can no longer act. But auto-validation only inserts a round_validations
-- row: it never converts draft_bids into auction_bids. A classic team that had
-- drafted its entire 2M budget was therefore judged "out of purchasing power"
-- (pp = treasury - drafts = 0 < 5000) and silently validated with ZERO bids, losing
-- the round it had just carefully prepared. The more thoroughly a player drafted, the
-- more certain the lockout. It fires as soon as any other player validates, since
-- validate_round calls this helper over every team in the league.
--
-- The question the helper asked was "can this team bid more?" when the right question
-- is "can this team still act?". A team holding pending drafts can very much act: it
-- can validate them.
--
-- It also carried the two classic-mode holes fixed in validate_round yesterday
-- (20260819020000): the level-derived slot cap (12 at level 8 instead of 10), and the
-- purchasing power that ignored the roster payroll now that classic teams sit on the
-- post-reset branch.
--
-- The cap and the "is it full" test are extracted here so that validate_round,
-- this helper, and the upcoming early-finish check all share one definition instead
-- of each re-deriving it, which is how they drifted apart in the first place.

-- ---------------------------------------------------------------------------
-- 1. team_max_slots — squad ceiling for a team, mode-aware.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_max_slots(p_team_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level int;
  v_mode  text;
BEGIN
  SELECT t.level, l.mode
    INTO v_level, v_mode
  FROM teams t
  JOIN leagues l ON l.id = t.league_id
  WHERE t.id = p_team_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Classic: fixed squad size regardless of level (CLASSIC_SQUAD_SIZE, GAME_RULES §19).
  IF v_mode = 'classic' THEN
    RETURN 10;
  END IF;

  -- Manager: ceiling grows with level (GAME_RULES §11).
  RETURN CASE v_level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_max_slots(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. team_is_complete — the roster has no empty slot left.
--    Counts signed contracts only, deliberately: pending bids may still be lost.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_is_complete(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM contracts
     WHERE team_id = p_team_id AND status = 'active'
  ) >= public.team_max_slots(p_team_id);
$$;

GRANT EXECUTE ON FUNCTION public.team_is_complete(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. auto_validate_unactionable_teams — never swallow a team that still has
--    drafts to submit, and use the shared cap + the classic budget rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_validate_unactionable_teams(
  p_auction_id uuid,
  p_league_id uuid,
  p_current_phase_id int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team record;
  v_pp bigint;
  v_active_salaries bigint;
  v_drafts_total bigint;
  v_drafts_count int;
  v_sponsor_income bigint;
  v_max_slots int;
  v_used_slots int;
  v_league_mode text;
  v_inserted int := 0;
BEGIN
  SELECT mode INTO v_league_mode FROM public.leagues WHERE id = p_league_id;

  FOR v_team IN
    SELECT t.id, t.level, t.treasury, t.phase_confirmed_id, lm.league_id
    FROM public.teams t
    JOIN public.league_members lm ON lm.team_id = t.id
    WHERE lm.league_id = p_league_id
  LOOP
    -- Draft bids for this league (count AND total).
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_drafts_total, v_drafts_count
    FROM public.draft_bids
    WHERE team_id = v_team.id AND league_id = p_league_id;

    -- A team holding pending drafts is actionable: it can validate them.
    -- Auto-validating it here would record a validation without ever converting
    -- those drafts into bids, forfeiting its round. Skip it entirely.
    IF v_drafts_count > 0 THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(locked_salary), 0)
    INTO v_active_salaries
    FROM public.contracts
    WHERE team_id = v_team.id AND status = 'active';

    v_sponsor_income := 0;
    SELECT COALESCE(s.monthly_budget, 0)
    INTO v_sponsor_income
    FROM public.team_sponsors ts
    JOIN public.sponsors s ON s.id = ts.sponsor_id
    WHERE ts.team_id = v_team.id;

    -- Purchasing power, mirroring validate_round (20260819020000).
    IF v_league_mode = 'classic' THEN
      -- Flat per-phase budget, never debited by purchases.
      v_pp := v_team.treasury - v_active_salaries - v_drafts_total;
    ELSIF v_team.phase_confirmed_id IS NOT NULL
          AND v_team.phase_confirmed_id = p_current_phase_id THEN
      v_pp := v_team.treasury - v_drafts_total;
    ELSE
      v_pp := v_team.treasury + v_sponsor_income - v_active_salaries - v_drafts_total;
    END IF;

    v_max_slots := public.team_max_slots(v_team.id);

    -- Slots already taken: signed contracts + bids pending in this auction.
    SELECT
      (SELECT COUNT(*) FROM public.contracts
        WHERE team_id = v_team.id AND status = 'active')
      +
      (SELECT COUNT(*) FROM public.auction_bids
        WHERE team_id = v_team.id AND auction_id = p_auction_id AND status = 'active')
    INTO v_used_slots;

    -- Genuinely unable to act: cannot afford the cheapest rider, or no slot left.
    IF v_pp < 5000 OR v_used_slots >= v_max_slots THEN
      INSERT INTO public.round_validations (auction_id, team_id, validated_at, auto_validated)
      VALUES (p_auction_id, v_team.id, now(), true)
      ON CONFLICT (auction_id, team_id) DO NOTHING;

      IF FOUND THEN
        v_inserted := v_inserted + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_validate_unactionable_teams(uuid, uuid, int)
  TO authenticated, service_role;
