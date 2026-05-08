-- Audit table for manual XP adjustments (admin balancing, catch-up grants, etc.)
-- cumulative_xp on teams remains the source of truth; this table provides traceability.

CREATE TABLE public.team_xp_adjustments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  amount       numeric     NOT NULL,
  reason       text        NOT NULL,
  adjusted_at  date        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_xp_adjustments ENABLE ROW LEVEL SECURITY;

-- League members can read adjustments for teams in their league
CREATE POLICY "team_xp_adjustments_select" ON public.team_xp_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.league_members lm ON lm.league_id = t.league_id
      WHERE t.id = team_xp_adjustments.team_id
        AND lm.user_id = auth.uid()
    )
  );

