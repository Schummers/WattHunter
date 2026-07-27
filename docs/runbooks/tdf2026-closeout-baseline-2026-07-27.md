# Tour de France 2026 — Closeout Baseline (2026-07-27, pre-stage-21)

Read-only snapshot taken before importing stage 21 + GC final + secondary
classifications, to diff against after closeout. League in scope:
**"Classiques de l'individualisme V2"** (`00000000-0000-4000-8000-c1a551c2026e`,
mode `classic`).

## Pre-flight

- `git fetch origin && git status` → `main` up to date with `origin/main`, working tree clean.
- `supabase migration list --linked` → local and remote match exactly, latest applied migration is `20260726000000` (Tour 2026 rest-days/stage-dates fix). No pending migrations.

## `race_results` / `gt_final_classifications` state (before)

- `race_results` has stages 1-20 for `race/tour-de-france/2026` (141-162 rows/stage).
- No `stage-21` rows, no `.../gc` rows.
- `gt_final_classifications` has **0 rows** for `race/tour-de-france/2026%`.

## `teams.cumulative_xp` / `level` (league V2, before)

| Team | Level | cumulative_xp |
|---|---:|---:|
| Leopard_Trek | 8 | 5671.59 |
| Klimax | 8 | 4932.04 |
| GoudalEnergies | 8 | 4843.06 |
| Muskatel Muskadji | 8 | 4189.38 |
| Las Chivas Pendejas | 8 | 3758.43 |
| Dixon Hormous | 8 | 3375.63 |
| Peejee | 8 | 3354.75 |
| bigdaddy | 8 | 2205.18 |
| TheAussieMate | 8 | 2102.61 |

Note: 9 teams in the league (MEMORY.md said 8 — `TheAussieMate` also present;
it has no `rider_xp_daily` rows for the Tour, so its 2102.61 XP predates this
race, e.g. Giro).

## `team_ranking_daily` (before, date=2026-07-26)

Rank order matches the `cumulative_xp` order above exactly (1=Leopard_Trek … 9=TheAussieMate).

## `rider_xp_daily` sum per team per stage (1-20, before)

Full per-team/per-stage sums captured for the post-closeout regression check
(stages 1-20 must not move by even 0.01 after the stage-21 rescore, since
`calculate_daily_scores` will be called with `race_slugs` scoped to the 5 new
slugs only). Raw data captured in this session's tool output; representative
totals (sum across stages 1-20) per team:

| Team | Sum XP stages 1-20 |
|---|---:|
| Leopard_Trek | 3081.50 |
| Klimax | 2288.88 |
| GoudalEnergies | 3028.22 |
| Muskatel Muskadji | 2979.50 |
| Las Chivas Pendejas | 1928.24 |
| Dixon Hormous | 1720.00 |
| Peejee | 1712.70 |
| bigdaddy | 1221.92 |

(Corrected 2026-07-27 post-closeout: the first pass through this table had an
arithmetic slip. `scripts/verify_tdf2026_closeout.py` independently re-summed
the per-stage data pulled in this same session and these are the values that
actually match — confirmed identical before and after the stage-21 import.)

(TheAussieMate: 0 — no squad rows this race.)

## sponsor_bonuses / sponsor_goal_completions

Confirmed empty for `race/tour-de-france/2026%` (classic league → both
`process_race_bonuses` and `evaluate_sponsor_goals` skip it per
`sponsor_bonus.py:25-27` / `goal_evaluator.py:450-467`). The only two
`sponsor_bonuses` rows for this race (`stage-4`, `stage-20`, 12000 each) belong
to a different, non-classic league and are out of scope for this closeout.

## gt_squad (phase 6, year 2026)

Active (non-removed) squad rows per team, all roles assigned well before
2026-07-26 (latest `created_at` = 2026-07-23), so no `role_cutoff` risk on
stage 21:

| Team | Active rows | Roles |
|---|---:|---|
| bigdaddy | 10 | climber, domestique, gc_leader, sprinter, stage_hunter, tt_specialist, underdog |
| Dixon Hormous | 10 | same set |
| GoudalEnergies | 10 | same set |
| Klimax | 9 | same set |
| Las Chivas Pendejas | 10 | same set |
| Leopard_Trek | 10 | same set |
| Muskatel Muskadji | 7 | same set minus underdog |
| Peejee | 10 | same set |

No DNF flags set (`dnf_stage` null across the board in this league for phase 6/2026).
