-- Tour de France 2026 — Stage 1 (TTT) scored via the GC classification.
--
-- Stage 1 is a team time trial. WattHunter has no TTT-specific scoring, so (one-time,
-- playtest decision) the GC standing AFTER stage 1 is used as the individual stage-1
-- result, then scored as a normal GT stage flagged is_itt=TRUE (only gc_leader ×1.5 and
-- tt_specialist ×2 earn a role bonus on an ITT — see scoring._role_multiplier).
--
-- This migration only deposits the INPUTS. XP is produced by re-running the scoring
-- pipeline: services/pcs-sync/scripts/rescore_tdf2026_stage1.py
-- (role_cutoff = 2026-07-05T00:00:00Z, freezing squad+roles at the stage-1 state so the
--  day-2 role edits made on 2026-07-05 do NOT retroactively rescore stage 1).
--
-- Only riders owned by a Classic V2 team are injected (the only league with a phase-6/2026
-- squad; verified no cross-league contamination). Rows resolve rider_id via pcs_slug and
-- JOIN riders, so on a fresh `supabase db reset` (no riders) they insert nothing — Rule #2.

-- 1. GC-as-stage-1 results (rank = GC position after stage 1; is_itt=TRUE; flat profile 'itt').
INSERT INTO public.race_results
  (rider_id, race_slug, race_name, stage, race_date, pcs_points, rank, race_class, is_itt, breakaway_kms, profile_icon)
SELECT r.id, 'race/tour-de-france/2026/stage-1', 'Tour de France - Stage 1', 'stage-1',
       '2026-07-04', 0, v.rank, 'grand_tour', TRUE, NULL, 'itt'
FROM (VALUES
  ('rider/jonas-vingegaard', 1),
  ('rider/filippo-ganna', 2),
  ('rider/tadej-pogacar', 3),
  ('rider/juan-ayuso-pesquera', 4),
  ('rider/remco-evenepoel', 5),
  ('rider/isaac-del-toro', 6),
  ('rider/florian-lipowitz', 8),
  ('rider/tobias-foss', 9),
  ('rider/paul-seixas', 10),
  ('rider/romain-gregoire', 12),
  ('rider/antonio-tiberi', 13),
  ('rider/lenny-martinez', 15),
  ('rider/michael-matthews', 16),
  ('rider/alex-baudin', 17),
  ('rider/tobias-halland-johannessen', 20),
  ('rider/thymen-arensman', 21),
  ('rider/mathias-vacek', 23),
  ('rider/kevin-vauquelin', 26)
) AS v(pcs_slug, rank)
JOIN public.riders r ON r.pcs_slug = v.pcs_slug
ON CONFLICT (rider_id, race_slug) DO UPDATE
  SET rank = EXCLUDED.rank, is_itt = EXCLUDED.is_itt, profile_icon = EXCLUDED.profile_icon,
      pcs_points = EXCLUDED.pcs_points, race_class = EXCLUDED.race_class;

-- 2. Daily jersey holders after stage 1 (single holder per classification, rank 1).
--    Points/green (Egan Bernal) is owned by nobody in the league -> not injected.
INSERT INTO public.gt_daily_classifications
  (race_slug, stage, rider_id, classification_type, rank)
SELECT 'race/tour-de-france/2026/stage-1', 'stage-1', r.id, v.ctype, 1
FROM (VALUES
  ('rider/jonas-vingegaard', 'gc'),
  ('rider/juan-ayuso-pesquera', 'youth'),
  ('rider/tadej-pogacar', 'kom')
) AS v(pcs_slug, ctype)
JOIN public.riders r ON r.pcs_slug = v.pcs_slug
ON CONFLICT (race_slug, rider_id, classification_type) DO UPDATE SET rank = EXCLUDED.rank;
