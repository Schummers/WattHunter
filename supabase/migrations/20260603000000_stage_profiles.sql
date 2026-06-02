-- Spec A (A7) — pre-race stage profile lookup table.
-- One row per stage_slug ("race/<race>/<year>/stage-N"), populated by the
-- startlists pipeline from Race.stages() (single page fetch per race).
-- Consumed by place_tactic for Nemesis profile gating
-- (Nemesis Sprint requires p1/p2/p3, Nemesis GC requires p3/p4/p5).
CREATE TABLE IF NOT EXISTS public.stage_profiles (
  race_slug      text  PRIMARY KEY,
  profile_icon   text  NOT NULL CHECK (profile_icon IN ('p0','p1','p2','p3','p4','p5')),
  race_date      date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stage_profiles"
  ON public.stage_profiles FOR SELECT USING (true);

COMMENT ON TABLE public.stage_profiles IS
  'Pre-race stage profile icon (p0-p5) per race_slug. Populated by run_pipeline.py startlists. Consumed by place_tactic Nemesis gating (Spec A A7).';

COMMENT ON COLUMN public.stage_profiles.profile_icon IS
  'PCS profile icon: p0=unknown, p1=flat, p2=hilly-flat-finish, p3=hilly-uphill-finish, p4=mountain-flat-finish, p5=mountain-summit-finish.';
