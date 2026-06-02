-- Remontada Boost removal (feature mort depuis 2026-05-21, remplacé par Spec B Underdog).
-- Tables vides + colonne toujours = 1.0 → DROP sans perte de donnée réelle.
-- CASCADE emporte les policies RLS demo (remontada_*_anon_demo, migrations 20260529).

DROP TABLE IF EXISTS public.remontada_boosts CASCADE;
DROP TABLE IF EXISTS public.remontada_boost_triggers CASCADE;

ALTER TABLE public.rider_xp_daily DROP COLUMN IF EXISTS remontada_mult;
