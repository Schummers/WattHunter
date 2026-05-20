# Audit · apps/web/components/movement-tag.tsx
Generated: 2026-05-20
Used by: 4 pages (cf. sitemap)

---

## Tour d'horizon

Composant d'affichage inline du delta de classement PCS d'un coureur. Trois états visuels :

- `movement === null || movement === 0` → tiret `—` en `--text-ghost`, pas de badge
- `movement > 0` → badge vert (`--success-bg` / `--success`) avec signe `+`
- `movement < 0` → badge rouge (`--danger-bg` / `--danger`)

Props : `movement: number | null` — aucune prop de style exposée.

Consommateurs (4) :
- `ranking-client.tsx` (tab Teams + tab Riders)
- `ranking/team/[teamId]/page.tsx`
- `rider-card.tsx` (shared component — le rend indirectement dans 5 pages)
- `draft-bid-card.tsx` (shared component)

---

## Résultat détecteur automatique

```
pnpm audit-ds apps/web/components/movement-tag.tsx --json
→ { "count": 0, "violations": [] }
```

Aucune violation regex A/B/C détectée.

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Le seul token typographique utilisé est `text-[length:var(--type-micro)]` — conforme à la scale DS.

### B · Couleurs (0)

Aucune violation. Toutes les couleurs utilisent des tokens sémantiques :
- `text-[var(--text-ghost)]` — état neutre
- `bg-[var(--success-bg)]` + `text-[var(--success)]` — état positif
- `bg-[var(--danger-bg)]` + `text-[var(--danger)]` — état négatif

Pas de hex hardcodé, pas de palette Tailwind directe.

### C · Spacing & Radius (0)

Aucune violation. Spacing en utilities Tailwind standard (`px-1.5`, `py-px`) et radius via token `rounded-[var(--radius-pill)]` (20px — conforme radius-as-affordance "décoratif").

### D · Patterns composants (0)

**False-positive potentiel — aucun problème réel.**

Le composant utilise `<span>` avec `rounded-[var(--radius-pill)]` + `bg-[var(...)]` — pattern similaire à une Pill. Cependant :

- Il N'utilise PAS `rounded-full` (le pattern que le détecteur cible)
- Il N'utilise PAS `border` (une Pill/Badge outline en aurait un)
- Il utilise `rounded-[var(--radius-pill)]`, soit exactement le token DS pour les éléments décoratifs
- Ce composant EST déjà un composant dédié (`MovementTag`) — il n'y a pas lieu de le remplacer par `<Pill>` car il a une sémantique propre (delta de classement positif/négatif) et une logique de rendu conditionnel intégrée

Verdict : pas de violation D. Le `<MovementTag>` est lui-même le composant DS approprié pour ce cas d'usage.

### E · Geist Mono numbers (0)

Aucune violation. Les nombres sont rendus dans des `<span>` qui ont `font-mono` explicitement — `{movement}` et `+{movement}` sont correctement wrappés.

---

## Cross-cutting issues (à logger en follow-ups)

Aucun. Le composant est minimal, focused, et sans duplication détectée.

---

## Checklist verification (à cocher par le repair agent)

> Aucun fix à appliquer — composant 100% conforme. La checklist Phase 3 est N/A.

- [x] Audit complet effectué (regex + revue manuelle)
- [x] 0 violation A-E confirmée
- [x] Revue manuelle des 3 branches de rendu (null/0, >0, <0)
- [x] Consommateurs listés (4 pages / composants)
- [ ] Screenshot before/after — N/A (aucun fix)
- [ ] typecheck / lint / vitest — N/A (aucune modification)
