DROP TRIGGER IF EXISTS trg_flag_underdog_contract ON public.contracts;
DROP FUNCTION IF EXISTS public.flag_underdog_contract();
ALTER TABLE public.contracts DROP COLUMN IF EXISTS underdog_discount;
