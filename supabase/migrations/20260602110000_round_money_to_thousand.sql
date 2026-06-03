-- Granularité monétaire : incrément d'enchère 100 € → 1 000 €.
--
-- 1. Ré-arrondit (FLOOR au millier) toutes les colonnes de PRIX existantes.
--    Floor (et non "au plus proche") : ne fait que RÉDUIRE une obligation
--    future, jamais l'augmenter → préserve l'invariant
--    treasury >= Σ(salaires actifs + enchères actives). Cohérent avec la
--    formule de salaire (apps/web/lib/format.ts calcMinSalary + sync.py).
--    Plancher 5 000 € conservé (= 5× le nouvel incrément).
--    On NE touche PAS teams.treasury ni treasury_log : ce sont des SOLDES /
--    un AUDIT immuable, pas des prix. Le format K les affiche proprement.
--
-- 2. Remplace les contraintes CHECK % 100 → % 1000. L'UPDATE doit précéder le
--    swap de contrainte, sinon la validation échoue sur les lignes existantes.
--
-- Précédent : 20260402250000_salary_round_100.sql (arrondi à 100 à l'époque).

-- ---- 1. Round price columns (integer division floors; keep 5000 floor) ----
UPDATE public.riders
SET monthly_salary = GREATEST(5000, monthly_salary / 1000 * 1000)
WHERE monthly_salary % 1000 <> 0;

UPDATE public.contracts
SET locked_salary = GREATEST(5000, locked_salary / 1000 * 1000)
WHERE locked_salary % 1000 <> 0;

UPDATE public.auction_bids
SET amount = GREATEST(5000, amount / 1000 * 1000)
WHERE amount % 1000 <> 0;

UPDATE public.draft_bids
SET amount = GREATEST(5000, amount / 1000 * 1000)
WHERE amount % 1000 <> 0;

UPDATE public.gt_emergency_bids
SET amount = GREATEST(5000, amount / 1000 * 1000)
WHERE amount % 1000 <> 0;

-- Sponsor budgets are already round in practice; normalize defensively.
UPDATE public.sponsors
SET monthly_budget = monthly_budget / 1000 * 1000
WHERE monthly_budget % 1000 <> 0;

-- NOTE: sponsors.first_phase_budget was planned but never created on the DB
-- (see 20260509160000_fix_confirm_phase_setup_first_phase_budget.sql). The
-- defensive rounding of that column is omitted because the column does not exist.

-- ---- 2. Swap CHECK constraints 100 → 1000 ----
ALTER TABLE public.draft_bids DROP CONSTRAINT IF EXISTS draft_bids_amount_check;
ALTER TABLE public.draft_bids
  ADD CONSTRAINT draft_bids_amount_check CHECK (amount >= 5000 AND amount % 1000 = 0);

ALTER TABLE public.auction_bids DROP CONSTRAINT IF EXISTS auction_bids_amount_check;
ALTER TABLE public.auction_bids
  ADD CONSTRAINT auction_bids_amount_check CHECK (amount >= 5000 AND amount % 1000 = 0);

ALTER TABLE public.gt_emergency_bids DROP CONSTRAINT IF EXISTS gt_emergency_bids_amount_check;
ALTER TABLE public.gt_emergency_bids
  ADD CONSTRAINT gt_emergency_bids_amount_check CHECK (amount >= 5000 AND amount % 1000 = 0);
