# Audit · /league/[id]/help
Generated: 2026-05-21
Files: page.tsx + loading.tsx + components/game-guide-accordion.tsx + lib/help-table.tsx
States: static (pas d'état serveur — page entièrement statique)

---

## Component tree rendu (1 niveau)

- `page.tsx` (Client Component — "use client")
  - `BackHeader` → voir shared-components/back-header.md (déjà audité — NE PAS dupliquer)
  - `GameGuideAccordion` ← components/game-guide-accordion.tsx
    - `HelpSection[]` (10 sections — HELP_SECTIONS)
      - Section header button (Icon + title + subtitle + ChevronDown)
      - Content wrapper (transition max-h)
        - `Prose` wrapper — styles prose avec `[&_*]` selectors
          - `Formula` boxes
          - `Table` ← lib/help-table.tsx
          - `<p>`, `<ul>`, `<ol>`, `<strong>`, `<code>` (JSX natif)
- `loading.tsx` — spinner centré (identique aux autres loading skeletons)

## Composants partagés utilisés (déjà audités — NE PAS dupliquer)
- `BackHeader` → voir shared-components/back-header.md

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Tokens DS utilisés correctement :
- `--type-page-title` (page.tsx) → conforme
- `--type-emphasis` (section title dans accordion) → conforme
- `--type-caption` (subtitle, table headers, table cells, formula, code) → conforme
- `--type-body` (prose wrapper base) → conforme

**FP** : le `Prose` wrapper (ligne 41 game-guide-accordion.tsx) utilise `[&_code]:font-mono` → conforme pour le code inline. Pattern `[&_selector]` est un choix de styling de prose acceptable.

**FP** : `Formula` (ligne 32) utilise `font-mono` → conforme pour les blocs de formule mathématique/code.

### B · Couleurs (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | game-guide-accordion.tsx:569 | `bg-[var(--bg-surface)]` sur l'icon badge du header | Conforme — FP | `--bg-surface` est un token DS valide. Aucune violation. |

Aucune violation réelle sur les couleurs.

Tokens utilisés dans game-guide-accordion.tsx :
- `--border-subtle` → conforme (dividers entre sections)
- `--bg-subtle` → conforme (hover accordéon)
- `--bg-surface` → conforme (icon badge bg + Formula bg + code bg)
- `--text-high` → conforme (section title, strong, table cells)
- `--text-mid` → conforme (prose base, table headers)
- `--text-low` → conforme (subtitle, captions)
- `--text-ghost` → conforme (chevron)

Tokens utilisés dans help-table.tsx :
- `--border-subtle` → conforme
- `--bg-surface` → conforme (thead bg)
- `--text-mid` → conforme (thead text)
- `--text-high` → conforme (cell text)

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | game-guide-accordion.tsx:569 | `rounded-lg` sur l'icon badge header | `rounded-[var(--radius-lg)]` | MANUAL | `rounded-lg` = 8px = `--radius-lg`. Tailwind class et token DS sont fonctionnellement équivalents ici. Violation mineure : préférer le token explicite pour cohérence avec le reste du codebase. Confidence MANUAL — fonctionnellement neutre. |

**Note** : `rounded-lg` dans `Formula` (ligne 32) et dans `help-table.tsx` (ligne 9) → FP. Ces éléments sont des conteneurs de lecture (non-interactifs), et 8px est le radius de card correct. Utiliser `rounded-[var(--radius-lg)]` serait plus strict mais l'impact visuel est nul.

### D · Patterns composants (2)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | game-guide-accordion.tsx:590-598 | Animation `max-h-0 → max-h-[2000px]` avec `transition-all duration-200` | `overflow-hidden` + `grid-rows-[0fr]` → `grid-rows-[1fr]` | MANUAL | Le pattern `max-h-[2000px]` pour les accordéons est un anti-pattern connu : l'animation n'est pas linéaire (collapse rapide, expand variable). Pattern DS recommandé si accordéon = `grid-rows` ou `details/summary`. Ceci dit, `max-h` est répandu dans la codebase (voir GT Tactics) → cohérence interne l'emporte. Logger en follow-up. Ne pas bloquer Phase 3. |
| D-002 | game-guide-accordion.tsx:41 | `Prose` wrapper avec `[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded ...` | Conforme — FP | Le pattern `[&_selector]` est une approche valide pour styler du contenu prose générique. Pas de violation DS. C'est intentionnel pour éviter de wrapper chaque `<ul>` et `<code>` inline. |

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | game-guide-accordion.tsx (multiples) | Valeurs numériques dans `<Table>` rows (ex: "500", "380", "250K", "19,000 EUR") rendues sans `font-mono` sur les cellules | Ajouter `font-mono` sur les `<td>` numériques dans `help-table.tsx` | MANUAL | DS §Typographie : "Geist Mono (ALL numbers)". Les cellules de table contenant des chiffres (PCS points, salaires, XP seuils) n'utilisent pas Geist Mono. `help-table.tsx` ligne 30 : `<td className="px-3 py-2 text-[var(--text-high)]">` — pas de `font-mono`. Confidence MANUAL car les tables sont des tables d'aide/documentation avec mix texte+chiffres — le DS "tous les chiffres" peut être interprété strictement ou non. Proposer : `[&_td]:font-mono` sur le wrapper ou `font-mono` sur `<td>` dans help-table.tsx. |

---

## Résumé

| Catégorie | Violations | FP |
|---|---|---|
| A · Typographie | 0 | 2 |
| B · Couleurs | 0 | 1 |
| C · Spacing & Radius | 1 (MANUAL, impact nul) | 2 |
| D · Patterns | 1 (follow-up) | 1 |
| E · Geist Mono | 1 (MANUAL) | 0 |
| **Total** | **3** | **6** |

**BLOCKED** : aucun. La page help est la plus conforme des 3 pages auditées.

**Follow-ups Phase 3** :
- E-001 : décider si `font-mono` doit s'appliquer aux cellules de table d'aide — impact sur lisibilité à valider
- D-001 : migration accordéon `max-h` → `grid-rows` (animation quality, non bloquant)
- C-001 : remplacer `rounded-lg` par `rounded-[var(--radius-lg)]` dans game-guide-accordion (cosmétique pur)
