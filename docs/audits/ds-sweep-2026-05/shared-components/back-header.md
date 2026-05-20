# Audit · apps/web/components/back-header.tsx
Generated: 2026-05-21
Used by: settings, ranking/team/[teamId], auction/rounds-client, rider/rider-detail-client, team/strategies, team/budget/marketplace-client, team/budget/transactions-client, levels, help

## Tour d'horizon
`BackHeader` est une barre de navigation secondaire sticky (top-0, z-40) affichant un bouton retour avec icône `ArrowLeft` et un label textuel. Il accepte deux props : `label: string` (obligatoire) et `onBack?: () => void` (facultatif — fallback sur `router.back()`). Aucune variante visuelle conditionnelle : le rendu est toujours identique quelle que soit la page consommatrice.

## Violations détaillées

### A · Typographie (0)
Aucune violation — `text-[length:var(--type-emphasis)]` est le token correct.

### B · Couleurs (0)
Aucune violation — `bg-[var(--bg-app)]`, `text-[var(--text-mid)]`, `hover:text-[var(--text-high)]` sont tous des tokens sémantiques DS valides.

### C · Spacing & Radius (1)
| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | back-header.tsx:17 | `min-h-[40px]` | `min-h-10` | AUTO | Tailwind `min-h-10` = 40px (10 × 4px spacing base). Substitution mécanique 1-pour-1, aucun impact visuel. Préférer les utilities Tailwind standard aux valeurs arbitraires `[Npx]`. |

### D · Patterns composants (0)
Aucune violation — le `<button>` est un élément interactif natif, non substituable par un composant DS (pas un Pill, Badge ou FilterChip).

### E · Geist Mono numbers (0)
Aucune violation — `{label}` est une `string` (pas un nombre). L'`ArrowLeft size={18}` est un prop React interne à l'icône SVG, non affiché comme texte numérique.

## Cross-cutting issues (à logger en follow-ups si applicable)
- Aucun. Le composant est minimal et canonique — 1 seule violation résiduelle de faible impact.

## Checklist verification (à cocher par le repair agent)
- [ ] Screenshot before captured
- [ ] Screenshot after captured
- [ ] Diff visuel décrit textuellement : aucun changement visuel attendu (`min-h-10` = 40px = identique à `min-h-[40px]`)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant ce composant
- [ ] Pas de régression sur les 9 pages consommatrices (settings, ranking/team/[teamId], auction/rounds-client, rider/rider-detail-client, team/strategies, team/budget/marketplace-client, team/budget/transactions-client, levels, help)
