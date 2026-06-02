-- Best-effort rollback: recrée la colonne + des tables vides (données non restaurées).
-- Remontada est supprimé définitivement ; ce down rétablit juste un schéma compilable,
-- pas la structure complète d'origine. Les policies RLS demo ne sont PAS recréées
-- (elles vivaient dans d'autres migrations).
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS remontada_mult numeric NOT NULL DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS public.remontada_boost_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remontada_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
