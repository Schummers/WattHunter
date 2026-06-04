# Handoff — Phase 2 corrections (vague prod juin 2026)

> Colle ce fichier (ou son contenu) comme premier message d'une nouvelle conversation pour reprendre les corrections. Tout le contexte nécessaire est ici.

---

## Mission
Reprendre la **passe de correction** de l'audit Phase 2 de la vague prod 2026-06-02→04 (Spec A scoring, Spec B underdog, Spec C bonus economy, money×1000, no-cumul, suppression remontada). L'audit « vérifier + tests » est **déjà fait**. Il reste à **corriger les bugs confirmés** et à **écrire les tests d'intégration RPC sur Supabase local**.

Travailler sur la branche existante **`test/phase2-validation-audit`** (commit de départ `f10e71a`, basé sur `d6a20e8`/main).

## À lire en premier (sources de vérité)
1. **Plan complet** : `~/.claude/plans/your-trial-has-expired-rustling-ullman.md` — sections « PHASE 2 » (plan + RÉSULTATS) = la liste triée des bugs.
2. **Mémoire** : `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/phase2_audit_2026-06-04.md` + `MEMORY.md`.
3. **Règles** : `docs/GAME_RULES.md` (§6.4 Nemesis, §7 scoring, §11 constantes, §17 cumul, sections underdog) ; `CLAUDE.md` (règles NEVER DO, workflow migrations).
4. **Tests posés** : `services/pcs-sync/tests/test_constants_drift_guard.py`, `services/pcs-sync/tests/test_pipeline_idempotence_guard.py`.

## État actuel
- Baseline : `cd services/pcs-sync && .venv/bin/python -m pytest -q` → **307 passed, 1 xfailed** (le xfail = ID-1, bug P0 tracké).
- Garde-fous anti-drift en place (parité `gt-goals.ts`↔`goal_evaluator.py`, breakaway threshold, niveaux/finals).
- **Aucun fix prod appliqué.**

---

## Bugs CONFIRMÉS à corriger (par priorité)

### 1. ID-1 — Pagination manquante (P0 à l'échelle) — *commencer par là*
`services/pcs-sync/sponsor_bonus.py` → `process_race_bonuses` fetch **sans pagination** (`.execute()` brut, cap PostgREST 1000 lignes) :
- `race_results` (l.~200, filtré par race_slugs — déborde si 21 étapes × ~176 coureurs)
- `contracts` active/notice toutes ligues (l.~299)
- `team_sponsors` toutes équipes (l.~318)
- `gt_squad` par année (l.~266)

**Fix** : réutiliser le helper `_fetch_all(query_factory, page_size=1000)` déjà présent dans `goal_evaluator.py:118` (l'extraire dans un module partagé, ex. `services/pcs-sync/db_utils.py`, et l'importer des deux côtés). Fix **Python pur, pas de migration**.
**Validation** : retirer le `xfail` de `test_sponsor_bonus_fetches_are_paginated` (il doit passer) + ajouter un test >1000 lignes.

### 2. SC-4 — Profil NULL → sprinter ×1.0 (P1 opérationnel)
`scoring.py:243` : si `profile_icon` est NULL (étape pas encore seedée), le sprinter perd son ×1.5 silencieusement.
**Fix au choix** : (a) garantir que `import_stage_profiles` (cmd `startlists`) tourne avant le scoring, OU (b) **fail-loud** : lever/logguer une erreur si une étape scorée n'a pas de `stage_profiles`. Recommandé : (b) pour le Tour.

### 3. SC-2 & SC-3 — décisions DESIGN d'abord, puis fix
- **SC-2** (`scoring.py:608` + `:680`) : `underdog_mult` est calculé hors de la boucle tactique → il **s'empile** avec Nemesis (`× nemesis_modifier × underdog_mult`). Question : un coureur en rôle *underdog* qui est aussi attaquant/cible Nemesis doit-il cumuler les deux ? (cas rare).
- **SC-3** (`scoring.py:672`) : `nemesis_modifier = min(nemesis_modifier, nem_mod)` est inconditionnel → si 2+ Nemesis ennemis ciblent le même coureur la même étape, un attaquant gagnant (0.5) écrase un `target_won` (1.25). Le commentaire dit « si TOUS ont gagné » mais le code ne le vérifie pas. (cas très rare). Voir `tactics.py:69 compute_nemesis_modifier` pour la table d'outcomes.
- Une fois la sémantique tranchée → fix + tests d'intégration (nécessite d'étendre le mock `_base_mocks` de `test_scoring_gt.py` avec `pcs_rank` + activations tactiques).

### 4. RPC-1 + dettes (P2, regrouper)
- **RPC-1** : `gt_assign_role` demote legacy phase_id insère sans `race_slug` → migration `20260605000100` l.288 (vs l.270 qui l'inclut). Fix = nouvelle migration corrective. Impact faible.
- **SC-6** (`scoring.py:470` vs `:480`) cutoff `>` vs `<=` : harmoniser ou documenter.
- **SC-5** : cols `role_mult`/`gt_role_mult` dupliquées = backward-compat → décider de dropper `role_mult` ou documenter.
- **CO-1** : `docs/GAME_RULES.md §9` dit nationalité « ×1.25 » (périmé), code = 1.20 → corriger la doc.

### INFIRMÉ (ne pas toucher)
- **SC-1** : le rôle `underdog` EST écrit par `gt_assign_role` v2 et lu au scoring (`scoring.py:603`). Faux positif.

---

## Tests d'intégration RPC à écrire (sur Supabase LOCAL)
Cibles (migrations `20260603000100`, `2026060400*`, `2026060500*`, `20260602110100`) :
- Rejets validation : increment `%1000` (place_bid/gt_place_emergency_bid), `tactic_type`/`role` invalides, bornes bid.
- Autorisation : cross-team / cross-league refusée (Nemesis, squad).
- Cap squad **par race_slug** : 10 sur Giro + 8 sur Tour OK ; cap underdog 10 borné roster ; cap rôle underdog = 2.
- Discount underdog : `floor(locked_salary*0.5/1000)*1000`, appliqué seulement si `underdog_discount AND underdog_eligible`, **réversible** (plein tarif quand l'équipe remonte).
- Cohérence demote `race_slug` (RPC-1), lookup XP hybride race/phase (RPC-2, `place_tactic` v3/v4 `...000200:173-206`).

Approche : pytest d'intégration qui exécute du SQL contre la DB locale (ou pgTAP). Patron de mock unitaire existant : `services/pcs-sync/tests/helpers.py` (`make_supabase`).

## Setup Supabase local (Colima est installé, juste arrêté)
```bash
# 1) Démarrer le runtime Docker (Colima installé via brew, VM à (re)lancer)
colima start --cpu 4 --memory 6
# Si la VM est cassée : colima delete && colima start --cpu 4 --memory 6

# 2) Démarrer Supabase local (exclusions obligatoires — incompat Colima)
cd /Users/jonathanschummers/Documents/WattHunter
supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit

# 3) Rejouer toutes les migrations from scratch (vérifie qu'elles sont rejouables)
supabase db reset

# 4) Accès DB (pas de psql natif)
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres
# Connection string : postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Arrêt en fin de session
supabase stop && colima stop
```
Un `supabase db reset` qui passe = bonne nouvelle de bonus (valide aussi que les 28 migrations de la vague sont cohérentes localement, dont les `_rollback/*.down.sql`).

## Règles de travail (CLAUDE.md)
- **Rule #2** : toute modif schéma/data = **migration** (`supabase/migrations/<ts>_<desc>.sql` + `_rollback/<ts>_<desc>.down.sql`), jamais de SQL direct.
- Pattern server action : Zod → `supabase.rpc(...)` → error forwarding. Pas de logique métier en TS.
- **NEVER** : exposer service_role au client, bypass RLS, muter treasury hors helpers, autoriser enchère si treasury < engagements, enchère sur rider releasé < 7j.
- Commits conventionnels (`fix:`, `test:`…), finir par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Demander confirmation avant tout push prod / migration sur la base distante** (jeu live, données joueurs réelles). Travailler/tester en local d'abord.

## Vérification (definition of done par fix)
- `cd services/pcs-sync && .venv/bin/python -m pytest -q` (utiliser `.venv/bin/python`, jamais `python3` système).
- `pnpm test` (vitest `apps/web`) si TS touché.
- Tests RPC : `supabase db reset` puis pytest d'intégration ciblé.
- Chaque bug confirmé → un test qui échouait passe (ou xfail retiré).

## Ordre recommandé
1. ID-1 (Python pur, gros gain) → retirer le xfail.
2. Setup Colima/Supabase local + `db reset` (débloque les tests RPC).
3. SC-4 (fail-loud profil).
4. Tests d'intégration RPC (discount underdog, caps, validation, autorisation).
5. Décisions design SC-2/SC-3 avec le user → fix + tests.
6. RPC-1 + dettes P2 + doc §9.
