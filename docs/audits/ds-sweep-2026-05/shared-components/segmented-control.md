# Audit · apps/web/components/segmented-control.tsx
Generated: 2026-05-20
Used by: ranking/ranking-client, rider/rider-detail-client, team/budget/transactions-client

## Tour d'horizon

Composant Filter Chips Option C (Contained Light) — toggle fermé à 2–5 segments dans un conteneur avec bordure. Rendu sur les pages Ranking (Teams / Riders), Rider Detail (PCS Stats / Game Stats), et Transactions (All / Income / Expense). Aucune prop optionnelle : toujours `segments`, `activeIndex`, `onChange`.

Variantes visuelles :
- **Active segment** : `bg-surface-active`, `text-high`, `font-semibold` (600)
- **Inactive segment** : `text-low`, `font-medium` (500)

## Violations détaillées

### A · Typographie (0)

Aucune violation. `text-[length:var(--type-caption)]` conforme DS.

### B · Couleurs (0)

Aucune violation. Tous les tokens couleur sont sémantiques (`--border-default`, `--bg-surface-active`, `--text-high`, `--text-low`).

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | segmented-control.tsx:15 | `p-[3px]` | `p-[3px]` → voir rationale | BLOCKED · token manquant | La DS spec Option C prescrit exactement `padding: 3px` pour le conteneur. Aucun utilitaire Tailwind standard ne couvre 3px (`p-px`=1px, `p-0.5`=2px, `p-1`=4px). Il faudrait soit ajouter `--space-0.75: 3px` dans globals.css, soit accepter `p-[3px]` comme exception documentée dans le composant. Déférer à Jonathan pour décision. |

### D · Patterns composants (0)

Aucune violation. Le composant *est* l'implémentation du pattern Filter Chips Option C du DS.

### E · Geist Mono numbers (0)

Aucune violation. Le composant ne rend que des chaînes de caractères (`{segment}`), sans valeurs numériques.

## Cross-cutting issues (à logger en follow-ups)

- **`w-full` vs `width: fit-content`** : La spec DS Option C définit le conteneur en `width: fit-content`. Le composant utilise `w-full`, ce qui étire le toggle sur toute la largeur disponible. Les 3 consommateurs wrappent dans un `px-4` et semblent préférer ce comportement (pleine largeur dans la colonne). Cela dévie de la spec Option C mais semble intentionnel. À valider avec Jonathan lors du gate Phase 2 — si `w-full` est maintenu, documenter l'écart dans le DS.

- **Absence d'état `hover` desktop** : La spec Option C inclut un hover state (`color: text-mid; background: rgba(255,255,255,0.03)` sur segments inactifs). Le composant n'a pas de classe hover pour les segments inactifs. `transition-colors` est présent mais sans cible. Hors scope A-E (comportement/a11y), mais à logguer dans follow-ups.

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — état 2 segments (ex: Teams / Riders, segement 0 actif)
- [ ] Screenshot before captured — état 2 segments (segement 1 actif)
- [ ] Screenshot after captured
- [ ] Diff visuel : changement attendu si C-001 est résolu → imperceptible visuellement (3px vs alternative la plus proche)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant ce composant
- [ ] Pas de régression sur les 3 pages consommatrices : ranking-client, rider-detail-client, transactions-client
