# Audit · /league/[id]/ranking/team/[teamId]
Generated: 2026-05-21
Files: ranking/team/[teamId]/page.tsx + ranking/team/[teamId]/loading.tsx + components/metric-box.tsx (used exclusively here)
States: my-team, other-team, with-roster, with-former-riders, empty

---

## Component tree rendu

- `ranking/team/[teamId]/page.tsx` (server component)
  - `back-header.tsx` (shared — audit: `shared-components/back-header.md`)
  - `metric-box.tsx` (local exclusive — 1 consommateur, audité ici)
  - `movement-tag.tsx` (shared — audit: `shared-components/movement-tag.md`)
  - `Avatar` / `AvatarImage` / `AvatarFallback` (Shadcn UI primitives)
  - `<Link>` rows (inline rider row function `renderRiderRow`, lignes 182–248)
- `ranking/team/[teamId]/loading.tsx` (Suspense fallback)

---

## États audités

- [x] has-active-riders (roster actif non vide)
- [x] has-former-riders (section "Former Riders" visible)
- [x] empty (activeContracts.length === 0, message "No active riders.")
- [x] Loading skeleton (`loading.tsx`)
- [x] Rider row — état isFormer (opacity-50 + dashed border avatar)
- [x] Rider row — mouvement positif / négatif / neutre (via MovementTag, hors scope ici)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Tous les tokens typographiques utilisés sont conformes à la scale DS :
- `text-[length:var(--type-page-title)]` — titre équipe (h1)
- `text-[length:var(--type-caption)]` — sous-titre owner, counts sections, country flag, loading message
- `text-[length:var(--type-label)]` — headers sections "Active Roster" / "Former Riders"
- `text-[length:var(--type-emphasis)]` — nom coureur, XP valeur
- `text-[length:var(--type-body)]` — message empty state
- `text-[length:var(--type-micro)]` — "XP" unit label, AvatarFallback initiales
- `text-[length:var(--type-stat-small)]` — valeur MetricBox (via `metric-box.tsx`)
- `text-[length:var(--type-label)]` — label MetricBox (via `metric-box.tsx`)

`loading.tsx` utilise `text-[length:var(--type-caption)]` pour "Loading..." — conforme.

Pas de `text-base`, `text-sm`, `text-[Npx]` détectés.

### B · Couleurs (0)

Aucune violation. Toutes les couleurs utilisent des tokens sémantiques :

**page.tsx :**
- `text-[var(--text-high)]` — noms coureurs, XP valeur, titre équipe, h1
- `text-[var(--text-mid)]` — owner sous-titre, message empty state, AvatarFallback
- `text-[var(--text-low)]` — rang coureur "#N in game", headers sections
- `text-[var(--text-ghost)]` — counts sections, chevron
- `bg-[var(--bg-surface)]` — AvatarFallback background
- `bg-[var(--bg-surface-hover)]` — hover sur rider row link
- `bg-[var(--bg-subtle)]` — divider entre sections
- `border-[var(--border-default)]` — AvatarFallback border, dashed avatar ancien coureur
- `border-[var(--border-subtle)]` — dividers entre rider rows
- `divide-[var(--border-subtle)]` — divide-y rider list

**loading.tsx :**
- `border-[var(--accent-default)]` — spinner arc
- `text-[var(--text-mid)]` — texte "Loading..."

**metric-box.tsx :**
- `border-[var(--border-subtle)]` — border card
- `bg-[var(--bg-surface)]` — fond card
- `text-[var(--accent-highlight)]` — valeur highlight
- `text-[var(--text-high)]` — valeur sans highlight
- `text-[var(--text-low)]` — label

Pas de hex hardcodé, pas de palette Tailwind directe (gray, zinc, slate, white, black).

### C · Spacing & Radius (0)

Aucune violation dans la cible des brackets `[Npx]`.

**page.tsx :** spacings tous en utilities Tailwind standard (`px-4`, `py-3`, `pb-2`, `gap-3`, `gap-1`, `gap-1.5`, `gap-2`, `size-9`, `space-y-6`, `space-y-1`, `pb-24`, `h-1.5`). Pas de `p-[Npx]`, `gap-[Npx]`, `rounded-[Npx]`.

**loading.tsx :** `w-8 h-8`, `gap-3` — utilities Tailwind standard, pas de valeurs arbitraires en px.

**metric-box.tsx :** `rounded-xl` = valeur Tailwind standard (12px). Hors scope C (le détecteur cible `rounded-[Npx]`, pas les utilities nommées Tailwind). Note : 12px ne correspond à aucun token DS `--radius-*` (sm=4, md=6, lg=8, compound=10, pill=20), mais l'utilisation d'une utility Tailwind standard est préférable à du `[Npx]` arbitraire — aucune violation à corriger selon le scope défini.

**Note cross-cutting** : `rounded-xl` dans `metric-box.tsx` est sémantiquement une card décorative (12px). Si la décision est d'aligner toutes les cards sur `rounded-[var(--radius-compound)]` (10px) ou d'ajouter un token `--radius-card: 12px`, c'est une évolution de design system à tracer dans `follow-ups.md`, pas une violation A-E.

### D · Patterns composants (0)

Aucune violation.

Les rider rows utilisent un `<Link>` avec `Avatar` — pas de span custom imitant un Badge/Pill/Tag. Le divider `<div className="h-1.5 bg-[var(--bg-subtle)]" />` est un séparateur visuel, pas un composant DS candidat. L'AvatarFallback avec `border border-dashed` (état isFormer) est un état visuel inline légitime, pas un pattern Pill/Badge.

**False Positive anticipé — AvatarFallback (isFormer) :**

```tsx
<Avatar className={`size-9 shrink-0 ${options.isFormer ? "border border-dashed border-[var(--border-default)]" : ""}`}>
```

Pourrait ressembler à un badge outline, mais c'est un état conditionnel de l'Avatar (dashed = released rider), pas un composant indépendant. Pas de remplacement DS approprié.

### E · Geist Mono numbers (2 — MANUAL)

Deux nombres affichés sans `font-mono` dans un contexte de phrase narrative.

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | page.tsx:278 | `{activeContracts.length} rider{activeContracts.length !== 1 ? "s" : ""}` dans `<span className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">` | Wrapper `{activeContracts.length}` avec `<span className="font-mono tabular-nums">{activeContracts.length}</span>` | MANUAL | Nombre intégré dans une phrase narrative ("3 riders"). Précédent établi dans `team-gt.md` E-NOTE-001 et E-NOTE-002 : les compteurs dans du texte courant sont à la limite. Option 1 = laisser (narratif). Option 2 = wrapper mono (cohérence stricte). Demander confirmation Jonathan. |
| E-002 | page.tsx:305 | `{formerContracts.length} rider{formerContracts.length !== 1 ? "s" : ""}` dans `<span className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">` | Même traitement que E-001 | MANUAL | Même pattern, même raisonnement que E-001. Décision à aligner avec E-001. |

**Nombres conformes (déjà en `font-mono`) :**
- `#{rank} in game` — line 228 : `<span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">` — conforme.
- `{formatThousands(xp)}` — line 237 : `<span className="font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">` — conforme.
- MetricBox `formattedValue` — `font-mono text-[length:var(--type-stat-small)] font-bold` — conforme.

---

## Composants partagés référencés (ne pas réauditer)

| Composant | Audit | Violations connues |
|---|---|---|
| `back-header.tsx` | `shared-components/back-header.md` | C-001 (min-h-[40px] → min-h-10) |
| `movement-tag.tsx` | `shared-components/movement-tag.md` | 0 violation |

`metric-box.tsx` est audité dans ce rapport (1 seul consommateur — cette page).

---

## Cross-cutting issues (à logger dans follow-ups.md)

1. **`rounded-xl` dans MetricBox** : `rounded-xl` (12px) n'a pas de token DS correspondant. Si l'équipe veut aligner toutes les card containers sur les tokens `--radius-*`, soit ajouter `--radius-card: 12px` au design system, soit adopter `rounded-[var(--radius-compound)]` (10px). Décision à tracer en follow-up, pas une violation A-E.

2. **`renderRiderRow` comme fonction interne** : le pattern rider row (Avatar + name + flag + MovementTag + rank + XP + chevron) est inline dans la page server component. Si ce pattern est réutilisé dans d'autres pages (ranking, GT squad list...), candidat extraction en `<RiderRow>` composant partagé — à tracer en follow-up post-sweep.

---

## Résumé

| Classe | Violations | Auto | Manual | Blocked | FP |
|---|---|---|---|---|---|
| A · Typo | 0 | — | — | — | — |
| B · Couleur | 0 | — | — | — | — |
| C · Spacing/Radius | 0 | — | — | — | 1 (rounded-xl hors scope) |
| D · Patterns | 0 | — | — | — | 1 (AvatarFallback dashed) |
| E · Geist Mono | 2 | 0 | 2 | 0 | — |
| **Total** | **2** | **0** | **2** | **0** | **2** |

**Status : NEEDS MANUAL DECISION** — 2 violations E à résoudre après confirmation Jonathan (nombres narratifs → wrapper font-mono ou laisser tel quel).

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (state: has-active-riders)
- [ ] Screenshot before captured (state: has-former-riders)
- [ ] Screenshot before captured (state: empty)
- [ ] Appliquer E-001 si Jonathan confirme wrapper mono
- [ ] Appliquer E-002 si Jonathan confirme wrapper mono (aligner avec E-001)
- [ ] Screenshot after captured (mêmes états)
- [ ] Diff visuel décrit textuellement : seul changement attendu — la police du count "N rider(s)" passe de Geist Sans à Geist Mono (subtil à `--type-caption` = 12px)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS (aucun test spécifique à cette page identifié)
