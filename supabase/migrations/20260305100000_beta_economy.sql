-- Beta economy changes (2026-03-05-beta-economy-design.md)

-- 1. Starting treasury: 500K → 300K for new teams
ALTER TABLE public.teams ALTER COLUMN treasury SET DEFAULT 300000;

-- 2. Add 'monthly_bonus' to treasury_log types for rider performance bonus
ALTER TABLE public.treasury_log
  DROP CONSTRAINT treasury_log_type_check;
ALTER TABLE public.treasury_log
  ADD CONSTRAINT treasury_log_type_check
  CHECK (type IN (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',
    'rider_revenue',
    'sponsor_payment',
    'bankruptcy_release',
    'monthly_bonus'
  ));
