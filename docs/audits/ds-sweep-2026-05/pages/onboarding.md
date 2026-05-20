# Audit · /onboarding
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4-6)
File: `apps/web/app/(auth)/onboarding/page.tsx`

## Status: CLEAN — 0 violation A-E

## Tour d'horizon
Page d'accueil marketing pre-auth (landing onboarding). Mesh gradient animé en background, logo, 3 feature cards via `InfoCard`, 2 CTA (Get started / Log in), liens légaux. Composants : `Button` (variant="cta"), `InfoCard` (DS), `Link`, icônes Lucide.

## Violations détaillées

### A · Typographie (0)
Aucune violation — `text-[length:var(--type-page-title)]`, `text-[length:var(--type-body)]`, `text-[length:var(--type-emphasis)]`, `text-[length:var(--type-caption)]` correctement utilisés sur tous les éléments texte.

### B · Couleurs (0)
Aucune violation.

Le mesh gradient utilise `bg-[var(--color-cyan-700)]`, `bg-[var(--color-cyan-600)]`, `bg-[var(--color-cyan-800)]` directement (tokens primitifs Layer 2). **Ce n'est pas une violation B** : le DS §Architecture 4 couches définit explicitement la Layer 4 (Mesh Gradient) comme usage autorisé des primitives `--color-cyan-*` pour "Hero sections, marketing, onboarding". Les éléments sont purement décoratifs (blurs animés, aucun texte, aucune sémantique). Tous les autres éléments UI utilisent des tokens sémantiques valides (`--text-high`, `--text-mid`, `--accent-default`, `--badge-bg`, `--accent-label`).

### C · Spacing & Radius (0)
Aucune violation dans les catégories C (p/gap/m/rounded en `[Npx]`).

Notes sur les valeurs arbitraires hors scope C :
- `opacity-20`, `opacity-15` : utilities Tailwind v4 valides (échelle 0-100 entière, pas `[Npx]`)
- `blur-[100px]`, `blur-[80px]` : hors scope C (la spec C couvre uniquement p/gap/m/rounded arbitraires en px, pas blur)
- `h-[60%]`, `w-[60%]`, `h-[40%]`, `w-[40%]` : pourcentages relatifs au viewport, hors scope C (valeurs `%` != valeurs `px`)

### D · Patterns composants (0)
Aucune violation — les `<div className="rounded-full ...">` sont des blobs décoratifs de mesh gradient, non des éléments UI porteurs d'information. Non substituables par Pill/Badge/Tag/Chip.

### E · Geist Mono numbers (0)
Aucune violation — `width={56}` et `height={56}` sur `<Image>` sont des props React internes, non rendus comme texte. Aucun nombre affiché dans le UI.

## Cross-cutting issues
Aucun.

## Checklist verification
- [ ] Screenshot before captured (état: default)
- [ ] Screenshot after captured
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS
