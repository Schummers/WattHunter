# ADR: Rank-based barème replaces raw PCS points on Grand Tour scoring

- **Status**: Accepted
- **Date**: 2026-07-03
- **Scope**: Grand Tours only (Giro/Tour/Vuelta), starting Tour de France 2026. Classics
  and 1-week races are unchanged (still raw PCS points) — a post-Tour review will decide
  whether to extend.

## Context

WattHunter's GT scoring used raw PCS points as the XP base. A comparative analysis
against two reference fantasy-cycling games (Velogames, La Route du Tour) surfaced two
structural problems inherited from PCS's own point curve, not from WattHunter's design:

1. **Winner-take-all falaise at the top**: PCS pays 1st→2nd on a stage -30% and on the
   final GC -24% (e.g. Tour 2025: Pogačar 500 pts vs Vingegaard 380 pts — a 120-point gap
   for finishing 34 seconds behind over three weeks).
2. **GC final dominance**: the ratio (GC final win) / (stage win) was ~5:1 on raw PCS,
   against 2.5:1 (La Route du Tour) and 2.7:1 (Velogames) in the references. This made
   drafting the eventual GC winner overwhelmingly the dominant strategy, flattening the
   value of stage hunters, sprinters, and secondary-jersey contenders.

## Decision

Replace the PCS-points base with a **custom rank-derived table**, shaped after Velogames'
curves but rescaled to WattHunter's existing magnitude (stage win = 100, preserving the
Manager-mode level thresholds in `LEVEL_THRESHOLDS`). Concretely:

- Stage and GC-final base points now come from `race_results.rank` (already scraped and
  stored on every result) via fixed lookup tables, not from `pcs_points`.
- Daily classification bonuses (GC/Points/KOM/Youth) become **flat for every squad
  rider** in the ranked zone, with the matching role multiplying on top — replacing the
  previous matched-only mechanism (0 for non-matching roles).
- Final classifications (GC/Points/KOM/Youth) become **flat across roles** — role
  multipliers no longer apply to end-of-race jerseys, mirroring La Route du Tour's rule
  that in-race status does not carry into final standings.
- A new **domestique assist bonus** rewards a domestique whose *real pro-team* teammate
  (not his fantasy squad) performs — inspired by Velogames' assist mechanic, scoped to
  the one role (domestique) that previously earned nothing beyond ×1.0.
- The climber role multiplier is now gated to hilly/mountain stage profiles (p3/p4/p5),
  mirroring the existing sprinter gating (p1/p2/p3) — an inconsistency the flatter,
  deeper stage table would otherwise have made visible (a climber placing top-15 on a
  flat sprint stage would wrongly earn ×1.5).

## Why this was a real trade-off

The alternative — keep raw PCS points — has one genuine advantage the team weighed
seriously: **fidelity to the sport's own valuation and zero equilibration debt** (no
custom table to maintain, no risk of the table aging badly against a changing peloton).
Rejected because: (a) PCS's curve is calibrated for a real-world ranking system, not for
a fantasy game's strategic depth, and (b) the team already controls every other bonus
layer (roles, classifications, tactics) by hand — inheriting only the base from an
external, opaque source was the actual inconsistency.

Taking Velogames' point values verbatim (not rescaled) was also rejected: their scale is
~2.2× WattHunter's (stage win 220 vs 100), which would have made the already-scored Giro
2026 phase incomparable to the Tour within the same season's cumulative XP, and would
have required retuning the Manager level curve.

## Consequences

- **Not rescored**: Giro 2026 (already played) keeps its raw-PCS-points scores. The
  season's cumulative XP mixes two barèmes across GTs for 2026 — accepted as the cost of
  not disturbing completed results ("the past is the past").
- `rider_xp_daily.raw_pcs_points` now stores the rank-derived base for GT slugs (column
  name kept for backward compatibility; semantics documented here and in `scoring.py`).
- New `rider_xp_daily.assist_bonus` column (migration `20260703100000`).
- Underdog's "no final-classification bonus" carve-out (§14) becomes a special case of
  the general "finals are flat for everyone" rule, not a underdog-specific rule.
- Classics/1-week races keep the pre-refonte matched-only classification mechanism and
  raw PCS points until a post-Tour review decides on extension — this ADR does not cover
  that scope.

## Known limitations

- **Assist teammate detection is bounded by the rider pool.** Domestique assists match a
  teammate's `real_team` from the `riders` table (top ~600 PCS). A real-team teammate who
  is outside that pool and finishes stage top 3 (or holds GC top 3) will not trigger the
  assist. Negligible on a Grand Tour (top-3 finishers are essentially always in-pool), but
  noted for completeness.
- **Assist eligibility = classified finisher.** The domestique only earns assists when his
  own result row carries a non-null `rank` (a classified finisher), since `race_results`
  also stores non-classified rows (DNF/DNS carry `rank=NULL`). This is marginally stricter
  than Velogames' "must start" rule, chosen because "started" is not a signal available in
  the scoring path — `rank is not None` is the clean, unambiguous one.
- **By-date scoring fallback does not support the rank-based barème.** `calculate_daily_scores`
  widens the finisher fetch (rank-based base + assists need every finisher, not just PCS
  scorers) only on the explicit-`race_slugs` path — the one `post-race` always uses. The
  legacy by-date fallback keeps `pcs_points > 0`; a GT stage scored purely by date would
  lose sub-top-20 rows and assists. Accepted because `post-race` always passes `--race <slug>`.
