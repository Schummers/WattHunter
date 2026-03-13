-- Add league_id to contracts (denormalized from teams) for unique constraint
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id);

-- Backfill from teams
UPDATE public.contracts c SET league_id = t.league_id FROM public.teams t WHERE c.team_id = t.id AND c.league_id IS NULL;

-- Make NOT NULL
ALTER TABLE public.contracts ALTER COLUMN league_id SET NOT NULL;

-- Partial unique index: only one active/notice contract per rider per league
CREATE UNIQUE INDEX idx_contracts_unique_active_rider_league ON public.contracts (rider_id, league_id) WHERE status IN ('active', 'notice');
