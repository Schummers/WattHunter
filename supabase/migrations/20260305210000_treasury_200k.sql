-- Reduce starting treasury from 500K to 200K (aligned with sponsor 200K/month)
ALTER TABLE public.teams ALTER COLUMN treasury SET DEFAULT 200000;

-- Update existing teams that still have the old default
UPDATE public.teams SET treasury = 200000 WHERE treasury = 500000;
UPDATE public.teams SET treasury = 200000 WHERE treasury = 300000;
