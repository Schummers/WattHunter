-- Rollback for 20260612000000_audit_p0_rls_hardening.sql
-- Restores the pre-hardening (insecure) state. For emergency revert only.

-- 1. grant_xp — restore default PUBLIC execute
GRANT EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) TO PUBLIC;

-- 2. block_team_field_updates — drop the underdog_eligible guard
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
  THEN
    RAISE EXCEPTION 'Protected field: level/treasury/xp/user_id/league_id can only be modified by SECURITY DEFINER functions';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. contracts_update_own
CREATE POLICY "contracts_update_own" ON public.contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.user_id = auth.uid()
    )
  );

-- 4. auction_bids_insert_own
CREATE POLICY "auction_bids_insert_own" ON public.auction_bids
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid())
  );

-- 5. gt_squad / gt_role_assignments write policies
CREATE POLICY "GT squad writable by team owner"
  ON public.gt_squad FOR ALL TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));

CREATE POLICY "GT role assignments writable by team owner"
  ON public.gt_role_assignments FOR ALL TO authenticated
  USING (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE user_id = auth.uid()));
