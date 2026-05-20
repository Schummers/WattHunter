# Audit · /league/[id]/team/gt
Generated: 2026-05-20
Files: team/gt/page.tsx + gt-team-client.tsx + _remontada-banner-slot.tsx
Modaux: TacticBoostModal, TacticNemesisModal (2-step), RiderPickerSheet
States: pre-GT, GT-active, GT-finished, with-tactics-used, swap-mode

---

## Component tree rendu

```
page.tsx (RSC — auth guard + data fetching)
├── InactiveView (inline, page.tsx:128–160)
│   — rendered when currentGT = null
│   — variant A: no next GT known
│   — variant B: next GT known (countdown)
└── RemontadaBannerSlot (_remontada-banner-slot.tsx, RSC, conditionnel)
    └── RemontadaBoostBanner (shared component — audité séparément si applicable)
└── GtTeamClient (gt-team-client.tsx, "use client")
    ├── NemesisIncomingBanner (shared — pas dans liste des 7 partagés, audité ici)
    ├── section "Sponsors Goals"
    │   ├── SponsorBonusCard (shared, rendu si sponsor)
    │   └── Empty state (inline, gt-team-client.tsx:168)
    ├── TeamTacticsSection (shared — rendu conditionnel)
    │   ├── TacticCard (tactic-card.tsx — audité ici car usage unique GT)
    │   ├── → TacticBoostModal (tactic-boost-modal.tsx — audité ici)
    │   │   ├── ModalShell (tactic-modal-shell.tsx — audité ici)
    │   │   ├── ModalHeader (tactic-modal-shell.tsx)
    │   │   ├── ModalActions (tactic-modal-shell.tsx)
    │   │   └── StageList (tactic-stage-list.tsx — hors scope si partagé)
    │   └── → TacticNemesisModal (tactic-nemesis-modal.tsx — audité ici)
    │       ├── step 1: rival picker (RivalRow inline)
    │       └── step 2: stage picker
    └── section "Team Composition"
        ├── ROLE_ORDER.map → role block headers (inline)
        ├── RiderCard (shared — audité dans shared-components/rider-card.md)
        └── → RiderPickerSheet (rider-picker-sheet.tsx — hors scope composant partagé)
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `RiderCard` → voir `shared-components/rider-card.md`

---

## États audités

- [x] GT inactive — no next GT (`InactiveView` variant A)
- [x] GT inactive — next known, countdown (`InactiveView` variant B)
- [x] GT active — squad empty (tous slots ouverts)
- [x] GT active — squad partiellement/totalement rempli
- [x] GT active — avec Remontada boost actif (banner visible)
- [x] GT active — avec Nemesis incoming (banner `NemesisIncomingBanner`)
- [x] GT active — swap mode (RiderPickerSheet ouvert)
- [x] TacticBoostModal ouvert (unleash / overdrive / call-the-bus)
- [x] TacticNemesisModal step 1 (select rival)
- [x] TacticNemesisModal step 2 (confirm stage)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation de classe A détectée.

Tous les éléments de texte dans les fichiers audités utilisent `text-[length:var(--type-*)]`. Détail par fichier :

- **page.tsx `InactiveView`** : `--type-body`, `--type-label`, `--type-page-title`, `--type-caption` — conformes.
- **gt-team-client.tsx** : `--type-section`, `--type-caption`, `--type-label`, `--type-micro` — conformes.
- **tactic-card.tsx** : `--type-micro`, `--type-emphasis`, `--type-stat-small`, `--type-caption` — conformes.
- **tactic-modal-shell.tsx** : `--type-section`, `--type-caption`, `--type-body` — conformes.
- **tactic-boost-modal.tsx** : `--type-body`, `--type-label`, `--type-caption` — conformes.
- **tactic-nemesis-modal.tsx** : `--type-body`, `--type-label`, `--type-emphasis`, `--type-caption`, `--type-micro`, `--type-stat-small` — conformes.

---

### B · Couleurs (0)

Aucune violation de classe B détectée.

Revue complète :

- `_remontada-banner-slot.tsx` : pas de className de couleur directe — délègue à `RemontadaBoostBanner`.
- `page.tsx` `InactiveView` : `text-[var(--text-mid)]`, `text-[var(--text-low)]`, `text-[var(--text-high)]`, `text-[var(--text-ghost)]` — tous sémantiques.
- `gt-team-client.tsx` : `text-[var(--text-high)]`, `text-[var(--text-low)]` — conformes. Pas de hex ni couleur Tailwind hardcodée.
- `tactic-card.tsx` : `border-[var(--border-default)]`, `bg-[var(--bg-surface)]`, `border-[var(--border-hover)]`, `bg-[var(--bg-surface-hover)]`, `border-[var(--accent-default)]`, `bg-[var(--badge-bg)]`, `border-[var(--border-subtle)]`, `bg-[var(--bg-subtle)]`, `text-[var(--accent-default)]`, `text-[var(--text-mid)]`, `text-[var(--text-high)]`, `text-[var(--text-low)]` — tous sémantiques.
- `tactic-modal-shell.tsx` : `bg-[var(--scrim)]`, `bg-[var(--bg-surface)]`, `border-[var(--border-subtle)]`, `text-[var(--text-high)]`, `text-[var(--text-mid)]`, `bg-[var(--accent-default)]`, `text-[var(--bg-app)]` — conformes.
- `tactic-boost-modal.tsx` : `text-[var(--accent-default)]`, `text-[var(--text-mid)]`, `text-[var(--text-low)]`, `text-[var(--danger)]` — conformes.
- `tactic-nemesis-modal.tsx` : `border-[var(--warning-border)]`, `bg-[var(--warning-bg)]`, `text-[var(--warning)]`, `border-[var(--border-default)]`, `bg-[var(--bg-subtle)]`, `border-[var(--accent-default)]`, `bg-[var(--badge-bg)]`, `bg-[var(--bg-surface-hover)]`, `bg-[var(--badge-bg)]`, `border-[var(--border-subtle)]`, `bg-[var(--bg-app)]`, `bg-[var(--bg-subtle)]`, `text-[var(--accent-default)]`, `text-[var(--text-high)]`, `text-[var(--text-mid)]`, `text-[var(--text-low)]`, `text-[var(--danger)]` — tous sémantiques.

---

### C · Spacing & Radius (0)

Aucune violation de classe C détectée.

- Toutes les valeurs `rounded-*` utilisent soit `rounded-[var(--radius-*)]` soit des utilitaires Tailwind standard (`rounded-full`, `rounded-t-[var(--radius-lg)]`).
- Pas de `p-[Npx]`, `gap-[Npx]`, `m-[Npx]` détectés.
- Spacing via utilitaires Tailwind standard (`p-4`, `p-3`, `gap-4`, `gap-2`, `gap-1.5`, `px-3`, `py-2.5`, `mb-3`, `mb-1`, `pt-1`, `pb-0`, `pb-24`, `py-4`, `py-16`, `px-4`) — conformes.

---

### D · Patterns composants (0)

Aucune violation de classe D détectée.

- Aucun `<span>` avec `rounded-full border ...` inline imitant un Pill/Badge.
- Le composant `Tag` (de `pill.tsx`) est utilisé correctement dans `tactic-card.tsx:48` : `<Tag variant="highlighted" ...>Today</Tag>` — conforme.
- `ROLE_ORDER.map` → les headers de rôle utilisent des `<span>` et `<p>` sémantiquement corrects (texte pur, pas de badges).
- Le `RivalRow` dans `tactic-nemesis-modal.tsx` utilise un radio button custom avec `role="radio"` — pattern interactif justifié, pas un Badge/Pill déguisé.

---

### E · Geist Mono numbers (0)

Aucune violation de classe E détectée.

Tous les éléments affichant des valeurs numériques sont correctement wrappés avec `font-mono tabular-nums` :

- `tactic-card.tsx:62` : `{remaining}` et `{tactic.max}` — `font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums` et `text-[length:var(--type-caption)]` dans même span (le `/` et le max partagent le contexte mono). Conforme.
- `tactic-nemesis-modal.tsx:127` : `{myLeader.xp}` — `font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums`. Conforme.
- `tactic-nemesis-modal.tsx:218` : `{rival?.xp}` — `font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums`. Conforme.
- `tactic-nemesis-modal.tsx:280` : `{rival.xp}` dans `RivalRow` — `font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums`. Conforme.
- `page.tsx:152` : `{days}` dans le countdown — **voir note E-NOTE-001 ci-dessous**.
- `gt-team-client.tsx:212` : `{headerCount}` (ex: "1 / 2") — **voir note E-NOTE-002 ci-dessous**.

**E-NOTE-001** — `{days}` dans `InactiveView` (page.tsx:152) :

```tsx
<p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
  Starts {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · in{" "}
  {days} days
</p>
```

`{days}` est une valeur numérique sans `font-mono`. Contexte : phrase narrative ("in 14 days"). Selon le DS §E, les nombres dans une phrase narrative sont à la limite — le DS spécifie `font-mono` pour les stats affichées de façon isolée, pas nécessairement pour les nombres intégrés dans du texte courant. Ici, c'est un décompte dans une phrase continue.

**Confidence : MANUAL** — deux options valides :
1. Laisser tel quel (nombre narratif, pas une stat isolée). Justification : le DS s'applique principalement aux valeurs de stats (XP, prix, scores), pas aux compteurs dans du texte.
2. Wrapper : `<span className="font-mono tabular-nums">{days}</span>`. Justification : cohérence stricte avec la règle E.

Recommandation auditeur : option 1 (faux positif probable — pas de BLOCKED, mais signalé pour décision humaine au gate Phase 2).

**E-NOTE-002** — `{headerCount}` dans `gt-team-client.tsx:212` :

```tsx
<span className="text-[length:var(--type-label)] text-[var(--text-low)]">
  {headerCount}
</span>
```

`headerCount` = `"1 / 2"` (string composite, pas un number JSX brut). Le DS vise les `{number}` JSX expressions, pas les strings. Ce pattern est une string interpolée qui contient des chiffres mais s'affiche comme un label de capacité ("1 / 2"). Pattern similaire présent dans d'autres composants du repo.

**Confidence : MANUAL** — deux options :
1. Laisser tel quel (string label, pas une stat — `font-mono` serait surprenant sur un "1 / 2" de capacité).
2. Ajouter `font-mono tabular-nums` pour cohérence numérique.

Recommandation auditeur : option 1 (faux positif probable). La valeur "1 / 2" est davantage un label de slot qu'une stat, et d'autres patterns similaires dans l'app (`tactic-card.tsx:64` lui-même mélange `font-mono` pour `remaining` et `font-normal` pour `/ {tactic.max}` dans une `<span>` inline — cohérence interne).

---

## Cross-cutting issues

Aucun issue cross-cutting identifié sur cette page spécifiquement.

**Observations hors scope (à logger dans follow-ups.md) :**

1. **`tactic-modal-shell.tsx` — `ModalActions` dupliqué** : le footer de `TacticNemesisModal` steps 1 et 2 re-implémente manuellement les boutons Cancel/Next/Back/Declare au lieu d'utiliser `ModalActions`. Le step 1 duplique exactement le pattern Cancel+CTA de `ModalActions` (lignes 74–91 de tactic-nemesis-modal.tsx). Step 2 a une structure légèrement différente (flex-between avec Back à gauche). Suggérer variante `ModalActions` avec prop `backAction` pour le step 2. → follow-up.

2. **`gt-team-client.tsx:200-214`** — `headerCount` string composite (`${riders.length} / ${cap}`) rendu sans `font-mono`. Cohérence à aligner avec la pattern `remaining / max` de `tactic-card.tsx` après gate humain (décision E-NOTE-002).

3. **`page.tsx` `(supabase as any)` cast** (ligne 83) — code smell, hors scope DS mais notable pour une session de cleanup séparée.

---

## Statut global

**CLEAN** — 0 violation A, B, C, D, E confirmée.

2 observations E best-effort (E-NOTE-001, E-NOTE-002) signalées pour décision humaine au gate Phase 2 — toutes deux classifiées comme faux positifs probables.

Cette page est la plus propre du batch GT. Elle bénéficie vraisemblablement d'avoir été développée après l'introduction formelle du design system v3.

---

## Checklist verification (à cocher par le repair agent)

> **Note pour le repair agent** : aucune violation confirmée sur cette page. Aucun fix à appliquer. Les 2 notes E sont FP probables — attendre la décision humaine du gate Phase 2 avant toute action.

- [ ] Screenshot before captured (état gt-active-with-squad)
- [ ] Screenshot before captured (état gt-inactive-next-known)
- [ ] Screenshot before captured (TacticBoostModal ouvert)
- [ ] Screenshot before captured (TacticNemesisModal step 1)
- [ ] Screenshot before captured (TacticNemesisModal step 2)
- [ ] Screenshot after captured (N/A — aucun fix prévu)
- [ ] Diff visuel: N/A (0 fix)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant cette page

---

## Faux positifs (FP) documentés

| ID | File:Line | Détection | Raison FP | Décision |
|---|---|---|---|---|
| E-FP-001 | page.tsx:152 | `{days}` sans `font-mono` | Nombre narratif dans une phrase ("in 14 days"), pas une stat isolée. Le DS §E vise les stats affichées de façon isolée. | FP probable — soumettre au gate humain |
| E-FP-002 | gt-team-client.tsx:212 | `{headerCount}` sans `font-mono` | String composite "1 / 2" construite avant le rendu JSX. Pas une `{number}` JSX expression directe. Sémantique de label de capacité, pas de stat. | FP probable — soumettre au gate humain |

---

## Références composants partagés utilisés sur cette page

| Composant | Rapport | Violations à propager |
|---|---|---|
| `RiderCard` | `shared-components/rider-card.md` | Voir rapport |
| `SponsorBonusCard` | Non audité séparément (< 3 consommateurs) | N/A |
| `RiderPickerSheet` | Non audité séparément (< 3 consommateurs) | N/A |
| `TeamTacticsSection` | Non audité séparément (< 3 consommateurs) | N/A |
| `NemesisIncomingBanner` | Non audité séparément (< 3 consommateurs) | N/A |
| `RemontadaBoostBanner` | Non audité séparément (< 3 consommateurs) | N/A |

---

## Notes Phase 3 (pour le repair agent)

- **Aucun fix à appliquer** sur les fichiers audités.
- Pas de commit `fix(ds): sweep team/gt` nécessaire, sauf si le gate humain tranche E-NOTE-001 ou E-NOTE-002 en faveur d'un fix.
- Si Jonathan décide d'appliquer `font-mono tabular-nums` sur `{days}` (E-NOTE-001) : wrapper en `<span className="font-mono tabular-nums">{days}</span>` dans `InactiveView`, page.tsx:152.
- Si Jonathan décide d'appliquer `font-mono tabular-nums` sur `{headerCount}` (E-NOTE-002) : ajouter `font-mono tabular-nums` à la `<span>` existante ligne 211 de `gt-team-client.tsx`. Note : `headerCount` est une string, pas un number — `tabular-nums` a un effet limité sur des strings composites mais n'est pas incorrect.
- Screenshots obligatoires même en l'absence de fix (preuve de conformité visuelle).
