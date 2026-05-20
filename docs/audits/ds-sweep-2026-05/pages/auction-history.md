# Audit · /league/[id]/auction/history
Generated: 2026-05-20
Files: auction/history/page.tsx + loading.tsx

## Component tree rendu

- `auction/history/page.tsx` (server component, inline only — no extracted client component)
  - Search bar (inline `<input>`, line 107-111)
  - Empty state (inline `<div>`, line 115-121)
  - Round header rows (inline `<div>`, line 145-148)
  - Rider bid rows (inline `<div>`, line 155-177)
  - GT Emergency Bids section (inline `<div>`, line 185-218)
- `auction/history/loading.tsx` (standalone spinner)

## États audités

- [x] No history (empty state)
- [x] Has rounds with bids (normal render)
- [x] GT emergency bids present
- [x] Unauthenticated user (early return, line 19-25)

---

## Violations détaillées

### A · Typographie (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | page.tsx:110 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Input placeholder/text inherits default body context. `text-base` = 16px Tailwind, bypasses DS token scale. `--type-body` is the correct semantic token for body/input text. |

### B · Couleurs (0)

Aucune violation. Toutes les couleurs utilisent des tokens sémantiques `var(--text-*)`, `var(--bg-*)`, `var(--border-*)`, `var(--accent-*)`.

### C · Spacing & Radius (0)

Aucune violation. Tous les spacings utilisent les utilitaires Tailwind (`px-4`, `py-3`, `gap-3`, etc.). Tous les radius utilisent `rounded-lg`, `rounded-full` (utilitaires Tailwind), pas de valeurs `rounded-[Xpx]` hardcodées.

### D · Patterns composants (0)

Aucune violation. Pas de `<span class="rounded-full border...">` assimilable à un Pill/Badge/Tag.

L'indicateur Won/Lost (page.tsx:209-210) utilise du texte coloré conditionnel via `text-[var(--accent-default)]` / `text-[var(--text-low)]` — ce n'est pas un badge bordé, donc hors scope D. Pourrait être amélioré avec un `<Pill>` mais ce serait du refactor fonctionnel, pas une violation D.

### E · Geist Mono numbers (0)

Aucune violation. Tous les montants monétaires sont wrappés dans `<span className="font-mono">` :
- page.tsx:169-171 : `<span className="font-mono">{formatEuro(bid.amount)}</span>` ✅
- page.tsx:208 : `<span className="font-mono text-[var(--text-mid)]">{formatEuro(bid.amount)}</span>` ✅

---

## Résumé

| Classe | Violations |
|--------|-----------|
| A · Typographie | **1** |
| B · Couleurs | 0 |
| C · Spacing & Radius | 0 |
| D · Patterns composants | 0 |
| E · Geist Mono numbers | 0 |
| **Total** | **1** |

---

## Cross-cutting issues

Aucun pattern récurrent problématique sur cette page. La page est globalement bien alignée sur le DS.

Observation (follow-up, pas violation A-E) : l'indicateur Won/Lost (line 209-210) est du texte brut. Un `<Pill variant="success/ghost">` serait plus cohérent avec les autres pages qui indiquent le statut d'une enchère. → log dans `follow-ups.md`.

---

## False positives (FP) documentés

Aucun FP notable. Le seul candidat potentiel était `text-base` à la ligne 110 — confirmé comme vrai positif (bypasse effectivement le token scale DS).

---

## Refs composants partagés

Cette page n'utilise aucun des composants partagés audités séparément (`back-header`, `rider-card`, `filter-chips`, `pill`, etc.). Tout est inline.

---

## Notes Phase 3 (Réparateur)

- **1 fix total, AUTO** : substitution mécanique `text-base` → `text-[length:var(--type-body)]` à la ligne 110 de `page.tsx`.
- `loading.tsx` : **aucune modification nécessaire**, fichier déjà conforme.
- Vérifier après fix que l'input garde le même rendu visuel (16px → 14px/16px responsive via token) — légère réduction de taille sur mobile possible.
- Aucun import à ajouter, aucun composant à installer.

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état round-active, has-bids)
- [ ] Screenshot after captured
- [ ] Diff visuel review — pas de régression non voulue
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant cette page
