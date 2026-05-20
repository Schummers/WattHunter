# Design System Compliance Sweep — Design Spec

**Date** : 2026-05-20
**Status** : Approved (brainstorming)
**Owner** : Jonathan
**Goal** : Sweep one-shot — remettre toute l'app au carré sur le design system v3.1, puis revenir à la discipline manuelle (Rule #1 du CLAUDE.md).

---

## Contexte

Le sweep précédent (Jules, branche `fix/design-compliance-sweep-8674597273383972459`) a échoué :
- 36 violations rapportées, 5 corrigées (toutes du même pattern trivial `text-[10px]`)
- Zéro screenshot before/after
- Substitutions sémantiquement aveugles
- Rapport sans token de remplacement proposé

Conséquence : la dette DS s'accumule, et changer une valeur de token globale n'a pas l'effet cascadé attendu parce que trop d'occurrences sont hardcodées en dur.

Ce sweep vise à éliminer la dette en une passe propre, page par page, avec preuve visuelle.

---

## Scope (violations à traiter)

### Inclus (A → E)

| Code | Classe | Détection | Token cible |
|---|---|---|---|
| **A** | Typographie | `text-\[\d+px\]`, `text-(base\|lg\|sm\|xl\|2xl\|3xl)` | `text-[length:var(--type-*)]` |
| **B** | Couleur | hex (`#[0-9a-f]{3,8}`), `text-(white\|black\|gray\|zinc\|slate)-\d+`, `bg-(white\|black\|gray\|zinc\|slate)-\d+` | `text-[var(--text-*)]`, `bg-[var(--bg-*)]`, `--accent-*`, `--cyan-*` |
| **C** | Spacing & Radius | `p-\[\d+px\]`, `gap-\[\d+px\]`, `m[xytrbl]?-\[\d+px\]`, `rounded-\[\d+px\]` | Tailwind utilities (`p-3`, `gap-2`) ou `rounded-[var(--radius-*)]` |
| **D** | Patterns composants | `<span class="rounded-full border...">` custom assimilable à Pill/Badge/Tag/Chip | Composants DS : `<Pill>`, `<Badge>`, `<FilterChip>`, `<Tabs variant="line">` |
| **E** | Geist Mono numbers | Nombres rendus dans un élément qui hérite Geist Sans (regex AST sur expressions JSX contenant des `{number}`) | Wrapper avec classe `font-mono` ou composant `<Mono>` |

### Hors scope
- Perf / a11y / dead code / bundle size (autre chantier)
- Cohérence inter-composants (subjectif, risque de refactor sans fin)
- Animations / transitions

---

## Architecture du sweep

### Découpage : page par page, dans une branche locale unique

- **Branche** : `feature/ds-compliance-sweep`
- **Commits** : un par page (ex. `fix(ds): sweep /league/[id]/auction/market`)
- **Pas de PR** : review locale via `git diff` page par page, merge final en une seule PR récapitulative
- **Rebase libre** avant merge si réorganisation utile

### Pipeline en 4 phases avec gate humain à la fin de chaque phase

```
[Phase 1 Inventoriste] → [GATE: valide sitemap] → [Phase 2 Auditeurs ×N batch] → [GATE: valide audits] → [Phase 3 Réparateurs ×N batch] → [Phase 4 Verif globale]
```

---

## Phase 1 — Inventoriste (1 agent séquentiel)

**But** : produire la carte complète du périmètre à auditer.

**Inputs** : `apps/web/app/`, `apps/web/components/`, design system `docs/watthunter-design-system-v3.md`, `apps/web/app/globals.css`.

**Output** : `docs/audits/ds-sweep-2026-05/00-sitemap.md`

```markdown
# Sitemap DS Compliance Sweep

## Routes inventoriées (N total)

### Auth & Onboarding (X routes)
- `/` (landing) — file: `app/page.tsx`
- `/login` — file: `app/login/page.tsx`
- ...

### Game — League (X routes)
- `/league/[leagueId]` — file: `app/(game)/league/[leagueId]/page.tsx`
  - States: empty (no team), pre-auction, auction-active, GT-active, off-season
  - Top-level components: HomeView, RaceFeed, BackHeader
- `/league/[leagueId]/auction/market`
  - States: round-active, round-closed, no-bids, with-bids
  - Top-level components: MarketClient, RiderCard, FilterChips
- ...

### Settings & Admin (X routes)
- ...

## Composants partagés à auditer indépendamment (rendus par 3+ pages)
- `rider-card.tsx` (utilisé par 6 pages → audit séparé puis pages référencent)
- `back-header.tsx` (toutes pages game)
- ...

## Total: N routes + M composants partagés = ~N+M unités d'audit
```

**GATE humain** : Jonathan review le sitemap. Ajoute/retire des routes, signale les pages "mortes" à ignorer, valide les états par page.

---

## Phase 2 — Auditeurs (N agents en parallèle, batch de 5)

**But** : pour chaque unité (page ou composant partagé), produire un rapport d'audit profond avec token de remplacement proposé pour CHAQUE violation.

**Stratégie de parallélisation** : batch de 5 agents simultanés. Pas tous en même temps (25+ subagents = contextes énormes + risque de rate limit MCP).

**Inputs par agent** :
- 1 unité du sitemap (= 1 page ou 1 composant partagé)
- Le sitemap complet (lecture pour comprendre les dépendances)
- Le design system v3
- Les tokens définis dans `globals.css`

**Output** : `docs/audits/ds-sweep-2026-05/pages/<slug>.md`

```markdown
# Audit · /league/[leagueId]/auction/market
Generated: 2026-05-20
Auditeur: claude (model: sonnet)

## Component tree rendu
- market-client.tsx (page-level)
  - back-header.tsx (shared)
  - filter-chips.tsx (shared)
  - rider-card.tsx (shared, x N instances)
  - <inline span> wrapper "rider stat row" (custom, line 245-280)

## États audités
- [x] Round active, has bids
- [x] Round active, no bids
- [x] Round closed
- [x] Empty (no riders match filter)

## Violations détaillées

### A · Typographie (4)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | market-client.tsx:369 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Body text in card, no semantic override needed |
| A-002 | market-client.tsx:409 | `text-base` | `text-[length:var(--type-emphasis)]` | MANUAL | Rider name context — body would be visually wrong, emphasis matches DS §rider-name |

### B · Couleurs (2)
...

### C · Spacing & Radius (3)
...

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | market-client.tsx:245-280 | `<span class="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[length:var(--type-caption)]...">` | `<Pill variant="outline" size="sm">` | DS §pill — exact match, élimine la duplication avec 4 autres pages |

### E · Geist Mono numbers (1)
...

## Cross-cutting issues (sur cette page uniquement)
- Le wrapper "rider stat row" est ré-implémenté 3x sur cette page avec 3 jeux de tokens différents. Suggérer extraction `<RiderStatRow>` après le sweep. → log dans `docs/audits/ds-sweep-2026-05/follow-ups.md`

## Checklist verification (à cocher par le repair agent)
- [ ] Screenshot before captured (état round-active, has-bids)
- [ ] Screenshot after captured
- [ ] Diff visuel review — pas de régression non voulue
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant cette page
- [ ] DOM snapshot Playwright matche (pour les composants déjà testés)
```

**Règle stricte** : aucune violation ne sort sans `Proposed` rempli. Si l'auditeur est bloqué, il flagge `BLOCKED · need DS clarification` avec une question précise, et continue les autres violations.

**GATE humain** : Jonathan parcourt les ~25-30 rapports. Ce gate est le plus important — c'est là qu'on évite que le repair agent applique des fix sémantiquement faux. Il peut être fait par échantillonnage (10 audits review fond + 20 review rapide).

---

## Phase 3 — Réparateurs (N agents en parallèle, batch de 5)

**But** : appliquer les fixes validés, avec preuve visuelle.

**Inputs par agent** :
- 1 rapport d'audit validé
- Accès Playwright (via MCP) pour screenshots
- Accès Bash pour lint/typecheck/test
- Branche locale `feature/ds-compliance-sweep` (les agents commitent séquentiellement après chaque page — pas de conflit de merge)

**Workflow par agent** :

1. **Baseline screenshots** : démarrer le dev server (déjà tournant), naviguer vers la page, capturer chaque état listé dans l'audit. Sauvegarder dans `docs/audits/ds-sweep-2026-05/screenshots/<slug>-before-<state>.png`.

2. **Appliquer les fixes AUTO** : substitutions mécaniques directement.

3. **Appliquer les fixes MANUAL** : substituer avec le token proposé. Si l'auditeur a flaggé `BLOCKED`, skipper et noter dans `docs/audits/ds-sweep-2026-05/blocked.md`.

4. **Run verification** : `pnpm typecheck`, `pnpm lint` (sans `--quiet`), `pnpm test -- <file pattern>`.

5. **After screenshots** : mêmes états, sauvegarde dans `<slug>-after-<state>.png`.

6. **Diff visuel manuel** : ouvrir before/after côte-à-côte (l'agent décrit ce qui a changé en texte dans le rapport, mais ne juge pas de l'acceptabilité — c'est pour le review humain).

7. **Commit** : message format `fix(ds): sweep <route or component> — N violations resolved`.

**Sortie par agent** : section appendée au rapport d'audit :

```markdown
## Repair log (2026-05-21)

### Applied
- A-001 ✅ (line 369: text-base → text-[length:var(--type-body)])
- A-002 ✅
- D-001 ✅ (Pill component imported from @/components/ui/pill)

### Skipped
- E-001 ⏸ BLOCKED · auditor noted "ambiguous — number embedded in sentence, ask user"

### Verification
- typecheck PASS
- lint PASS (0 warnings)
- vitest 12/12 PASS
- Screenshots: 4 states captured before/after
- Visual diff (textual description): rider name slightly less bold (expected: emphasis weight 600 vs base 400)

### Commit
`fix(ds): sweep /league/[id]/auction/market — 9 violations resolved`
sha: TBD
```

---

## Phase 4 — Vérification globale

Après tous les batches Phase 3 :

1. **Grep résiduel** : refaire passer le détecteur (script `scripts/audit-ds.ts` à écrire en Phase 0) sur toute la codebase. Doit retourner 0 violation (sauf BLOCKED).

2. **Build complet** : `pnpm build` from scratch.

3. **Playwright e2e** : `pnpm test:e2e` sur les flows critiques (auction, GT tactics).

4. **Review visuel global** : Jonathan parcourt l'app en local et compare avec sa mémoire / les screenshots before. Toute régression visuelle inattendue déclenche un rollback du commit fautif.

5. **Merge** : squash ou rebase merge de `feature/ds-compliance-sweep` dans `main`. Une seule PR finale informative (pas une PR par page).

6. **Update CLAUDE.md** : ajouter une note "Sweep DS effectué 2026-05-XX, codebase à 0 violation A-E à cette date".

7. **Archive** : déplacer `docs/audits/ds-sweep-2026-05/` → `docs/archive/audits/ds-sweep-2026-05/`.

---

## Outils à construire en Phase 0 (préparation)

Avant Phase 1, écrire :

### `scripts/audit-ds.ts` (TypeScript, exécutable via tsx)

Détecteur regex + AST utilisé par :
- L'Inventoriste (pour confirmer la liste des composants ayant des violations)
- Les Auditeurs (pour ne pas rater de violation triviale)
- Phase 4 (pour vérifier que 0 violation reste)

API :
```bash
pnpm audit-ds                          # full repo
pnpm audit-ds apps/web/app/.../page.tsx  # single file
pnpm audit-ds --class A,B              # only typo + colors
pnpm audit-ds --json                   # machine-readable for agents
```

Output JSON :
```json
{
  "file": "...",
  "violations": [
    { "id": "A-001", "line": 369, "class": "A", "rule": "text-base bypasses token scale", "current": "text-base", "context": "..." }
  ]
}
```

Le `Proposed` token n'est PAS dans le script (trop contextuel) — c'est l'agent auditeur qui le remplit.

### `scripts/screenshot-states.ts`

Wrapper Playwright qui prend une liste d'URLs + états (via query params ou actions de pré-navigation) et capture en batch. Réutilisable par les Réparateurs.

---

## Sélection des modèles

Convention WattHunter (cf. MEMORY.md) :
- **Opus 4.7** : Inventoriste (Phase 1), review des audits (gate humain assisté), Phase 4 verification finale
- **Sonnet 4.6** : Auditeurs (Phase 2) et Réparateurs (Phase 3) en subagents — c'est de l'exécution structurée

---

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Agent applique un fix MANUAL sémantiquement faux | Gate humain Phase 2 + screenshots before/after Phase 3 |
| Cascade de tokens change l'apparence d'une page involontairement | Diff visuel obligatoire par page, rollback granulaire par commit |
| Subagents en parallèle se marchent dessus sur la branche | Batches de 5 max + un agent "coordinateur" séquentialise les commits |
| Composant partagé modifié casse 6 pages | Auditer les composants partagés EN PREMIER, puis les pages qui les consomment (ordre de Phase 2) |
| Le détecteur rate des violations subtiles | Phase 4 grep résiduel + écrire des tests unitaires pour le détecteur lui-même |
| Scope creep (refactors hors A-E) | Whitelist stricte des 5 classes, les "follow-ups" partent dans un backlog séparé |

---

## Estimation

- **Phase 0** (outils) : 2-3h
- **Phase 1** (sitemap) : 30 min agent + 30 min review humaine
- **Phase 2** (audits) : ~25-30 unités × 15-20 min/agent en batch de 5 = ~2h calendrier + ~3h review humaine étalée
- **Phase 3** (repairs) : ~25-30 unités × 20-30 min/agent en batch de 5 = ~3h calendrier
- **Phase 4** (verif globale) : 1h

**Total** : ~1 journée de calendrier active + ~3h review humaine étalable sur 2-3 jours.

---

## Critères de succès

1. `pnpm audit-ds` retourne 0 violation A-E sur l'ensemble de `apps/web/`.
2. `pnpm build && pnpm test && pnpm test:e2e` PASS.
3. Aucune régression visuelle non voulue (review screenshots).
4. Tester l'objectif final : changer une valeur de token dans `globals.css` (ex. `--cyan-500`) → vérifier que ~20+ composants reflètent le changement sans toucher au code.
5. CLAUDE.md mis à jour avec la date du sweep et la baseline 0.

---

## Out of scope, follow-ups attendus

À logger dans `docs/audits/ds-sweep-2026-05/follow-ups.md` au fil de l'eau :
- Extractions de composants partagés (les "cross-cutting issues" repérés par les auditeurs)
- Tokens manquants dans le design system (si un agent propose `--type-X` qui n'existe pas, on log la demande au lieu de l'inventer)
- Perf / a11y / dead code (chantier séparé)

---

## Décisions verrouillées

- Scope : A + B + C + D + E uniquement
- Slicing : par page + composants partagés audités à part
- Branche : `feature/ds-compliance-sweep` locale, commits granulaires, merge final unique
- Parallélisation : batches de 5 sub-agents
- Gates humains : après sitemap (Phase 1) et après audits (Phase 2)
- Screenshots before/after : obligatoires pour chaque page
- Modèles : Opus pour Inventoriste + reviews + Phase 4, Sonnet pour batch Auditeurs/Réparateurs
