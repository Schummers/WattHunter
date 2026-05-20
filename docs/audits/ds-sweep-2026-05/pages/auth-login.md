# Audit · /login
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4-6)
File: `apps/web/app/(auth)/login/page.tsx`

## Status: CLEAN — 0 violation A-E

## Tour d'horizon
Page d'authentification email + Google OAuth. Composants : `Button`, `Input`, `FormField` (DS), `Link`. Tous les tokens typographiques, couleurs et spacing utilisent les variables sémantiques DS (`--type-*`, `--text-*`, `--border-*`, `--accent-*`, `--status-*`). Aucune valeur hardcodée. Aucun pattern custom imitant un composant DS.

## Violations détaillées

### A · Typographie (0)
Aucune violation — tous les éléments texte utilisent `text-[length:var(--type-*)]`.

### B · Couleurs (0)
Aucune violation — `text-[var(--text-high)]`, `text-[var(--text-mid)]`, `text-[var(--accent-default)]`, `bg-[var(--border-subtle)]`, `text-[var(--status-success)]`, `text-[var(--status-danger)]` sont des tokens sémantiques DS valides.

### C · Spacing & Radius (0)
Aucune violation — spacing via Tailwind utilities standard (`gap-4`, `gap-3`, `mb-2`, `-mt-2`, `mt-4`). Aucune valeur `[Npx]` arbitraire dans les catégories p/gap/m/rounded.

### D · Patterns composants (0)
Aucune violation — pas de `<span>` ou `<div>` custom imitant Pill/Badge/Tag/Chip.

### E · Geist Mono numbers (0)
Aucune violation — aucun nombre affiché en texte UI. Les props `width={48}` et `height={48}` sur `<Image>` sont des attributs React internes, non rendus comme texte.

## Cross-cutting issues
Aucun.

## Checklist verification
- [ ] Screenshot before captured
- [ ] Screenshot after captured
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS
