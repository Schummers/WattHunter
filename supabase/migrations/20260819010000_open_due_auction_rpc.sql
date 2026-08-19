-- Auto-open a due auction round, for any league member.
--
-- Until now the lazy-open lived entirely in TypeScript (lib/supabase/get-open-auction.ts):
-- it flipped `auctions.status` from 'scheduled' to 'open' with the anon client. But the
-- only UPDATE policy on `auctions` is `auctions_update_commissioner`, so that write
-- silently failed for every player except the commissioner, and the helper returned null.
-- On top of that, the Auction page never called the helper at all — it only read the
-- rounds. Net effect: a round whose opens_at had passed could stay 'scheduled' forever,
-- and players saw a disabled "No Open Round" button with no way to act.
--
-- This RPC moves the flip server-side under SECURITY DEFINER (the project's standard
-- pattern: Zod validation -> rpc -> error forwarding), so any member of the league can
-- trigger it, while membership is still enforced here rather than by RLS.
--
-- Idempotent and concurrency-safe: an already-open round is returned untouched, the
-- due row is locked FOR UPDATE, and the UPDATE re-checks status = 'scheduled' so two
-- simultaneous page loads cannot open two different rounds.

CREATE OR REPLACE FUNCTION public.open_due_auction(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM league_members
     WHERE league_id = p_league_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Not a member of this league');
  END IF;

  -- 1. An open round already exists: return it, flip nothing.
  --    ORDER BY + LIMIT rather than a single-row assumption — a league that somehow
  --    ends up with two open rounds should degrade to "the earliest one", not error.
  SELECT id, name INTO v_id, v_name
    FROM auctions
   WHERE league_id = p_league_id AND status = 'open'
   ORDER BY opens_at ASC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'name', v_name, 'opened', false);
  END IF;

  -- 2. Otherwise take the earliest scheduled round whose opens_at has passed.
  SELECT id, name INTO v_id, v_name
    FROM auctions
   WHERE league_id = p_league_id
     AND status = 'scheduled'
     AND opens_at <= now()
   ORDER BY opens_at ASC
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    -- Nothing open, nothing due (between phases, or the next round opens later).
    RETURN jsonb_build_object('ok', true, 'id', NULL);
  END IF;

  UPDATE auctions
     SET status = 'open'
   WHERE id = v_id
     AND status = 'scheduled';

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'name', v_name, 'opened', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_due_auction(uuid) TO authenticated;
