# Audit · /reset-password
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4-6)
File: `apps/web/app/(auth)/reset-password/page.tsx`

## Status: CLEAN — 0 violation A-E

## Tour d'horizon
Page de saisie du nouveau mot de passe (post-email recovery link). 2 champs (new password, confirm). Composants : `Button`, `Input`, `FormField` (DS).

## Violations détaillées

### A · Typographie (0)
Aucune violation — `text-[length:var(--type-page-title)]`, `text-[length:var(--type-body)]`, `text-[length:var(--type-caption)]` correctement utilisés.

### B · Couleurs (0)
Aucune violation — `--text-high`, `--text-mid`, `--status-danger` tokens sémantiques valides.

### C · Spacing & Radius (0)
Aucune violation — `gap-4`, `mt-4` uniquement.

### D · Patterns composants (0)
Aucune violation — aucun custom pill/badge/chip.

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
