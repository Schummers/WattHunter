# Audit · /league/[id]/auction/market
Generated: 2026-05-20
Files: auction/market/page.tsx + market-client.tsx + loading.tsx
States: round-active-has-bids, round-active-no-bids, round-closed, filter-applied, empty-results

---

## Component tree rendu

```
page.tsx (RSC — data fetching + auth guard)
└── MarketClient (market-client.tsx, "use client")
    ├── Search input  (inline, lines 398–421)
    ├── FilterChips   (shared — audité dans shared-components/filter-chips.md)
    ├── Counter label (inline, line 434–437)
    ├── Group accordion header (inline, lines 447–466)
    │   └── RiderCard (shared — audité dans shared-components/rider-card.md)
    │       └── renderRiderRight() (inline slot, lines 336–392)
    │           ├── Bid input container (inline)
    │           ├── Min salary label (inline)
    │           └── Error message (inline)
    ├── RiderCard (flat list, même composant)
    ├── "Load more" button (inline, lines 518–528)
    ├── Empty state (inline, lines 532–538)
    └── StickyBar (shared — audité dans shared-components/sticky-bar.md)
        └── Slot/budget summary + "Draft Auction" CTA button (children slot)

loading.tsx (indépendant — spinner centré)
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `FilterChips` → voir `shared-components/filter-chips.md`
- `RiderCard` → voir `shared-components/rider-card.md`
- `StickyBar` → voir `shared-components/sticky-bar.md`

---

## États audités

- [x] Round active, has bids (bid input rempli, StickyBar "Draft Auction (N)")
- [x] Round active, no bids (bid input vide, StickyBar désactivé)
- [x] Round closed / aucune enchère active (même layout, bouton disabled)
- [x] Filter appliqué (accordion groupé par Team / Speciality / Nationality / Age)
- [x] Empty results (aucun rider ne matche la recherche)

---

## Violations détaillées

### A · Typographie (4)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | market-client.tsx:369 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Input bid amount. `text-base` (16px Tailwind) est un token Tailwind générique, pas un token DS. DS §Typography: `--type-body` = 14px (12px mobile, scale +2 à md). Contexte input numérique — `--type-body` est le token attendu pour les inputs et champs de formulaire. Le code a une variante responsive `md:text-[length:var(--type-body)]` mais pas de fallback mobile — unifier sur le token uniquement. |
| A-002 | market-client.tsx:409 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Search input. Même violation que A-001 : `text-base` + `md:text-[length:var(--type-body)]`. Remplacer les deux classes par le seul token responsive (le token gère lui-même le scale via `globals.css`). |
| A-003 | market-client.tsx:434 | `text-[length:var(--type-label)]` | _Conforme — false positive détecteur_ | — | `--type-label` est un token DS valide (uppercase tracking, 11px). Le token est bien utilisé avec `font-bold uppercase tracking-wide`. Pas de violation. |
| A-004 | market-client.tsx:452 | `text-[length:var(--type-section)]` | _Conforme — false positive détecteur_ | — | `--type-section` est un token DS valide pour les headers de section (accordion group names). Pas de violation. |

> **Résumé violations A réelles : 2 (A-001, A-002)**

---

### B · Couleurs (0)

Aucune violation détectée. Toutes les couleurs dans `market-client.tsx` et `page.tsx` utilisent des tokens sémantiques.

Vérification exhaustive des tokens couleurs utilisés dans les éléments custom (hors composants partagés) :

| Contexte | Token utilisé | Statut |
|---|---|---|
| Search border | `var(--border-default)` | Conforme |
| Search focus ring | `var(--accent-focus-ring)` | Conforme |
| Search icon | `var(--text-ghost)` | Conforme |
| Search text | `var(--text-high)` | Conforme |
| Search placeholder | `var(--text-ghost)` | Conforme |
| Clear button hover | `var(--text-mid)` | Conforme |
| Counter label | `var(--text-low)` | Conforme |
| Accordion header bg | `var(--bg-subtle)` | Conforme |
| Accordion header border | `var(--border-subtle)` | Conforme |
| Accordion group name | `var(--text-high)` | Conforme |
| Accordion count | `var(--text-low)` | Conforme |
| Accordion chevron | `var(--text-low)` | Conforme |
| Bid input border default | `var(--border-default)` | Conforme |
| Bid input border active | `var(--accent-default)` | Conforme |
| Bid input bg active | `var(--bg-surface-hover)` | Conforme |
| Bid input text active | `var(--accent-default)` | Conforme |
| Bid input text inactive | `var(--text-low)` | Conforme |
| Euro suffix | `var(--text-ghost)` | Conforme |
| Min salary label | `var(--text-low)` | Conforme |
| Error message | `var(--status-danger)` | Conforme |
| Load more button | `var(--accent-default)` | Conforme |
| Empty state text | `var(--text-mid)` | Conforme |
| Spinner border | `var(--accent-default)` | Conforme (loading.tsx) |
| Loading text | `var(--text-mid)` | Conforme (loading.tsx) |
| Sign-in / not-member text | `var(--text-mid)` | Conforme (page.tsx) |
| StickyBar children — slot/budget | `var(--text-high)` | Conforme |
| CTA button | `cta-gradient` + `var(--cta-text)` | Conforme |

**False positive notable** : `var(--status-danger)` (line 386) — ce token est un alias de `var(--danger)` défini dans `globals.css`. Les deux formes sont correctes, `--status-danger` et `--danger` sont identiques. Pas de violation.

---

### C · Spacing & Radius (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | market-client.tsx:346 | `rounded-lg` | `rounded-md` | AUTO | Container du bid input (l'input wrapper avec border). Radius-as-affordance DS v3.1 §Radius : `--radius-md` (6px) = interactive affordance obligatoire pour inputs, buttons, chips. `rounded-lg` (8px = `--radius-lg`) est réservé aux cards et conteneurs structurels. Ce container est un champ interactif — doit être `rounded-md`. |
| C-002 | market-client.tsx:555 | `rounded-lg` | `rounded-md` | AUTO | Bouton CTA "Draft Auction" dans le `StickyBar` children slot (line 555). Même règle que C-001 : bouton interactif = `rounded-md` (6px). Cohérence avec le bouton CTA de `sticky-bar.tsx:74` déjà identifié dans l'audit partagé (même correction). |

**Éléments vérifiés — conformes :**

| Élément | Classe | Valeur | Statut |
|---|---|---|---|
| Search container | `rounded-lg` | 8px | Conforme — conteneur structurel (pas un bouton) |
| Clear button | `rounded-full` | 9999px | Conforme — icône circulaire, affordance icon button |
| `pb-20` | padding-bottom | 80px | Conforme — Tailwind spacing standard |
| `px-4`, `py-2`, `pb-3`, `pt-2` | padding | 16/8/12/8px | Conformes — Tailwind utilities standards |
| `gap-2`, `gap-0.5` | gap | 8/2px | Conformes |
| `py-2.5` | accordion header | 10px | Conforme — Tailwind spacing |
| `px-2`, `h-7` | bid input container | 8/28px | Conforme — Tailwind utilities |
| `w-20` | bid input width | 80px | Conforme — sizing pratique |

> **Note : `rounded-lg` sur le search container (line 399)** : le champ de recherche est un **conteneur structurel** (div wrappant icône + input + clear button), pas un élément tappable direct. Le radius 8px est acceptable pour un conteneur. La règle interactive affordance s'applique aux contrôles tappables/focusables directs, pas à leur wrapper. **Pas de violation**.

---

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | market-client.tsx:375–377 | `<span className="text-[length:var(--type-micro)] text-[var(--text-ghost)] font-medium">€</span>` | Garder le `<span>` — **false positive D** | — | Le `€` suffix dans le bid input est un micro-label décoratif positionné à l'intérieur du container input. Il ne répond pas à la définition d'un Tag/Badge/Chip du DS (pas un état, pas une catégorie, pas un filtre). Aucun composant DS ne correspond à ce pattern. **Pas une violation D**. |

**Éléments vérifiés — non-violations D :**

- Counter label "N available · M/P slots" : texte inline avec `<span>` + `font-bold uppercase tracking-wide`. Pattern conforme à DS §Labels. Pas un badge.
- Accordion group header avec count : `<span>` count numérique. Pas un badge — c'est un label de section. Pas de substitution applicable.
- `py-4 text-center` Load more : bouton text link. Pas un pattern badge/pill.

**Conclusion D : 0 violations réelles** (D-001 classé false positive).

---

### E · Geist Mono numbers (3)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | market-client.tsx:369 | `font-mono` présent, `tabular-nums` absent sur le bid amount dans l'input | Ajouter `tabular-nums` : `className="w-20 bg-transparent text-right text-[length:var(--type-body)] font-semibold font-mono tabular-nums outline-none ..."` | AUTO | DS §Typographie règle 2 : Geist Mono + `tabular-nums` systématiquement sur tous les nombres. Le montant de l'enchère est un nombre saisi — `tabular-nums` garantit la largeur stable pendant la saisie, évite le "jump" visuel à chaque chiffre. Note : corriger en même temps que A-001 (supprimer `text-base md:text-[length:var(--type-body)]` → `text-[length:var(--type-body)]`). |
| E-002 | market-client.tsx:382 | `<span className="font-mono">€{formatThousands(minSalary)}</span>` — `tabular-nums` absent | Ajouter `tabular-nums` : `<span className="font-mono tabular-nums">` | AUTO | Montant min salary affiché sous le bid input. `formatThousands` retourne un nombre formaté (ex: "3 200"). DS règle : `tabular-nums` obligatoire sur tout montant numérique affiché. |
| E-003 | market-client.tsx:549 | `<span className="font-mono">{totalBidCount}/{maxSlots}</span>` et `<span className="font-mono">{formatEuro(remainingBudget)}</span>` — `tabular-nums` absent sur les deux spans | Ajouter `tabular-nums` sur chacun : `<span className="font-mono tabular-nums">` | AUTO | Stats slots et budget dans le StickyBar children. `totalBidCount`, `maxSlots`, `remainingBudget` sont tous des valeurs numériques. DS règle : `font-mono` + `tabular-nums` systématiquement. Ces valeurs changent en temps réel à chaque bid entré — `tabular-nums` est particulièrement critique ici pour éviter le layout shift. |

---

## Cross-cutting issues

### CI-001 · Responsive typography pattern incohérent
`market-client.tsx` utilise un pattern `text-base md:text-[length:var(--type-body)]` sur les inputs (search + bid). Ce pattern est incohérent : le token `--type-body` gère déjà le responsive nativement via la convention DS (+2px à md). La classe `text-base` est redondante et hardcode Tailwind au lieu du token DS. → Corriger via A-001/A-002.

### CI-002 · `renderRiderRight` comme fonction inline vs composant
`renderRiderRight()` (lines 336–392) est définie inline dans le composant `MarketClient` et recréée à chaque render. Pour les listes de 100+ riders, ce pattern peut être une source de re-render inutile. Suggestion : extraire en `<BidInputCell>` stable avec `React.memo`. → **Hors scope sweep — logger dans `follow-ups.md`**.

### CI-003 · Accordion `ChevronDown` — size hardcodé
`<ChevronDown size={14} ...>` (line 459) : la taille `14` est hardcodée. DS §Icons ne spécifie pas de taille de référence pour les chevrons d'accordéon. Pas une violation A-E. → Hors scope.

### CI-004 · `loading.tsx` — spinner custom
`loading.tsx` implémente un spinner avec `border-2 border-t-transparent rounded-full animate-spin`. Pattern correct et conforme aux tokens DS (couleurs sémantiques, radius-full pour cercle). **Aucune violation détectée dans `loading.tsx`.**

---

## False positives explicites

| ID | File:Line | Élément | Raison |
|---|---|---|---|
| FP-001 | market-client.tsx:399 | `rounded-lg` sur le search container div | Conteneur structurel wrappant icon + input, pas un élément interactif direct. Radius 8px acceptable pour les conteneurs. Règle interactive affordance s'applique aux contrôles tappables, pas à leurs wrappers. |
| FP-002 | market-client.tsx:375–377 | `<span>€</span>` | Micro-label décoratif interne à l'input — pas assimilable à Tag/Badge/Pill. Aucun composant DS applicable. |
| FP-003 | market-client.tsx:386 | `var(--status-danger)` | Alias valide de `--danger` dans globals.css. Les deux tokens sont identiques. Pas de violation. |
| FP-004 | market-client.tsx:434 | `text-[length:var(--type-label)]` | Token DS valide — conforme. Pas de violation A. |
| FP-005 | market-client.tsx:452 | `text-[length:var(--type-section)]` | Token DS valide — conforme. Pas de violation A. |

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — state: round-active-has-bids (bid input rempli, StickyBar active)
- [ ] Screenshot before captured — state: round-active-no-bids (inputs vides, StickyBar désactivée)
- [ ] Screenshot before captured — state: filter-applied (accordion Teams ou Speciality)
- [ ] Screenshot before captured — state: empty-results (recherche sans résultat)
- [ ] Screenshot after captured (mêmes 4 états)
- [ ] Diff visuel décrit : A-001/A-002 (font size mobile légèrement différente de text-base → type-body), C-001/C-002 (radius 8px→6px sur bid container + CTA), E-001-003 (tabular-nums — invisible visuellement sauf si fonte non chargée)
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS (0 warning ignoré)
- [ ] `pnpm test` PASS
- [ ] Vérifier visuellement : les bid inputs ne sautent pas en largeur à la saisie (validation tabular-nums E-001)
- [ ] Vérifier visuellement : le slot/budget counter dans StickyBar ne saute pas à l'ajout d'un bid (validation E-003)
