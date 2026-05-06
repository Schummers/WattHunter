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

-- Retroactive entries --------------------------------------------------------

-- 2026-04-02 : Klimax +20 XP (équilibrage)
INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at)
VALUES ('68ccf635-6599-4d53-a112-de66b27fa4cf', 20, 'Admin balance – équilibrage', '2026-04-02');

-- 2026-05-06 : Dixon Hormous +120 XP (level 4 catch-up)
INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at)
VALUES ('75122355-d629-4f10-927c-2eedc17883cd', 120, 'Admin balance – level 4 catch-up', '2026-05-06');

-- 2026-05-06 : bigdaddy +120 XP (level 4 catch-up)
INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at)
VALUES ('9ed75546-bbf8-4687-bb7d-6f39ff4c6171', 120, 'Admin balance – level 4 catch-up', '2026-05-06');
