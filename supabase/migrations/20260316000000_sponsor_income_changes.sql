-- Sponsor income changes: Lotto escalating 200K→300K, T2 350K→400K
-- first_phase_budget: nullable, only for sponsors with escalating income
ALTER TABLE public.sponsors ADD COLUMN first_phase_budget int;

-- payments_count: tracks how many payments a team has received from this sponsor
ALTER TABLE public.team_sponsors ADD COLUMN payments_count int NOT NULL DEFAULT 0;

-- Backfill: existing team_sponsors assumed to have received 1 payment already
UPDATE public.team_sponsors SET payments_count = 1 WHERE activated_at < now();

-- Lotto (T1): first phase 200K, subsequent phases 300K
UPDATE public.sponsors SET monthly_budget = 300000, first_phase_budget = 200000 WHERE name = 'Lotto';

-- T2 sponsors: 350K → 400K
UPDATE public.sponsors SET monthly_budget = 400000 WHERE tier = 2;
