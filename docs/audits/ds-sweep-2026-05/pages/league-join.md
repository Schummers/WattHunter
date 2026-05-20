# Audit · /league/join
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4-6)
File: `apps/web/app/(auth)/league/join/page.tsx`

## Status: CLEAN — 0 violation A-E

## Tour d'horizon
Formulaire pour rejoindre une ligue via code 6 caractères. `useActionState` server action. Back link, 1 champ `Input` (avec `tracking-widest uppercase` pour le code invite), `Button` CTA. Pre-fill du code depuis `?code=` query param via `useSearchParams` (wrapped en `<Suspense>`).

## Violations détaillées

### A · Typographie (0)
Aucune violation — `text-[length:var(--type-page-title)]`, `text-[length:var(--type-body)]`, `text-[length:var(--type-caption)]` correctement utilisés.

### B · Couleurs (0)
Aucune violation — `--text-high`, `--text-mid`, `--accent-default`, `--accent-hover`, `--status-danger` tokens sémantiques DS valides.

### C · Spacing & Radius (0)
Aucune violation — `gap-4`, `gap-8`, `gap-1.5` uniquement.

### D · Patterns composants (0)
Aucune violation — aucun custom pill/badge/chip.

### E · Geist Mono numbers (0)
Aucune violation — aucun nombre affiché comme texte UI. `maxLength={6}` est un attribut HTML de validation.

## Cross-cutting issues
Aucun.

## Checklist verification
- [ ] Screenshot before captured
- [ ] Screenshot after captured
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS
