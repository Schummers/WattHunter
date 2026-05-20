-- Nerf Remontada Boost: x2.0 → x1.5
-- The x2.0 multiplier proved too strong during Giro 2026 (35% of some teams' XP
-- came from the boost alone). Reducing to x1.5 keeps the mechanic meaningful
-- while preventing it from dominating the standings.
--
-- Scoring will be retroactively recalculated for all Giro stages after this
-- migration is applied. The scoring pipeline reads multiplier from this table.

UPDATE public.remontada_boosts
SET multiplier = 1.5
WHERE multiplier = 2.0;
