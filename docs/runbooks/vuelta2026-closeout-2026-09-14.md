# Vuelta a España 2026 — Closeout Runbook (executed 2026-09-14)

League in scope: **"Classiques de l'individualisme V2"**
(`00000000-0000-4000-8000-c1a551c2026e`, mode `classic`, 7 fielded teams;
`Dixon Hormous` and `TheAussieMate` did not field a Vuelta squad). Barème:
rank-based (ADR `docs/adr/2026-07-rank-based-gt-barème.md`) with the 2026-08
Vuelta refonte (events, GC final 400 — PR #73). Stage 3 cancelled (weather):
20 stages scored.

This closeout is **not** a routine one. It doubles as the repair of the PCS
DOM-obfuscation incident (`docs/adr` pending, tickets under
`.scratch/pcs-import-integrity/issues/`, fix merged as PR #74). Read the
"Integrity incident" section before reusing any command below.

## Outcome

| Layer | Check | Result |
|---|---|---|
| 1. Import integrity | `race_results` ranks vs **Wikipedia** (independent of PCS), top 10 × 20 stages | **0 / 200** (base was 31 / 193 before) |
| 2. Barème conformity | `rider_xp_daily` rank_points vs GAME_RULES §7, all Vuelta slugs | **0 / 1352** lines |
| 3. Drift | XP lines whose rank did not change but XP did | **1** (explained, 7 XP, code-drift `844cae8`) |

Jerseys (points / kom / youth) had **never been distributed** before this
closeout; `youth` had 1 row in base (broken). Now 79 / 48 / 38 rows.

### Season standings after closeout

| # | Team | cumulative_xp | Δ closeout |
|---|---|---|---|
| 1 | Leopard_Trek | 9936.10 | +51.00 |
| 2 | Peejee | 7813.60 | +197.65 |
| 3 | Klimax | 7770.04 | +64.50 |
| 4 | GoudalEnergies | 7761.36 | +174.50 |
| 5 | Muskatel Muskadji | 7446.88 | +75.00 |
| 6 | Las Chivas Pendejas | 6813.73 | +58.00 |
| 7 | bigdaddy | 4914.18 | +148.00 |
| 8 | Dixon Hormous | 3742.63 | 0 |
| 9 | TheAussieMate | 2102.61 | 0 |

### Vuelta-only standings (XP on Vuelta slugs)

Peejee 4255.85 · Leopard_Trek 3603.01 · Las Chivas Pendejas 2695.8 · Muskatel
Muskadji 2682.0 · bigdaddy 2673.0 · GoudalEnergies 2563.8 · Klimax 2428.5.
Places 3 to 5 sit within 23 XP.

### Δ per team, by cause

| Team | rank fix | daily classif fix | jerseys | drift |
|---|---|---|---|---|
| Leopard_Trek | −4.5 | −0.5 | +56 | 0 |
| Peejee | −2.4 | −4.0 | +204 | 0 |
| Klimax | −11.0 | +0.5 | +75 | 0 |
| GoudalEnergies | +12.0 | +5.5 | +157 | 0 |
| Muskatel Muskadji | +18.0 | −3.0 | +60 | 0 |
| Las Chivas Pendejas | +17.0 | 0 | +48 | −7 (Oliveira st-1, ITT rule) |
| bigdaddy | +6.0 | 0 | +142 | 0 |

The import bug moved little XP **net**: 54 wrong ranks on 16 stages, but most
were swaps between two contracted riders on different teams, so exposure
(hundreds of XP per team, ticket 08) largely cancelled. The material change is
the jerseys.

## What was run (in order)

Everything lives in `.scratch/pcs-import-integrity/verif/`. Python 3.12 venv,
`services/pcs-sync/.venv/bin/python`. Cached PCS pages from the sweep of
2026-09-14 (`fixtures/sweep/`, `fixtures/closing/`, gitignored) served every
import; **no live scraping** during the closeout.

```bash
cd services/pcs-sync

# 0. Independent source: Wikipedia wikitext (API, deterministic parse) -> fixtures/wikipedia/
#    Pages: "2026 Vuelta a España, Stage 1 to Stage 11", "… Stage 12 to Stage 21", main article.

# 1. Triangulation Wikipedia / repaired PCS / base, before anything is written
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/wikipedia_crosscheck.py
#    -> repaired PCS vs Wikipedia 0/200 ; base vs Wikipedia 31/193

# 2. Baseline snapshot, re-import from cache, rescore, diff  (writes prod)
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/cloture_vuelta.py --write
#    -> cloture-20260914-195611-avant.json (baseline), …-rapport.json

# 3. INCIDENT (see below) : race_date repair + one-stage-per-call rescore  (writes prod)
.venv/bin/python -u ../../.scratch/pcs-import-integrity/verif/fix_dates_et_rescore.py

# 4. Proof
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/diff_cloture.py \
    ../../.scratch/pcs-import-integrity/cloture-20260914-195611-avant.json apres-dates
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/preuve_cloture.py
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/wikipedia_crosscheck.py
```

Artefacts (committed unless noted): `cloture-20260914-195611-avant.json`
(baseline), `cloture-20260914-210424-apres-dates.json` (final state),
`diff-cloture-apres-dates.json`, `preuve-cloture.md` / `.json` (per-team,
per-stage, per-rider table with rank, barème, multipliers, XP),
`wikipedia-crosscheck-2026-09-14.json`. Intermediate snapshots of the wrong
state (`…-195611-apres.json`, `…-204930-apres-par-etape.json`) are left
untracked.

## Integrity incident: PCS DOM obfuscation

PCS scrambles the DOM order of rider names on result tables and restores the
visual order in CSS. Every import before PR #74 could read wrong ranks. On the
Vuelta: 54 wrong ranks on 16 of 20 stages, 11 on the closing slugs, `youth`
broken, closing rescore never run (ticket 08).

**Why previous "0 écart" audits missed it**: `verify_tdf2026_closeout.py` and
the Tour/Vuelta audits recomputed XP *from the stored rank*. They proved the
barème was applied correctly to ranks that were wrong. Layer 1 above is the
check that was missing. It is now mandatory before any closeout.

The Wikipedia crosscheck initially reported 25 divergences. 23 were harness
bugs (pipe links `[[Name (cyclist)|Name]]` cut by the regex; spelling variants
between sources, handled by a hand-verified alias table). The last one, stage 1
ranks 6-7 (Chamberlain / Bisiaux, two Decathlon riders 1" apart, ITT), is a
**Wikipedia error**: the PCS page is not obfuscated (`data-id=""`, no
repositioning CSS), and the user validated Bisiaux 6th by hand. Recorded as
`WIKIPEDIA_KNOWN_ERRORS` in the harness.

## Incident during this closeout: one race_date for every stage

The first run of `cloture_vuelta.py` passed `race_date="2026-09-13"` (race end)
to `import_race_results` for all 20 stages. `calculate_daily_scores` derives the
role cutoff (11:00 on stage day) from `race_results.race_date`, so **every stage
was scored with the roles of 13 September**. Players change roles almost daily
(Widar: underdog 26/08, domestique 28/08, underdog 29/08, domestique 31/08,
underdog 02/09, climber 08/09), so the drift was large: −561 XP on Las Chivas,
+102 on Muskatel, 87 lines. The decomposed diff (`diff_cloture.py`, cause
column "derive") is what caught it: rank identical, multiplier changed.

Repair: restore `race_results.race_date` per stage from `stage_profiles`
(dates cross-checked with Wikipedia: stage 1 = 2026-08-22), then rescore
**one stage per call** (the engine computes a single cutoff per call — "all
slugs in one call share a date", `scoring.py`). Drift fell to 1 line.

**Rules for the next closeout**:
- one `race_date` per stage, from `stage_profiles`, never the race end date;
- one stage per `calculate_daily_scores` call; the 5 closing slugs
  (`stage-21`, `gc`, `points`, `kom`, `youth`) may share one call;
- always run the decomposed diff; a non-empty "derive" column means the rescore
  did not reproduce what was played, whatever the totals say.

## Open notes

- Two classic teams scored 0 XP on stage 1 (squad locked after the 11:00 CET
  cutoff, `teams=5` on that stage). Same cause as 2026-08-23, not an import
  issue.
- The crosscheck covers ranks 1-10 only (Wikipedia's depth). Ranks 11-20 are
  validated by the repair itself and its match with PCS's own CSS (ticket 03).
- Next: Tour 2026 and Giro 2026 **diagnosis only**, see
  `docs/handoffs/2026-09-14-integrite-import-tour-giro-handoff.md`.
