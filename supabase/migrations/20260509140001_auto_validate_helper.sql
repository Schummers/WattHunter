-- Helper: mark teams that can't place any bid as auto-validated for an auction.
-- A team is non-actionable when:
--   * Its purchasing power is below min_salary (5000 EUR), OR
--   * Its slots are full (active contracts + active auction_bids >= max_slots).
-- Insert is idempotent: re-running on the same auction is a no-op.

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
  v_sponsor_income bigint;
  v_max_slots int;
  v_used_slots int;
  v_inserted int := 0;
BEGIN
  FOR v_team IN
    SELECT t.id, t.level, t.treasury, t.phase_confirmed_id, lm.league_id
    FROM public.teams t
    JOIN public.league_members lm ON lm.team_id = t.id
    WHERE lm.league_id = p_league_id
  LOOP
    -- Active salaries
    SELECT COALESCE(SUM(locked_salary), 0)
    INTO v_active_salaries
    FROM public.contracts
    WHERE team_id = v_team.id AND status = 'active';

    -- Draft bids total (this league)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_drafts_total
    FROM public.draft_bids
    WHERE team_id = v_team.id AND league_id = p_league_id;

    -- Sponsor income (defaults to 0 if no team_sponsors row)
    v_sponsor_income := 0;
    SELECT COALESCE(s.monthly_budget, 0)
    INTO v_sponsor_income
    FROM public.team_sponsors ts
    JOIN public.sponsors s ON s.id = ts.sponsor_id
    WHERE ts.team_id = v_team.id;

    -- PP follows validate_round formula.
    -- Post-payday: treasury already includes sponsor and salaries.
    -- Pre-payday: project sponsor − salaries.
    IF v_team.phase_confirmed_id IS NOT NULL
       AND v_team.phase_confirmed_id = p_current_phase_id THEN
      v_pp := v_team.treasury - v_drafts_total;
    ELSE
      v_pp := v_team.treasury + v_sponsor_income - v_active_salaries - v_drafts_total;
    END IF;

    -- Max slots by level
    v_max_slots := CASE v_team.level
      WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
      WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
      WHEN 2 THEN 7 ELSE 6
    END;

    -- Used slots (active contracts + active bids in this auction)
    SELECT
      (SELECT COUNT(*) FROM public.contracts
        WHERE team_id = v_team.id AND status = 'active')
      +
      (SELECT COUNT(*) FROM public.auction_bids
        WHERE team_id = v_team.id AND auction_id = p_auction_id AND status = 'active')
    INTO v_used_slots;

    -- Auto-validate if non-actionable
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
