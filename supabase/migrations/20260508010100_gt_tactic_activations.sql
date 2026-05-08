-- supabase/migrations/20260508010100_gt_tactic_activations.sql
-- Records each tactic activation by a team during a GT phase.

CREATE TABLE gt_tactic_activations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  phase_id                    INT  NOT NULL,
  year                        INT  NOT NULL,
  tactic_type                 TEXT NOT NULL
    CHECK (tactic_type IN (
      'unleash', 'overdrive', 'call_the_bus', 'nemesis_gc', 'nemesis_sprint'
    )),
  stage_slug                  TEXT NOT NULL,
  -- Nemesis-only fields: both NULL or both NOT NULL
  nemesis_target_team_id      UUID REFERENCES teams(id) ON DELETE CASCADE,
  nemesis_target_role         TEXT CHECK (nemesis_target_role IN ('gc_leader', 'sprinter')),
  -- Resolution snapshot (filled by scoring pipeline)
  resolved_attacker_rider_id  UUID REFERENCES riders(id),
  resolved_target_rider_id    UUID REFERENCES riders(id),
  outcome                     TEXT CHECK (outcome IN ('attacker_won', 'target_won', 'no_resolution')),
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (team_id, phase_id, year, stage_slug),

  CONSTRAINT nemesis_fields_consistent CHECK (
    (nemesis_target_team_id IS NULL AND nemesis_target_role IS NULL)
    OR
    (nemesis_target_team_id IS NOT NULL AND nemesis_target_role IS NOT NULL)
  ),

  CONSTRAINT nemesis_role_matches_type CHECK (
    (tactic_type = 'nemesis_gc'     AND nemesis_target_role = 'gc_leader')
    OR (tactic_type = 'nemesis_sprint' AND nemesis_target_role = 'sprinter')
    OR (tactic_type NOT IN ('nemesis_gc', 'nemesis_sprint') AND nemesis_target_role IS NULL)
  )
);

CREATE INDEX gt_tactic_activations_team_phase_idx
  ON gt_tactic_activations(team_id, phase_id, year);

CREATE INDEX gt_tactic_activations_stage_idx
  ON gt_tactic_activations(stage_slug)
  WHERE outcome IS NULL;

-- Enable RLS
ALTER TABLE gt_tactic_activations ENABLE ROW LEVEL SECURITY;

-- Read: any league member can see activations of any team in their league
CREATE POLICY gt_tactic_activations_read ON gt_tactic_activations
  FOR SELECT
  USING (
    team_id IN (
      SELECT t.id
      FROM teams t
      JOIN teams my ON my.league_id = t.league_id
      WHERE my.user_id = auth.uid()
    )
  );

-- Write: only via place_tactic RPC (SECURITY DEFINER) — nothing direct
-- (no INSERT/UPDATE/DELETE policy means no access from anon/authenticated)

-- Usage-limit enforcement: max uses per (team, phase, year, tactic_type)
CREATE OR REPLACE FUNCTION enforce_tactic_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed   INT;
BEGIN
  max_allowed := CASE NEW.tactic_type
    WHEN 'unleash'         THEN 2
    WHEN 'overdrive'       THEN 2
    WHEN 'call_the_bus'    THEN 3
    WHEN 'nemesis_gc'      THEN 1
    WHEN 'nemesis_sprint'  THEN 1
    ELSE
      -- Defensive: any tactic_type added to the CHECK constraint without
      -- updating this trigger must fail loudly.
      NULL
  END;

  IF max_allowed IS NULL THEN
    RAISE EXCEPTION 'unknown tactic_type: %', NEW.tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM gt_tactic_activations
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year
    AND tactic_type = NEW.tactic_type;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'tactic % already used % time(s) (max %)',
      NEW.tactic_type, current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE TRIGGER gt_tactic_activations_usage_limit
  BEFORE INSERT ON gt_tactic_activations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tactic_usage_limit();
