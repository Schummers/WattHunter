# Audit · /league/[leagueId]/team/budget
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4.6)

## Fichiers audités
- `apps/web/app/(game)/league/[leagueId]/team/budget/page.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/budget/budget-client.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/budget/loading.tsx`

## Component tree rendu
- `page.tsx` (Server Component)
- `budget-client.tsx` (Client Component)
  - `phase-navigator.tsx` (composant page-level)
  - `filter-chips.tsx` (shared — voir `shared-components/filter-chips.md`)
  - `transaction-row.tsx` (composant page-level)
  - `sponsor-bonus-card.tsx` (composant page-level)
  - Link (Next.js) → marketplace
  - Link (Next.js) → transactions
- `loading.tsx` (Suspense fallback)

## États audités
- [x] filter-all (FilterChips index 0 — toutes transactions)
- [x] filter-income (FilterChips index 1)
- [x] filter-salaries / filter-bonuses (FilterChips index 2/3)
- [x] no-sponsor (lien "Select a sponsor" à la place du SponsorBonusCard)
- [x] sponsor-active (SponsorBonusCard collapsed)
- [x] sponsor-expanded (SponsorBonusCard expanded via onToggle)
- [x] isBankruptcyRisk=true (banner danger visible)
- [x] empty transactions (message "No transactions this phase")
- [x] loading.tsx (spinner)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Revue exhaustive :

| Fichier:Ligne | Classe utilisée | Statut |
|---|---|---|
| budget-client.tsx:89 | `text-[length:var(--type-label)]` | Conforme |
| budget-client.tsx:92 | `text-[length:var(--type-display)]` | Conforme |
| budget-client.tsx:98,104,110,117 | `text-[length:var(--type-caption)]` | Conforme |
| budget-client.tsx:130 | `text-[length:var(--type-caption)]` | Conforme |
| budget-client.tsx:139 | `text-[length:var(--type-section)]` | Conforme |
| budget-client.tsx:144 | `text-[length:var(--type-caption)]` | Conforme |
| budget-client.tsx:162 | `text-[length:var(--type-caption)]` | Conforme |
| budget-client.tsx:172 | `text-[length:var(--type-section)]` | Conforme |
| budget-client.tsx:176 | `text-[length:var(--type-caption)]` | Conforme |
| budget-client.tsx:193 | `text-[length:var(--type-caption)]` | Conforme |
| loading.tsx:6 | `text-[length:var(--type-caption)]` | Conforme |

---

### B · Couleurs (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | budget-client.tsx:116 | `border-white/10` | `border-[var(--surface-overlay)]` | AUTO | Séparateur horizontal dans la section P&L du Treasury card. `border-white/10` = `rgba(255,255,255,0.10)`. Le DS définit `--surface-overlay: rgba(255, 255, 255, 0.05)` pour les overlays de surface. Cependant, 0.10 ≠ 0.05 — l'opacité est différente. Token le plus proche : `--border-subtle` (`var(--color-b1-3)` = `#151b1e`) est trop sombre pour un séparateur interne à une card glassmorphism. Alternative : `--border-glass: rgba(255, 255, 255, 0.06)` (défini pour bottom nav / action bar), également proche mais réservé à la navigation. **Recommandation** : `border-[var(--border-glass)]` est sémantiquement le plus proche (séparateur de surface semi-transparente). Si non satisfaisant, ajouter `--separator-card: rgba(255,255,255,0.10)` et l'utiliser ici. **Confidence AUTO** si on accepte `--border-glass` ; **MANUAL** si un nouveau token est requis. Marquer MANUAL par sécurité. |
| B-002 | budget-client.tsx:130 | `text-red-400` | `text-[var(--danger)]` | AUTO | Texte du banner "Bankruptcy risk". `text-red-400` = `#f87171` (Red-400). `--danger: #ef4444` (Red-500) — légèrement plus foncé. Même pattern que sticky-bar.tsx:66 (B-001 dans `shared-components/sticky-bar.md`). La même substitution s'applique : le token `--danger` est la référence normative DS pour les messages d'erreur critique. Le contexte `bg-[var(--danger-bg)]` + `border-[var(--danger-border)]` sur le div parent utilise déjà les tokens danger — `text-red-400` est le seul élément non tokenisé de ce banner. Substitution mécanique sûre et cohérente avec le reste du banner. |

---

### C · Spacing & Radius (0)

Aucune violation. Aucune occurrence de `p-[Npx]`, `gap-[Npx]`, `rounded-[Npx]` (les `rounded-[var(--radius-*)]` ligne 130/159 sont conformes).

---

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | budget-client.tsx:89 | `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">Treasury</span>` | **FP — Section label pattern DS** | — | Même pattern que le FP-2 de strategies-client. Ce `<span>` est un label de section card (uppercase + tracking-wide + type-label). Il n'est pas remplaçable par `<Tag>` (un Tag est un badge inline, pas un titre structurel). Le scanner le confond avec un Badge à cause de `uppercase + tracking`. **False positive confirmé.** |

---

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | budget-client.tsx:120 | `{phaseResult >= 0 ? "+" : ""}{formatCompact(phaseResult)}` dans `<span className="font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-high)] tabular-nums">` | **FP — déjà Geist Mono** | — | Le résultat de phase est rendu avec `font-[family-name:var(--font-geist-mono)]` — conforme DS. Pas de violation E. |

Revue des autres nombres dans budget-client.tsx :

| Ligne | Expression | Wrapper mono | Statut |
|---|---|---|---|
| 93 | `{formatEuro(treasury)}` | `font-[family-name:var(--font-geist-mono)]` (div:92) | Conforme |
| 101 | `+{formatCompact(sponsorIncome)}` | `font-[family-name:var(--font-geist-mono)]` (span:100) | Conforme |
| 107 | `+{formatCompact(bonusIncome)}` | `font-[family-name:var(--font-geist-mono)]` (span:106) | Conforme |
| 113 | `-{formatCompact(phaseSalaries)}` | `font-[family-name:var(--font-geist-mono)]` (span:112) | Conforme |
| 120 | `{phaseResult...}{formatCompact(phaseResult)}` | `font-[family-name:var(--font-geist-mono)]` (span:119) | Conforme |

**Aucune violation E.** La page budget est exemplaire sur la règle Geist Mono — tous les montants financiers sont correctement wrappés.

---

## False positives

| ID | File:Line | Élément | Raison |
|---|---|---|---|
| FP-1 | budget-client.tsx:89 | `<span uppercase + tracking>Treasury</span>` | Section label DS valide — pas un Tag/Badge. Voir D-001. |
| FP-2 | budget-client.tsx:120 | `{formatCompact(phaseResult)}` | Déjà Geist Mono. Conforme. |
| FP-3 | budget-client.tsx:159 | `rounded-[var(--radius-lg)]` | Token sémantique conforme — `--radius-lg: 8px` pour card/container. |
| FP-4 | loading.tsx:4 | `border-[var(--accent-default)]` | Token DS valide. |

---

## Composants partagés référencés (ne pas re-auditer)

- **`filter-chips.tsx`** → `shared-components/filter-chips.md` (violations C-001, C-002, C-003 documentées là-bas)

Violations sur les partagés NON dupliquées ici. `phase-navigator.tsx`, `transaction-row.tsx`, `sponsor-bonus-card.tsx` sont des composants page-level non présents dans la liste des partagés (< 3 consommateurs). Leurs violations éventuelles sont à auditer dans le cadre de cette page ou de leurs propres audits futurs. Revue rapide inline :

- `sponsor-bonus-card.tsx` : non audité en profondeur ici (composant tiers). Usage dans cette page conforme (pas de className override).
- `phase-navigator.tsx` : pas de className override passé depuis budget-client.

---

## Cross-cutting issues

- **B-001 `border-white/10`** : le même pattern `border-white/10` apparaît probablement dans d'autres cards "glassmorphism" de l'app. Un token `--separator-card` ou l'utilisation de `--border-glass` devrait être décidé globalement. → Logger en follow-ups avec recherche globale `border-white/10`.
- **`formatCompact` fonction locale** (ligne 40-44) : cette fonction de formatage compact (M€, k€) est définie inline dans `budget-client.tsx`. Elle pourrait être extraite dans `lib/format.ts` pour être réutilisable. Hors scope A-E. → Logger en follow-ups.
- **`⚠` character Unicode** (ligne 131) : `<span>⚠</span>` est une icône Unicode non DS. Le DS prescrit Lucide React pour les icônes. À remplacer par `<AlertTriangle size={14} />` de Lucide. Hors scope A-E mais signalé. → Logger en follow-ups.

---

## Résumé

| Classe | Violations réelles | False positives |
|---|---|---|
| A | 0 | 0 |
| B | 2 (B-001 MANUAL, B-002 AUTO) | 0 |
| C | 0 | 0 |
| D | 0 | 1 (FP-1) |
| E | 0 | 2 (FP-2) |
| **Total** | **2** | **3** |

**Status global : QUASI-PROPRE (2 violations B — 1 AUTO triviale, 1 MANUAL à décider)**

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état: filter-all, sponsor-active, no-bankruptcy-risk)
- [ ] Screenshot before captured (état: isBankruptcyRisk=true — banner danger visible)
- [ ] Screenshot before captured (état: no-sponsor)
- [ ] Screenshot after captured (mêmes états)
- [ ] Diff visuel B-002 (`text-red-400` → `text-[var(--danger)]`) : couleur légèrement plus foncée (#f87171 → #ef4444) sur le texte du banner bankruptcy. Vérifier lisibilité sur `--danger-bg`.
- [ ] Diff visuel B-001 (si `--border-glass` appliqué) : séparateur P&L légèrement moins visible (0.10 → 0.06 opacity). Acceptable si décidé.
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant budget
