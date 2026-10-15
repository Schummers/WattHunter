# WattHunter — Glossary

Single-context project. Domain terms established during design sessions, kept in sync
with `docs/GAME_RULES.md` (the authoritative rules doc — this file is vocabulary only,
not a spec).

## Scoring (GT rank-based barème, 2026-07)

- **Barème** — the fixed table mapping a race result (rank) to XP points. WattHunter has
  two barèmes in play: the **PCS barème** (raw `pcs_points`, used outside GTs) and the
  **rank-based barème** (custom tables keyed by `race_results.rank`, used on GT slugs
  since the 2026-07 refonte). See `docs/adr/2026-07-rank-based-gt-barème.md`.
- **Rank-based** — a scoring rule whose input is the finish **position** (1st, 2nd, 15th…)
  rather than a points value. Contrast with **PCS-based**, whose input is the
  `pcs_points` a result carries.
- **Flat (for finals / daily classifications)** — a table that pays the same points to
  every rider at a given rank, regardless of GT role. Introduced 2026-07 for final
  classifications (was already true for the GC final; now extended to Points/KOM/Youth
  finals and, with a role-matched multiplier layered on top, to daily classifications).
  Opposite of **matched-only**, the pre-refonte mechanic where a non-matching role earned
  zero from a classification.
- **Assist (domestique assist)** — XP a squad **domestique** earns from a teammate on his
  **real pro team** (e.g. UAE Team Emirates), not his fantasy squad, finishing in a
  qualifying position (stage top 3 or GC top 3 that day). Distinct from **classif_bonus**
  (which rewards the domestique's *own* squad-role classification, not a teammate's).
- **Gating (profile gating)** — restricting a role's multiplier to certain stage profiles
  (`p1`-`p5`). Sprinter is gated to p1/p2/p3 (flat/hilly); Climber is gated to p3/p4/p5
  (hilly/mountain) since 2026-07 — mirrors sprinter gating, closing an inconsistency
  where climber was previously ungated.
- **GT slug** — a `race_results.race_slug` under `race/giro-d-italia/`,
  `race/tour-de-france/`, or `race/vuelta-a-espana/` (`GT_RACE_PREFIXES`). Only GT slugs
  use the rank-based barème; all other races keep raw PCS points.
