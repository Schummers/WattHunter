# Giro 2026 Cutover — Post-Mortem & Decisions

**Date:** 2026-06-03
**Scope:** Sync Giro stage 21 + final classifications (GC / points / KOM / youth), apply Spec C bonus economy, reconcile retroactive Spec C rules for fair-play, document new design rules.

## 1. Why this cutover existed
- Spec A scoring refonte (`a3809d0`) shipped to prod earlier; Giro stages 1–20 had been scored under the old XP rules (forward-only policy).
- Spec C bonus economy (PR #48, branch `feature/spec-c-bonus-economy`, merge `f0228c2`) merged to `main` but its two DB migrations (`20260603120000_sponsors_two_value_bareme`, `20260603130000_goal_completions_goal_key`) were intentionally held back so the Giro could be closed on the OLD barème — see `docs/archive/2026-06-03-giro-cutover-EXECUTED.md`.
- Stage 21 + the 4 finals (`/gc`, `/points`, `/kom`, `/youth`) had not been synced yet when the cutover started.

## 2. Operational constraint encountered
- procyclingstats Cloudflare protection blocked nodriver + playwright sync from the residential IP (HTTP 403 + JS challenge). Fallback was **manual ingestion from user-provided PCS screenshots**, validated row-by-row against scoring previews before any write.
- Backlog: re-diagnose CF bypass before the Tour de France sync.

## 3. Execution flow (what actually ran)

| # | Phase | Branch | Operations |
|---|---|---|---|
| 0 | Baseline snapshot | main | Read-only audit → `docs/runbooks/giro-cutover-baseline-2026-06-03.md` |
| 1 | Phase A: stage 21 | `ac29307` (pre-Spec-C) | Inject `race_results` (8 rows) → OLD `calculate_daily_scores`/`process_race_bonuses`/`evaluate_gt_goals`. Credited Milan win + Lonardi stage bonus + Peejee "Win a stage" 62.5k + (surprise) Peejee `two_riders_win_stage` 75k. |
| 1.1 | Revert | main | Manually reverted Peejee `two_riders_win_stage` 75k — Spec C deprecates this goal (replaced by role-strict `sh_win_stage` / `sh_win_2_stages`); the OLD legacy `role: None` logic that triggered it is the bug Spec C fixes. |
| 2 | Spec C migrations | main | `supabase db push --linked --include-all` → applied `20260603120000` + `20260603130000`. |
| 3 | Phase B: finals | main | Inject `race_results` (`/gc` 44 rows) + `gt_final_classifications` (10 points / 7 kom / 9 youth). Run NEW `calculate_daily_scores` / `process_race_bonuses` / `evaluate_sponsor_goals`. Credited 4 new goals (gc_podium x2, gc_top5, sh_kom_jersey) + 18 sponsor /gc bonuses. |
| 3.1 | Compensations | main | Manual fair-play credits for **new Spec C rules retroactively applied**: Dixon (Ciccone KOM final XP 80→160 + new `sh_kom_classification` goal 40k) and TheAussieMate (Eulálio Youth final XP 80→120). See §5 below. |
| 3.2 | No-cumul revert | main | Reverted 3 GC base bonuses where the same rider also triggered a one-time GC goal — see §4 below. |

All mutations traced in `treasury_log` (`sponsor_bonus`, `gt_goal_bonus`, `sponsor_bonus_revert`).

## 4. Decision: no-cumul rule for GC placements

Discovered during reconciliation that the live `process_race_bonuses` credits a GC base bonus (top 10) **on top of** the `gc_podium` / `gc_top5` one-time goal for the same rider. Surfaced as "Arensman #4 = 60k = 20k top10 + 40k gc_top5", which the user expected to be 40k (goal only).

**Decision (user-validated):**
- **GC** (top10 base + gc_podium / gc_top5 / gc_top10 one-time goals): **no cumul**. If the rider triggers a one-time GC goal, the base bonus on `/gc` is neutralized.
- **Stage wins** (stage base + sprint_win_stage / sh_win_stage): **cumul preserved for this cutover** to stay consistent with historical credits (Narváez s4, Ballerini s6, Ganna s10, Milan s21). Will be aligned to the no-cumul rule in `process_race_bonuses` **before the Tour de France 2026**.

Applied: reverted 3 GC base bonuses (Klimax/Gall 20k, Leopard/Hindley 20k, TheAussieMate/Arensman 20k), with `treasury_log` audit (`type=sponsor_bonus_revert`). Documented in `GAME_RULES.md §17 → Cumul rule`.

## 5. Decision: fair-play retroactive compensation for new Spec C rules

Spec C introduced two evaluators that didn't exist when Giro squads were locked: `sh_kom_classification` and the final-secondary scoring multipliers (`points → sprinter ×2`, `kom → climber ×2`, `youth → gc_leader ×1.5`). Teams couldn't have assigned roles to optimize for them. To avoid penalizing players retroactively:

- **Dixon Hormous (Ciccone gc_leader, #1 KOM final):**
  - `rider_xp_daily` for `/kom` updated: 80 → 160 XP (simulating Ciccone as climber, ×2.0 role match).
  - Inserted `sh_kom_classification` goal completion (20k base × 2 GT = 40 000 €) with audit description.
- **TheAussieMate (Eulálio domestique, #1 Youth final):**
  - `rider_xp_daily` for `/youth` updated: 80 → 120 XP (simulating Eulálio as gc_leader, ×1.5 role match).

These are **one-shot exceptions** documented for posterity. Future GTs (Tour 2026, Vuelta 2026) will apply Spec C rules strictly with no retro compensation — players will know the rules before the squad lock.

## 6. Decision: NOT compensating Arrieta stage 5 win (out-of-squad)

Igor Arrieta won Giro stage 5 (May 13) while temporarily released from Peejee's squad (released May 10, re-added May 15). Per the temporal squad cutoff rule (11:00 CET on race day, hardened in commit `70c27fa`), he earned 0 XP for that stage. The user explicitly declined to make an exception, preserving the rule. Documented to avoid future ambiguity.

## 7. Final state (REAL league)

| Rank | Team | Cumulative XP | Treasury | Δtreasury cutover |
|:-:|---|:-:|:-:|:-:|
| 1 | Klimax | 2643.16 | 295 500 € | +100 000 € |
| 2 | Leopard_Trek | 2590.09 | 343 150 € | +60 000 € |
| 3 | TheAussieMate | 2102.61 | 147 050 € | +80 000 € |
| 4 | GoudalEnergies | 1814.84 | 100 050 € | +60 000 € |
| 5 | Dixon Hormous | 1655.63 | 200 000 € | +40 000 € |
| 6 | Peejee | 1562.05 | 174 500 € | +107 500 € |
| 7 | Muscat Romain | 1112.88 | 139 900 € | 0 |
| 8 | bigdaddy | 983.26 | 203 000 € | 0 |

Total redistributed: **+447 500 €** and ~4 100 XP across 8 teams.

## 8. Backlog (post-cutover)

| Item | Severity | Notes |
|---|---|---|
| `process_race_bonuses`: extend no-cumul rule to sprint/stage_hunter goals | **Required before Tour 2026** | Logic: skip base bonus emission when the rider triggers a same-race one-time `sprint_win_stage` / `sh_win_stage` / `sprint_win_2_stages` / `sh_win_2_stages` goal. |
| T6 (UAE) sponsor base bonus alignment | Medium | Migration `20260603120000` deliberately deferred T6. UAE should mirror T4 (same base bonus + same goal sets). Create a new migration. |
| Sponsor card front-end wireframe | Medium | UI cards don't match the original wireframe — amounts not displayed as designed. Front audit. |
| `profile_icon` backfill on Giro stages 4/8/11 (and earlier) | Low | NULL profile_icon breaks Spec C sprinter gating (`win_stage` / `win_2_stages` require `profile_icon ∈ {p1,p2,p3}`). Re-run `import_stage_profiles` once Cloudflare is unblocked. Not bugged retroactively (Giro already closed). |
| Cloudflare PCS scrape | Required before Tour 2026 | nodriver fails to start; playwright + visible mode + 90s warm-up still gets CF JS challenge. Diagnose before next sync session. |

## 9. Audit trail
- Live `treasury_log` entries with `description` referencing this cutover.
- `sponsor_goal_completions` entries with explicit `goal_key` (Spec C invariant).
- Baseline snapshot: `docs/runbooks/giro-cutover-baseline-2026-06-03.md`.
- Original (pre-execution) runbook: `docs/archive/2026-06-03-giro-cutover-EXECUTED.md`.
