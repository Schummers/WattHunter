-- Characterization test for credit_goal_reward (audit Voie B, findings B2-01/B2-02).
-- Run: docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--        < services/pcs-sync/tests/sql/test_credit_goal_reward.sql
-- Proves: (1) first call credits treasury exactly once + writes one completion + one log;
--         (2) an identical rerun is a no-op (idempotent) — no double credit, no money loss.
-- Wrapped in a transaction that ROLLBACKs, so the DB is left untouched.

BEGIN;

-- Minimal fixtures (fixed UUIDs). Inserting into auth.users fires handle_new_user,
-- which creates the matching public.users row (display_name from metadata).
INSERT INTO auth.users (id, email)
  VALUES ('00000000-0000-4000-8000-000000000001', 'test-goal@example.com');
INSERT INTO public.leagues (id, name, invite_code, commissioner_id)
  VALUES ('00000000-0000-4000-8000-000000000010', 'Test League', 'TESTGOAL',
          '00000000-0000-4000-8000-000000000001');
INSERT INTO public.teams (id, user_id, league_id, name, treasury)
  VALUES ('00000000-0000-4000-8000-000000000020',
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000010', 'Test Team', 0);
INSERT INTO public.sponsors (id, name, slug, tier, unlock_level, monthly_budget, orientation)
  VALUES ('00000000-0000-4000-8000-000000000030', 'Test Sponsor', 'test-sponsor', 1, 1, 100000, 'neutral');
INSERT INTO public.riders (id, pcs_slug, full_name)
  VALUES ('00000000-0000-4000-8000-000000000040', 'test-rider', 'Test Rider');

-- Reward payload (50k €).
\set payload '{"team_id":"00000000-0000-4000-8000-000000000020","sponsor_id":"00000000-0000-4000-8000-000000000030","goal_index":0,"goal_label":"Win an ITT","race_slug":"race/giro-d-italia/2026","stage_slug":"race/giro-d-italia/2026/stage-10","rider_id":"00000000-0000-4000-8000-000000000040","base_reward":50000,"multiplier":1.0,"final_reward":50000,"goal_key":"test-sponsor:0","neutralized_stage_slugs":[],"description":"Goal: Win an ITT in race/giro-d-italia/2026 (x1.0)"}'

-- Call 1 (fresh) then Call 2 (rerun, must be a no-op).
SELECT 'call1' AS step, public.credit_goal_reward(:'payload'::jsonb) AS result;
SELECT 'call2' AS step, public.credit_goal_reward(:'payload'::jsonb) AS result;

DO $$
DECLARE
  v_treasury    int;
  v_completions int;
  v_logs        int;
BEGIN
  SELECT treasury INTO v_treasury
    FROM public.teams WHERE id = '00000000-0000-4000-8000-000000000020';
  SELECT count(*) INTO v_completions
    FROM public.sponsor_goal_completions WHERE team_id = '00000000-0000-4000-8000-000000000020';
  SELECT count(*) INTO v_logs
    FROM public.treasury_log
    WHERE team_id = '00000000-0000-4000-8000-000000000020' AND type = 'gt_goal_bonus';

  IF v_treasury <> 50000 THEN
    RAISE EXCEPTION 'FAIL treasury=% expected 50000 (credited once, not twice)', v_treasury;
  END IF;
  IF v_completions <> 1 THEN
    RAISE EXCEPTION 'FAIL completions=% expected 1', v_completions;
  END IF;
  IF v_logs <> 1 THEN
    RAISE EXCEPTION 'FAIL treasury_log rows=% expected 1', v_logs;
  END IF;

  RAISE NOTICE 'PASS: treasury=50000, completions=1, logs=1 after 2 calls (idempotent)';
END $$;

ROLLBACK;
