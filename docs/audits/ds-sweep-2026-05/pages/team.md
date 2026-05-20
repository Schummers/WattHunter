# Audit · /league/[leagueId]/team
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4.6)
Branch: feature/ds-compliance-sweep

---

## Component tree rendu

```
team/layout.tsx
  SubTabs (sub-tabs.tsx) — sticky nav "My Team / {GT Label} / Budget"
  team/page.tsx
    loading.tsx (suspense boundary)
    [server component — données inlinées]
    ├─ RailLink → BrandCard (brand-card.tsx) — XP hero card
    ├─ [Strategy Slots Section]
    │   ├─ RailLink → [active strategy row] × N (inline div)
    │   │   ├─ [Icon div — rounded-full]
    │   │   ├─ [name + value spans]
    │   │   └─ [boost badge span — rounded-[var(--radius-pill)]]
    │   └─ RailLink → [empty slot row] × N (inline div)
    │       └─ [dashed circle div — rounded-full]
    └─ [Roster Section]
        ├─ RiderCard (rider-card.tsx — shared, audit séparé) × N
        └─ RiderCard isOpenSlot × N
```

**Composants partagés référencés** :
- `rider-card.tsx` → voir `shared-components/rider-card.md` (D-001, E-001/E-002/E-003)
- `brand-card.tsx` → hors liste partagés (< 3 consommateurs) — audité ici dans son contexte d'usage

---

## États audités

- [x] `roster-has-riders` — équipe avec coureurs actifs + stratégies actives
- [x] `roster-empty` — équipe sans coureurs (slots ouverts uniquement)
- [x] `strategies-active` — au moins un slot de stratégie rempli (+ boostPct badge)
- [x] `strategies-empty` — tous les slots de stratégie vides (empty slot rows)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Toutes les tailles de police dans `page.tsx` et `loading.tsx` utilisent `text-[length:var(--type-*)]`. Le layout (`layout.tsx`) ne contient pas de rendu de texte propre. `brand-card.tsx` (composant dédié à cette page) : conforme.

### B · Couleurs (0)

Aucune violation. Toutes les couleurs utilisent des tokens sémantiques :
- `var(--text-high)`, `var(--text-mid)`, `var(--text-low)`, `var(--text-ghost)` — textes
- `var(--bg-surface)`, `var(--bg-subtle)` — fonds
- `var(--border-subtle)`, `var(--border-default)` — bordures
- `var(--badge-bg)`, `var(--accent-highlight)` — boost badge
- `var(--bg-app)` dans `SubTabs` (sub-tabs.tsx), `var(--accent-default)` pour l'onglet actif

Pas de hex hardcodé, pas de classe Tailwind palette (gray-*, zinc-*, etc.).

**Note `brand-card.tsx` ligne 66** : utilise `var(--surface-overlay)` qui est défini dans `globals.css` (ligne 139 : `rgba(255, 255, 255, 0.05)`). Token valide — pas une violation.

### C · Spacing & Radius (0)

Aucune violation regex (pas de `rounded-[Npx]`, `p-[Npx]`, `gap-[Npx]`).

**Note sémantique — `rounded-full` (page.tsx L.225 et L.254)** :
- L.225 : icône de stratégie active — `rounded-full bg-[var(--bg-surface)]`
- L.254 : empty slot — `rounded-full border border-dashed border-[var(--border-default)]`

Par convention DS (identique au constat `rider-card.md` §C) : `rounded-full` = `border-radius: 9999px` = équivalent de `--radius-full`. Forme Tailwind canonique, utilisée dans tout le codebase. **False-positive sémantique** — aucune correction requise.

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | page.tsx:237 | `<span className="rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-2 py-0.5 text-[length:var(--type-caption)] font-semibold text-[var(--accent-highlight)]">+{slot!.boostPct}%</span>` | `<Badge variant="highlighted" className="shrink-0 font-mono tabular-nums">+{slot!.boostPct}%</Badge>` | MANUAL | DS §Badge — variant "highlighted" spécifié pour "boost %, strategy type, XP badge" avec `--badge-bg` + `--accent-label`. Pattern identique à `rider-card.tsx:136` (D-001 dans `shared-components/rider-card.md`). Remplacer l'inline span assure la cohérence inter-pages. **Caveat** : `--accent-highlight` (cyan-400) vs `--accent-label` (#0ea5e9, sky-500) — vérifier visuellement. Si différence visible, passer `className="text-[var(--accent-highlight)]"` en override sur `<Badge>`. |

### E · Geist Mono numbers (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | page.tsx:274 | `<span className="font-mono">{riderCount}/{maxSlots}</span>` — `tabular-nums` absent | `<span className="font-mono tabular-nums">{riderCount}/{maxSlots}</span>` | AUTO | DS §Typographie règle 2 : Geist Mono sur tous les nombres, toujours avec `tabular-nums`. `riderCount` et `maxSlots` sont des entiers (ex: `3/8`). Ajouter `tabular-nums` garantit la largeur stable des chiffres. |
| E-002 | page.tsx:237 | `{slot!.boostPct}%` rendu dans le span boost badge sans `font-mono` ni `tabular-nums` | Après application D-001 (`<Badge variant="highlighted">`), ajouter `className="font-mono tabular-nums"` sur le Badge | MANUAL | `boostPct` est un entier (ex: `+15%`). DS impose Geist Mono sur tous les nombres. À appliquer conjointement avec D-001. |

---

## Faux positifs du détecteur (`pnpm audit-ds --json`)

Le script signale 3 violations E (E-001/002/003, lignes 190-193) sur :
- `xp={xp}` (L.190)
- `level={level}` (L.191)
- `rank={rank}` (L.193)

**Verdict : tous les 3 sont des faux positifs.** Ce sont des valeurs numériques passées en **props** à `<BrandCard>` — elles ne sont pas rendues dans le DOM par `page.tsx`. Le rendu réel se fait dans `brand-card.tsx` où `xp.toLocaleString()`, `level`, `rank` sont tous enveloppés dans `font-mono` (L.60-71 de `brand-card.tsx`). Le heuristique du détecteur (`Number variable in non-mono context`) ne distingue pas prop-passing vs render — limitation connue du script.

Ces 3 items ne sont PAS des violations à corriger dans `page.tsx`. Si `brand-card.tsx` avait des violations E, elles seraient à corriger dans ce fichier.

---

## Cross-cutting issues

- **Boost badge dupliqué** : le pattern `rounded-[var(--radius-pill)] bg-[var(--badge-bg)] ... text-[var(--accent-highlight)]` est répliqué identiquement dans `page.tsx:237` (stratégie boost) et `rider-card.tsx:136` (boost badge coureur). Les deux doivent migrer vers `<Badge variant="highlighted">` en même temps pour éviter une divergence. → Coordonner réparation D-001 ici avec D-001 de `rider-card.md`.

- **`brand-card.tsx` hors liste partagés** : ce composant est consommé uniquement par `team/page.tsx` (1 consommateur identifié) — pas audité séparément. Aucune violation détectée dans son code lors de cette revue (typo, couleurs, spacing tous conformes). Si un 2e consommateur est ajouté, promouvoir au statut "composant partagé" et auditer séparément.

- **`sub-tabs.tsx`** (rendu par `layout.tsx`) : 2 consommateurs connus (`team/layout.tsx` et `auction/layout.tsx`), en dessous du seuil partagé (3). Aucune violation détectée dans le composant. Violations éventuelles à reporter dans les audits des pages respectivement.

---

## Checklist verification (à cocher par le repair agent)

### État `roster-has-riders`
- [ ] Screenshot before capturé (coureurs actifs + stratégie active avec badge boost)
- [ ] Screenshot after capturé
- [ ] Diff visuel décrit

### État `roster-empty`
- [ ] Screenshot before capturé (slots ouverts uniquement, pas de coureurs)
- [ ] Screenshot after capturé

### État `strategies-empty`
- [ ] Screenshot before capturé (empty slot rows avec dashed circle)
- [ ] Screenshot after capturé

### Vérifications techniques
- [ ] `pnpm typecheck` PASS (import `Badge` depuis `@/components/ui/badge` à vérifier)
- [ ] `pnpm lint` PASS (0 warnings ignorés)
- [ ] `pnpm test` PASS (tests touchant `team/page` si existants)
- [ ] Pas de régression visuelle sur `rider-card.tsx` (D-001 coordonné)

---

## Récapitulatif violations

| Classe | Count | AUTO | MANUAL | BLOCKED | FP |
|---|---|---|---|---|---|
| A | 0 | — | — | — | — |
| B | 0 | — | — | — | — |
| C | 0 | — | — | — | 2 (`rounded-full` sémantique) |
| D | 1 | 0 | 1 | 0 | — |
| E | 2 | 1 | 1 | 0 | 3 (props passées à BrandCard) |
| **Total** | **3** | **1** | **2** | **0** | **5** |

**BLOCKED** : aucun.
**FP** : 5 (3 du détecteur script sur props BrandCard + 2 `rounded-full` sémantiques).

---

## Notes Phase 3 (repair agent)

1. **E-001** (AUTO) : `page.tsx:274` — ajouter `tabular-nums` au `<span className="font-mono">`. Trivial, 1 mot à ajouter.

2. **D-001 + E-002** (MANUAL, à faire conjointement) :
   - Importer `Badge` depuis `@/components/ui/badge` en haut de `page.tsx`
   - Remplacer le `<span>` ligne 237 par `<Badge variant="highlighted" className="shrink-0 font-mono tabular-nums">+{slot!.boostPct}%</Badge>`
   - **Valider visuellement** : `--accent-highlight` (cyan-400, `#22d3ee`) vs `--accent-label` (#0ea5e9). Si différence visible sur le badge, utiliser `className="shrink-0 font-mono tabular-nums text-[var(--accent-highlight)]"` pour override.
   - Coordonner avec la réparation D-001 de `rider-card.md` pour cohérence visuelle.

3. **Ordre recommandé** : E-001 en premier (trivial + pas de dépendance), puis D-001+E-002 (dépend de `Badge` import + validation visuelle).
