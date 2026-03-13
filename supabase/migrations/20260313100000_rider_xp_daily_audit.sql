-- Task 4a: Enrich rider_xp_daily for audit trail + team_ranking_daily for movement

-- Add race_slug for audit trail
ALTER TABLE public.rider_xp_daily ADD COLUMN IF NOT EXISTS race_slug text;
ALTER TABLE public.rider_xp_daily ADD COLUMN IF NOT EXISTS revenue_earned int DEFAULT 0;

-- Drop old unique constraint (team_id, rider_id, date)
-- Replace with (team_id, rider_id, race_slug) to support multiple races per day
DROP INDEX IF EXISTS rider_xp_daily_team_id_rider_id_date_key;
ALTER TABLE public.rider_xp_daily DROP CONSTRAINT IF EXISTS rider_xp_daily_team_id_rider_id_date_key;
CREATE UNIQUE INDEX idx_rider_xp_daily_team_rider_race ON public.rider_xp_daily (team_id, rider_id, race_slug);

-- Snapshot table for daily team ranking (movement calculation)
CREATE TABLE IF NOT EXISTS public.team_ranking_daily (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    rank int NOT NULL,
    cumulative_xp bigint NOT NULL,
    UNIQUE(team_id, date)
);

ALTER TABLE public.team_ranking_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read team_ranking_daily"
    ON public.team_ranking_daily FOR SELECT TO authenticated USING (true);
