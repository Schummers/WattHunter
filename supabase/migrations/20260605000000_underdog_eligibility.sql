-- Spec B (B0) — underdog eligibility foundation.
-- A team is eligible when its cumulative_xp < 75% of the league leader's.
-- teams.underdog_eligible = runtime flag (read by triggers + payday).
-- underdog_eligibility = per-phase audit snapshot.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS underdog_eligible boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.underdog_eligibility (
  team_id     uuid    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phase_id    int     NOT NULL,
  year        int     NOT NULL,
  is_eligible boolean NOT NULL,
  leader_xp   bigint  NOT NULL,
  team_xp     bigint  NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, phase_id, year)
);

ALTER TABLE public.underdog_eligibility ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated (own league via team); writes only via the SECURITY DEFINER RPC.
CREATE POLICY underdog_eligibility_select ON public.underdog_eligibility
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = underdog_eligibility.team_id AND t.user_id = auth.uid()
    )
  );

-- Recompute eligibility for every league at a phase boundary.
CREATE OR REPLACE FUNCTION public.recompute_underdog_eligibility(p_phase_id int, p_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lg record;
  v_leader bigint;
  v_leagues int := 0;
BEGIN
  FOR v_lg IN
    SELECT DISTINCT league_id FROM public.teams WHERE league_id IS NOT NULL
  LOOP
    SELECT COALESCE(MAX(cumulative_xp), 0) INTO v_leader
    FROM public.teams WHERE league_id = v_lg.league_id;

    UPDATE public.teams t
      SET underdog_eligible = (v_leader > 0 AND t.cumulative_xp < 0.75 * v_leader)
      WHERE t.league_id = v_lg.league_id;

    INSERT INTO public.underdog_eligibility
      (team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at)
    SELECT t.id, p_phase_id, p_year,
           (v_leader > 0 AND t.cumulative_xp < 0.75 * v_leader),
           v_leader, t.cumulative_xp, now()
    FROM public.teams t
    WHERE t.league_id = v_lg.league_id
    ON CONFLICT (team_id, phase_id, year) DO UPDATE
      SET is_eligible = EXCLUDED.is_eligible,
          leader_xp   = EXCLUDED.leader_xp,
          team_xp     = EXCLUDED.team_xp,
          computed_at = EXCLUDED.computed_at;

    v_leagues := v_leagues + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'leagues', v_leagues);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_underdog_eligibility(int, int) TO service_role;
