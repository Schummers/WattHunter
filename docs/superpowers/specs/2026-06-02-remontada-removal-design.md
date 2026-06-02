# Spec — Suppression définitive de Remontada

> 2026-06-02 · Cleanup pré-P2 de la Refonte Équilibrage. Design validé via brainstorming.
> Contexte : [[refonte_equilibrage_progress]], [[anti_runaway_system]].

## Pourquoi

Le **Remontada Boost** est mort depuis le 2026-05-21 : feature-flag `REMONTADA_ENABLED = False`
(back + front), tables `remontada_boosts` / `remontada_boost_triggers` vides, colonne
`rider_xp_daily.remontada_mult` toujours = 1.0. La mécanique s'est avérée fragile aux recalculs
rétroactifs (création de boosts fantômes lors des rescores). Elle est désormais remplacée par
**Spec B (Underdog)**. On revient sur la décision « code conservé pour réactivation » du 2026-05-21 :
**suppression définitive**, pour repartir d'un `scoring.py` propre et d'une baseline de tests verte
avant P2 (Refonte Scoring).

## Objectif & critères de succès

- Aucune référence à remontada restante dans le code (back, front, types, migrations actives).
- `scoring.py` ne dépend plus de `remontada.py` ; les 2 helpers généraux qu'il y empruntait sont
  relocalisés.
- Migration DB qui DROP les 2 tables + la colonne `remontada_mult`.
- **Baseline verte** : `pytest` (pcs-sync) + `pnpm test` (web) + `pnpm typecheck` + `pnpm lint` 100% OK.
  Cela inclut la résolution des 7 `test_scoring_gt` rouges (voir §Risques).
- Docs vivantes à jour (GAME_RULES, ARCHITECTURE, CLAUDE.md, MEMORY).

## Périmètre réel (audité)

Le périmètre dépasse la liste du handoff d'origine. Footprint complet (hors `node_modules`/`.git`) :

### Backend — `services/pcs-sync/`
| Fichier | Action |
|---|---|
| `remontada.py` | **Supprimer** (après relocalisation des helpers, voir ci-dessous) |
| `scripts/disable_remontada_cleanup.py` | **Supprimer** (one-shot déjà exécuté le 2026-05-21, référence la colonne droppée) |
| `scoring.py` | **Éditer** (cœur du chantier — voir détail) |
| `tactics.py` | **Éditer** — nettoyer le commentaire de formule (l.7, `× remontada × nemesis`) |
| `refresh_demo_league.py` | **Éditer** — retirer `"remontada_boosts"` (l.52) et `"remontada_boost_triggers"` (l.60) de la wipe-list |
| `gt_slug.py` | **Créer** — accueille les 2 helpers généraux |
| `tests/test_remontada.py` | **Supprimer** |
| `tests/test_remontada_integration.py` | **Supprimer** |
| `tests/test_gt_slug.py` | **Créer** — test unitaire des helpers relocalisés |
| `tests/test_scoring_gt.py` | **Éditer** — retirer la position de mock `remontada_boosts` |
| `tests/test_scoring.py` | **Éditer** — retirer l'assert `remontada_mult == 1.0` (l.333) |

### Helpers partagés — RELOCALISATION (point dur)

`scoring.py` importe 5 symboles de `remontada` :

| Symbole | Nature | Sort |
|---|---|---|
| `get_gt_identifier(slug)` | helper général (identifie le GT) — utilisé l.423/481/613 | **Relocaliser** → `gt_slug.py` |
| `get_stage_number(slug)` | helper général (n° d'étape) — utilisé l.424/482/614 | **Relocaliser** → `gt_slug.py` |
| `get_active_multiplier(...)` | remontada-spécifique | Supprimer (call retiré de scoring.py) |
| `detect_overtakes(...)` | remontada-spécifique | Supprimer |
| `record_overtake(...)` | remontada-spécifique | Supprimer |

`snapshot_league_ranking` (remontada.py l.32) n'est utilisé que par les tests remontada → supprimé avec eux.
Les 2 helpers à relocaliser ne sont consommés que par `scoring.py` (vérifié par grep) → relocalisation contenue.
On les **copie verbatim** dans `gt_slug.py` (fonctions pures de parsing de slug, sans dépendance remontada).

### `scoring.py` — détail des retraits
- Import : remplacer `from remontada import (...)` par `from gt_slug import get_gt_identifier, get_stage_number`.
- Retirer `remontada_stage_in_run` (l.421-427).
- Retirer les blocs `get_active_multiplier` (l.548-561 et l.613-624) ; la formule XP perd `* remontada_mult`
  (l.561 → `... * nemesis_modifier`).
- Retirer les clés `"remontada_mult"` des payloads `rider_xp_daily` (l.577 et l.637) — la colonne est droppée.
- Retirer le bloc de détection d'overtakes (l.724-745 : `if remontada_stage_in_run ...`, `detect_overtakes`,
  `record_overtake`). Vérifier que `pre_snapshot`/`post_snapshot` ne servaient qu'à ça avant suppression.

### Frontend — `apps/web/`
| Fichier | Action |
|---|---|
| `lib/remontada.ts` | **Supprimer** (`getActiveRemontadaBoost`, type `RemontadaBoost`, flag) |
| `components/remontada-boost-banner.tsx` | **Supprimer** |
| `components/race-feed-remontada-card.tsx` | **Supprimer** |
| `app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx` | **Supprimer** |
| `components/__tests__/race-feed-remontada-card.test.tsx` | **Supprimer** |
| `lib/race-feed-types.ts` | **Éditer** — retirer `RemontadaData` (l.57) + membre d'union `{ type: "remontada"; ... }` (l.74) |
| `lib/get-race-feed-data.ts` | **Éditer** — retirer import `RemontadaData` (l.24) + bloc 8) (l.341-379) |
| `components/race-feed.tsx` | **Éditer** — retirer import `RaceFeedRemontadaCard` (l.10) + branche `card.type === "remontada"` (l.112-113) |
| `app/(game)/league/[leagueId]/team/gt/page.tsx` | **Éditer** — retirer import `RemontadaBannerSlot` (l.14) + `<RemontadaBannerSlot>` (l.105) |
| `lib/gt-phases.ts` | **Éditer** — nettoyer le commentaire (l.81, référence `remontada_boosts.gt_identifier`) |
| `lib/__tests__/get-race-feed-data.test.ts` | **Éditer** — retirer les cas remontada |
| `lib/database.types.ts` | **Régénérer** après migration (supprime tables + colonne) |
| `lib/supabase/database.types.ts` | **Régénérer** après migration |

> Note design system : suppression de composants uniquement, aucun nouveau pattern UI → Rule #1 sans objet ici.

### Migration DB — `supabase/migrations/`
- **Créer** `20260602110000_drop_remontada.sql` (timestamp > P1 `20260602100200`) :
  - `DROP TABLE IF EXISTS public.remontada_boosts CASCADE;` (cascade les policies demo
    `remontada_boosts_anon_demo` des migrations 20260529)
  - `DROP TABLE IF EXISTS public.remontada_boost_triggers CASCADE;`
  - `ALTER TABLE public.rider_xp_daily DROP COLUMN IF EXISTS remontada_mult;`
- **Créer** `_rollback/20260602110000_drop_remontada.down.sql` : best-effort — recrée les tables vides
  + la colonne `remontada_mult numeric NOT NULL DEFAULT 1.0`. Données non restaurées (feature morte, assumé).
  Les policies RLS demo ne sont pas recréées par le down (elles vivaient dans d'autres migrations).

### Docs vivantes
- `docs/GAME_RULES.md` — retirer toute mention Remontada (constantes §11, mécaniques).
- `docs/ARCHITECTURE.md` — retirer tables/composants/RPC remontada.
- `CLAUDE.md` — retirer la ligne « Remontada Boost **DÉSACTIVÉ** depuis 2026-05-21 (feature-flag, code conservé) »
  et la mention dans « Features livrées » (Anti-Runaway).
- `MEMORY.md` + `anti_runaway_system.md` + `refonte_equilibrage_progress.md` — acter la suppression définitive.

## Risques & points d'attention

1. **Helpers partagés** (point dur n°1) : ne PAS supprimer `get_gt_identifier`/`get_stage_number`.
   Les relocaliser dans `gt_slug.py`, vérifier que `scoring.py` compile et que les tests passent.
2. **7 `test_scoring_gt` rouges** : baseline actuelle = 12 reds (5 `test_remontada` + 7 `test_scoring_gt`).
   La trace des 7 pointe vers `remontada.py:177` (`get_active_multiplier` reçoit un `MagicMock` car les
   positions de mock ont dérivé après P1). **Retirer l'intégration remontada de `scoring.py` + nettoyer la
   position de mock `remontada_boosts` résout ces 7 reds.** Ce chantier absorbe donc la tâche spawnée
   « 7 test_scoring_gt rouges » (décision 2026-06-02). Si après retrait certains reds subsistent pour une
   cause indépendante (nouvelle colonne P1, etc.), les fixer aussi — objectif baseline 100% verte.
3. **Régénération `database.types.ts`** : doit se faire APRÈS application de la migration (locale ou prod),
   sinon les types contiennent encore les tables droppées. Process : appliquer migration en local Colima →
   `supabase gen types` → commit.
4. **Push prod** : confirmation explicite requise avant `supabase db push --linked` (CLAUDE.md, comme P1).
   Tables/colonne déjà vides → DROP sans perte de données réelles.

## Plan d'exécution (haut niveau)

Worktree frais, subagent-driven. Ordre suggéré (le plan writing-plans détaillera) :
1. Backend : créer `gt_slug.py` (+ test), éditer `scoring.py`, supprimer `remontada.py` + cleanup script,
   éditer `tactics.py` / `refresh_demo_league.py`, supprimer/éditer tests Python → `pytest` vert.
2. Migration DB + application locale (Colima) → vérifier DROP propre.
3. Frontend : supprimer composants, éditer types/feed/page, régénérer `database.types.ts` → `pnpm typecheck`/`lint`/`test` verts.
4. Docs vivantes.
5. Vérification finale globale, puis push migration prod (confirmation).

## Hors périmètre

- Spec B (Underdog) et P2 (Refonte Scoring) : chantiers séparés, postérieurs.
- Pas de refactoring non lié dans `scoring.py` au-delà du retrait remontada.
