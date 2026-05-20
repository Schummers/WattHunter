# Audit · /league/[id]/team/budget/transactions
Generated: 2026-05-21
Files: transactions/page.tsx + transactions-client.tsx + loading.tsx
States: transactions-all, transactions-filtered, transactions-empty, month-grouped

---

## Component tree rendu

```
page.tsx (RSC — data fetching + auth guard)
└── TransactionsClient (transactions-client.tsx, "use client")
    ├── BackHeader (shared — audité dans shared-components/)
    ├── SegmentedControl (shared — audité dans shared-components/segmented-control.md)
    └── Month groups loop (groupByMonth, inline)
        ├── Month header (div flex, lines 81–87)
        │   ├── Month label span (UPPERCASE, inline, line 82–84)
        │   └── Net amount span (inline, line 85–86)
        └── TransactionRow[] (shared — audité dans shared-components/transaction-row.md)

loading.tsx (indépendant — spinner centré)
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `BackHeader` → voir `shared-components/back-header.md`
- `SegmentedControl` → voir `shared-components/segmented-control.md`
- `TransactionRow` → voir `shared-components/transaction-row.md`

---

## États audités

- [x] Toutes transactions (filtre "All", grouped by month)
- [x] Filtre catégorie appliqué (Salaries / Sponsors / Auctions via SegmentedControl)
- [x] État vide (no transactions, empty state)
- [x] Groupement mois avec net positif et net négatif

---

## Violations détaillées

### A · Typographie (0)

Aucune violation détectée.

Vérification exhaustive :

| Contexte | Token utilisé | Statut |
|---|---|---|
| Month label "JANUARY 2026" | `text-[length:var(--type-label)]` | Conforme — token label pour UPPERCASE structurel |
| Net amount mensuel | `text-[length:var(--type-caption)]` | Conforme |
| Empty state "No transactions yet" | `text-[length:var(--type-caption)]` | Conforme |
| Spinner loading text | `text-[length:var(--type-caption)]` | Conforme (loading.tsx) |

---

### B · Couleurs (0)

Aucune violation détectée.

Vérification exhaustive :

| Contexte | Token utilisé | Statut |
|---|---|---|
| Month label couleur | `var(--text-low)` | Conforme |
| Net amount couleur | `var(--text-high)` | Conforme |
| Dividers entre TransactionRow | `var(--border-subtle)` | Conforme — `divide-[var(--border-subtle)]` |
| Empty state couleur | `var(--text-low)` | Conforme |
| Spinner border | `var(--accent-default)` | Conforme (loading.tsx) |
| Spinner texte | `var(--text-mid)` | Conforme (loading.tsx) |

---

### C · Spacing & Radius (0)

Aucune violation détectée.

Vérification exhaustive :

| Élément | Classe | Valeur | Statut |
|---|---|---|---|
| Container principal | `pb-24` | 96px | Conforme — Tailwind utility |
| Filter padding | `px-4 py-3` | 16/12px | Conforme |
| Month header | `px-4 py-2` | 16/8px | Conforme |
| Empty state | `px-4 py-8` | 16/32px | Conforme |

---

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | transactions-client.tsx:82–84 | `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">` | **False positive — voir justification** | — | Détecté comme "inline span UPPERCASE + tracking → possible Badge label". **Contexte réel : c'est un label de section header** (mois + année en capitales, ex: "JANUARY 2026"). DS §Lists : `--type-label` (12px/700 UC + tracking, `--text-low`) est exactement le token prescrit pour les "Section headers". Ce pattern est conforme — c'est l'usage canonique du token `--type-label`. Aucun composant DS (Pill/Badge/Tag/Chip) ne correspond à ce contexte. **Pas une violation D.** |

**Conclusion D : 0 violations réelles** (D-001 classé false positive).

---

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | transactions-client.tsx:85 | `font-mono text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums` | Remplacer `font-mono` par `font-[family-name:var(--font-geist-mono)]` | MANUAL | `font-mono` (Tailwind) mappe vers `--font-mono: "Geist Mono"` dans `globals.css` — fonctionnellement correct. Mais la convention établie dans le dossier `budget/` (notamment `budget-client.tsx` lignes 92–119 et `marketplace-client.tsx` ligne 123) est d'utiliser `font-[family-name:var(--font-geist-mono)]` pour passer explicitement par la variable CSS Next.js du package `geist`. Les deux approches rendent la même fonte, mais l'incohérence de convention dans le même dossier mérite d'être résolue. Confidence MANUAL car le changement est non-trivial (chaque token font-mono du codebase devrait idéalement être homogène) et l'impact visuel est nul. |

**Note importante :** `tabular-nums` est bien présent (line 85), ce qui est conforme. La violation E-001 est purement une incohérence de convention de token font, pas une absence de Geist Mono.

---

## Cross-cutting issues

### CI-001 · `groupByMonth` — fonction inline dans le fichier client
`groupByMonth` (lines 29–50) est une fonction de transformation de données définie dans le composant client. Elle mériterait d'être extraite dans `lib/format.ts` ou `lib/sponsors.ts` pour la testabilité (les fonctions `filterTransactions` et `TRANSACTION_FILTER_OPTIONS` sont déjà dans `lib/sponsors.ts`). → Hors scope sweep, logger `follow-ups.md`.

### CI-002 · `loading.tsx` — spinner custom identique à marketplace/loading.tsx
Pattern copié-collé avec `marketplace/loading.tsx`. Candidat à un composant `<LoadingSpinner>` partagé dans `components/`. → Hors scope, `follow-ups.md`.

### CI-003 · Net amount — positif non-coloré
Le net mensuel (line 85–86) affiche `+€X,XXX` ou `-€X,XXX` mais la couleur est toujours `var(--text-high)`. DS §Couleurs sémantiques indique `--status-success` pour les gains et `--status-danger` pour les pertes. Pas une violation A-E (pas de hardcode hex/class Tailwind couleur), mais incohérence UX. → Hors scope, `follow-ups.md`.

---

## False positives explicites

| ID | File:Line | Élément | Raison |
|---|---|---|---|
| FP-001 | transactions-client.tsx:82–84 | `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">` | Section header de mois — usage canonique de `--type-label` DS §Lists. Détecté par le script comme "inline span UPPERCASE + tracking → possible Badge" mais la règle D s'applique aux spans assimilables à Pill/Badge/Tag. Un header de section (JANUARY 2026) n'est pas un badge. |
| FP-002 | loading.tsx:4 | `rounded-full` | Spinner circulaire — `rounded-full` = `--radius-full` (9999px). Conforme pour un cercle de spinner. |

---

## Résumé

| Classe | Violations réelles | False positives | BLOCKED |
|---|---|---|---|
| A — Typographie | 0 | 0 | 0 |
| B — Couleurs | 0 | 0 | 0 |
| C — Spacing & Radius | 0 | 0 | 0 |
| D — Patterns composants | 0 | 1 | 0 |
| E — Geist Mono numbers | 1 (E-001) | 1 | 0 |
| **Total** | **1** | **2** | **0** |

**Status : READY FOR REPAIR (1 violation, confidence MANUAL)**

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — state: transactions-all (grouped, multiple months)
- [ ] Screenshot before captured — state: transactions-empty ("No transactions yet")
- [ ] Screenshot before captured — state: filter-applied (ex: filtre "Salaries")
- [ ] Screenshot after captured (mêmes 3 états)
- [ ] Diff visuel décrit : E-001 (aucun changement visuel attendu — même fonte, juste convention token)
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS (0 warning ignoré)
- [ ] `pnpm test` PASS

## Notes Phase 3

**E-001 — Convention font Geist Mono :** si la décision est d'harmoniser sur `font-[family-name:var(--font-geist-mono)]` dans tout le dossier budget/, le repair agent doit aussi vérifier `budget-client.tsx` pour s'assurer qu'il est déjà conforme (il l'est — cf. grep), et laisser un commentaire dans `follow-ups.md` si d'autres fichiers hors-budget utilisent `font-mono` de manière incohérente.

Alternative : décider de standardiser sur `font-mono` (Tailwind v4 natif, plus court) dans tout le projet — auquel cas `marketplace-client.tsx` et `budget-client.tsx` seraient à corriger à leur tour. Cette décision dépasse le scope d'une page seule → trancher au niveau projet et logger dans `follow-ups.md`.
