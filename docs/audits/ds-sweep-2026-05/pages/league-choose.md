# Audit · /league/choose
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4-6)
File: `apps/web/app/(auth)/league/choose/page.tsx`

## Status: CLEAN — 0 violation A-E

## Tour d'horizon
Page de choix post-onboarding : créer ou rejoindre une ligue. 2 cards-liens (`<Link>`) avec icône, titre et description. Pas de composant DS card — utilise des `<Link>` stylisés manuellement. Tokens sémantiques DS corrects sur tous les éléments.

## Violations détaillées

### A · Typographie (0)
Aucune violation — `text-[length:var(--type-page-title)]`, `text-[length:var(--type-body)]`, `text-[length:var(--type-emphasis)]`, `text-[length:var(--type-caption)]` correctement utilisés.

### B · Couleurs (0)
Aucune violation — `--text-high`, `--text-mid`, `--border-default`, `--bg-surface`, `--bg-surface-hover`, `--bg-surface-active`, `--accent-default` sont des tokens sémantiques DS valides.

### C · Spacing & Radius (0)
Aucune violation — `p-4`, `gap-4`, `gap-3`, `gap-0.5`, `gap-8` uniquement. `rounded-xl` et `rounded-lg` sont des utilities Tailwind standard (non `[Npx]`).

### D · Patterns composants (0)
Aucune violation — les 2 `<Link>` stylisés sont des cartes de navigation interactives full-width, non assimilables à des Pill/Badge/Tag/Chip.

### E · Geist Mono numbers (0)
Aucune violation — aucun nombre affiché comme texte UI.

## Cross-cutting issues
Aucun.

## Checklist verification
- [ ] Screenshot before captured
- [ ] Screenshot after captured
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS
