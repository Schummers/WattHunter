# Audit 2026-06-11 — Investigation + Fix Log

> Branche : `fix/audit-2026-06-11-p0` (basée sur `main` à jour avec origin).
> Aucun push prod. Migrations créées mais **non appliquées** (à valider via `supabase db reset` local).
> Scope : les P0 (sécurité + intégrité données). Les P1/P2 cosmétiques (DS tokens, perf N+1, archi server-action) ne sont pas traités ici.

## Méthode

Chaque finding P0 a été vérifié en lisant le code réel (pas le résumé du rapport). Verdict en 3 catégories : **FIXÉ**, **FAUX POSITIF**, **RÉEL mais DIFFÉRÉ** (avec raison).

---

## ✅ FIXÉ (vérifié réel + corrigé + tests verts)

### Sécurité RLS — migration `20260612000000_audit_p0_rls_hardening.sql`
Une seule migration, 5 trous d'escalade de privilège confirmés. Chaque write fermé passe déjà par un RPC SECURITY DEFINER ou le pipeline service-role → zéro changement de comportement légitime. Chaque table garde une policy SELECT indépendante (lectures intactes).

| Finding | Trou | Fix |
|---|---|---|
| D1-RLS-02 / D1-01 | `grant_xp` : pas de `REVOKE FROM PUBLIC` → tout authenticated s'attribue du XP illimité (le `GRANT TO service_role` est additif, PUBLIC garde EXECUTE par défaut Postgres) | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` (service_role/supabase_admin + owner intacts → callers internes OK) |
| D1-RLS-03 / BR-D1-03 | `teams.underdog_eligible` absent du trigger `block_team_field_updates` → self-grant remise −50 % + squad 10 | Ajout de `underdog_eligible` à la liste protégée (CREATE OR REPLACE) |
| D1-RLS-01 / BR-D1-04 | `contracts_update_own` : UPDATE sans restriction de colonne → owner réécrit salary/status/bid_amount, bypass auction/release | DROP policy (release = RPC `release_rider`, aucune écriture contracts anon dans l'app) |
| D1-01 | `auction_bids_insert_own` jamais droppée → INSERT direct bypass `place_bid` (solvabilité, cooldown 7j, gating niveau, incrément) | DROP policy (app insère via `place_bid` ; la policy UPDATE séparée de `cancelBid` est conservée) |
| D1-02 / BR-D1-02 | `gt_squad` + `gt_role_assignments` `FOR ALL TO authenticated` → écriture directe bypass `gt_add_to_squad`/`gt_assign_role` (cap 8/10, cap rôle, éligibilité underdog, cutoff 11:00 CET) | DROP des 2 policies d'écriture (policies SELECT "readable by league members" conservées) |

Rollback : `_rollback/20260612000000_audit_p0_rls_hardening.down.sql`.

### Intégrité données — pagination PostgREST 1000-row (le bug #1 historique)
La famille de bugs qui a coûté +400k€ (double crédits) et le bonus ITT manqué. `db_utils._fetch_all` existait mais n'était pas systématiquement utilisé.

| Finding | Fichier | Fix |
|---|---|---|
| PERF-01, B1-01, DATA-02, SCORING-PAGINATION-1, PERF-04/05/06, TD-01/02 | `scoring.py` | Import `_fetch_all` + **9 fetches GT-wide** paginés (race_results, rider_xp_daily prev, contracts, team_strategies, gt_squad, gt_role_assignments, gt_daily_classifications, gt_final_classifications, gt_tactic_activations) |
| PERF-12, TD-01, ARCH-B5-01, PERF-01 (B5) | `sync_race.py` | Import `_fetch_all` + **7 fetches `riders`** paginés (la table riders peut dépasser 1000 sur plusieurs saisons → map pcs_slug→id silencieusement tronquée) |
| B2-03 / TD-01 (B2) | `goal_evaluator.py` | `team_sponsors` fetch paginé |

### Intégrité données — fenêtre temporelle squad
| Finding | Fichier | Fix |
|---|---|---|
| B2-01 (P1) | `goal_evaluator.py:594` | Suppression du seed `date.today()` pour `all_squad_riders`. En run rétroactif (`evaluate-goals` lancé J+N), le cutoff "aujourd'hui" admettait des riders ajoutés au squad APRÈS la course (même famille de bug que le fix Dixon Hormous sur `sponsor_bonus.py`). L'union des cutoffs par-stage est désormais la seule source de membership. |

**Vérification** : `pytest tests/` → **323 passed, 11 skipped** (avant et après). Aucun test cassé.

---

## ❌ FAUX POSITIFS (vérifiés non-exploitables — effort économisé)

| Finding | Verdict |
|---|---|
| TD-003 — `confirmPhaseSetup` IDOR (teamId du caller, "pas de check ownership") | **FAUX**. Le rapport regarde l'action TS, pas le RPC. `confirm_phase_setup` (migration `20260605000300`, ligne 34) fait `WHERE id = p_team_id AND user_id = v_user_id` quand `auth.uid()` est non-null. Ownership vérifié côté RPC. |
| TD-004 / SEC-F6-1 — `forceResolveRound` callable par tout membre, pas seulement commissioner | **BY DESIGN**. ADR-017 documente explicitement que n'importe quel joueur peut force-resolve via Status tab (fallback manuel voulu, pas de dépendance commissioner). |

---

## ⏳ RÉEL mais DIFFÉRÉ (vérifiés réels — nécessitent nouveaux RPC + validation DB live)

Ces items sont réels mais demandent de nouveaux RPC SECURITY DEFINER (crédit trésorerie atomique relatif) et/ou réécriture de tests positionnels lourds, **non validables sans Postgres live**. Rusher une RPC qui touche l'argent sans validation DB introduirait un risque pire que le bug latent. À traiter dans une passe dédiée avec `supabase db reset` local.

| Finding | Réalité confirmée | Pourquoi différé |
|---|---|---|
| B2-01/B2-02 — `goal_evaluator.py` payout non atomique : completion insérée AVANT crédit → échec transitoire entre les deux = argent perdu (skip au rerun) | Réel (échec single, pas que concurrence) | **Le double-crédit au rerun (l'incident +400k) est DÉJÀ couvert** par le check d'idempotence + test E2E `test_run1_credits_treasury_exactly_once`. Le gap restant = fenêtre partielle étroite. Fix propre = RPC `credit_goal_reward` (INSERT completion `ON CONFLICT DO NOTHING` + crédit relatif, atomique) modelé sur `credit_sponsor_bonuses` + réécriture ~200 lignes de test positionnel. |
| B4-DATA-02 / B4-01 / TD-B4-01 — `resolve_gt_rescue.py:102-111` read-modify-write trésorerie (TOCTOU) | Réel | Pipeline lancé manuellement single-thread → concurrence improbable en pratique. Fix = RPC crédit relatif atomique. |
| DATA-2/4, B2-06 — read-modify-write trésorerie dans `goal_evaluator` / `sponsor_bonus.py` revert | Réel | Même famille ; route via RPC relatif (`credit_sponsor_bonuses` existe comme modèle). |
| B3-AUC-01/02, TD-B3-06 — `auction.py` création contrat non atomique / non crash-safe | Réel | Resolution multi-tables sans transaction. Fix = déplacer winner-mark + contract-insert + rider-activate dans un RPC. |
| BR-D1-01 / D1-04 — `team_sponsors` `FOR ALL` : bypass du gating `unlock_level` | Réel (mais scopé own-team, pas IDOR cross-team comme le dit BR-D1-01) | L'app écrit `team_sponsors` directement en 4 sites (callback, join, saveSponsor, league-creation). Fermer la policy casse l'app → il faut d'abord un RPC `set_team_sponsor` qui porte le gating. |
| SEC-LOBBY-1 / F6-02 — `teams_insert_own` : level/treasury/cumulative_xp client-controlled à l'INSERT (le trigger ne couvre que UPDATE) | Réel | Création de ligue légitime fixe level=starting_level (1-8) → un guard INSERT ne peut pas forcer level=1. Fix = RPC `create_league_with_team` SECURITY DEFINER. |

### Autre item réel non-sécurité, différé (changement de sémantique de scoring)
| B1-01 / TD-B1-01 / DATA-03 — `scoring.py` "Call the Bus" dead code : le gate `if not in_squad: continue` éjecte les bench riders avant l'application de la tactique | Réel (la tactique n'award rien) | C'est un changement de **comportement de scoring** (les bench riders se mettraient à scorer), pas un trou de sécurité. Demande validation game-design + couverture de test dédiée avant de modifier la sémantique. |
