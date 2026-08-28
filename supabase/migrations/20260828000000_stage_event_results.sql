-- Issue 02 (scoring-vuelta-refonte, 2026-08) — in-race event results on GT stages:
-- KOM crossings (categorized climbs, HC/1/2/3/4) and intermediate sprints, one row
-- per (stage, event, rider). Scraped from the stage page already fetched by
-- post-race (Stage.climbs() + a local parser for the "Sprint | ..." tables) —
-- zero extra HTTP requests. Read by scoring's event terms (issue 03): HC top 8,
-- cat 1 top 5, sprints top 8. Categories 2/3/4 are stored for completeness but
-- pay nothing.
CREATE TABLE IF NOT EXISTS public.stage_event_results (
  race_slug   text NOT NULL,            -- stage slug, e.g. 'race/vuelta-a-espana/2026/stage-2'
  event_type  text NOT NULL CHECK (event_type IN ('kom', 'sprint')),
  event_name  text NOT NULL,            -- climb or sprint name as shown on PCS
  category    text CHECK (category IN ('HC', '1', '2', '3', '4')),  -- NULL for sprints
  rider_id    uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  rank        int  NOT NULL CHECK (rank >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (race_slug, event_type, event_name, rider_id),
  CHECK ((event_type = 'kom') = (category IS NOT NULL))
);

ALTER TABLE public.stage_event_results ENABLE ROW LEVEL SECURITY;

-- Written only by the Python pipeline (service role bypasses RLS); readable by all.
CREATE POLICY "Anyone can read stage_event_results"
  ON public.stage_event_results FOR SELECT USING (true);
