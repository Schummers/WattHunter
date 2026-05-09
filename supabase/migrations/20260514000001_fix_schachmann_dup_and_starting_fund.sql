-- 1. Remove duplicate Schachmann salary (Round 2 correction predates backfill)
DELETE FROM public.treasury_log
WHERE id = '626f46e3-622f-4a90-887f-de20f92176a8';

-- 2. Move Fair Play -50K from Giro phase (May 6) to Classics Part 2 (Apr 15)
UPDATE public.treasury_log
SET created_at = '2026-04-15 12:00:00+00'
WHERE id = 'c1f45cdb-cb7f-40ca-b69f-d87e31009456';
