-- Spec A (A9) — per-race tactic usage limits as a reference table
-- (instead of inline CASE inside the BEFORE-INSERT trigger). GT keeps the
-- original 2/2/3/1/1 budget; 1-week stage races get a tighter 1/1/2/1/1.

CREATE TABLE IF NOT EXISTS public.tactic_usage_limits (
  race_kind     TEXT NOT NULL CHECK (race_kind IN ('gt','one_week')),
  tactic_type   TEXT NOT NULL CHECK (tactic_type IN
                  ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint')),
  max_per_race  INT  NOT NULL CHECK (max_per_race > 0),
  PRIMARY KEY (race_kind, tactic_type)
);

ALTER TABLE public.tactic_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tactic_usage_limits"
  ON public.tactic_usage_limits FOR SELECT USING (true);

COMMENT ON TABLE public.tactic_usage_limits IS
  'Max activations per (team, race) for each tactic, scoped by race kind. Spec A A9.';

-- Seed both kinds (idempotent — use ON CONFLICT).
INSERT INTO public.tactic_usage_limits(race_kind, tactic_type, max_per_race) VALUES
  ('gt',       'unleash',        2),
  ('gt',       'overdrive',      2),
  ('gt',       'call_the_bus',   3),
  ('gt',       'nemesis_gc',     1),
  ('gt',       'nemesis_sprint', 1),
  ('one_week', 'unleash',        1),
  ('one_week', 'overdrive',      1),
  ('one_week', 'call_the_bus',   2),
  ('one_week', 'nemesis_gc',     1),
  ('one_week', 'nemesis_sprint', 1)
ON CONFLICT (race_kind, tactic_type) DO UPDATE
  SET max_per_race = EXCLUDED.max_per_race;

-- ---------------------------------------------------------------------------
-- Helper: infer race_kind from a row's race_slug / phase_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.infer_race_kind(
  p_race_slug TEXT,
  p_phase_id  INT
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_race_slug IS NOT NULL THEN
    IF p_race_slug LIKE 'race/giro-d-italia/%'
       OR p_race_slug LIKE 'race/tour-de-france/%'
       OR p_race_slug LIKE 'race/vuelta-a-espana/%' THEN
      RETURN 'gt';
    END IF;
    RETURN 'one_week';
  END IF;

  -- Legacy fallback: phase_id only.
  IF p_phase_id IN (4, 6, 8) THEN
    RETURN 'gt';
  END IF;
  RETURN 'one_week';
END;
$$;

COMMENT ON FUNCTION public.infer_race_kind IS
  'Return ''gt'' or ''one_week'' for a (race_slug, phase_id) pair. Used by enforce_tactic_usage_limit and place_tactic.';

-- ---------------------------------------------------------------------------
-- Rewrite enforce_tactic_usage_limit to read tactic_usage_limits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_tactic_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_race_kind   TEXT;
  v_max_allowed INT;
  v_current     INT;
BEGIN
  v_race_kind := public.infer_race_kind(NEW.race_slug, NEW.phase_id);

  SELECT max_per_race INTO v_max_allowed
  FROM public.tactic_usage_limits
  WHERE race_kind = v_race_kind
    AND tactic_type = NEW.tactic_type;

  IF v_max_allowed IS NULL THEN
    RAISE EXCEPTION 'no usage limit configured for race_kind=% tactic_type=%',
      v_race_kind, NEW.tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Count activations scoped to the same race.
  -- Prefer race_slug when present; fall back to (phase_id, year) for legacy rows.
  IF NEW.race_slug IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current
    FROM public.gt_tactic_activations
    WHERE team_id = NEW.team_id
      AND race_slug = NEW.race_slug
      AND tactic_type = NEW.tactic_type;
  ELSE
    SELECT COUNT(*) INTO v_current
    FROM public.gt_tactic_activations
    WHERE team_id = NEW.team_id
      AND phase_id = NEW.phase_id
      AND year = NEW.year
      AND tactic_type = NEW.tactic_type;
  END IF;

  IF v_current >= v_max_allowed THEN
    RAISE EXCEPTION 'tactic % already used % time(s) for this race (max %)',
      NEW.tactic_type, v_current, v_max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Trigger is already in place from migration 20260508010100; rebinding the
-- function body via CREATE OR REPLACE FUNCTION is sufficient (no DROP/CREATE TRIGGER).
