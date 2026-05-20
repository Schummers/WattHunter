# Audit · apps/web/components/sticky-bar.tsx
Generated: 2026-05-20
Used by: 5 pages (cf. sitemap)

## Tour d'horizon

`StickyBar` est une barre d'action fixe en bas d'écran, affichant des infos de slot/budget et un bouton CTA (Save / bid). Elle supporte deux modes de rendu :

1. **Mode slot/budget** (default) : affiche `slotInfo`, `budgetInfo`, `deficitMessage`, `warningMessage`, et un bouton d'action labellisé via `buttonLabel`.
2. **Mode children** : slot libre pour un contenu custom via `children`.

Comportement responsive :
- Mobile : `fixed inset-x-0 bottom-...` — positionnée au-dessus de la BottomNav quand visible (`3.5rem`), à `bottom: 0` quand la BottomNav est masquée.
- Desktop (`lg:`): cachée (`lg:hidden`) sauf si `alwaysShow=true`, auquel cas elle se positionne `lg:left-[180px] lg:bottom-0` pour respecter la sidebar.

La barre gère également le décalage de clavier virtuel mobile via `window.visualViewport`.

## Violations détaillées

### A · Typographie (0)

Aucune violation. Tous les tokens typographiques sont corrects :
- Line 66 : `text-[length:var(--type-emphasis)]` — conforme DS.
- Line 74 : `text-[length:var(--type-emphasis)]` — conforme DS.
- Line 84, 87 : `text-[length:var(--type-caption)]` — conforme DS.

### B · Couleurs (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | sticky-bar.tsx:66 | `text-red-400` | `text-[var(--danger)]` | AUTO | État déficit = danger sémantique. `--danger` = `#ef4444` (Red-500) est le token DS pour ce contexte (budget dépassé, erreur critique). `text-red-400` (`#f87171`) contourne le token et produit une couleur légèrement plus claire que la référence DS. Substitution mécanique sans impact fonctionnel perceptible. |
| B-002 | sticky-bar.tsx:84 | `text-red-400` | `text-[var(--danger)]` | AUTO | Même violation que B-001 sur le `deficitMessage`. Token `--danger` est la référence normative pour les messages d'erreur (cf. DS §Couleurs sémantiques : "Danger: #ef4444 — Perte, budget dépassé, deadline"). |

### C · Spacing & Radius (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | sticky-bar.tsx:74 | `rounded-lg` | `rounded-md` | AUTO | Bouton interactif CTA. DS v3.1 §Radius Tokens (ligne normative) : `--radius-md` (6px) = "Filter chips (interactive), **buttons**, inputs — Interactive signal". `rounded-lg` = 8px (`--radius-lg`) est réservé aux cards et conteneurs structurels, pas aux éléments interactifs tappable. Le radius-as-affordance exige 6px pour tout contrôle tappable. |
| C-002 | sticky-bar.tsx:58 | `lg:left-[180px]` | `lg:left-[var(--sidebar-width,180px)]` | MANUAL | Offset sidebar hardcodé en px. La valeur `180px` correspond à la largeur de la Sidebar définie dans le DS (§Navigation responsive : "Sidebar 180px"). Il n'existe pas de token CSS `--sidebar-width` dans `globals.css`. Deux options : (a) créer le token `--sidebar-width: 180px` dans globals.css et l'utiliser ici + dans `rounds-client.tsx` (même pattern, 2 occurrences), ou (b) laisser la valeur arbitraire documentée. Option (a) recommandée pour la maintenabilité — si la sidebar change de largeur, 1 seul endroit à modifier. **Blocker léger** : nécessite création d'un nouveau token CSS (hors scope repair direct — doit être validé avant application). |

### D · Patterns composants (0)

Aucune violation. Aucun pattern assimilable à Pill/Badge/Tag/Chip n'est implémenté inline. Le `<button>` est un élément interactif natif et non remplaçable par un composant DS.

### E · Geist Mono numbers (0)

Aucune violation. Les props `slotInfo` et `budgetInfo` contiennent des données numériques (slots restants, montants budget) et sont correctement wrappés dans `<span className="font-mono">` (lines 67, 69). Le `font-semibold` du `<span>` parent (line 66) hérite de Geist Sans mais est immédiatement écrasé par `font-mono` sur les spans enfants. Conforme à la règle DS "Geist Mono pour tout ce qui est numérique".

## False positives

| Élément | Ligne | Raison |
|---------|-------|--------|
| `{ bottom: "3.5rem" }` inline style | 54 | Valeur calculée dynamiquement en JS (fallback BottomNav visible). Pas une classe Tailwind — hors scope A-E. `3.5rem` = 56px = hauteur de la BottomNav, valeur technique non substituable par un token CSS sans refactoring logique. |
| `py-2` | 58 | Tailwind spacing standard (8px = `--space-2`). Conforme. |
| `px-4` | 62, 64 | Tailwind spacing standard (16px = `--space-4`). Conforme. |
| `space-y-1` | 64 | Tailwind spacing standard (4px = `--space-1`). Conforme. |
| `duration-200` | 58 | Transition motion — hors scope A-E. |
| `font-semibold` | 74 | Weight 600 = conforme DS Buttons "CTA Primary text: 14px/600". |
| `cta-gradient` | 77 | Classe utilitaire définie dans `globals.css` (§CTA Gradient). Token DS valide. |
| `text-[var(--cta-text)]` | 77 | Token DS valide. |
| `bg-[var(--bg-surface)]` + `text-[var(--text-low)]` | 76 | Tokens DS valides pour l'état disabled/déficit du bouton. |

## Cross-cutting issues

- **C-002 nécessite un nouveau token `--sidebar-width`** : le même hardcode `lg:left-[180px]` apparaît dans `rounds-client.tsx:171`. Si le token est créé, les deux occurrences doivent être mises à jour simultanément. Logger dans `follow-ups.md`.
- Aucune extraction de composant suggérée : le composant est déjà bien isolé et correctement scopé.

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état déficit, état normal)
- [ ] Screenshot after captured
- [ ] Diff visuel review — pas de régression non voulue (couleur `--danger` légèrement plus rouge que `red-400` — vérifier perceptibilité)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant sticky-bar
- [ ] Si C-002 appliqué : token `--sidebar-width` ajouté dans `globals.css` + `rounds-client.tsx:171` mis à jour en même temps
