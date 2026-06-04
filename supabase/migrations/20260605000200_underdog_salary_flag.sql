-- Spec B (B4) — flag contracts recruited under underdog terms.
-- Set at INSERT when the team is currently eligible AND the rider is rank > 100.
-- The discount itself is applied at payday (next migration), and is reversible.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS underdog_discount boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.flag_underdog_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_eligible boolean;
  v_rank int;
BEGIN
  IF NEW.underdog_discount THEN
    RETURN NEW;  -- respect an explicitly-set flag (e.g. backfill)
  END IF;

  SELECT underdog_eligible INTO v_eligible FROM public.teams WHERE id = NEW.team_id;
  SELECT pcs_rank INTO v_rank FROM public.riders WHERE id = NEW.rider_id;

  IF COALESCE(v_eligible, false) AND COALESCE(v_rank, 0) > 100 THEN
    NEW.underdog_discount := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_underdog_contract ON public.contracts;
CREATE TRIGGER trg_flag_underdog_contract
  BEFORE INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.flag_underdog_contract();
