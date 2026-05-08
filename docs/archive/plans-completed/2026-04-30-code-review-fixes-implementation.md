# Code Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 12 issues identified in the senior code review (2026-04-30) by phases, with each phase committable and rollbackable independently.

**Architecture:** Tout le travail se fait sur une branche dédiée `fix/code-review-batch`, sans toucher à `main` jusqu'à validation finale. Les phases s'enchaînent du moins risqué (Phase 1 quick wins) au plus risqué (Phase 4 RPC + lockdown). Chaque phase termine par un commit. Les migrations SQL incluent des fichiers de rollback explicites.

**Tech Stack:** Next.js 16 App Router + TypeScript strict + Tailwind v4 + Supabase Postgres + RLS + Vitest + Python 3.12 (FastAPI / Playwright).

---

## Pre-flight checks (à faire AVANT le Setup)

Le plan part de 2 hypothèses produit que le user doit confirmer :

### Hypothèse 1 — Résolution des auctions
Les 6 auctions actuelles sont "closed". Aucun code TS ne ferme les auctions. Le service Python FastAPI ne peut pas démarrer (`main.py:13` import `sync_all_riders` inexistant).

**Le plan suppose que** : tu fermes les auctions manuellement via `run_auction_resolve.py` (lancé en local) ou via Supabase Studio. Si Railway tourne avec une URL active, **stop et confirme avant Phase 1**.

→ Action : `cd services/pcs-sync && python3 run_auction_resolve.py` doit fonctionner. Si OUI, on continue. Si NON, on doit décider Q1 avant.

### Hypothèse 2 — Alpha privée jusqu'à validation
Tu joues avec 7 amis identifiés. Le bug #1 (`teams_update_own` permet auto-élévation) est théorique mais pas exploité. Le plan met le fix #1 en Phase 4 (après les RPC SECURITY DEFINER, sinon casse les writes treasury).

**Si tu prévois public alpha avant la fin de Phase 4** : remonter #1 + #10 + #7 (RPC join_league) au plus tôt, quitte à reporter les autres.

---

## Setup — Création de la branche dédiée

### Task 0: Créer la branche fix/code-review-batch

**Files:**
- N/A (git only)

- [ ] **Step 1: Vérifier que main est à jour et clean**

```bash
git status
git fetch origin
git log --oneline -5
```

Expected: working tree clean (untracked .playwright-mcp/* OK, gitignored), HEAD on main, sync with origin/main.

- [ ] **Step 2: Créer la branche locale**

```bash
git checkout -b fix/code-review-batch
git push -u origin fix/code-review-batch
```

Expected: branche créée + push réussi avec tracking.

- [ ] **Step 3: Vérifier la branche active**

```bash
git branch --show-current
```

Expected: `fix/code-review-batch`

- [ ] **Step 4: Créer un commit baseline vide pour marquer le point de retour**

```bash
git commit --allow-empty -m "chore: start code-review-batch (rollback baseline)"
git rev-parse HEAD > /tmp/wh-rollback-baseline.txt
cat /tmp/wh-rollback-baseline.txt
```

Expected: SHA du commit baseline sauvegardé. Si tout part en vrille, `git reset --hard $(cat /tmp/wh-rollback-baseline.txt)`.

---

# Phase 1 — Quick wins (1 jour, faible risque)

Cible : #2, #4, #5 (partiel), #6, #11, plus 5 quick wins du rapport. Chaque task ≤ 30 min, chaque task se commit. Aucun risque de cassure UI majeure.

## Task 1.1: Migration XP stretched curve (#2)

**Vérifié en DB** : 0 team en zone de rétrogradation. Migration sans risque pour les comptes existants.

**Files:**
- Create: `supabase/migrations/20260501000000_xp_stretched_curve_recompute.sql`
- Reference: `apps/web/lib/levels.ts:6-9`

- [ ] **Step 1: Pré-check DB (snapshot avant migration)**

```bash
set -a && source .env && set +a
curl -s -X GET "$SUPABASE_URL/rest/v1/teams?select=id,name,level,cumulative_xp" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  > /tmp/wh-teams-before-xp-migration.json
cat /tmp/wh-teams-before-xp-migration.json | python3 -m json.tool | head -30
```

Expected: 7 teams avec leurs levels actuels. Sauvegarde pour comparaison après.

- [ ] **Step 2: Écrire la migration**

```sql
-- supabase/migrations/20260501000000_xp_stretched_curve_recompute.sql
-- Apply Anti-Runaway Mech 3 stretched XP curve to existing teams.
-- New thresholds (source of truth: apps/web/lib/levels.ts and services/pcs-sync/scoring.py):
-- L1=0, L2=25, L3=150, L4=350, L5=600, L6=1200, L7=1800, L8=2400
-- Old DB thresholds were L6=900, L7=1500, L8=2000.

-- 1. Reusable function — single source of truth going forward.
CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 2400 THEN 8
    WHEN xp >= 1800 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;

-- 2. Recompute team levels using the new curve.
UPDATE public.teams SET level = public.compute_level(cumulative_xp);
```

- [ ] **Step 3: Écrire la migration de rollback (si jamais on doit revenir)**

```sql
-- supabase/migrations/_rollback/20260501000000_xp_stretched_curve_recompute.down.sql
-- Manual rollback only — restores the previous (April 2nd) levels.
-- DO NOT auto-apply.

UPDATE public.teams SET level = CASE
  WHEN cumulative_xp >= 2000 THEN 8
  WHEN cumulative_xp >= 1500 THEN 7
  WHEN cumulative_xp >=  900 THEN 6
  WHEN cumulative_xp >=  600 THEN 5
  WHEN cumulative_xp >=  350 THEN 4
  WHEN cumulative_xp >=  150 THEN 3
  WHEN cumulative_xp >=   25 THEN 2
  ELSE 1
END;

DROP FUNCTION IF EXISTS public.compute_level(numeric);
```

```bash
mkdir -p supabase/migrations/_rollback
# (write the file as shown above)
```

- [ ] **Step 4: Appliquer la migration sur Supabase distant**

```bash
supabase db push
```

Expected: `Applying migration 20260501000000_xp_stretched_curve_recompute.sql ... done`

- [ ] **Step 5: Post-check DB (vérifier zero team affectée)**

```bash
set -a && source .env && set +a
curl -s -X GET "$SUPABASE_URL/rest/v1/teams?select=id,name,level,cumulative_xp" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  > /tmp/wh-teams-after-xp-migration.json
diff <(python3 -m json.tool /tmp/wh-teams-before-xp-migration.json) \
     <(python3 -m json.tool /tmp/wh-teams-after-xp-migration.json)
```

Expected: aucune différence (les 7 teams ont les mêmes levels avant/après car aucune dans la zone affectée).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260501000000_xp_stretched_curve_recompute.sql \
        supabase/migrations/_rollback/20260501000000_xp_stretched_curve_recompute.down.sql
git commit -m "fix(db): apply stretched XP curve to align teams.level with code"
```

---

## Task 1.2: ~~Créer apps/web/middleware.ts (#4)~~ — **ANNULÉ : NO-OP**

> Tâche supprimée du périmètre après vérification runtime (preview_start + Next.js logs).
>
> **Raison** : Next.js 16 a déprécié `middleware.ts` au profit de `proxy.ts`. Le fichier `apps/web/proxy.ts` existe déjà et appelle `updateSession()` — vérifié dans les logs : `proxy.ts: 80ms` apparaît à chaque requête. La session Supabase est déjà rafraîchie correctement sur navigation.
>
> Le finding #4 du code review (`docs/reviews/2026-04-30-12-problems-detailed.md`) a été barré comme faux positif.
>
> **Aucune action de code requise pour Task 1.2.** Passer directement à Task 1.3.

---

## Task 1.3: Réparer Python imports cassés (#6)

Décision : **réparer plutôt que supprimer**, parce que `resolve_current_round` (auction.py:55) est utile pour fermer les auctions.

**Files:**
- Modify: `services/pcs-sync/main.py:13`
- Modify: `services/pcs-sync/run_daily_pipeline.py:23`

- [ ] **Step 1: Vérifier que sync_top500 existe bien**

```bash
grep -n "^async def sync_top500\|^def sync_top500" services/pcs-sync/sync.py
```

Expected: 1 match.

- [ ] **Step 2: Réparer main.py**

```ts
// Edit services/pcs-sync/main.py:13
// Replace:
//   from sync import sync_all_riders
// By:
//   from sync import sync_top500
```

Et tous les call sites :
- Line 56: `result = await sync_all_riders()` → `result = await sync_top500()`
- Line 73: `roster_result = await sync_all_riders(_supabase)` → `roster_result = await sync_top500(_supabase)`

- [ ] **Step 3: Tester l'import**

```bash
cd services/pcs-sync && python3 -c "from main import app; print('Import OK')"
```

Expected: `Import OK` (ou ModuleNotFoundError sur fastapi si pas dans le venv — c'est OK, c'est le test sur la résolution `sync.py`).

```bash
cd services/pcs-sync && python3 -c "
from sync import sync_top500
import main
print('All imports resolved')
" 2>&1 | tail -5
```

Expected: pas d'erreur sur les imports `sync` (les autres errors fastapi sont attendues si pas de venv).

- [ ] **Step 4: Décider de run_daily_pipeline.py**

Vérifier si encore utilisé : `grep -rn "run_daily_pipeline" .` (doit retourner 0 hors le fichier lui-même).

```bash
grep -rn "run_daily_pipeline" . --exclude-dir=node_modules --exclude-dir=__pycache__ | grep -v "run_daily_pipeline.py:"
```

Expected: 0 résultat → personne ne l'utilise → on le supprime.

- [ ] **Step 5: Supprimer run_daily_pipeline.py (si pas utilisé)**

```bash
rm services/pcs-sync/run_daily_pipeline.py
```

- [ ] **Step 6: Lancer les tests Python pour vérifier**

```bash
cd services/pcs-sync && python3 -m pytest tests/ -v 2>&1 | tail -20
```

Expected: tous tests passent (les 22 reportés).

- [ ] **Step 7: Commit**

```bash
git add services/pcs-sync/main.py
git rm services/pcs-sync/run_daily_pipeline.py
git commit -m "fix(pcs-sync): repair broken imports (sync_all_riders → sync_top500), remove dead daily pipeline"
```

---

## Task 1.4: Retirer le payday Python (#5)

CLAUDE.md tranche pour la version TS. On retire le `if is_round_1: run_payday()` de `auction.py`. La fonction `run_payday` reste pour l'instant (sera supprimée Phase 4 quand on confirme qu'elle n'est plus appelée).

**Files:**
- Modify: `services/pcs-sync/auction.py:265-271`

- [ ] **Step 1: Identifier le bloc exact à retirer**

```bash
sed -n '262,275p' services/pcs-sync/auction.py
```

Expected: bloc autour de "Run payday for all teams" L266-271.

- [ ] **Step 2: Retirer le bloc payday automatique**

```python
# services/pcs-sync/auction.py
# REMOVE lines 265-271 (the auto-payday after Round 1 resolution):
#
# OLD:
#             # Run payday for all teams — only on Round 1 of each phase
#             auction_name = auction.get("name", "")
#             is_round_1 = "Round 1" in auction_name or str(auction.get("round", "")) == "1"
#             payday_result = None
#             if is_round_1 and league_id:
#                 logger.info(f"Auction {auction_id} is Round 1 — triggering payday for league {league_id}")
#                 payday_result = run_payday(supabase, league_id)
#
# NEW:
#             # Payday is now handled by the in-app server action confirmPhaseSetup
#             # (apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts:89).
#             # Python is responsible only for auction resolution + contract creation.
#             payday_result = None
```

Et adapter `results.append` à la ligne 273 pour ne plus déballer `payday_result` :

```python
# OLD:
#             results.append({
#                 "auction_id": auction_id,
#                 "round": current_round,
#                 "resolved": resolved_count,
#                 **({"payday": payday_result} if payday_result else {}),
#             })
# NEW:
            results.append({
                "auction_id": auction_id,
                "round": current_round,
                "resolved": resolved_count,
            })
```

- [ ] **Step 3: Tester**

```bash
cd services/pcs-sync && python3 -m pytest tests/test_auction.py -v 2>&1 | tail -20
```

Expected: tests passent. Si `test_nominal_resolution` ou un autre test attend `payday_result`, l'ajuster :

```bash
grep -n "payday_result\|payday" services/pcs-sync/tests/test_auction.py
```

Si trouvé, retirer les assertions associées au payday.

- [ ] **Step 4: Commit**

```bash
git add services/pcs-sync/auction.py services/pcs-sync/tests/test_auction.py
git commit -m "fix(pcs-sync): remove auto-payday from auction resolution (TS confirmPhaseSetup is source of truth)"
```

---

## Task 1.5: Tokens design system manquants (#11 — partie tokens)

**Files:**
- Modify: `apps/web/app/globals.css`
- Reference: `docs/watthunter-design-system-v3.md`

- [ ] **Step 1: Identifier la section :root dans globals.css**

```bash
grep -n "^:root\|^}" apps/web/app/globals.css | head -10
```

- [ ] **Step 2: Ajouter les nouveaux tokens dans globals.css**

Ajouter après la ligne `--warning: #f59e0b;` (ou dans le bloc des semantic tokens) :

```css
  /* Semantic backgrounds (10% opacity overlays) */
  --success-bg: rgba(16, 185, 129, 0.10);
  --danger-bg:  rgba(239, 68, 68, 0.10);
  --warning-bg: rgba(245, 158, 11, 0.10);

  /* Semantic borders (30% opacity) */
  --success-border: rgba(16, 185, 129, 0.30);
  --danger-border:  rgba(239, 68, 68, 0.30);
  --warning-border: rgba(245, 158, 11, 0.30);

  /* Modal scrim & surface overlay */
  --scrim: rgba(0, 0, 0, 0.50);
  --surface-overlay: rgba(255, 255, 255, 0.05);
```

- [ ] **Step 3: Build local pour vérifier que les tokens sont bien parsés**

```bash
cd apps/web && pnpm build 2>&1 | tail -10
```

Expected: build OK. Pas d'erreur Tailwind sur les nouveaux tokens (Tailwind v4 lit les CSS vars directement).

- [ ] **Step 4: Commit (sans utiliser les tokens encore — c'est l'étape suivante)**

```bash
git add apps/web/app/globals.css
git commit -m "feat(ds): add semantic background/border + scrim/overlay tokens"
```

---

## Task 1.6: Migrer les couleurs Tailwind nommées vers les tokens (#11 — partie migration)

**Files:**
- Modify: ~30 sites listés ci-dessous

Migration mécanique. Faire les remplacements UN PAR UN, tester visuellement après chaque batch.

- [ ] **Step 1: Identifier tous les sites à migrer**

```bash
grep -rn "bg-emerald-500/\|bg-red-500/\|bg-amber-500/\|border-emerald-500/\|border-red-500/\|border-amber-500/" apps/web/app apps/web/components 2>/dev/null > /tmp/wh-color-violations.txt
wc -l /tmp/wh-color-violations.txt
cat /tmp/wh-color-violations.txt
```

Expected: ~25-30 sites listés. Sauver le fichier.

- [ ] **Step 2: Remplacements automatisés (sed)**

```bash
# Backup avant sed
git diff > /tmp/wh-pre-color-migration.diff

# Migration mécanique
find apps/web/app apps/web/components -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's/bg-emerald-500\/[0-9]\{1,2\}/bg-[var(--success-bg)]/g' \
  -e 's/bg-red-500\/[0-9]\{1,2\}/bg-[var(--danger-bg)]/g' \
  -e 's/bg-amber-500\/[0-9]\{1,2\}/bg-[var(--warning-bg)]/g' \
  -e 's/border-emerald-500\/[0-9]\{1,2\}/border-[var(--success-border)]/g' \
  -e 's/border-red-500\/[0-9]\{1,2\}/border-[var(--danger-border)]/g' \
  -e 's/border-amber-500\/[0-9]\{1,2\}/border-[var(--warning-border)]/g'

# Vérifier le diff
git diff --stat
```

- [ ] **Step 3: Migrer aussi les bg-black/X (scrim) et bg-white/X (overlay)**

```bash
find apps/web/app apps/web/components -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's/bg-black\/[0-9]\{1,2\}/bg-[var(--scrim)]/g' \
  -e 's/bg-white\/5/bg-[var(--surface-overlay)]/g'
```

- [ ] **Step 4: Build + typecheck**

```bash
cd apps/web && pnpm typecheck && pnpm build 2>&1 | tail -10
```

Expected: 0 erreur. Si erreur sur un fichier, la fixer manuellement (cas spéciaux où le sed a trop matché).

- [ ] **Step 5: Smoke test visuel**

```bash
cd apps/web && pnpm dev
```

Naviguer manuellement aux pages avec banners erreur/succès :
- `/login` (envoyer un mauvais password → banner danger)
- `/league/[leagueId]/auction` (regarder bid states avec deficit)
- `/league/[leagueId]/budget` (deficit warning)
- `/league/[leagueId]/team/strategies` (info banners)
- N'importe quel modal (scrim noir)

Vérifier que les couleurs ressemblent à l'avant. Si une nuance est trop forte/faible, ajuster les opacités dans `globals.css`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "refactor(ds): migrate hardcoded Tailwind colors to semantic tokens"
```

---

## Task 1.7: Quick wins divers

**Files:**
- Modify: `apps/web/components/sponsor-bonus-card.tsx` (15 hardcoded text-[Xpx])
- Modify: `apps/web/components/filter-chips.tsx:22` (1 hardcoded text-[13px])
- Modify: `apps/web/components/bid-adjust-card.tsx:101,120`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/page.tsx:255`
- Modify: `apps/web/components/budget-summary.tsx:54` (#4ade80 hex)
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx:131,144` (gradient → .cta-gradient)
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:354-355` (revalidatePath doublon)
- Modify: `apps/web/app/(auth)/league/create/actions.ts:4` + `join/actions.ts:4` (zod → zod/v4)

- [ ] **Step 1: Fix sponsor-bonus-card.tsx**

Remplacer dans le fichier les 15 occurrences :
- `text-[10px]` → `text-[length:var(--type-micro)]`
- `text-[11px]` → `text-[length:var(--type-caption)]` (11 n'existe pas dans la scale, on remonte à 12)
- `text-[13px]` → `text-[length:var(--type-caption)]` (idem)

```bash
sed -i '' \
  -e 's/text-\[10px\]/text-[length:var(--type-micro)]/g' \
  -e 's/text-\[11px\]/text-[length:var(--type-caption)]/g' \
  -e 's/text-\[13px\]/text-[length:var(--type-caption)]/g' \
  -e 's/text-\[14px\]/text-[length:var(--type-body)]/g' \
  apps/web/components/sponsor-bonus-card.tsx \
  apps/web/components/filter-chips.tsx \
  apps/web/components/bid-adjust-card.tsx \
  apps/web/app/\(game\)/league/\[leagueId\]/team/page.tsx
```

Vérifier qu'aucun `text-[Xpx]` ne reste :

```bash
grep -rn "text-\[1[0-9]px\]" apps/web/app apps/web/components
```

Expected: 0 résultat.

- [ ] **Step 2: Fix budget-summary.tsx hex**

```bash
sed -i '' 's/text-\[#4ade80\]/text-[var(--success)]/g' apps/web/components/budget-summary.tsx
grep "#4ade80" apps/web/components/budget-summary.tsx
```

Expected: 0 résultat.

- [ ] **Step 3: Fix gradient hardcoded → .cta-gradient**

Lire le fichier d'abord :

```bash
sed -n '125,150p' "apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx"
```

Remplacer manuellement `bg-gradient-to-r from-cyan-500 to-cyan-400` par `cta-gradient` (la classe est définie dans `globals.css`). Garder les autres classes du `className` intact.

- [ ] **Step 4: Fix revalidatePath doublon**

```bash
sed -n '350,360p' "apps/web/app/(game)/league/[leagueId]/auction/actions.ts"
```

Repérer les deux `revalidatePath` consécutifs L354-355 et supprimer le doublon avec Edit.

- [ ] **Step 5: Fix zod imports**

```bash
sed -i '' 's|from "zod"|from "zod/v4"|g' \
  "apps/web/app/(auth)/league/create/actions.ts" \
  "apps/web/app/(auth)/league/join/actions.ts"
grep -rn 'from "zod"' apps/web/app apps/web/lib | grep -v "zod/v4" | grep -v node_modules
```

Expected: 0 résultat (tous utilisent maintenant zod/v4).

- [ ] **Step 6: Build + tests**

```bash
cd apps/web && pnpm typecheck && pnpm test && pnpm build 2>&1 | tail -10
```

Expected: 0 erreur, tous tests passent.

- [ ] **Step 7: Commit**

```bash
git add apps/web/
git commit -m "fix: design system rule#1 + zod/v4 alignment + remove duplicate revalidate"
```

---

## Task 1.8: Hoister buildNavItems hors de Sidebar

**Files:**
- Modify: `apps/web/components/sidebar.tsx:32-60`

- [ ] **Step 1: Lire la fonction**

```bash
sed -n '28,65p' apps/web/components/sidebar.tsx
```

- [ ] **Step 2: Hoister la fonction au top-level du fichier**

Déplacer `function buildNavItems(...)` hors du composant `Sidebar`. La fonction devient un module-level export non-React. Si elle utilise `pathname`, le passer en argument.

```ts
// Top-level (avant export default function Sidebar):
function buildNavItems(pathname: string, leagueId: string, /* autres args */): NavItem[] {
  // ... corps actuel
}

// Dans Sidebar :
export default function Sidebar(...) {
  // ...
  const navItems = useMemo(
    () => buildNavItems(pathname, leagueId, /* autres */),
    [pathname, leagueId /* etc. */]
  );
  // ...
}
```

- [ ] **Step 3: Build + smoke test**

```bash
cd apps/web && pnpm typecheck && pnpm dev
# Naviguer entre /league/X/team et /league/X/budget — sidebar doit changer correctement
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "perf(sidebar): hoist buildNavItems to module scope"
```

---

## Task 1.9: Ajouter .max(8) sur setRoundDates

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts`

- [ ] **Step 1: Repérer le schema Zod**

```bash
grep -n "rounds.*z.array\|setRoundDates" "apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts"
```

- [ ] **Step 2: Ajouter .max(8) au schema**

Lire le bloc concerné, identifier le `z.array(...)` pour `rounds`, et ajouter `.max(8)` :

```ts
// Avant :
//   rounds: z.array(z.object({ ... }))
// Après :
//   rounds: z.array(z.object({ ... })).max(8, "Cannot configure more than 8 rounds per phase")
```

- [ ] **Step 3: Test**

```bash
cd apps/web && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts"
git commit -m "fix(auction): cap setRoundDates rounds at 8 to prevent DOS"
```

---

## Task 1.10: Phase 1 closeout — push et tag

- [ ] **Step 1: Push la branche avec tous les commits Phase 1**

```bash
git push origin fix/code-review-batch
git log --oneline -20
```

- [ ] **Step 2: Tag de fin de phase**

```bash
git tag phase-1-quick-wins
git push origin phase-1-quick-wins
```

- [ ] **Step 3: Smoke test global**

```bash
cd apps/web && pnpm dev
# Tour de l'app : login → league → team → bids → settings
# Vérifier que rien ne pète visuellement
```

Si problème, `git reset --hard phase-1-quick-wins~N` (N = nombre de commits à reset).

---

# Phase 2 — Sécurité fonctionnelle (2-3 jours)

Cible : #3 cross-round solvency, #7 invite_code caché. Ne pas faire #1 ni #10 ici (Phase 4).

## Task 2.1: Tests préventifs sur le bug cross-round (#3)

Avant de fixer, écrire un test qui démontre le bug — TDD.

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/cross-round.test.ts`

- [ ] **Step 1: Écrire le test failing qui démontre le bug**

```ts
// apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/cross-round.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Reuse the same mock pattern as actions.test.ts
const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

describe("placeBid — cross-round solvency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("BUG: should reject a bid that exceeds treasury when summed across all rounds", async () => {
    // Setup: team has 200K treasury, 0 contracts
    // Round 1 has an active bid of 150K
    // User tries to bid 150K in Round 2 → should fail (300K > 200K) but currently passes

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const { placeBid } = await import("./actions");

    // ... build mock chain returning team with treasury 200_000
    //     and active_bid (round=1) amount=150_000
    //     and trying to insert bid in round=2 amount=150_000

    const result = await placeBid({
      auctionId: "00000000-0000-4000-8000-000000000001",
      riderId: "00000000-0000-4000-8000-000000000002",
      amount: 150_000,
      round: 2,
    });

    expect(result.error).toMatch(/[Ii]nsufficient/);
  });
});
```

(Le test doit être complet — voir le pattern dans `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.test.ts:53` pour `makeChain`.)

- [ ] **Step 2: Lancer le test pour confirmer qu'il échoue**

```bash
cd apps/web && pnpm test cross-round 2>&1 | tail -10
```

Expected: FAIL — la solvabilité actuelle ne détecte pas le dépassement cross-round.

## Task 2.2: Fix cross-round solvency (#3)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:95-110`

- [ ] **Step 1: Modifier la query pour sommer tous les rounds**

Retirer le filtre `.eq("round", parsed.data.round)` pour sommer tous les active bids de cette team, toutes auctions/rounds confondues :

```ts
// Replace lines 95-110 (the .eq("round", ...) block):
// BEFORE:
//   const { data: activeBids } = await supabase
//     .from("auction_bids")
//     .select("id, amount")
//     .eq("team_id", team.id)
//     .eq("auction_id", parsed.data.auctionId)
//     .eq("round", parsed.data.round)
//     .eq("status", "active");
//
// AFTER:
  const { data: activeBids } = await supabase
    .from("auction_bids")
    .select("id, amount")
    .eq("team_id", team.id)
    .eq("status", "active");
```

- [ ] **Step 2: Tester**

```bash
cd apps/web && pnpm test cross-round 2>&1 | tail -10
```

Expected: PASS.

```bash
cd apps/web && pnpm test 2>&1 | tail -20
```

Expected: tous tests passent. Si un test existant casse parce qu'il assumait le comportement bug, le reviser (mais bien valider que le test était bien écrit avant de toucher).

- [ ] **Step 3: Smoke test manuel**

```bash
cd apps/web && pnpm dev
# Manuellement créer un scénario :
# - Trésorerie connue (200K)
# - Placer un bid de 150K dans le round X
# - Tenter de placer 100K dans le round Y → doit refuser (250K > 200K)
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts" \
        "apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/cross-round.test.ts"
git commit -m "fix(auction): aggregate active bids across all rounds for solvency check"
```

---

## Task 2.3: Audit RLS sur leagues + RPC join_league_by_code (#7)

**Files:**
- Create: `supabase/migrations/20260502000000_secure_invite_code.sql`
- Modify: `apps/web/app/(auth)/league/join/actions.ts` (utiliser la nouvelle RPC)

- [ ] **Step 1: Lister tous les call sites SELECT de `leagues` côté app**

```bash
grep -rn 'from("leagues")' apps/web/ 2>/dev/null | head -30
```

Identifier ceux qui ont besoin de `invite_code` : seulement le flow `(auth)/league/join`.

- [ ] **Step 2: Écrire la migration**

```sql
-- supabase/migrations/20260502000000_secure_invite_code.sql
-- Restrict leagues SELECT so invite_code is never exposed to non-members.
-- The join flow goes through a SECURITY DEFINER RPC that checks the code internally.

-- 1. New restrictive policy: only members or commissioner can SELECT a league.
DROP POLICY IF EXISTS "leagues_select_authenticated" ON public.leagues;

CREATE POLICY "leagues_select_member_or_commissioner" ON public.leagues
FOR SELECT USING (
  auth.uid() = commissioner_id
  OR EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_members.league_id = leagues.id
      AND league_members.user_id = auth.uid()
  )
);

-- 2. Public view (no invite_code) for occasional listing needs.
CREATE OR REPLACE VIEW public.leagues_public AS
  SELECT id, name, status, max_players, season_year, commissioner_id, created_at
  FROM public.leagues;

GRANT SELECT ON public.leagues_public TO authenticated;

-- 3. RPC for join-by-code flow — runs as SECURITY DEFINER to bypass RLS for the lookup.
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league record;
  v_existing_team_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate code format
  IF p_code IS NULL OR length(p_code) < 4 OR length(p_code) > 16 THEN
    RETURN jsonb_build_object('error', 'Invalid code format');
  END IF;

  -- Lookup league by code (bypasses RLS thanks to SECURITY DEFINER)
  SELECT id, name, status, max_players INTO v_league
  FROM public.leagues
  WHERE invite_code = p_code;

  IF v_league IS NULL THEN
    RETURN jsonb_build_object('error', 'League not found');
  END IF;

  -- Check capacity
  IF (SELECT count(*) FROM public.league_members WHERE league_id = v_league.id) >= v_league.max_players THEN
    RETURN jsonb_build_object('error', 'League is full');
  END IF;

  -- Check existing membership
  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = v_league.id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('error', 'Already a member of this league');
  END IF;

  -- Insert membership and team
  INSERT INTO public.league_members (league_id, user_id) VALUES (v_league.id, v_user_id);
  INSERT INTO public.teams (league_id, user_id, name) VALUES (v_league.id, v_user_id, 'My Team') RETURNING id INTO v_existing_team_id;

  RETURN jsonb_build_object('ok', true, 'league_id', v_league.id, 'team_id', v_existing_team_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
```

- [ ] **Step 3: Rollback file**

```sql
-- supabase/migrations/_rollback/20260502000000_secure_invite_code.down.sql
DROP FUNCTION IF EXISTS public.join_league_by_code(text);
DROP VIEW IF EXISTS public.leagues_public;
DROP POLICY IF EXISTS "leagues_select_member_or_commissioner" ON public.leagues;
CREATE POLICY "leagues_select_authenticated" ON public.leagues
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

- [ ] **Step 4: Modifier le server action `(auth)/league/join/actions.ts`**

Remplacer la query manuelle `from("leagues").select().eq("invite_code", code)` par un appel à la RPC :

```ts
// AVANT (~line 30-50) : lookup manuel + insert manuel
// APRÈS :
const { data, error } = await supabase.rpc("join_league_by_code", { p_code: code });
if (error || !data?.ok) {
  return { error: data?.error ?? error?.message ?? "Failed to join league" };
}
redirect(`/league/${data.league_id}`);
```

- [ ] **Step 5: Appliquer la migration EN LOCAL d'abord (si possible)**

```bash
supabase db push --dry-run  # ou
supabase db push
```

Expected: migration appliquée.

- [ ] **Step 6: Tester le flow join end-to-end**

```bash
cd apps/web && pnpm dev
```

Flow manuel :
1. Login avec un compte qui n'est PAS dans la ligue
2. Aller sur /league/join
3. Entrer un code valide → doit rejoindre
4. Entrer un code invalide → doit afficher l'erreur

Vérifier en console F12 :
```js
const { data } = await supabase.from("leagues").select("id, invite_code");
// Doit retourner SEULEMENT les leagues dont user est membre/commissioner.
// La colonne invite_code doit être nulle pour les leagues dont il est membre simple ? À tester.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260502000000_secure_invite_code.sql \
        supabase/migrations/_rollback/20260502000000_secure_invite_code.down.sql \
        "apps/web/app/(auth)/league/join/actions.ts"
git commit -m "fix(security): hide invite_code from non-members via SECURITY DEFINER RPC"
```

---

## Task 2.4: Phase 2 closeout

- [ ] **Step 1: Push & tag**

```bash
git push origin fix/code-review-batch
git tag phase-2-security
git push origin phase-2-security
```

- [ ] **Step 2: Smoke test cross-stack**

Vérifier que :
- Login OK
- Join league flow OK (avec un test code)
- Place bid avec budget OK / budget insuffisant cross-rounds → erreur
- Pas d'erreur console F12 sur la home

---

# Phase 3 — Tests économiques (2-3 jours)

Cible : #8. Couvrir `validateRound`, `lib/budget.ts`, `lib/strategies.ts`. Pré-requis pour Phase 4.

## Task 3.1: Tests pour lib/budget.ts (#8 — partie 1)

**Files:**
- Create: `apps/web/lib/budget.test.ts`

- [ ] **Step 1: Lire la fonction à tester**

```bash
cat apps/web/lib/budget.ts
```

- [ ] **Step 2: Écrire les tests**

```ts
// apps/web/lib/budget.test.ts
import { describe, it, expect } from "vitest";
import { computeAvailableBudget } from "./budget";

describe("computeAvailableBudget", () => {
  describe("phase confirmed (treasury already has salaries deducted)", () => {
    it("returns treasury - draftTotal when no drafts", () => {
      const result = computeAvailableBudget(200_000, 0, 0, 0, true);
      expect(result).toBe(200_000);
    });

    it("returns treasury - draftTotal when drafts exist", () => {
      const result = computeAvailableBudget(200_000, 0, 0, 50_000, true);
      expect(result).toBe(150_000);
    });

    it("returns negative when drafts exceed treasury", () => {
      const result = computeAvailableBudget(100_000, 0, 0, 150_000, true);
      expect(result).toBeLessThan(0);
    });

    it("ignores sponsorIncome and activeSalaries when phase confirmed", () => {
      // After phase confirm, treasury already reflects sponsor in - salaries out
      const result = computeAvailableBudget(200_000, 999_999, 999_999, 50_000, true);
      expect(result).toBe(150_000);
    });
  });

  describe("phase NOT confirmed (treasury still pre-payday)", () => {
    it("subtracts active salaries and adds sponsor income", () => {
      // treasury 200K + sponsor 300K - salaries 100K - drafts 50K = 350K
      const result = computeAvailableBudget(200_000, 300_000, 100_000, 50_000, false);
      expect(result).toBe(350_000);
    });

    it("returns negative when total commitments exceed available", () => {
      const result = computeAvailableBudget(50_000, 100_000, 100_000, 100_000, false);
      expect(result).toBeLessThan(0);
    });
  });

  it("handles zero values without crashing", () => {
    const result = computeAvailableBudget(0, 0, 0, 0, true);
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 3: Lancer les tests**

```bash
cd apps/web && pnpm test budget 2>&1 | tail -15
```

Expected: tous PASS. Si un test échoue, c'est qu'on a trouvé un bug — le documenter dans le commit avant fix.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/budget.test.ts
git commit -m "test(budget): cover computeAvailableBudget with phase-confirmed and pre-payday cases"
```

---

## Task 3.2: Tests pour lib/strategies.ts (#8 — partie 2)

**Files:**
- Create: `apps/web/lib/strategies.test.ts`

- [ ] **Step 1: Lire le module**

```bash
cat apps/web/lib/strategies.ts
```

- [ ] **Step 2: Écrire les tests pour les fonctions exportées**

```ts
// apps/web/lib/strategies.test.ts
import { describe, it, expect } from "vitest";
import { getMaxActiveStrategies, STRATEGY_TYPES, getMinLevelForStrategy } from "./strategies";

describe("getMaxActiveStrategies", () => {
  it("returns 1 for level 1-2", () => {
    expect(getMaxActiveStrategies(1)).toBe(1);
    expect(getMaxActiveStrategies(2)).toBe(1);
  });

  it("returns 2 for level 3-6", () => {
    expect(getMaxActiveStrategies(3)).toBe(2);
    expect(getMaxActiveStrategies(6)).toBe(2);
  });

  it("returns 3 for level 7-8", () => {
    expect(getMaxActiveStrategies(7)).toBe(3);
    expect(getMaxActiveStrategies(8)).toBe(3);
  });
});

describe("getMinLevelForStrategy", () => {
  it("Speciality unlocks at level 1", () => {
    expect(getMinLevelForStrategy("speciality")).toBe(1);
  });
  it("Nationality unlocks at level 3", () => {
    expect(getMinLevelForStrategy("nationality")).toBe(3);
  });
  it("Teams unlocks at level 5", () => {
    expect(getMinLevelForStrategy("teams")).toBe(5);
  });
  it("Age unlocks at level 7", () => {
    expect(getMinLevelForStrategy("age")).toBe(7);
  });
});

describe("STRATEGY_TYPES integrity", () => {
  it("has 4 strategy types", () => {
    expect(STRATEGY_TYPES).toHaveLength(4);
  });
  it("each type has slug, name, minLevel", () => {
    for (const t of STRATEGY_TYPES) {
      expect(t.slug).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(typeof t.minLevel).toBe("number");
    }
  });
});
```

- [ ] **Step 3: Lancer les tests**

```bash
cd apps/web && pnpm test strategies 2>&1 | tail -10
```

(Si certaines fonctions ont un nom différent, ajuster le test à l'API réelle après lecture.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/strategies.test.ts
git commit -m "test(strategies): cover maxActive cap + level gates per strategy type"
```

---

## Task 3.3: Tests pour validateRound (#8 — partie 3)

C'est le test le plus important. 357 lignes de logique critique, 0 test aujourd'hui.

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts`

- [ ] **Step 1: Lire validateRound en entier**

```bash
sed -n '222,357p' "apps/web/app/(game)/league/[leagueId]/auction/actions.ts"
```

Identifier les branches : auth, team fetch, drafts fetch, sponsor lookup, contracts fetch, budget check, slot check, cancel previous bids, insert new bids.

- [ ] **Step 2: Reprendre le pattern existant `installSequence`**

```bash
sed -n '70,100p' "apps/web/app/(game)/league/[leagueId]/team/gt/actions.test.ts"
```

C'est le pattern propre à reproduire.

- [ ] **Step 3: Écrire le test happy path**

```ts
// apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("validateRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("happy path: drafts within budget and slots → bids inserted", async () => {
    // ... mock chain returning:
    // - team fetched (treasury 500K, level 3)
    // - drafts list (2 drafts: 80K + 60K)
    // - active sponsor (200K monthly_budget)
    // - contracts list (1 active contract @ 50K salary)
    // - cancel previous bids (no error)
    // - insert new bids (no error)

    const { validateRound } = await import("./actions");
    const result = await validateRound("00000000-0000-4000-8000-000000000001");

    expect(result.error).toBeUndefined();
    // assert revalidatePath called with the auction page
  });

  it("budget exceeded → error returned, no insert", async () => {
    // mock team treasury 100K, drafts total 200K → should fail at budget check
    const { validateRound } = await import("./actions");
    const result = await validateRound("00000000-0000-4000-8000-000000000001");
    expect(result.error).toMatch(/[Bb]udget exceeded/);
  });

  it("slot overflow → error returned", async () => {
    // mock team level 1 (max 6 slots), 5 active contracts + 2 drafts → 7 > 6 → fail
    const { validateRound } = await import("./actions");
    const result = await validateRound("00000000-0000-4000-8000-000000000001");
    expect(result.error).toMatch(/[Rr]oster limit|[Ss]lot/);
  });

  it("re-validation: cancels previous bids before inserting new ones", async () => {
    // mock cancel chain returns ok, then insert chain
    const { validateRound } = await import("./actions");
    const result = await validateRound("00000000-0000-4000-8000-000000000001");
    expect(result.error).toBeUndefined();
    // assert that .update({status: "cancelled"}) was called before .insert
  });

  it("auth missing → error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { validateRound } = await import("./actions");
    const result = await validateRound("00000000-0000-4000-8000-000000000001");
    expect(result.error).toBeTruthy();
  });
});
```

(Compléter chaque test avec le mock chain réel — voir `team/gt/actions.test.ts` pour le pattern. Cette tâche est dense ; estimer 3-4h pour les 5 tests.)

- [ ] **Step 4: Lancer**

```bash
cd apps/web && pnpm test validateRound 2>&1 | tail -20
```

Expected: tous PASS. Si un test révèle un bug existant, le mentionner clairement dans le commit (`test: cover validateRound — found bug X`).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(game)/league/[leagueId]/auction/actions.test.ts"
git commit -m "test(auction): cover validateRound (happy path, budget, slot, re-validation, auth)"
```

---

## Task 3.4: Extraire makeChain en helper partagé

**Files:**
- Create: `apps/web/test-utils/supabase-mock.ts`
- Modify: les 4 fichiers test existants pour réutiliser

- [ ] **Step 1: Identifier les copies actuelles**

```bash
for f in apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]/actions.test.ts \
         apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.test.ts \
         apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.test.ts \
         apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.test.ts; do
  echo "=== $f ==="
  grep -n "function makeChain\|const makeChain\|installSequence" "$f"
done
```

- [ ] **Step 2: Choisir la meilleure version (`installSequence` de team/gt/actions.test.ts)**

C'est l'agent 5 qui l'a noté comme la plus propre.

- [ ] **Step 3: Extraire dans `apps/web/test-utils/supabase-mock.ts`**

```ts
// apps/web/test-utils/supabase-mock.ts
import { vi } from "vitest";

export function makeChain<T = unknown>(result: T) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    not: vi.fn(() => chain),
    is: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: any) => Promise.resolve(result).then(onFulfilled),
  };
  return chain;
}

export function installSequence(mockFrom: any, sequence: Array<[string, any]>) {
  let i = 0;
  mockFrom.mockImplementation((tableName: string) => {
    if (i >= sequence.length) {
      throw new Error(`Unexpected from("${tableName}") at index ${i}, sequence exhausted`);
    }
    const [expectedTable, result] = sequence[i++];
    if (tableName !== expectedTable) {
      throw new Error(`Expected from("${expectedTable}") at step ${i - 1}, got from("${tableName}")`);
    }
    return makeChain(result);
  });
}
```

- [ ] **Step 4: Migrer un test à la fois**

Remplacer la copie locale dans `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.test.ts` :

```ts
import { makeChain, installSequence } from "@/test-utils/supabase-mock";
// Supprimer la fonction locale makeChain
```

```bash
cd apps/web && pnpm test 2>&1 | tail -10
```

Expected: tous tests passent encore.

Répéter pour les 3 autres fichiers test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test-utils/supabase-mock.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]/actions.test.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.test.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.test.ts \
        apps/web/app/\(game\)/league/\[leagueId\]/rider/\[riderId\]/actions.test.ts
git commit -m "refactor(test): extract shared Supabase mock helpers"
```

---

## Task 3.5: Phase 3 closeout

- [ ] **Step 1: Push & tag**

```bash
cd apps/web && pnpm test 2>&1 | tail -10
# Doit montrer ~30+ tests passing
git push origin fix/code-review-batch
git tag phase-3-tests
git push origin phase-3-tests
```

---

# Phase 4 — Architecture profonde (1-2 semaines)

Cible : #9 types Supabase, #10 RPC SECURITY DEFINER (commencer par `place_bid`), #1 trigger lockdown.

**ATTENTION ORDRE OBLIGATOIRE** : #9 → #10 → #1. Ne PAS faire #1 avant #10 (casserait validateRound + auction resolution).

## Task 4.1: Générer les types Supabase (#9)

**Files:**
- Create: `apps/web/lib/database.types.ts`
- Modify: `apps/web/lib/supabase/server.ts`, `browser.ts`, `middleware.ts`
- Modify: `apps/web/package.json` (script `db:types`)

- [ ] **Step 1: Vérifier la CLI**

```bash
supabase --version
supabase projects list
```

Expected: la CLI répond, le projet `uuvshpykvpnhpeondqjt` est listé.

- [ ] **Step 2: Générer les types**

```bash
supabase gen types typescript --project-id uuvshpykvpnhpeondqjt > apps/web/lib/database.types.ts
wc -l apps/web/lib/database.types.ts
head -30 apps/web/lib/database.types.ts
```

Expected: fichier généré (~500-1500 lignes selon le schéma).

- [ ] **Step 3: Ajouter le script package.json**

```json
// apps/web/package.json — dans "scripts":
"db:types": "supabase gen types typescript --project-id uuvshpykvpnhpeondqjt > lib/database.types.ts"
```

- [ ] **Step 4: Wirer le typage dans le serveur**

```ts
// apps/web/lib/supabase/server.ts
import type { Database } from "@/lib/database.types";

export async function createClient() {
  // ...
  return createServerClient<Database>(/* ... */);
}
```

Idem pour `browser.ts` et `middleware.ts`.

- [ ] **Step 5: Lancer le typecheck — c'est ici qu'on découvre les erreurs**

```bash
cd apps/web && pnpm typecheck 2>&1 | tee /tmp/wh-types-errors.txt
wc -l /tmp/wh-types-errors.txt
```

Expected: probablement plusieurs erreurs sur les casts inline existants. C'est attendu et c'est ce qu'on veut découvrir.

- [ ] **Step 6: Fixer les erreurs typecheck par batch**

Pour chaque erreur du typecheck :
- Si c'est un cast `as { foo: bar }` qui peut être remplacé par le type Supabase généré : retirer le cast
- Si c'est un `Array.isArray(x) ? x[0] : x` : créer une helper typée :

```ts
// apps/web/lib/supabase/unwrap.ts
export function unwrapJoin<T>(x: T | T[] | null): T | null {
  if (x === null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}
```

Et remplacer les call sites un par un.

Cette étape est itérative — peut prendre 1-2 jours selon le nombre d'erreurs. Commit après chaque batch de ~5-10 fichiers.

```bash
# Après chaque batch :
cd apps/web && pnpm typecheck && pnpm test
git add apps/web/
git commit -m "refactor(types): use Database types in <module> (batch N)"
```

- [ ] **Step 7: Commit final + script db:types**

```bash
git add apps/web/package.json apps/web/lib/database.types.ts
git commit -m "feat(types): generate and integrate Supabase Database types"
```

---

## Task 4.2: RPC place_bid en SECURITY DEFINER (#10 — partie 1)

**Files:**
- Create: `supabase/migrations/20260503000000_rpc_place_bid.sql`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:placeBid`

- [ ] **Step 1: Écrire les tests d'abord (TDD)**

```ts
// apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/place-bid-rpc.test.ts
// Mocker supabase.rpc("place_bid", ...) au lieu de la chain from(..)
```

Tests à couvrir : auth, treasury, slot overflow, level gating, rider in pool, co-unlock, race condition (advisory lock).

- [ ] **Step 2: Écrire la RPC**

```sql
-- supabase/migrations/20260503000000_rpc_place_bid.sql
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_rider_id uuid,
  p_amount int,
  p_round int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_rider record;
  v_total_commitments int;
  v_existing_bid_id uuid;
  v_bid_id uuid;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Bounds check
  IF p_amount < 5000 OR p_amount > 100_000_000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 100 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 100');
  END IF;

  -- 3. Lookup auction + verify open
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;
  IF v_auction.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'Auction is not open');
  END IF;
  IF v_auction.closes_at < now() THEN
    RETURN jsonb_build_object('error', 'Auction window closed');
  END IF;

  -- 4. Lookup team for this user in the auction's league + LOCK
  SELECT * INTO v_team FROM public.teams
   WHERE user_id = v_user_id AND league_id = v_auction.league_id
   FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'No team in this league');
  END IF;

  -- 5. Lookup rider + level gating
  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF v_rider IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not found');
  END IF;
  IF NOT v_rider.ever_in_pool THEN
    RETURN jsonb_build_object('error', 'Rider not in playable pool');
  END IF;

  -- Port of lib/levels.ts:minRankForLevel — pool min by team level
  -- L1: 300, L2: 200, L3: 100, L4: 30, L5: 20, L6: 10, L7: 4, L8: 1
  IF v_rider.pcs_rank IS NOT NULL AND v_rider.pcs_rank < (
    CASE v_team.level
      WHEN 8 THEN 1
      WHEN 7 THEN 4
      WHEN 6 THEN 10
      WHEN 5 THEN 20
      WHEN 4 THEN 30
      WHEN 3 THEN 100
      WHEN 2 THEN 200
      ELSE 300
    END
  ) THEN
    RETURN jsonb_build_object('error', 'Insufficient level for this rider');
  END IF;

  -- Co-unlock check: rider unlocked only if ≥2 teams in the league have the required level
  -- Port of lib/co-unlock.ts:computeCoUnlockStatus
  -- A rider with rank R requires team level minLevelForRank(R); rider unlocked if ≥2 teams have it.
  -- Inline logic since the threshold table is small.
  DECLARE
    v_required_level int;
    v_qualifying_teams int;
  BEGIN
    -- minLevelForRank: smallest level whose pool covers this rank
    v_required_level := CASE
      WHEN v_rider.pcs_rank IS NULL THEN 1
      WHEN v_rider.pcs_rank <= 1   THEN 8
      WHEN v_rider.pcs_rank <= 4   THEN 7
      WHEN v_rider.pcs_rank <= 10  THEN 6
      WHEN v_rider.pcs_rank <= 20  THEN 5
      WHEN v_rider.pcs_rank <= 30  THEN 4
      WHEN v_rider.pcs_rank <= 100 THEN 3
      WHEN v_rider.pcs_rank <= 200 THEN 2
      ELSE 1
    END;

    SELECT count(*) INTO v_qualifying_teams
    FROM public.teams
    WHERE league_id = v_auction.league_id AND level >= v_required_level;

    IF v_qualifying_teams < 2 THEN
      RETURN jsonb_build_object(
        'error',
        format('Locked — needs %s more team(s) at Lv.%s', 2 - v_qualifying_teams, v_required_level)
      );
    END IF;
  END;

  -- 6. Solvency: sum salaries + ALL active bids (cross-rounds)
  SELECT COALESCE(SUM(locked_salary), 0) INTO v_total_commitments
   FROM public.contracts
   WHERE team_id = v_team.id AND status IN ('active', 'notice');

  v_total_commitments := v_total_commitments + (
    SELECT COALESCE(SUM(amount), 0) FROM public.auction_bids
     WHERE team_id = v_team.id AND status = 'active'
  );

  -- Check existing bid (update vs insert)
  SELECT id INTO v_existing_bid_id FROM public.auction_bids
   WHERE auction_id = p_auction_id AND team_id = v_team.id
     AND rider_id = p_rider_id AND round = p_round AND status = 'active';

  IF v_existing_bid_id IS NOT NULL THEN
    -- Subtract existing amount before adding new (replacement)
    v_total_commitments := v_total_commitments - (
      SELECT amount FROM public.auction_bids WHERE id = v_existing_bid_id
    );
  END IF;

  IF v_total_commitments + p_amount > v_team.treasury THEN
    RETURN jsonb_build_object('error', 'Insufficient budget');
  END IF;

  -- 7. Slot check (only on new bids)
  IF v_existing_bid_id IS NULL THEN
    DECLARE
      v_max_slots int;
      v_used_slots int;
    BEGIN
      -- Port of lib/levels.ts:getMaxSlots
      -- L1: 6, L2: 7, L3: 8, L4: 9, L5: 10, L6: 11, L7: 12, L8: 12
      v_max_slots := CASE v_team.level
        WHEN 8 THEN 12
        WHEN 7 THEN 12
        WHEN 6 THEN 11
        WHEN 5 THEN 10
        WHEN 4 THEN 9
        WHEN 3 THEN 8
        WHEN 2 THEN 7
        ELSE 6
      END;

      SELECT
        (SELECT count(*) FROM public.contracts
          WHERE team_id = v_team.id AND status = 'active')
        + (SELECT count(*) FROM public.auction_bids
          WHERE team_id = v_team.id AND status = 'active')
      INTO v_used_slots;

      IF v_used_slots >= v_max_slots THEN
        RETURN jsonb_build_object(
          'error',
          format('No available slots (%s/%s used)', v_used_slots, v_max_slots)
        );
      END IF;
    END;
  END IF;

  -- 8. Insert or update
  IF v_existing_bid_id IS NOT NULL THEN
    UPDATE public.auction_bids
       SET amount = p_amount, placed_at = now()
     WHERE id = v_existing_bid_id;
    v_bid_id := v_existing_bid_id;
  ELSE
    INSERT INTO public.auction_bids (auction_id, rider_id, team_id, amount, round, status, placed_at)
    VALUES (p_auction_id, p_rider_id, v_team.id, p_amount, p_round, 'active', now())
    RETURNING id INTO v_bid_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_bid(uuid, uuid, int, int) TO authenticated;
```

(Les TODO doivent être remplacés par le port effectif des helpers TS — c'est le cœur de l'effort, ~2 jours.)

- [ ] **Step 3: Rollback file**

```sql
-- supabase/migrations/_rollback/20260503000000_rpc_place_bid.down.sql
DROP FUNCTION IF EXISTS public.place_bid(uuid, uuid, int, int);
```

- [ ] **Step 4: Modifier l'action TS pour utiliser la RPC**

```ts
// apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:placeBid
// Replace ~150 lines of Supabase chain by ~10 lines:

export async function placeBid(input: PlaceBidInput) {
  const parsed = placeBidSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bid", {
    p_auction_id: parsed.data.auctionId,
    p_rider_id: parsed.data.riderId,
    p_amount: parsed.data.amount,
    p_round: parsed.data.round,
  });

  if (error || !data || (data as any).error) {
    return { error: (data as any)?.error ?? error?.message ?? "Bid failed" };
  }

  revalidatePath(`/league/${parsed.data.leagueId}/auction/${parsed.data.auctionId}`);
  return { ok: true };
}
```

- [ ] **Step 5: Apply migration & test end-to-end**

```bash
supabase db push
cd apps/web && pnpm test place-bid && pnpm dev
# Smoke test : placer un bid, modifier un bid, déclencher un budget exceeded
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260503000000_rpc_place_bid.sql \
        supabase/migrations/_rollback/20260503000000_rpc_place_bid.down.sql \
        "apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts" \
        "apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/place-bid-rpc.test.ts"
git commit -m "feat(auction): migrate placeBid to SECURITY DEFINER RPC with cross-round solvency + advisory lock"
```

---

## Task 4.3: RPC validate_round (#10 — partie 2)

C'est la fonction la plus complexe (~250 lignes plpgsql). Prévoir 2-3 jours.

**Files:**
- Create: `supabase/migrations/20260504000000_rpc_validate_round.sql`
- Create: `supabase/migrations/_rollback/20260504000000_rpc_validate_round.down.sql`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:validateRound`
- Reference: lecture de `auction/actions.ts:222-357` pour la logique exacte à porter

- [ ] **Step 1: Étendre les tests existants validateRound (Task 3.3)**

Les tests vitest restent identiques côté input/output mais maintenant ils mockent `supabase.rpc("validate_round", ...)` au lieu de la chain `.from(...)`. Adapter les mocks.

- [ ] **Step 2: Écrire la RPC validate_round**

La RPC doit reproduire le flow TS de `validateRound` :
1. Auth check (`auth.uid() = team.user_id`)
2. Lock team row (`SELECT ... FOR UPDATE`)
3. Fetch drafts + contracts + active sponsor income
4. Compute available budget — porter `lib/budget.ts:computeAvailableBudget` en SQL inline
5. Slot check — réutiliser le pattern de Task 4.2 Step 7
6. Cancel previous auction_bids du round (UPDATE status='cancelled' WHERE round=p_round)
7. INSERT les nouveaux bids depuis draft_bids
8. Return jsonb_build_object('ok', true, 'inserted', count)

Code complet à rédiger en TDD : écrire le test, puis le code, itérer. Estimation : 200-250 lignes plpgsql.

- [ ] **Step 3: Modifier l'action TS**

Réduire `validateRound` (357 lignes actuelles) à ~15 lignes :
```ts
export async function validateRound(auctionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_round", { p_auction_id: auctionId });
  if (error || !data?.ok) return { error: data?.error ?? error?.message ?? "Validation failed" };
  revalidatePath(/* ... */);
  return { ok: true };
}
```

- [ ] **Step 4: Apply migration + tests**

```bash
supabase db push
cd apps/web && pnpm test validateRound
```

- [ ] **Step 5: Smoke test bout en bout**

Flow : créer plusieurs drafts → cliquer "Validate round" → vérifier que les bids sont créés.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260504000000_rpc_validate_round.sql \
        supabase/migrations/_rollback/20260504000000_rpc_validate_round.down.sql \
        "apps/web/app/(game)/league/[leagueId]/auction/actions.ts"
git commit -m "feat(auction): migrate validateRound to SECURITY DEFINER RPC (atomic + cross-round solvent)"
```

---

## Task 4.4: RPC release_rider, confirm_phase_setup, leave_league (#10 — partie 3)

3 RPCs plus simples (~50-100 lignes chacune en plpgsql). Pour chacune :

**Files:**
- Create: `supabase/migrations/20260504100000_rpc_release_rider.sql` (+ rollback)
- Create: `supabase/migrations/20260504200000_rpc_confirm_phase_setup.sql` (+ rollback)
- Create: `supabase/migrations/20260504300000_rpc_leave_league.sql` (+ rollback)
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts:releaseRider`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts:confirmPhaseSetup`
- Modify: `apps/web/app/(game)/league/[leagueId]/settings/actions.ts:leaveLeague`

Pour CHAQUE RPC, suivre les 6 steps de Task 4.3 (tests, RPC, modif TS, apply, smoke, commit).

**Spécificités à respecter** :

- **release_rider** : implémenter le defer "release effective at next phase" (CLAUDE.md). Ajouter colonne `released_at_phase_id` si pas existante (migration séparée ou inline). Le contrat reste `status='active'` jusqu'à la transition de phase ; à la transition, un job (côté TS via `confirmPhaseSetup` ou ailleurs) marque `status='released'`.

- **confirm_phase_setup** : reproduit le payday TS actuel. Atomique. Idempotent (`phase_confirmed_id = current_phase` → skip).

- **leave_league** : 5 deletes en cascade dans l'ordre auction_bids → team_sponsors → team_strategies → teams → league_members. Wrap en single transaction (la fonction PL/pgSQL est déjà atomique).

Commit séparé par RPC pour permettre rollback ciblé.

---

## Task 4.5: Trigger teams_protect_sensitive_fields (#1)

**Maintenant que les RPCs SECURITY DEFINER existent**, le trigger peut bloquer les UPDATE non-service-role sur `level/treasury/cumulative_xp` sans casser le flow.

**Files:**
- Create: `supabase/migrations/20260505000000_protect_team_sensitive_fields.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260505000000_protect_team_sensitive_fields.sql
CREATE OR REPLACE FUNCTION public.block_team_field_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level
     OR NEW.treasury IS DISTINCT FROM OLD.treasury
     OR NEW.cumulative_xp IS DISTINCT FROM OLD.cumulative_xp
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.league_id IS DISTINCT FROM OLD.league_id
  THEN
    RAISE EXCEPTION 'Field protected: level/treasury/xp/user_id/league_id can only be modified by service_role or SECURITY DEFINER functions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_protect_sensitive_fields
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  WHEN (current_setting('role', true) <> 'service_role')
  EXECUTE FUNCTION public.block_team_field_updates();
```

- [ ] **Step 2: Rollback**

```sql
-- supabase/migrations/_rollback/20260505000000_protect_team_sensitive_fields.down.sql
DROP TRIGGER IF EXISTS teams_protect_sensitive_fields ON public.teams;
DROP FUNCTION IF EXISTS public.block_team_field_updates();
```

- [ ] **Step 3: Test exploit avant migration (preuve du bug)**

```bash
set -a && source .env && set +a
# Impersonate a user via anon key (need a real user JWT — skip si trop complexe)
# OU : vérifier directement avec service_role qu'on peut UPDATE → après migration, doit toujours marcher
curl -s -X PATCH "$SUPABASE_URL/rest/v1/teams?id=eq.<some-test-team-id>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --data '{"level": 8}'
# Doit réussir avant ET après migration (service_role bypass).
```

- [ ] **Step 4: Apply migration**

```bash
supabase db push
```

- [ ] **Step 5: Test post-migration — la RPC place_bid doit toujours marcher**

```bash
cd apps/web && pnpm test
```

Expected: tous tests passent. Si un test échoue, investiguer (probablement un endroit qui UPDATE treasury sans passer par RPC — à porter aussi).

- [ ] **Step 6: Smoke test global**

```bash
cd apps/web && pnpm dev
# Flow complet : place bid → validate round → confirm phase
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260505000000_protect_team_sensitive_fields.sql \
        supabase/migrations/_rollback/20260505000000_protect_team_sensitive_fields.down.sql
git commit -m "fix(security): block direct UPDATE on teams.level/treasury/xp via trigger"
```

---

## Task 4.6: Phase 4 closeout

- [ ] **Step 1: Push & tag**

```bash
git push origin fix/code-review-batch
git tag phase-4-architecture
git push origin phase-4-architecture
```

- [ ] **Step 2: Smoke test final**

Tour de l'app complet :
- Login + signup
- Create league + join league avec code
- Place bid + edit bid + validate round
- Confirm phase
- Release rider
- Leave league

---

# Phase 5 — Merge dans main

## Task 5.1: PR + review

- [ ] **Step 1: Créer la PR**

```bash
gh pr create --title "Code review fixes — batch 1 (security + DS + tests + RPC)" \
  --body "$(cat <<'EOF'
## Summary
Implements the 12 issues identified in `docs/reviews/2026-04-30-code-review-senior.md`:

- Phase 1 — Quick wins: XP migration, middleware.ts, Python imports, design tokens, lint nits
- Phase 2 — Security: cross-round solvency fix, invite_code hidden via RPC
- Phase 3 — Tests: validateRound, budget, strategies + shared test helpers
- Phase 4 — Architecture: Supabase types, RPC place_bid + validate_round, sensitive fields trigger

## Test plan
- [x] All vitest pass (`pnpm test`)
- [x] All pytest pass (`cd services/pcs-sync && pytest`)
- [x] Manual: place bid + validate round flow OK
- [x] Manual: join league flow OK
- [x] Manual: visual regression on banners (success/danger/warning)
- [ ] Production smoke test post-merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Review tasks (humain)**

- Self-review du diff complet : `git diff main...fix/code-review-batch | wc -l`
- Demander à un autre dev (si dispo)
- Tester en environnement de staging si dispo

- [ ] **Step 3: Merge**

Une fois validée, merge via la UI GitHub ou en CLI. Préférer un **squash merge** pour avoir un seul commit propre dans `main` avec tous les changements groupés.

- [ ] **Step 4: Cleanup**

```bash
git checkout main
git pull origin main
git branch -d fix/code-review-batch
# Garder les tags phase-1 à phase-4 pour pouvoir naviguer dans l'historique
```

---

# Annexe A — Comment rollback une phase

Chaque phase est taggée. Pour rollback :

```bash
# Rollback Phase 4 (si problème en prod) :
git checkout main
git revert phase-3-tests..phase-4-architecture
git push origin main

# OU si pas encore mergé :
git checkout fix/code-review-batch
git reset --hard phase-3-tests
git push --force origin fix/code-review-batch
```

Pour rollback une migration SQL : appliquer le fichier `_rollback/<name>.down.sql` correspondant manuellement via Supabase Studio (les rollbacks ne sont pas auto-appliqués par `supabase db push`).

# Annexe B — Backlog post-alpha (hors plan)

- **#12 rail-pages refactor** : 3-5 jours, nécessite Next.js parallel routes (`@rail` slot). À faire après alpha publique.
- Autres items du rapport principal (Top 12 + quick wins) déjà couverts ici.
- Audits de migration RLS dupliquées (auction_bids policies × 2) : nettoyage cosmétique.

# Annexe C — Pre-flight reminder

Avant de lancer la Phase 1, **confirmer Q1** (comment se ferment les auctions actuelles) avec l'utilisateur.

Si Railway tourne en réalité → réviser le Task 1.3 (peut-être qu'on doit garder main.py fonctionnel et adapter Railway).

Si l'utilisateur ferme manuellement → le plan tel qu'écrit est correct.
