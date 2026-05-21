-- Fix duplicate sponsor_bonus credits from sponsor_bonus pipeline reruns.
--
-- Bug: `credit_sponsor_bonuses` RPC (migration 20260520000001) inserts into
-- treasury_log and credits teams.treasury unconditionally for every bonus
-- passed in the payload. Python caller (services/pcs-sync/sponsor_bonus.py)
-- builds the payload from all detected bonuses on every run, not just the
-- new ones. The sponsor_bonuses table is idempotent (UNIQUE INDEX on
-- team_id,rider_id,race_slug,result_type) but treasury_log is not, so
-- every rerun re-credits the same bonus.
--
-- The pipeline was re-run multiple times on 2026-05-20 during the temporal
-- squad-check fix + remontada nerf rollout (commits 70c27fa & friends),
-- creating up to 6 duplicate credits for the same stage win.
--
-- This migration:
--   1. Identifies groups (team_id, rider_id, description) with COUNT > 1 in
--      treasury_log for sponsor_bonus entries on Giro 2026 stages.
--   2. Keeps the earliest row in each group, sums the rest = excess per team.
--   3. Inserts a `sponsor_bonus_revert` audit row per affected team.
--   4. Debits teams.treasury by the excess.
--   5. Deletes the duplicate rows.
--
-- Scope is bounded by:
--   * created_at >= 2026-05-09 (start of Giro 2026)
--   * created_at <  2026-05-21 06:00:00+00 (cutoff right after the latest
--     stage-11 credit on 05:52 UTC — anything newer is untouched)
--   * description LIKE 'Sponsor bonus:%giro-d-italia/2026%'
--
-- The RPC hardening + Python filter ship in companion migrations/commits
-- (20260521120100 + sponsor_bonus.py patch) to prevent the bug from coming
-- back on future reruns.

BEGIN;

ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

-- Identify duplicate rows (everything except the earliest in each dup group)
CREATE TEMP TABLE _dups_to_delete ON COMMIT DROP AS
WITH dup_groups AS (
  SELECT team_id, description, rider_id,
         MIN(created_at) AS earliest_created_at,
         COUNT(*) AS occurrences
  FROM public.treasury_log
  WHERE type = 'sponsor_bonus'
    AND created_at >= '2026-05-09'
    AND created_at <  '2026-05-21 06:00:00+00'
    AND description LIKE 'Sponsor bonus:%giro-d-italia/2026%'
  GROUP BY team_id, description, rider_id
  HAVING COUNT(*) > 1
)
SELECT tl.id, tl.team_id, tl.amount, tl.description, tl.rider_id
FROM public.treasury_log tl
INNER JOIN dup_groups dg
  ON tl.team_id    = dg.team_id
 AND tl.description = dg.description
 AND tl.rider_id  IS NOT DISTINCT FROM dg.rider_id
 AND tl.created_at > dg.earliest_created_at
WHERE tl.type = 'sponsor_bonus'
  AND tl.created_at >= '2026-05-09'
  AND tl.created_at <  '2026-05-21 06:00:00+00'
  AND tl.description LIKE 'Sponsor bonus:%giro-d-italia/2026%';

-- Safety: nothing to do? exit cleanly with a notice
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _dups_to_delete;
  RAISE NOTICE '[sponsor_bonus dedup] % duplicate rows targeted', v_count;
END $$;

-- Audit revert: 1 line per affected team
INSERT INTO public.treasury_log (team_id, type, amount, description)
SELECT team_id,
       'sponsor_bonus_revert',
       -SUM(amount),
       'Reverted: duplicate sponsor_bonus credits from pipeline reruns (data fix 2026-05-21)'
FROM _dups_to_delete
GROUP BY team_id;

-- Debit teams.treasury by their excess
UPDATE public.teams t
SET treasury = t.treasury - sub.excess
FROM (
  SELECT team_id, SUM(amount) AS excess
  FROM _dups_to_delete
  GROUP BY team_id
) sub
WHERE t.id = sub.team_id;

-- Delete duplicate rows
DELETE FROM public.treasury_log
WHERE id IN (SELECT id FROM _dups_to_delete);

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

-- Post-condition: zero duplicate groups remain in the affected window
DO $$
DECLARE v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM (
    SELECT 1
    FROM public.treasury_log
    WHERE type = 'sponsor_bonus'
      AND created_at >= '2026-05-09'
      AND created_at <  '2026-05-21 06:00:00+00'
      AND description LIKE 'Sponsor bonus:%giro-d-italia/2026%'
    GROUP BY team_id, description, rider_id
    HAVING COUNT(*) > 1
  ) x;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Dedup failed: % duplicate groups still remain', v_remaining;
  END IF;
END $$;

COMMIT;
