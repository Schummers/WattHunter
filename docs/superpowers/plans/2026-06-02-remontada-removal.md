# Remontada Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer définitivement le Remontada Boost (mort depuis 2026-05-21) du code, de la DB et des tests, en relocalisant les 2 helpers de parsing de slug.

**Architecture:** Suppression en une passe : helpers relocalisés → backend Python nettoyé → migration DROP → frontend nettoyé → types régénérés → docs. Ordre choisi pour éviter le chicken-and-egg des types générés (regen après push prod).

**Tech Stack:** Python 3.12 (pcs-sync, pytest), Next.js 16 / TypeScript (apps/web, vitest), Supabase Postgres migrations.

**Spec:** `docs/superpowers/specs/2026-06-02-remontada-removal-design.md`

**Contexte baseline (à connaître) :** Avant ce chantier, `pytest` montre **12 reds** : 5 `test_remontada` + 7 `test_scoring_gt`. Les 7 `test_scoring_gt` rouges sont causés par l'appel remontada dans `scoring.py` (mock `MagicMock` reçu par `get_active_multiplier` à cause de positions de mock dérivées). Ce chantier les rend verts. Objectif final : `pytest` + `pnpm test` + `pnpm typecheck` + `pnpm lint` **100% verts**.

---

## File Structure

**Créés :**
- `services/pcs-sync/gt_slug.py` — 2 helpers de parsing de slug GT (pures fonctions).
- `services/pcs-sync/tests/test_gt_slug.py` — test unitaire des helpers.
- `supabase/migrations/20260602110000_drop_remontada.sql` — DROP tables + colonne.
- `supabase/migrations/_rollback/20260602110000_drop_remontada.down.sql` — recréation best-effort.

**Supprimés :**
- `services/pcs-sync/remontada.py`
- `services/pcs-sync/scripts/disable_remontada_cleanup.py`
- `services/pcs-sync/tests/test_remontada.py`
- `services/pcs-sync/tests/test_remontada_integration.py`
- `apps/web/lib/remontada.ts`
- `apps/web/components/remontada-boost-banner.tsx`
- `apps/web/components/race-feed-remontada-card.tsx`
- `apps/web/components/__tests__/race-feed-remontada-card.test.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx`

**Modifiés :**
- `services/pcs-sync/scoring.py`, `tactics.py`, `refresh_demo_league.py`
- `services/pcs-sync/tests/test_scoring.py`, `tests/test_scoring_gt.py`
- `apps/web/lib/race-feed-types.ts`, `get-race-feed-data.ts`, `gt-phases.ts`
- `apps/web/components/race-feed.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`
- `apps/web/lib/__tests__/get-race-feed-data.test.ts`
- `apps/web/lib/database.types.ts`, `apps/web/lib/supabase/database.types.ts` (régénérés)
- `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`, MEMORY files

---

## Task 1: Relocaliser les helpers dans `gt_slug.py` (TDD)

**Files:**
- Create: `services/pcs-sync/gt_slug.py`
- Test: `services/pcs-sync/tests/test_gt_slug.py`

- [ ] **Step 1: Écrire le test**

`services/pcs-sync/tests/test_gt_slug.py` :
```python
from gt_slug import get_gt_identifier, get_stage_number


def test_get_gt_identifier_matches_three_grand_tours():
    assert get_gt_identifier("race/giro-d-italia/2026/stage-5") == "giro-d-italia"
    assert get_gt_identifier("race/tour-de-france/2026/stage-1") == "tour-de-france"
    assert get_gt_identifier("race/vuelta-a-espana/2026/gc") == "vuelta-a-espana"


def test_get_gt_identifier_returns_none_for_non_gt():
    assert get_gt_identifier("race/paris-nice/2026/stage-3") is None
    assert get_gt_identifier("") is None


def test_get_stage_number_parses_stage():
    assert get_stage_number("race/giro-d-italia/2026/stage-5") == 5
    assert get_stage_number("race/giro-d-italia/2026/stage-21") == 21


def test_get_stage_number_none_for_gc_or_empty():
    assert get_stage_number("race/giro-d-italia/2026/gc") is None
    assert get_stage_number("") is None
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_gt_slug.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'gt_slug'`

- [ ] **Step 3: Créer le module (copie verbatim depuis remontada.py:1-26)**

`services/pcs-sync/gt_slug.py` :
```python
"""GT race-slug parsing helpers (relocated from remontada.py, which is being removed).

Pure functions: extract the Grand Tour identifier and stage number from a PCS race slug.
Used by scoring.py / P2 scoring refactor."""
from __future__ import annotations
import re
from typing import Optional

GT_SLUGS = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")

_GT_PATTERN = re.compile(r"^race/(giro-d-italia|tour-de-france|vuelta-a-espana)/")
_STAGE_PATTERN = re.compile(r"/stage-(\d+)(?:/|$)")


def get_gt_identifier(race_slug: str) -> Optional[str]:
    """Return 'giro-d-italia' | 'tour-de-france' | 'vuelta-a-espana' or None."""
    if not race_slug:
        return None
    m = _GT_PATTERN.match(race_slug)
    return m.group(1) if m else None


def get_stage_number(race_slug: str) -> Optional[int]:
    """Return the integer stage number from a slug like '.../stage-5'. None for /gc or prologues."""
    if not race_slug:
        return None
    m = _STAGE_PATTERN.search(race_slug)
    return int(m.group(1)) if m else None
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_gt_slug.py -q`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/gt_slug.py services/pcs-sync/tests/test_gt_slug.py
git commit -m "feat(pcs-sync): add gt_slug helpers relocated from remontada"
```

---

## Task 2: Nettoyer `scoring.py` (retrait remontada)

**Files:**
- Modify: `services/pcs-sync/scoring.py`

- [ ] **Step 1: Supprimer l'import remontada**

Retirer le bloc (scoring.py l.18-24) :
```python
from remontada import (
    get_gt_identifier,
    get_stage_number,
    get_active_multiplier,
    detect_overtakes,
    record_overtake,
)
```
→ supprimer entièrement (aucun remplacement — ces symboles ne sont plus utilisés après ce task).

- [ ] **Step 2: Supprimer le bloc `remontada_stage_in_run`**

Retirer (l.417-428), depuis le commentaire `# --- Remontada: identify GT stages...` jusqu'à la fin de la boucle `for slug in (race_slugs or []):` incluse :
```python
    # --- Remontada: identify GT stages in this run (used later for overtake attribution) ---
    # Map: gt_identifier -> max stage number seen in this batch (used as trigger stage).
    # We use MAX because if two GT stages are scored in one call (unusual), the later one
    # reflects the cumulative state after this run.
    remontada_stage_in_run: dict[str, int] = {}
    for slug in (race_slugs or []):
        gt_id = get_gt_identifier(slug)
        stage_no = get_stage_number(slug)
        if gt_id and stage_no is not None:
            remontada_stage_in_run[gt_id] = max(
                remontada_stage_in_run.get(gt_id, 0), stage_no
            )
```

- [ ] **Step 3: Main loop — retirer les assignations gt_id/stage_no + le bloc multiplier**

Dans la boucle principale, retirer les 2 lignes (l.481-482) :
```python
                gt_id = get_gt_identifier(race_slug)
                stage_no = get_stage_number(race_slug)
```
Puis retirer le bloc Remontada (l.547-555) :
```python
                # Remontada Boost (Mech 1): 2x when active for this team at this GT stage.
                remontada_mult = 1.0
                if gt_id and stage_no is not None:
                    remontada_mult = get_active_multiplier(
                        supabase,
                        team_id=team_id,
                        gt_identifier=gt_id,
                        stage_number=stage_no,
                    )
```

- [ ] **Step 4: Main loop — retirer remontada_mult de la formule XP**

Remplacer (l.557-564) :
```python
                xp = max(
                    0,
                    round(
                        (raw_points * gt_role_mult * (1 + bonus) + gt_classif_bonus)
                        * remontada_mult * nemesis_modifier,
                        2,
                    ),
                )
```
par :
```python
                xp = max(
                    0,
                    round(
                        (raw_points * gt_role_mult * (1 + bonus) + gt_classif_bonus)
                        * nemesis_modifier,
                        2,
                    ),
                )
```

- [ ] **Step 5: Main loop — retirer la clé `"remontada_mult"` du payload upsert**

Supprimer la ligne (l.577) `"remontada_mult": remontada_mult,` du `supabase.table("rider_xp_daily").upsert({...})`.

- [ ] **Step 6: Second pass (classif-only) — retirer le bloc multiplier**

Retirer (l.613-622) :
```python
                c_gt_id = get_gt_identifier(c_race_slug)
                c_stage_no = get_stage_number(c_race_slug)
                c_remontada = 1.0
                if c_gt_id and c_stage_no is not None:
                    c_remontada = get_active_multiplier(
                        supabase,
                        team_id=team_id,
                        gt_identifier=c_gt_id,
                        stage_number=c_stage_no,
                    )
```
Remplacer (l.624) :
```python
                c_xp = max(0, round(c_classif_bonus * c_remontada, 2))
```
par :
```python
                c_xp = max(0, round(c_classif_bonus, 2))
```
Et supprimer la clé (l.637) `"remontada_mult": c_remontada,` du payload upsert second-pass.

- [ ] **Step 7: Retirer le bloc de détection d'overtakes**

Retirer (l.723-749) le bloc `# 5c. Remontada: ...` :
```python
            # 5c. Remontada: if this run touched a GT, compare last snapshot to now and trigger.
            # Skip during retroactive rescores (skip_overtake_detection=True) to avoid phantom triggers.
            if remontada_stage_in_run and not skip_overtake_detection:
                team_ids = [r["id"] for r in league_rows]
                prev_date = _latest_snapshot_date_before(supabase, team_ids, today)
                pre_rows = []
                ... (jusqu'à la fin de la boucle record_overtake)
                            record_overtake(
                                supabase,
                                league_id=league_id,
                                gt_identifier=gt_id,
                                overtaker_team_id=overtaker,
                                overtaken_team_id=overtaken,
                                triggered_at_stage=stage_no,
                            )
```
⚠️ Vérifier ensuite : `_latest_snapshot_date_before` et `post_snapshot` ne sont-ils utilisés que par ce bloc ? Run `grep -n "_latest_snapshot_date_before\|post_snapshot\|skip_overtake_detection" scoring.py`. Si `_latest_snapshot_date_before` devient orphelin → le supprimer aussi. Si `skip_overtake_detection` est un paramètre de fonction devenu inutilisé → le retirer de la signature ET de ses appelants (grep dans `run_pipeline.py`/`sync*.py`). Si `post_snapshot` sert encore au step 5b (snapshot ranking) → le garder.

- [ ] **Step 8: Vérifier la cohérence syntaxique**

Run: `cd services/pcs-sync && .venv/bin/python -c "import ast; ast.parse(open('scoring.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 9: Commit**

```bash
git add services/pcs-sync/scoring.py
git commit -m "refactor(scoring): remove remontada multiplier + overtake detection"
```

---

## Task 3: Supprimer les fichiers backend + nettoyer tactics/refresh_demo

**Files:**
- Delete: `services/pcs-sync/remontada.py`, `services/pcs-sync/scripts/disable_remontada_cleanup.py`
- Modify: `services/pcs-sync/tactics.py`, `services/pcs-sync/refresh_demo_league.py`

- [ ] **Step 1: Supprimer les fichiers**

```bash
git rm services/pcs-sync/remontada.py services/pcs-sync/scripts/disable_remontada_cleanup.py
```

- [ ] **Step 2: Nettoyer le commentaire `tactics.py`**

`tactics.py` l.7 contient une formule docstring : `xp = (raw_pcs × gt_role_mult × (1 + strat) + classif) × remontada × nemesis`.
La remplacer par : `xp = (raw_pcs × gt_role_mult × (1 + strat) + classif) × nemesis` (retirer `× remontada`).

- [ ] **Step 3: Nettoyer `refresh_demo_league.py`**

Retirer les 2 entrées de la wipe-list (l.52 `"remontada_boosts",` et l.60 `"remontada_boost_triggers",`).
Vérifier qu'aucune autre référence remontada ne subsiste : `grep -n remontada services/pcs-sync/refresh_demo_league.py` → vide.

- [ ] **Step 4: Commit**

```bash
git add services/pcs-sync/tactics.py services/pcs-sync/refresh_demo_league.py
git commit -m "chore(pcs-sync): delete remontada.py + cleanup script, scrub references"
```

---

## Task 4: Tests Python — supprimer remontada, verdir scoring_gt

**Files:**
- Delete: `services/pcs-sync/tests/test_remontada.py`, `tests/test_remontada_integration.py`
- Modify: `services/pcs-sync/tests/test_scoring.py`, `tests/test_scoring_gt.py`

- [ ] **Step 1: Supprimer les tests remontada**

```bash
git rm services/pcs-sync/tests/test_remontada.py services/pcs-sync/tests/test_remontada_integration.py
```

- [ ] **Step 2: Nettoyer `test_scoring.py`**

Retirer l'assertion (l.333) `assert payload["remontada_mult"] == 1.0`. Si le payload testé n'a plus de clé `remontada_mult`, aucune autre adaptation. Vérifier le contexte autour pour ne pas casser le test.

- [ ] **Step 3: Nettoyer `test_scoring_gt.py` (mock positions)**

Le mock supabase de ce fichier fournit les retours de query dans un ordre POSITIONNEL. Une position correspond à la query `remontada_boosts` (commentaires l.42, 98, 210, 504, 559, 563 : `# 9. remontada_boosts (None = no active boost)` etc.). Comme `scoring.py` n'appelle plus `get_active_multiplier` (donc plus de query `remontada_boosts`), il faut **retirer ces positions de mock** pour réaligner la séquence.
Procéder ainsi : lire le `side_effect`/séquence de mock de chaque test concerné, identifier l'élément `None` étiqueté `remontada_boosts`, le retirer. Réexécuter après chaque test pour valider l'alignement.

- [ ] **Step 4: Vérifier la suite Python complète au vert**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: **0 failed** (les 12 reds initiaux disparaissent : 5 test_remontada supprimés, 7 test_scoring_gt verdis). Si un red subsiste pour une cause indépendante (colonne P1, etc.), le diagnostiquer et le corriger — objectif baseline 100% verte.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/tests/
git commit -m "test(pcs-sync): drop remontada tests, realign scoring_gt mocks (green baseline)"
```

---

## Task 5: Migration DB — DROP tables + colonne

**Files:**
- Create: `supabase/migrations/20260602110000_drop_remontada.sql`
- Create: `supabase/migrations/_rollback/20260602110000_drop_remontada.down.sql`

- [ ] **Step 1: Écrire la migration up**

`supabase/migrations/20260602110000_drop_remontada.sql` :
```sql
-- Remontada Boost removal (feature mort depuis 2026-05-21, remplacé par Spec B Underdog).
-- Tables vides + colonne toujours = 1.0 → DROP sans perte de donnée réelle.
-- CASCADE emporte les policies RLS demo (remontada_*_anon_demo, migrations 20260529).

DROP TABLE IF EXISTS public.remontada_boosts CASCADE;
DROP TABLE IF EXISTS public.remontada_boost_triggers CASCADE;

ALTER TABLE public.rider_xp_daily DROP COLUMN IF EXISTS remontada_mult;
```

- [ ] **Step 2: Écrire la migration down (best-effort)**

`supabase/migrations/_rollback/20260602110000_drop_remontada.down.sql` :
```sql
-- Best-effort rollback: recrée la colonne + des tables vides (données non restaurées).
-- Les policies RLS demo ne sont PAS recréées (elles vivaient dans d'autres migrations).
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS remontada_mult numeric NOT NULL DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS public.remontada_boost_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remontada_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
```
> Note : le down est volontairement minimal (feature supprimée définitivement) — il rétablit juste un schéma compilable, pas la structure complète d'origine.

- [ ] **Step 3: Valider la syntaxe SQL en local (si Colima dispo)**

Si l'environnement local Supabase tourne (`supabase status`), valider via reset :
```bash
supabase db reset   # rejoue toutes les migrations from scratch, y compris le DROP
```
Expected: pas d'erreur sur la nouvelle migration. Si Colima n'est pas démarré, sauter cette étape (la validation se fera au push prod en Task 8, sous confirmation) et le signaler.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260602110000_drop_remontada.sql supabase/migrations/_rollback/20260602110000_drop_remontada.down.sql
git commit -m "feat(db): drop remontada tables + rider_xp_daily.remontada_mult column"
```

---

## Task 6: Frontend — supprimer la chaîne remontada

**Files:**
- Delete: `apps/web/lib/remontada.ts`, `apps/web/components/remontada-boost-banner.tsx`, `apps/web/components/race-feed-remontada-card.tsx`, `apps/web/components/__tests__/race-feed-remontada-card.test.tsx`, `apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx`
- Modify: `apps/web/lib/race-feed-types.ts`, `lib/get-race-feed-data.ts`, `lib/gt-phases.ts`, `components/race-feed.tsx`, `app/(game)/league/[leagueId]/team/gt/page.tsx`, `lib/__tests__/get-race-feed-data.test.ts`

- [ ] **Step 1: Supprimer les fichiers**

```bash
git rm apps/web/lib/remontada.ts \
  apps/web/components/remontada-boost-banner.tsx \
  apps/web/components/race-feed-remontada-card.tsx \
  "apps/web/components/__tests__/race-feed-remontada-card.test.tsx" \
  "apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx"
```

- [ ] **Step 2: `race-feed-types.ts`**

Retirer le type `RemontadaData = {...}` (l.57) et le membre d'union `| { type: "remontada"; data: RemontadaData }` (l.74) de l'union de cards.

- [ ] **Step 3: `get-race-feed-data.ts`**

Retirer l'import `RemontadaData,` (l.24). Retirer entièrement le bloc « 8) Fetch and slot Remontada cards » (l.341-379, depuis le commentaire jusqu'au `pushCard(...)` du type remontada inclus).

- [ ] **Step 4: `race-feed.tsx`**

Retirer l'import `import { RaceFeedRemontadaCard } from "./race-feed-remontada-card";` (l.10) et la branche (l.112-113) :
```tsx
                if (card.type === "remontada") {
                  return <RaceFeedRemontadaCard key={key} data={card.data} />;
                }
```

- [ ] **Step 5: `page.tsx` (team/gt)**

Retirer l'import `import { RemontadaBannerSlot } from "./_remontada-banner-slot";` (l.14) et le rendu `<RemontadaBannerSlot .../>` (l.105 et ses props). Vérifier qu'aucune variable calculée uniquement pour ce composant (ex. `currentStageNumber`, `gtIdentifier`) ne devient orpheline ; si oui, la retirer aussi.

- [ ] **Step 6: `gt-phases.ts`**

Mettre à jour le commentaire (l.81) qui référence `remontada_boosts.gt_identifier` : retirer la mention remontada en gardant la sémantique « Canonical GT identifier per phase ».

- [ ] **Step 7: `get-race-feed-data.test.ts`**

Retirer les cas de test remontada (mocks de `remontada_boosts`, assertions sur cards `type: "remontada"`). Vérifier `grep -n remontada apps/web/lib/__tests__/get-race-feed-data.test.ts` → vide.

- [ ] **Step 8: Vérifier (types pas encore régénérés — OK)**

Run: `pnpm --filter web typecheck` (ou `pnpm typecheck`)
Expected: PASS — plus aucune référence aux symboles remontada. (`database.types.ts` contient encore les tables mais plus rien ne les lit.)
Run: `pnpm --filter web test` → vert.

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "refactor(web): remove remontada banner, feed card, types and wiring"
```

---

## Task 7: Régénérer `database.types.ts` (après push prod migration)

> Cette task dépend de la migration appliquée sur prod (Task 8). **Exécuter Task 8 d'abord**, puis revenir ici. (Ordonnancement : la regen `--linked` reflète l'état prod.)

**Files:**
- Modify: `apps/web/lib/database.types.ts`, `apps/web/lib/supabase/database.types.ts`

- [ ] **Step 1: Régénérer depuis prod**

```bash
supabase gen types typescript --linked > apps/web/lib/database.types.ts
```
Puis répliquer dans le second fichier (vérifier comment il est généré — même commande vers `apps/web/lib/supabase/database.types.ts`, ou copie). Confirmer que `remontada_boosts`, `remontada_boost_triggers` et `rider_xp_daily.remontada_mult` ont disparu : `grep -n remontada apps/web/lib/database.types.ts apps/web/lib/supabase/database.types.ts` → vide.

- [ ] **Step 2: Vérifier**

Run: `pnpm typecheck && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/database.types.ts apps/web/lib/supabase/database.types.ts
git commit -m "chore(web): regenerate database types after remontada drop"
```

---

## Task 8: Push migration prod (CONFIRMATION REQUISE)

- [ ] **Step 1: Lister l'état prod**

Run: `supabase migration list --linked`
Vérifier que `20260602110000` apparaît comme **local seulement** (pending), et qu'aucune autre migration inattendue n'est pending.

- [ ] **Step 2: Demander confirmation explicite à l'utilisateur**

⚠️ CLAUDE.md : jamais d'auto-allow prod. Présenter : « DROP 2 tables vides + colonne `remontada_mult` (toujours 1.0). Aucune donnée réelle perdue. Je pousse ? » Attendre le OUI.

- [ ] **Step 3: Push (après OUI uniquement)**

Run: `supabase db push --linked`
Expected: `Applying migration 20260602110000_drop_remontada.sql...` → `Finished`.

- [ ] **Step 4: Vérifier sur prod**

Via le client Python pcs-sync (lecture seule) : confirmer que `rider_xp_daily` n'a plus la colonne `remontada_mult` (un `select("remontada_mult")` doit échouer) et que les 2 tables n'existent plus. Re-run `supabase migration list --linked` → `20260602110000` désormais Remote rempli.

> Après cette task, revenir exécuter **Task 7** (regen types).

---

## Task 9: Docs vivantes

**Files:**
- Modify: `docs/GAME_RULES.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`, MEMORY files

- [ ] **Step 1: `docs/GAME_RULES.md`**

Retirer la section/mentions Remontada (constantes §11/§12 et toute description de mécanique). `grep -ni remontada docs/GAME_RULES.md` → vide.

- [ ] **Step 2: `docs/ARCHITECTURE.md`**

Retirer les références aux tables `remontada_boosts`/`remontada_boost_triggers`, à `remontada.py`/`remontada.ts`, aux composants supprimés. `grep -ni remontada docs/ARCHITECTURE.md` → vide.

- [ ] **Step 3: `CLAUDE.md`**

Retirer la ligne « Remontada Boost **DÉSACTIVÉ** depuis 2026-05-21 (feature-flag, code conservé) » (section Constantes du jeu) et la mention dans « Features livrées » (Anti-Runaway → préciser « Remontada Boost supprimé 2026-06-02 »).

- [ ] **Step 4: MEMORY files**

- `MEMORY.md` : mettre à jour l'index Anti-Runaway + section « Remontada Boost désactivé » → suppression définitive 2026-06-02. Mettre à jour les gotchas DB (retirer les lignes tables/colonne remontada).
- `anti_runaway_system.md` : acter la suppression.
- `refonte_equilibrage_progress.md` : cocher « Remontada supprimé », débloquer P2.

- [ ] **Step 5: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs(remontada): scrub remontada from living docs after removal"
```

---

## Task 10: Vérification finale globale

- [ ] **Step 1: Grep zéro référence**

Run: `grep -rin remontada --include="*.py" --include="*.ts" --include="*.tsx" --include="*.sql" . | grep -v node_modules | grep -v "supabase/migrations/2026042\|20260508010000\|20260520000002\|20260521120000\|20260529000002\|20260529000004\|20260602110000"`
Expected: vide (les migrations historiques gardent leurs références — c'est normal, on ne réécrit pas l'historique des migrations appliquées).

- [ ] **Step 2: Suite complète verte**

```bash
cd services/pcs-sync && .venv/bin/python -m pytest -q
cd ../.. && pnpm typecheck && pnpm lint && pnpm test
```
Expected: tout vert.

- [ ] **Step 3: requesting-code-review**

Invoquer `superpowers:requesting-code-review` sur la branche avant merge.

---

## Self-Review (rempli par l'auteur du plan)

- **Spec coverage** : back (T1-T4), migration (T5,T8), front (T6-T7), docs (T9), vérif (T10) — toutes les sections du spec sont couvertes. ✅
- **Placeholders** : aucun TBD/TODO ; code des edits fourni ; mock-realignment de T4-step3 décrit comme procédure (le contenu exact des side_effect varie par test, à lire en exécution — non-placeholder car la méthode est explicite). ✅
- **Type consistency** : `gt_slug.get_gt_identifier`/`get_stage_number` (T1) = noms utilisés partout ; migration `20260602110000` cohérente T5/T8. ✅
- **Ordering** : T7 (regen types) dépend de T8 (push prod) — explicitement noté dans les deux tasks. ✅
