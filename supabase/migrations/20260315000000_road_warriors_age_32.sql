-- Fix Road Warriors age threshold: 30 → 32
-- Aligns with PRD v2 specification
UPDATE public.policies
SET description = 'Bonus XP for riders over 32 years old'
WHERE slug = 'road_warriors';
