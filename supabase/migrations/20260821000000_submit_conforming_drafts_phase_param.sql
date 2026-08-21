-- Fix: submit_conforming_drafts's manager-mode purchasing-power branch compared a
-- team's phase_confirmed_id to a subquery re-selecting that same team's same column
-- (`v_team.phase_confirmed_id = (SELECT phase_confirmed_id FROM teams WHERE id =
-- v_team.id)`), a tautology that is true whenever the value is non-null, regardless
-- of which phase it names.
--
-- Its two siblings, validate_round and auto_validate_unactionable_teams, compare
-- against the real current phase via a p_current_phase_id parameter. This function
-- was never given that parameter, so it structurally could not make the comparison
-- it appeared to be making.
--
-- Practical effect: a manager-mode team that confirmed a past phase but hasn't yet
-- confirmed the current one was forced onto the post-payday formula (bare treasury)
-- instead of the correct pre-payday projection (treasury + sponsor - salaries),
-- dropping sponsor income and understating budget. That could make an affordable
-- conforming draft look unaffordable and get skipped, forfeiting the exact round this
-- function exists to save. Classic mode was unaffected: it takes the first IF branch,
-- which never depended on this comparison.
--
-- Add the missing parameter and compare against it, exactly mirroring validate_round.

CREATE OR REPLACE FUNCTION public.submit_conforming_drafts(
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
    ELSIF v_team.phase_confirmed_id = p_current_phase_id THEN
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

-- Signature changed (new required parameter): drop the old one before recreating,
-- Postgres does not let CREATE OR REPLACE change a function's parameter list.
DROP FUNCTION IF EXISTS public.submit_conforming_drafts(uuid, uuid);

GRANT EXECUTE ON FUNCTION public.submit_conforming_drafts(uuid, uuid, int)
  TO authenticated, service_role;
