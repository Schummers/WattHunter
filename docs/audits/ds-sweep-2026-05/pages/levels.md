# Audit · /league/[id]/levels
Generated: 2026-05-21
Files: page.tsx + levels-timeline.tsx + loading.tsx
States: unauthenticated, active (level 1-8)

---

## Component tree rendu (1 niveau)

- `page.tsx` (Server Component)
  - `BackHeader` → voir shared-components/back-header.md (déjà audité — NE PAS dupliquer)
  - `LevelsTimeline` ← levels-timeline.tsx (Client Component)
    - Liste de `LevelRow` (inline, non extrait) pour chaque level LEVELS[]
      - Icon badge (CircleCheck / dot / Lock)
      - Progress bar `<Progress>` (Shadcn) — rendu uniquement sur le niveau courant
      - Bullet list de descriptions (via `renderBoldText`)
- `loading.tsx` — spinner centré (identique aux autres loading skeletons)

## Composants partagés utilisés (déjà audités — NE PAS dupliquer)
- `BackHeader` → voir shared-components/back-header.md
- `Progress` (Shadcn `@/components/ui/progress`) — composant système, pas audité séparément

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Tous les tokens DS utilisés correctement :
- `--type-page-title` / `--type-section` / `--type-caption` → conformes
- Pas de `text-base`, `text-sm`, `text-xs`, ni hardcoded px

**FP** : `font-mono` sur les spans XP (lignes 114 et 118) → conforme. Les valeurs XP et seuils de progression sont des chiffres → Geist Mono obligatoire selon DS §Typographie.

### B · Couleurs (3)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | levels-timeline.tsx:83 | `backgroundColor: "rgba(16,185,129,0.10)"` (completed badge bg) | `backgroundColor: "var(--success-bg)"` | AUTO | `rgba(16,185,129,0.10)` = exactement `--success-bg` défini dans globals.css. Token disponible, substitution directe. |
| B-002 | levels-timeline.tsx:85 | `backgroundColor: "rgba(14,165,233,0.10)"` (current badge bg) | `backgroundColor: "var(--badge-bg)"` | AUTO | `rgba(14,165,233,0.10)` correspond à `--badge-bg` (sky-500 @ 10%). Token disponible dans globals.css. Vérifier que la nuance sky vs cyan est intentionnelle — si c'est du cyan-400 (#0ea5e9 = sky-500 hex), c'est `--badge-bg`. |
| B-003 | levels-timeline.tsx:149-151 | `backgroundColor: isCurrent ? "var(--accent-label)" : "var(--text-ghost)"` (inline style sur bullet dot) | Migrer vers className | MANUAL | Les valeurs de couleur sont correctes (`--accent-label` et `--text-ghost` sont des tokens DS valides). La violation est l'utilisation d'inline `style={{ backgroundColor }}` au lieu de classes Tailwind. Proposer : `className={isCurrent ? "bg-[var(--accent-label)]" : "bg-[var(--text-ghost)]"}`. Confidence MANUAL car fonctionnellement équivalent. |

### C · Spacing & Radius (0)

Aucune violation.
- `rounded-[var(--radius-md)]` sur l'icon badge (ligne 80) → conforme (bouton interactif = 6px).
- `rounded-full` sur le dot current indicator (h-2 w-2) → conforme (`--radius-full` pour éléments circulaires).
- `rounded-full` sur les bullets (h-1.5 w-1.5) → conforme (éléments décoratifs circulaires).

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | levels-timeline.tsx:46-52 | État initial `expanded` calculé dans `useState(() => {...})` avec boucle for/of | Conforme — FP | Pattern correct pour initialiser un état complexe côté client. Pas de violation DS. |

FP sur D-001 : pas de violation, pattern conforme.

**Observation** : le composant `LevelsTimeline` mixte deux responsabilités (état d'expansion + rendu des rows). Candidat à extraction `LevelRow` dans un follow-up refacto, mais pas une violation DS.

### E · Geist Mono numbers (0)

Aucune violation. Les XP values utilisent `font-mono` (lignes 114, 118) → conformes.

---

## Résumé

| Catégorie | Violations | FP |
|---|---|---|
| A · Typographie | 0 | 1 |
| B · Couleurs | 3 (dont 2 AUTO, 1 MANUAL) | 0 |
| C · Spacing & Radius | 0 | 0 |
| D · Patterns | 0 | 1 |
| E · Geist Mono | 0 | 0 |
| **Total** | **3** | **2** |

**BLOCKED** : aucun. Les 3 violations B sont actionables directement (substitution de tokens).

**Follow-ups Phase 3** :
- B-002 : confirmer que sky-500 (`--badge-bg`) est le bon token pour le badge "niveau courant" (vs cyan-400/`--accent-highlight`)
- Extraction `LevelRow` en composant séparé (refacto qualité, pas DS)
