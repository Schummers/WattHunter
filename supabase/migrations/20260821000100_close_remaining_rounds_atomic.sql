-- Close the "everyone's squad is full" decision into a single atomic statement.
--
-- forceResolveRound was making this decision as two separate round trips from
-- TypeScript: read league_all_teams_complete(), then (if true) UPDATE auctions
-- SET status='closed' WHERE status='scheduled'. Between those two calls, any league
-- member loading the auction or market page triggers the pre-existing
-- open_due_auction RPC, which flips a due 'scheduled' round to 'open'. If that lands
-- in the window, the closing UPDATE's WHERE clause no longer matches that round (it
-- is 'open', not 'scheduled'), so it stays open and biddable while forceResolveRound
-- goes on to run the payday cascade — a round accepting bids after the phase's
-- rosters and budgets have already been reset for the next one.
--
-- No exposure yet: this league's current phase has only Rounds 1-3 provisioned, so
-- there is nothing in 'scheduled' state for the early-finish branch to race over
-- until rounds 4-5 are ever added. Closed now anyway, since it is cheap and the
-- alternative is remembering to do it later under more pressure.
--
-- One PL/pgSQL function body is one transaction: the completeness check and the
-- closing UPDATE now happen without a network round trip between them, and any
-- concurrent open_due_auction on the same row serializes against this transaction's
-- row lock instead of interleaving with it.

CREATE OR REPLACE FUNCTION public.close_remaining_rounds_if_complete(p_league_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_complete boolean;
BEGIN
  SELECT public.league_all_teams_complete(p_league_id) INTO v_complete;

  IF v_complete THEN
    -- Kept as 'closed' rather than deleted: the rounds that never ran are part of
    -- the phase's history.
    UPDATE auctions
       SET status = 'closed', resolved_at = now()
     WHERE league_id = p_league_id
       AND status = 'scheduled';
  END IF;

  RETURN v_complete;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_remaining_rounds_if_complete(uuid)
  TO authenticated, service_role;
