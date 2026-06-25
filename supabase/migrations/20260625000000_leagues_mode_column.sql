-- Classic League Mode: add a game-mode discriminator to leagues.
-- 'manager' = existing full-economy mode (default, no behavior change).
-- 'classic' = flattened mode (level 8, flat per-phase budget, 8-rider squad).
ALTER TABLE public.leagues
  ADD COLUMN mode text NOT NULL DEFAULT 'manager'
  CHECK (mode IN ('manager', 'classic'));

COMMENT ON COLUMN public.leagues.mode IS
  'Game mode: manager (full economy) or classic (flat budget, level 8, 8-rider squad).';
