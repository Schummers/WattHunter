# Audit · /league/[leagueId]/team/strategies
Generated: 2026-05-21
Auditeur: claude (model: sonnet-4.6)

## Fichiers audités
- `apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/strategies/strategies-client.tsx`
- `apps/web/app/(game)/league/[leagueId]/team/strategies/loading.tsx`

## Component tree rendu
- `page.tsx` (Server Component)
  - `back-header.tsx` (shared — voir `shared-components/back-header.md`)
  - `strategies-client.tsx` (page-level client)
    - `ui/switch.tsx` (Shadcn primitive)
    - `ui/select.tsx` (Shadcn primitive — SelectTrigger, SelectContent, SelectItem)
    - `sticky-bar.tsx` (shared — voir `shared-components/sticky-bar.md`)
    - `pill.tsx` → `Tag` (shared — voir `shared-components/pill.md`)
    - Lucide icons : Lock, Save, Target, Globe, Users, Clock
- `loading.tsx` (Suspense fallback)

## États audités
- [x] has-active-strategies (stratégies actives avec config sélectionnée)
- [x] all-empty (aucune stratégie active, slots tous vides)
- [x] auction-open-immediate (isInAuctionWindow=true → changements immédiats)
- [x] locked strategy (level insuffisant → opacity-40 + Tag "Lv.X")
- [x] pending state (hasPending=true → banner warning + Tag "Pending" sur stratégie)
- [x] saved-immediate banner (savedBanner="immediate" → banner success)
- [x] loading.tsx (spinner)

## Violations détaillées

### A · Typographie (0)

Aucune violation. Revue exhaustive :

| Ligne | Classe utilisée | Statut |
|---|---|---|
| page.tsx:22 | `text-[length:var(--type-body)]` | Conforme |
| page.tsx:132 | `text-[length:var(--type-page-title)]` | Conforme |
| strategies-client.tsx:144 | `text-[length:var(--type-caption)]` | Conforme |
| strategies-client.tsx:153 | `text-[length:var(--type-caption)]` | Conforme |
| strategies-client.tsx:163 | `text-[length:var(--type-caption)]` | Conforme |
| strategies-client.tsx:183 | `text-[length:var(--type-label)]` | Conforme |
| strategies-client.tsx:186 | `text-[length:var(--type-caption)]` | Conforme |
| strategies-client.tsx:215 | `text-[length:var(--type-emphasis)]` | Conforme |
| strategies-client.tsx:234 | `text-[length:var(--type-caption)]` | Conforme |
| strategies-client.tsx:330,333 | `text-[length:var(--type-body)]` | Conforme |
| strategies-client.tsx:341 | `text-[length:var(--type-emphasis)]` | Conforme |
| loading.tsx:6 | `text-[length:var(--type-caption)]` | Conforme |

---

### B · Couleurs (0)

Aucune violation. Revue exhaustive :

| Ligne | Classe utilisée | Statut |
|---|---|---|
| page.tsx:22 | `text-[var(--text-mid)]` | Conforme |
| page.tsx:132 | `text-[var(--text-high)]` | Conforme |
| strategies-client.tsx:141 | `border-[var(--success-border)] bg-[var(--success-bg)]` | Conforme |
| strategies-client.tsx:150 | `border-[var(--warning-border)] bg-[var(--warning-bg)]` | Conforme |
| strategies-client.tsx:172 | `bg-[var(--bg-subtle)]` | Conforme |
| strategies-client.tsx:174 | `text-[var(--text-mid)]` | Conforme |
| strategies-client.tsx:183 | `text-[var(--text-low)]` | Conforme |
| strategies-client.tsx:186 | `text-[var(--text-low)]` | Conforme |
| strategies-client.tsx:192 | `border-[var(--border-subtle)]` | Conforme |
| strategies-client.tsx:195 | `divide-[var(--border-subtle)]` | Conforme |
| strategies-client.tsx:213 | `text-[var(--text-high)]` ou `text-[var(--text-ghost)]` | Conforme |
| strategies-client.tsx:215 | `text-[var(--text-high)]` ou `text-[var(--text-ghost)]` | Conforme |
| strategies-client.tsx:334 | `text-[var(--accent-highlight)]` | Conforme |
| strategies-client.tsx:341 | `text-[var(--cta-text)]` | Conforme |
| loading.tsx:4 | `border-[var(--accent-default)]` | Conforme |
| loading.tsx:6 | `text-[var(--text-mid)]` | Conforme |

---

### C · Spacing & Radius (0)

Aucune violation. Aucune occurrence de `p-[Npx]`, `gap-[Npx]`, `rounded-[Npx]` (sauf `rounded-[var(--radius-*)]` qui est conforme). Toutes les valeurs de spacing utilisent des utilities Tailwind standard ou des tokens sémantiques.

---

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | strategies-client.tsx:183 | `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">` | **FP — Section label pattern DS** | — | Ce `<span>` est une section header label (uppercase + tracking-wide), pas un Tag/Badge/Chip. Le scanner l'a détecté à cause de `uppercase + tracking`. Le pattern "section label uppercase" est défini dans le DS (§Typography §Labels — `--type-label` avec `font-bold uppercase tracking-wide`). Ce n'est pas un composant remplaçable par `<Tag>` — un Tag est un badge inline, pas un titre de section. **False positive confirmé.** |

---

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | strategies-client.tsx:333 | `{boostPct}` rendu dans `<span className="text-[length:var(--type-body)] font-bold font-mono text-[var(--accent-highlight)]">` | **FP — déjà `font-mono`** | — | Le scanner a détecté `{level}` en page.tsx:140, mais il s'agit d'une prop passée au composant enfant (`level={level}`), pas un rendu JSX de nombre. Pas une violation E. Par ailleurs, `{boostPct}` en strategies-client.tsx:333 est déjà wrappé avec `font-mono` — conforme. `{coveredCount}` et `{totalRiders}` (ligne 330) sont dans un contexte texte ("X / Y riders covered") — heuristique : ces valeurs numériques dans une phrase sont à la limite. Contexte `<span className="text-[length:var(--type-body)] text-[var(--text-mid)]">` sans `font-mono`. |
| E-002 | strategies-client.tsx:330 | `{coveredCount} / {totalRiders}` dans `<span>` sans `font-mono` | `<span className="... font-mono">` wrappant `{coveredCount}` et `{totalRiders}` | MANUAL | Nombres inlinés dans une phrase courte ("X / Y riders covered"). DS §E règle : "tout nombre rendu dans un élément héritant Geist Sans". Ces deux valeurs numériques ne sont pas wrappées `font-mono`. Cependant le contexte est une phrase (pas un montant/stat isolé). **Confidence MANUAL** — l'auditeur considère que ces chiffres bénéficieraient de `font-mono` pour la lisibilité (comparaison à d'autres metrics numériques DS), mais l'impact est faible. Proposed : wrapper en `<span className="font-mono">{coveredCount}</span> / <span className="font-mono">{totalRiders}</span>`. |
| E-003 | strategies-client.tsx:186 | `{activeCount} / {maxActive}` dans `<span className="text-[length:var(--type-caption)] text-[var(--text-low)]">` | `<span className="font-mono">{activeCount}</span> / <span className="font-mono">{maxActive}</span>` | MANUAL | Même pattern que E-002 — compteur numérique (slots actifs / max) rendu sans `font-mono`. Les nombres représentent des métriques de jeu. DS §E recommande Geist Mono pour toute valeur numérique. |

---

## False positives

| ID | File:Line | Élément | Raison |
|---|---|---|---|
| FP-1 | page.tsx:140 | `level={level}` | Prop JSX passée à un composant enfant, pas un rendu de texte. Hors scope E. |
| FP-2 | strategies-client.tsx:183 | `<span uppercase + tracking>` | Section label DS valide — pas un Tag/Badge. Voir D-001. |
| FP-3 | strategies-client.tsx:247 | `opacity-30` sur Switch disabled | Opacity utility, pas une couleur hardcodée. Conforme. |
| FP-4 | strategies-client.tsx:341 | `cta-gradient` | Classe utilitaire définie dans globals.css. Token DS valide. |

---

## Composants partagés référencés (ne pas re-auditer)

- **`back-header.tsx`** → `shared-components/back-header.md`
- **`sticky-bar.tsx`** → `shared-components/sticky-bar.md` (violations B-001, B-002, C-001, C-002 documentées là-bas)
- **`pill.tsx` / `Tag`** → `shared-components/pill.md` (violations C-001, C-002 documentées là-bas)

Violations sur les partagés NON dupliquées ici.

---

## Cross-cutting issues

- Les `<Switch>` Shadcn utilisés ici ne semblent pas avoir de violation DS directe — leur rendu suit les tokens Shadcn/ui mappés dans globals.css.
- Le pattern `{activeCount} / {maxActive}` et `{coveredCount} / {totalRiders}` (violations E-002, E-003) sont identiques au pattern "X / Y" visible dans d'autres pages de statistiques. Une extraction `<SlotCounter>` ou `<MetricFraction>` pourrait uniformiser ce pattern. → Logger en follow-ups.
- `alert(result.error)` ligne 134 : UI native browser, pas un composant DS toast/notification. Hors scope A-E mais à remplacer par un composant toast à terme. → Logger en follow-ups.

---

## Résumé

| Classe | Violations réelles | False positives |
|---|---|---|
| A | 0 | 0 |
| B | 0 | 0 |
| C | 0 | 0 |
| D | 0 | 1 (FP-2) |
| E | 2 (E-002, E-003) | 1 (FP-1) |
| **Total** | **2** | **2** |

**Status global : PROPRE (2 violations mineures MANUAL E)**

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état: all-empty)
- [ ] Screenshot before captured (état: has-active-strategies + pending banner)
- [ ] Screenshot before captured (état: auction-open-immediate)
- [ ] Screenshot after captured (mêmes états)
- [ ] Diff visuel : E-002/E-003 → légère différence de chasse de police sur les chiffres seulement. Pas de changement layout.
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant strategies
