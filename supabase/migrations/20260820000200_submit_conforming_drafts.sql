-- Submit the pending drafts of teams that never validated, when those drafts already
-- satisfy the round's rules.
--
-- Rounds close on unanimous validation, and any league member may force a resolution.
-- A player who has laid out a conforming squad but has not pressed Validate at that
-- moment loses the entire round: resolution reads auction_bids, and drafts are not
-- bids. That is a harsh outcome for work already done correctly, and it is the same
-- shape of failure as the auto-validation bug fixed in 20260820000000.
--
-- So at resolution time we submit for them, but only when there is nothing to decide:
-- the drafts must fill the squad exactly and fit the budget, i.e. pass the very checks
-- validate_round would have applied. Anything short of that is a judgement call the
-- player has to make, and we leave it alone.
--
-- Teams that DID validate are never touched. Their drafts survive validation (step 10
-- inserts without deleting), so resubmitting would overwrite the bids they committed
-- with a draft set they may have edited afterwards.

CREATE OR REPLACE FUNCTION public.submit_conforming_drafts(
  p_auction_id uuid,
  p_league_id uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team record;
  v_league_mode text;
  v_drafts_total bigint;
  v_drafts_count int;
  v_active_salaries bigint;
  v_roster_count int;
  v_sponsor_income bigint;
  v_purchasing_power bigint;
  v_max_slots int;
  v_auction_round int;
  v_submitted int := 0;
BEGIN
  SELECT mode INTO v_league_mode FROM public.leagues WHERE id = p_league_id;

  FOR v_team IN
    SELECT t.id, t.treasury, t.phase_confirmed_id
    FROM public.teams t
    JOIN public.league_members lm ON lm.team_id = t.id
    WHERE lm.league_id = p_league_id
      -- Never touch a team that already validated.
      AND NOT EXISTS (
        SELECT 1 FROM public.round_validations rv
         WHERE rv.auction_id = p_auction_id AND rv.team_id = t.id
      )
  LOOP
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_drafts_total, v_drafts_count
    FROM public.draft_bids
    WHERE team_id = v_team.id AND league_id = p_league_id;

    IF v_drafts_count = 0 THEN
      CONTINUE;
    END IF;

    -- Belt and braces: if bids somehow already exist for this team in this auction,
    -- leave them be rather than layering a second set on top.
    IF EXISTS (
      SELECT 1 FROM public.auction_bids
       WHERE auction_id = p_auction_id AND team_id = v_team.id AND status = 'active'
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
    INTO v_active_salaries, v_roster_count
    FROM public.contracts
    WHERE team_id = v_team.id AND status = 'active';

    v_sponsor_income := 0;
    SELECT COALESCE(s.monthly_budget, 0)
    INTO v_sponsor_income
    FROM public.team_sponsors ts
    JOIN public.sponsors s ON s.id = ts.sponsor_id
    WHERE ts.team_id = v_team.id;

    -- Same purchasing-power rule as validate_round.
    IF v_league_mode = 'classic' THEN
      v_purchasing_power := v_team.treasury - v_active_salaries;
    ELSIF v_team.phase_confirmed_id IS NOT NULL
          AND v_team.phase_confirmed_id = (
            SELECT phase_confirmed_id FROM public.teams WHERE id = v_team.id
          ) THEN
      v_purchasing_power := v_team.treasury;
    ELSE
      v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
    END IF;

    IF v_purchasing_power - v_drafts_total < 0 THEN
      CONTINUE;  -- over budget: the player must fix it, not us
    END IF;

    v_max_slots := public.team_max_slots(v_team.id);

    -- Classic demands an exactly-full squad; other modes only a legal one.
    IF v_league_mode = 'classic' THEN
      IF v_roster_count + v_drafts_count <> v_max_slots THEN
        CONTINUE;
      END IF;
    ELSIF v_roster_count + v_drafts_count > v_max_slots THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
    FROM public.auction_bids
    WHERE auction_id = p_auction_id AND team_id = v_team.id;

    INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
    SELECT p_auction_id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
    FROM public.draft_bids db
    WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

    INSERT INTO public.round_validations (auction_id, team_id, validated_at, auto_validated)
    VALUES (p_auction_id, v_team.id, now(), true)
    ON CONFLICT (auction_id, team_id) DO NOTHING;

    v_submitted := v_submitted + 1;
  END LOOP;

  RETURN v_submitted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_conforming_drafts(uuid, uuid)
  TO authenticated, service_role;
