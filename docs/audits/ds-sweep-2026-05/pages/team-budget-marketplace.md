# Audit · /league/[id]/team/budget/marketplace
Generated: 2026-05-21
Files: marketplace/page.tsx + marketplace-client.tsx + loading.tsx
States: sponsor-selected, sponsor-locked-tier, sponsor-pending-change, no-sponsor, sponsor-immediate-applied

---

## Component tree rendu

```
page.tsx (RSC — data fetching + auth guard)
└── MarketplaceClient (marketplace-client.tsx, "use client")
    ├── BackHeader (shared — audité dans shared-components/)
    ├── Page header (h1 + description, inline)
    ├── Confirmation banner "immediate" (inline, lines 255–261)
    ├── Confirmation banner "pending" (inline, lines 262–268)
    └── Tier groups loop
        ├── Tier section header (inline, line 275)
        └── SponsorCard[] (inline component, lines 38–175)
            ├── Radio button (div role="radio", lines 100–114)
            ├── Sponsor name + budget (inline spans, lines 120–125)
            ├── Tags row (Tag components from @/components/pill, lines 136–145)
            └── Expanded bonus content (conditionally rendered, lines 150–172)
                ├── PrestigeBonusContent OR BaseBonusContent (shared)
                ├── GtGoalsPreview (shared)
                └── Nationality bonus inline label (lines 162–169)

loading.tsx (indépendant — spinner centré)
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `BackHeader` → voir `shared-components/back-header.md`
- `Tag` (`@/components/pill`) → voir `shared-components/pill.md`
- `BaseBonusContent`, `PrestigeBonusContent` → voir `shared-components/sponsor-bonus-card.md`
- `GtGoalsPreview` → voir `shared-components/gt-goals-preview.md`

---

## États audités

- [x] Sponsor actif sélectionné (radio checked, card `border-2 border-[var(--accent-default)]`)
- [x] Tier verrouillé (card `opacity-40`, chevron et radio non-cliquables, Lock icon)
- [x] Changement en attente (banner "pending" avec `pendingSponsorId`)
- [x] Changement immédiat appliqué (banner "immediate" post-save)
- [x] Aucun sponsor actif (page chargée sans `currentSponsor`)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation détectée. Tous les tokens typographiques utilisés sont conformes au DS v3.

Vérification exhaustive :

| Contexte | Token utilisé | Statut |
|---|---|---|
| Titre `h1` "Choose your Sponsor" | `text-[length:var(--type-page-title)]` | Conforme |
| Description sous le titre | `text-[length:var(--type-body)]` | Conforme |
| Texte bannière immediate/pending | `text-[length:var(--type-caption)]` | Conforme |
| Tier section header "Tier N · Level N" | `text-[length:var(--type-caption)]` | Conforme — label structurel, uppercase + tracking |
| Nom du sponsor | `text-[length:var(--type-emphasis)]` | Conforme |
| Montant mensuel | `text-[length:var(--type-emphasis)]` | Conforme |
| Nationality bonus label | `text-[length:var(--type-caption)]` | Conforme |
| Spinner loading text | `text-[length:var(--type-caption)]` | Conforme (loading.tsx) |

---

### B · Couleurs (0)

Aucune violation détectée. Toutes les couleurs utilisent des tokens sémantiques.

Vérification exhaustive :

| Contexte | Token utilisé | Statut |
|---|---|---|
| Card border default | `var(--border-default)` | Conforme |
| Card border selected | `var(--accent-default)` | Conforme |
| Card background | `var(--bg-surface)` | Conforme |
| Radio dot sélectionné bg | `var(--accent-default)` | Conforme |
| Radio dot sélectionné border | `var(--accent-default)` | Conforme |
| Radio dot center fill | `var(--bg-app)` | Conforme |
| Nom sponsor, budget | `var(--text-high)` | Conforme |
| Chevron expand | `var(--text-low)` | Conforme |
| Tier label, Lock icon | `var(--text-low)` | Conforme |
| Bannière immediate border | `var(--success-border)` | Conforme |
| Bannière immediate bg | `var(--success-bg)` | Conforme |
| Bannière pending border | `var(--warning-border)` | Conforme |
| Bannière pending bg | `var(--warning-bg)` | Conforme |
| Bannière texte | `var(--text-high)` | Conforme |
| Nationality border-t | `var(--border-default)` | Conforme |
| Nationality texte label | `var(--text-low)` | Conforme |
| Spinner border | `var(--accent-default)` | Conforme (loading.tsx) |
| Spinner texte | `var(--text-mid)` | Conforme (loading.tsx) |

---

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | marketplace-client.tsx:151 | `pl-[42px]` | `pl-[44px]` ou garder + annotation `/* 18px radio + 6px gap + 18px = 42px */` | MANUAL | `pl-[42px]` est une valeur arbitraire (px hardcodé) détectée par l'auditeur DS. **Contexte : indentation de l'expanded content pour aligner avec le texte, après le radio button de 18px + gap.** Valeur = 18px (radio `h-[18px] w-[18px]`) + 16px gap (approx `gap-2.5` = 10px) + padding container `px-3.5` = 14px, soit ~42px total pour l'alignement précis. Il n'existe pas de token Tailwind standard qui couvre exactement cette valeur fonctionnelle. Options : (a) laisser `pl-[42px]` avec un commentaire expliquant le calcul géométrique — c'est un cas de "spacing dérivé d'un layout précis" pas d'un design arbitraire; (b) passer à `pl-11` (44px, Tailwind utility), qui donne ~2px de sur-indentation acceptable; (c) restructurer le layout pour utiliser un `flex` avec un spacer de `w-[18px]` + `gap-2.5`, ce qui élimine le `pl` hardcodé entièrement. Option (c) est la plus propre DS mais nécessite un refactor layout. |

**Éléments vérifiés — conformes :**

| Élément | Classe | Statut |
|---|---|---|
| Container principal | `pb-24` | Conforme — Tailwind utility |
| Header padding | `px-4 pb-4 pt-2` | Conforme |
| Bannière | `mx-4 mb-4 px-4 py-3` | Conforme |
| Tier groups container | `px-4 max-w-[600px] mx-auto` | Conforme — max-width layout standard |
| Cards gap | `gap-2` | Conforme |
| Tier group gap | `mt-5` | Conforme |
| Tier label padding | `pb-2` | Conforme |
| Card header padding | `px-3.5 py-3` | Conforme — Tailwind standard |
| Radio size | `h-[18px] w-[18px]` | Conforme — sizing précis pour composant custom (pas spacing) |
| Radio dot | `h-[7px] w-[7px]` | Conforme — idem |
| Expanded content | `pr-3.5 pb-3.5` | Conforme |
| Nationality row | `mt-2.5 pt-2.5` | Conforme |
| Card radius | `rounded-[var(--radius-lg)]` | Conforme — card décorative → radius-lg (8px) correct |

---

### D · Patterns composants (0)

Aucune violation détectée.

**Éléments vérifiés — non-violations D :**

| Élément | Classe actuelle | Conclusion |
|---|---|---|
| Tags orientation/nationalité | `<Tag variant="highlighted">` | Conforme — composant DS Tag utilisé correctement |
| Radio button custom | `div role="radio"` avec border/bg tokens | Radio interactif custom — aucun composant DS Tag/Badge/Chip applicable. Pattern correct. |
| Tier section header | `text-[length:var(--type-caption)] font-semibold uppercase tracking-wide` | Conforme — label structurel pur, pas un badge. |
| Bannières feedback | `div` avec border + bg sémantiques | Bannières de feedback (success/warning) — pattern `div` inline acceptable, pas un composant pill/badge. |

---

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | marketplace-client.tsx:123 | `font-[family-name:var(--font-geist-mono)]` présent, `text-[length:var(--type-emphasis)]` présent, `tabular-nums` présent — **conforme**. Spinner `loading.tsx` : aucun nombre rendu. | _Voir note ci-dessous_ | — | Tous les montants numériques utilisent Geist Mono (`font-[family-name:var(--font-geist-mono)]`) + `tabular-nums`. Le montant sponsor (`formatBudget(sponsor.monthly_budget)`, line 124) est correctement wrappé. |

**Note sur la convention de font Geist Mono :** `marketplace-client.tsx` utilise `font-[family-name:var(--font-geist-mono)]` (variable CSS Next.js injectée via le package `geist`), tandis que `transactions-client.tsx` utilise `font-mono` (Tailwind v4 mappe vers `--font-mono` = "Geist Mono" dans `globals.css`). Les deux pointent vers la même fonte. La convention du dossier `budget/` est `font-[family-name:var(--font-geist-mono)]` (voir `budget-client.tsx` lignes 92–119). **Pas une violation A-E** mais incohérence de convention inter-fichiers — logger dans `follow-ups.md`.

**Aucune violation E réelle.**

---

## Cross-cutting issues

### CI-001 · Convention Geist Mono incohérente dans le dossier budget/
`marketplace-client.tsx` utilise `font-[family-name:var(--font-geist-mono)]` (convention `budget-client.tsx`), mais `transactions-client.tsx` utilise `font-mono`. Fonctionnellement identiques mais incohérents dans le même dossier. → Logger dans `follow-ups.md` pour harmonisation.

### CI-002 · `alert()` pour gestion d'erreur (line 232)
`alert(result.error)` pour reporter une erreur de save sponsor. Hors scope DS mais UX faible — un toast ou une bannière inline serait conforme DS. → Hors scope sweep, logger `follow-ups.md`.

### CI-003 · `loading.tsx` — spinner custom identique à marketplace/loading.tsx
Pattern copié-collé entre les deux `loading.tsx` du dossier (marketplace + transactions). Candidat à un composant `<LoadingSpinner>` partagé. → Hors scope, `follow-ups.md`.

---

## False positives explicites

| ID | File:Line | Élément | Raison |
|---|---|---|---|
| FP-001 | marketplace-client.tsx:105–113 | `h-[18px] w-[18px]` radio, `h-[7px] w-[7px]` dot | Sizing de composant custom interactif (radio button), pas un spacing token. Les valeurs en px ici sont des dimensions de composant, pas du padding/margin. Hors scope C. |
| FP-002 | marketplace-client.tsx:271 | `max-w-[600px]` | Layout constraint max-width — valeur de conteneur documentée DS §Layout Pattern B. Pas une violation C. |
| FP-003 | marketplace-client.tsx:275 | `text-[length:var(--type-caption)] font-semibold uppercase tracking-wide text-[var(--text-low)]` | Pattern label structurel (Tier header). `uppercase` + `tracking-wide` conforme à DS §Labels structurels. Pas une violation D (span n'est pas assimilable à un Badge — c'est un label de section). |
| FP-004 | marketplace-client.tsx:84–90 | `rounded-[var(--radius-lg)]` sur SponsorCard | Card décorative (conteneur d'info, non-interactive au sens tappable — le bouton header est l'élément interactif, pas la card entière). DS §Radius-as-affordance : 8px = cards/conteneurs structurels. Conforme. |
| FP-005 | loading.tsx:3–11 | Spinner custom avec `rounded-full` | `rounded-full` = radius cercle (9999px, `--radius-full`). Conforme pour un spinner circulaire. |

---

## Résumé

| Classe | Violations réelles | False positives | BLOCKED |
|---|---|---|---|
| A — Typographie | 0 | 0 | 0 |
| B — Couleurs | 0 | 0 | 0 |
| C — Spacing & Radius | 1 (C-001) | 5 | 0 |
| D — Patterns composants | 0 | 1 | 0 |
| E — Geist Mono numbers | 0 | 1 | 0 |
| **Total** | **1** | **7** | **0** |

**Status : READY FOR REPAIR (1 violation, confidence MANUAL)**

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — state: sponsor-selected (Tier 1 selected, card highlighted)
- [ ] Screenshot before captured — state: sponsor-locked-tier (Tier 2+ locked, opacity-40)
- [ ] Screenshot before captured — state: sponsor-pending-change (banner "pending" visible)
- [ ] Screenshot after captured (mêmes 3 états)
- [ ] Diff visuel décrit : C-001 (indentation du contenu expanded légèrement modifiée si refacto layout)
- [ ] `pnpm typecheck` PASS
- [ ] `pnpm lint` PASS (0 warning ignoré)
- [ ] `pnpm test` PASS
- [ ] Vérifier visuellement : contenu expanded bien aligné avec le texte de l'en-tête (après fix C-001)

## Notes Phase 3

**C-001 — Recommandation** : l'option la plus propre est le refacto layout :
```tsx
{/* Avant */}
<div className="pl-[42px] pr-3.5 pb-3.5">...</div>

{/* Après — option layout flex avec spacer */}
<div className="flex pr-3.5 pb-3.5">
  <div className="shrink-0 w-[18px] mr-2.5" aria-hidden="true" /> {/* spacer = radio width + gap approx */}
  <div className="flex-1">...</div>
</div>
```
Si le refacto layout crée trop de risque visuel, accepter `pl-[42px]` avec commentaire explicatif `{/* indent = radio 18px + gap ~10px + padding 14px */}`. La valeur n'est pas arbitraire — elle est géométriquement dérivée du composant. Décision finale au repair agent avec screenshot de validation.
