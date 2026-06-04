# Handoff — Audit de cohérence DOC ↔ CODE (post-vague juin 2026)

> Colle ce fichier (ou son contenu) comme premier message d'une nouvelle conversation. But : vérifier que TOUTE la documentation du jeu reflète fidèlement le code après la vague Spec A/B/C + money×1000 + no-cumul + suppression remontada.

---

## Mission
Auditer la cohérence entre la **documentation du jeu** et l'**implémentation réelle** après la vague prod 2026-06-02→04. Produire un **tableau dérive doc↔code**, puis corriger la doc (commit `docs:` — CLAUDE.md Rule #4). Bonus : ajouter un **test automatisé** qui transforme les constantes documentées en artefact vérifié.

Ce n'est PAS un audit de code (déjà fait, voir `docs/handoffs/2026-06-04-phase2-correction-handoff.md`). Ici on vérifie que ce qui est ÉCRIT correspond à ce qui est CODÉ.

## Documentation à auditer (3 surfaces)
1. **`docs/GAME_RULES.md`** — la doc canonique des règles. Source de vérité « papier ».
2. **`docs/ARCHITECTURE.md`** — tables, RPCs, composants, flux pipeline.
3. **In-app player-facing** : `apps/web/components/scoring-doc-card.tsx` (carte « How scoring works », ~229 l.) — c'est de la doc que le joueur LIT dans l'app, elle doit matcher §7. Vérifier aussi les libellés de `apps/web/components/sponsor-bonus-card.tsx` et `gt-goals-preview.tsx`.

## Méthode
Pour chaque section de `GAME_RULES.md`, extraire chaque **affirmation chiffrée ou conditionnelle** et la confronter à son code/migration. Ancres :

| Règle (GAME_RULES) | À confronter à | Points à vérifier |
|---|---|---|
| §4.4 Salary Formula | `scoring.py` / migrations | formule pts_PCS×2000/12, arrondi millier inférieur |
| §4 / §5 Auctions | migration `place_bid` (`20260602110100`) | increment 1000€, cooldown 7j, treasury ≥ engagements |
| §7 Daily XP + multiplicateurs | `scoring.py` (`_role_multiplier`, `_classif_bonus`, finals) | daily ×2 rôle matché, youth ×1.5, GC final ×1.0, stage_hunter échappée ≥30km +1/10km, sprinter p1/p2/p3, tt ITT ×2 |
| §7 Level progression | `scoring.py:LEVEL_THRESHOLDS` | L7=2600, L8=5000, no-regression |
| §7 In-app scoring doc (A8) | `scoring-doc-card.tsx` | la carte joueur dit-elle EXACTEMENT les mêmes règles ? |
| §9 Sponsors / barème | `sponsor_bonus.py`, migration `20260603120000` | **nationalité 1.20 (pas 1.25 — DÉRIVE CONNUE §9)**, barème 2-valeurs, ×2 GT/Monument, T4/T5 |
| §11 Game Constants | partout (code + migrations) | tableau récap : chaque constante = valeur réelle ? |
| §11 Tactic gating profiles (A7) | migration `place_tactic` v4 (`20260604010100`) | Nemesis Sprint p1-p3, Nemesis GC p3-p5, ITT/TTT bloqués |
| §11 Final secondary scale | `scoring.py:FINAL_SECONDARY_SCALE` | 80/20/10 (GT), 40/10/5 (1-week) |
| §12.1 Co-Unlock | `apps/web/lib/co-unlock.ts` + RPC place_bid | seuil dynamique max(2, ceil(0.30×n)) |
| §12.2 Level Curve Stretch | scoring.py | cohérent avec §7 |
| §13 Tactics + usage per race (A9) | migration `tactic_usage_limits` (`20260604000100`) | Unleash 2/1, Overdrive 2/1, Call the Bus 3/2, Nemesis 1/1 (GT/1-week) |
| §14 Underdog | migrations `20260605000*`, `scoring.py:_underdog_multiplier` | seuil 75%, rank>100, clamp(rank/100,1,4), −50% floor(/1000)×1000, cap rôle 2, squad 8→10 |
| §18 Cumul rule (no-cumul) | `goal_evaluator.py` + `sponsor_bonus.py` + migration `neutralized_stage_slugs` | la règle décrite = le comportement codé ? |

## Dérives DÉJÀ repérées (à corriger d'office)
1. **§9 nationalité « ×1.25 »** → code = **1.20** (Spec C 2026-06-03). Corriger §9, garder §11 qui est juste.
2. **Référence « §17 » pour le no-cumul** dans le code (commentaires), `ARCHITECTURE.md`, `MEMORY.md`, `CLAUDE.md` → la règle est en réalité en **§18** (§17 = GT Rescue). Soit re-numéroter, soit corriger toutes les références. Trancher avec le user.
3. Vérifier que **remontada** n'apparaît plus comme mécanique active dans `GAME_RULES.md` (doit être absent ou marqué supprimé) et que `§12 Anti-Runaway` ne liste que Co-Unlock + Level Curve Stretch (Remontada supprimé 2026-06-02).
4. Vérifier que `CLAUDE.md` « Features livrées » et les « anti-intuitions » §Constantes sont à jour (increment 1000€, salaire pas de plafond, etc.).

## Garde-fous code↔code déjà en place (à NE PAS refaire)
`services/pcs-sync/tests/test_constants_drift_guard.py` couvre déjà : parité goals TS↔Python, breakaway threshold, LEVEL_THRESHOLDS, FINAL_SECONDARY_SCALE, SPRINT_PROFILES. **Manque le doc↔code.**

## Livrable
1. **Tableau dérive doc↔code** : pour chaque ligne ci-dessus → ✅ aligné / ⚠️ dérive (doc=X, code=Y) / ❓ ambigu.
2. **Corrections doc** : commit `docs:` mettant `GAME_RULES.md` (+ ARCHITECTURE/CLAUDE/MEMORY si réf) en accord avec le code. (Si une vraie *règle* du jeu est fausse côté CODE, NE PAS la coder en douce : la signaler au user — c'est peut-être un bug, pas une dérive doc.)
3. **Test garde-fou doc** (recommandé) : un pytest qui parse le tableau `GAME_RULES.md §11 — Game Constants` et compare aux constantes réelles (`scoring.py`, `co-unlock.ts`, migrations). Modèle existant : `services/pcs-sync/tests/test_demo_constants_sync.py` (parse un fichier source par regex et compare). Ça transforme la doc en artefact testé → plus de dérive silencieuse.
4. **Cohérence carte in-app** : si `scoring-doc-card.tsx` diverge de §7, corriger le composant (respecter le design system — CLAUDE.md Rule #1).

## Contexte / règles de travail
- Branche : créer `docs/consistency-audit` (ou continuer sur `test/phase2-validation-audit` si le user préfère tout regrouper).
- Vérifs : `cd services/pcs-sync && .venv/bin/python -m pytest -q` (utiliser `.venv/bin/python`) ; `pnpm test` si TS.
- À lire d'abord : `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md`, `~/.claude/plans/your-trial-has-expired-rustling-ullman.md` (inventaire de la vague), mémoire `phase2_audit_2026-06-04.md`.
- CLAUDE.md Rule #4 : mettre à jour les living docs dans la même session. Commits conventionnels (`docs:`), finir par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Distinguer** : dérive DOC (la doc est fausse, le code est la vérité → corriger la doc) vs bug CODE (le code contredit une règle voulue → signaler au user, ne pas « corriger » la règle en cachette).
