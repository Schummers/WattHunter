# Audit · apps/web/components/filter-chips.tsx
Generated: 2026-05-21
Used by: auction/market/market-client, achievements/achievements-client, team/budget/budget-client

## Tour d'horizon

Composant de filtrage en section (Option B: Free Chips selon DS §Filter Chips). Rendu une rangée de `<button>` scrollables horizontalement. Props : `options[]` (label + variant optionnel), `activeIndex`, `onChange`. Variante `"accent"` disponible pour des options visuellement distinctives (ex: "My Bids"). 51 lignes, pas de sous-composants importés.

## Violations détaillées

### A · Typographie (0)

Aucune violation détectée.

- `text-[length:var(--type-caption)]` : conforme — token DS `--type-caption` (12px/500) utilisé correctement.
- `font-medium` (inactive) + `font-semibold` (active) : conforme — DS Option B spécifie weight 500 pour inactive et 600 pour active.

### B · Couleurs (0)

Aucune violation détectée.

Toutes les couleurs utilisent des tokens sémantiques corrects :

| Contexte | Token utilisé | Token DS attendu | Statut |
|---|---|---|---|
| Inactive text | `var(--text-low)` | `--text-low` | Conforme |
| Inactive border | `var(--border-default)` | `--border-default` | Conforme |
| Inactive bg | `transparent` | `transparent` | Conforme |
| Hover text | `var(--text-mid)` | `--text-mid` | Conforme |
| Hover border | `var(--border-hover)` | `--border-hover` | Conforme |
| Active (default) text | `var(--text-high)` | `--text-high` | Conforme |
| Active (default) border | `var(--border-hover)` | `--border-hover` | Conforme |
| Active (default) bg | `var(--bg-surface-active)` | `--bg-surface-active` | Conforme |
| Active (accent) text | `var(--accent-default)` | `--accent-default` | Conforme |
| Active (accent) border | `var(--accent-default)` | `--accent-default` | Conforme |
| Active (accent) bg | `var(--badge-bg)` | `--badge-bg` | Conforme |

### C · Spacing & Radius (3)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | filter-chips.tsx:22 | `rounded-[6px]` | `rounded-md` | AUTO | DS §Filter Chips : radius 6px = interactive affordance. `globals.css` définit `--radius-md: 6px`, ce qui correspond au token Tailwind `rounded-md`. Substitution mécanique sûre. |
| C-002 | filter-chips.tsx:22 | `px-[14px]` | `px-3.5` | AUTO | 14px = 3.5 × 4px = Tailwind `px-3.5` (3.5 spacing units). DS Option B spec : `padding: 6px 14px` — la valeur 14px n'a pas de token `--space-*` dédié dans globals.css. Tailwind `px-3.5` est le mapping standard sans valeur arbitraire. |
| C-003 | filter-chips.tsx:22 | `py-[6px]` | `py-1.5` | AUTO | 6px = 1.5 × 4px = Tailwind `py-1.5`. DS Option B spec : `padding: 6px 14px` — même logique que C-002. |

### D · Patterns composants (0)

Non applicable — ce composant EST le FilterChip (composant DS). Aucune substitution à faire. Le composant implémente correctement le pattern Option B (Free Chips) avec border, gap-2, overflow-x-auto, scrollbar-none, boutons `shrink-0`.

### E · Geist Mono numbers (0)

Aucun nombre rendu dans ce composant. Le composant affiche uniquement les labels de type string (`option.label`). Pas de violation E.

## Cross-cutting issues

- **a11y manquant (hors scope A-E)** : le composant manque `role="tablist"` sur le container et `role="tab"` + `aria-selected` sur chaque bouton. DS §Filter Chips §Accessibility les exige explicitement. → Logger dans `follow-ups.md`.
- **`window.scrollTo` dans onClick** : le composant remet le scroll en haut à chaque changement de filtre (`window.scrollTo({ top: 0, behavior: "instant" })`). Ce comportement est potentiellement indésirable si le FilterChips est utilisé dans un contexte de page avec scroll partiel (ex: budget-client avec phase selector). → Logger dans `follow-ups.md`.
- **Type `variant` sur FilterChipOption** : le type `"default" | "accent"` pour variant est correct. Aucun problème DS.

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — state: default (no selection ou premier chip actif)
- [ ] Screenshot before captured — state: with-selection (chip actif autre que premier)
- [ ] Screenshot before captured — state: with-accent-active (variant accent actif, ex: "My Bids" sur market)
- [ ] Screenshot before captured — state: scrollable (si 5+ options)
- [ ] Screenshot after captured (mêmes états)
- [ ] Diff visuel : changements cosmétiques uniquement (rounded-[6px] → rounded-md visuellement identique, px-3.5/py-1.5 visuellement identiques)
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS (0 warning ignoré)
- [ ] `pnpm test` PASS
- [ ] Vérification visuelle sur les 3 pages consommatrices : market-client, achievements-client, budget-client
