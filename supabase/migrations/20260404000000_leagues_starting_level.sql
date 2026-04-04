-- Add starting_level column to leagues table
-- Used by joinLeague to set the correct level for new teams
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS starting_level integer NOT NULL DEFAULT 1;
