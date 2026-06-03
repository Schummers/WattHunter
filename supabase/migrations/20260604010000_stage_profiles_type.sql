-- Spec A follow-up — add `stage_type` to stage_profiles.
--
-- Why: PCS marks all stages with a `profile_icon` p1..p5 (flat → mountain),
-- but it has no notion of ITT/TTT (individual / team time trial) at the
-- profile level. A TTT 28km can be labelled `p3` (medium mountain) by PCS,
-- which lets `place_tactic` v3 accept Nemesis Sprint/GC on a TT stage where
-- those tactics have no game-design meaning.
--
-- Fix: add a `stage_type` column with the canonical PCS values
-- ('RR' = road race, 'ITT' = individual time trial, 'TTT' = team time trial).
-- Existing rows default to 'RR'; the seed pipeline now parses the stage name
-- for `(ITT)` / `(TTT)` markers and writes the value at upsert time.
--
-- place_tactic v4 will reject Nemesis Sprint + Nemesis GC + Overdrive on
-- ITT/TTT stages. Unleash and Call the Bus remain allowed.

ALTER TABLE public.stage_profiles
  ADD COLUMN IF NOT EXISTS stage_type text NOT NULL DEFAULT 'RR'
    CHECK (stage_type IN ('RR', 'ITT', 'TTT'));

COMMENT ON COLUMN public.stage_profiles.stage_type IS
  'PCS stage type: RR (road race, default), ITT (individual time trial), TTT (team time trial). Used by place_tactic v4 to gate tactics that require peloton/breakaway dynamics.';
