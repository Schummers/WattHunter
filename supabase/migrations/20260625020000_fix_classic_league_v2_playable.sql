-- Make the seeded classic league "Classiques de l'individualisme V2" playable.
--
-- The initial seed (20260625010000) created it as status='active' with treasury=0 and
-- NO auction. That leaves the league in limbo: the game route does not redirect to the
-- lobby (so launch_first_auction is unreachable), yet no auction exists, so players have
-- nothing to draft and zero budget.
--
-- Fix (mirrors how a normally-created classic league reaches its first auction):
--   1. Revert to status='pending' so the commissioner lands in the lobby and can press
--      "Launch first auction" (launch_first_auction requires status='pending').
--   2. Fund each team with the classic 1.5M budget. launch_first_auction does NOT touch
--      treasury, and classic_phase_reset only runs at phase END — so the FIRST phase
--      budget must be seeded here, mirroring classicTeamDefaults() at league creation.
--
-- After this, the commissioner launches the first auction from the lobby; that creates the
-- 3 Tour rounds (correct Europe/Paris scheduling) and flips the league to 'active'.

UPDATE public.leagues
   SET status = 'pending', updated_at = now()
 WHERE id = '00000000-0000-4000-8000-c1a551c2026e'::uuid;

-- Fund the 8 teams to the classic budget (idempotent: only the unfunded ones).
UPDATE public.teams
   SET treasury = 1500000, updated_at = now()
 WHERE league_id = '00000000-0000-4000-8000-c1a551c2026e'::uuid
   AND treasury = 0;

-- Audit line per team (idempotent via NOT EXISTS guard).
INSERT INTO public.treasury_log (team_id, type, amount, description)
SELECT t.id, 'budget_reset', 1500000, 'Classic budget reset — initial (Tour)'
  FROM public.teams t
 WHERE t.league_id = '00000000-0000-4000-8000-c1a551c2026e'::uuid
   AND NOT EXISTS (
     SELECT 1 FROM public.treasury_log tl
      WHERE tl.team_id = t.id AND tl.type = 'budget_reset'
   );
