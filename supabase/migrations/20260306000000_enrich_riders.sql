-- Migration: Enrich riders with bio data + rider_teams history
-- Pipeline E — rider enrichment (birthdate, birth_place, height, weight, team history)

-- 1. Add new columns to riders (idempotent)
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS height_cm int;
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS weight_kg int;

-- 2. Update specialty CHECK constraint to accept both old and new values
ALTER TABLE public.riders DROP CONSTRAINT IF EXISTS riders_specialty_check;
ALTER TABLE public.riders ADD CONSTRAINT riders_specialty_check
  CHECK (specialty IN (
    'climber','sprinter','rouleur','puncheur','time_trialist','all_rounder',
    'GC','OneDay','TT','Sprint'
  ));

-- 3. Create rider_teams table (team history per season)
CREATE TABLE IF NOT EXISTS public.rider_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id    uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  team_name   text NOT NULL,
  team_url    text,
  season      int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rider_id, team_url, season)
);

ALTER TABLE public.rider_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rider_teams"
  ON public.rider_teams
  FOR SELECT
  USING (true);
