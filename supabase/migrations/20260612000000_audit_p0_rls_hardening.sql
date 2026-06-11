-- Audit 2026-06-11 — P0 RLS / privilege-escalation hardening.
-- Five confirmed, exploitable holes. Each write path being closed already goes
-- through a SECURITY DEFINER RPC (or the service-role pipeline), so removing the
-- direct anon/authenticated access changes no legitimate app behaviour.
--
-- Verified before writing:
--   * release_rider / place_bid / gt_add_to_squad|assign_role are RPCs (SECURITY DEFINER)
--   * no apps/web anon-client direct writes to contracts / auction_bids(insert) / gt_squad / gt_role_assignments
--   * each table keeps an independent SELECT policy (reads unaffected)
--   * cancelBid uses a SEPARATE auction_bids UPDATE policy (untouched here)

-- ---------------------------------------------------------------------------
-- 1. grant_xp — D1-RLS-02 / D1-01
-- The header comment claims "service-role only" but Postgres grants EXECUTE to
-- PUBLIC by default on function creation, and the migration only ADDED grants
-- (never REVOKEd PUBLIC). Any authenticated user could call grant_xp and award
-- unlimited XP to any team. Revoke the default PUBLIC/anon/authenticated grant.
-- service_role + supabase_admin keep their explicit grants; postgres-owned
-- SECURITY DEFINER callers (gt_claim_dnf_refund) run as owner and are unaffected.
REVOKE EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. teams.underdog_eligible — D1-RLS-03 / BR-D1-03
-- The block_team_field_updates() trigger guards level/treasury/cumulative_xp/
-- user_id/league_id but NOT underdog_eligible (added later by Spec B). With the
-- teams_update_own policy, an owner could set underdog_eligible = true directly
-- and unlock the -50% salary discount + squad-cap 10. Add it to the guard.
CREATE OR REPLACE FUNCTION public.block_team_field_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level
     OR NEW.treasury IS DISTINCT FROM OLD.treasury
     OR NEW.cumulative_xp IS DISTINCT FROM OLD.cumulative_xp
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.league_id IS DISTINCT FROM OLD.league_id
     OR NEW.underdog_eligible IS DISTINCT FROM OLD.underdog_eligible
  THEN
    RAISE EXCEPTION 'Protected field: level/treasury/xp/user_id/league_id/underdog_eligible can only be modified by SECURITY DEFINER functions';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. contracts_update_own — D1-RLS-01 / BR-D1-04
-- for-update policy with no column restriction lets an owner rewrite ANY column
-- of their own contracts (status, monthly_salary, locked_salary, bid_amount),
-- bypassing the auction/release RPCs. release_rider is an RPC, so this policy is
-- unused by the app. Drop it.
DROP POLICY IF EXISTS "contracts_update_own" ON public.contracts;

-- ---------------------------------------------------------------------------
-- 4. auction_bids_insert_own — D1-01
-- The original direct-INSERT policy was never dropped, so players can insert
-- bids straight into auction_bids, bypassing place_bid (solvency, 7-day release
-- cooldown, level gating, increment). The app inserts bids only via place_bid.
-- Drop the direct-INSERT policy (the separate UPDATE policy for cancelBid stays).
DROP POLICY IF EXISTS "auction_bids_insert_own" ON public.auction_bids;

-- ---------------------------------------------------------------------------
-- 5. gt_squad / gt_role_assignments FOR ALL writes — D1-02 / BR-D1-02
-- "FOR ALL TO authenticated" lets owners write their squad/roles directly,
-- bypassing gt_add_to_squad / gt_assign_role (squad cap 8/10, role caps,
-- underdog eligibility, 11:00 CET cutoff). All app writes go through those RPCs.
-- Drop the write policies; the separate "readable by league members" SELECT
-- policies remain, so reads are unaffected.
DROP POLICY IF EXISTS "GT squad writable by team owner" ON public.gt_squad;
DROP POLICY IF EXISTS "GT role assignments writable by team owner" ON public.gt_role_assignments;
