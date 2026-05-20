# Audit · /league/[id] (Home + Race Feed)
Generated: 2026-05-21
Files: page.tsx + race-card-*.tsx + race-feed-*.tsx
States: lobby-pending, feed-no-team, feed-late-join, feed-active, feed-gt-active, off-season

---

## Component tree rendu (1 niveau)

- `page.tsx` (Server Component)
  - `LobbyView` — rendu si `league.status === "pending"` (composant partagé → audit séparé si nécessaire)
  - `RaceFeed` — rendu pour toutes les states feed-*
    - `RaceFeedDateGroup` — wrapper date par groupe
      - `RaceCardPast` — race passée (expandable)
      - `RaceCardToday` — race du jour (always expanded)
      - `RaceCardFuture` — stage futur (+ tactic button si GT)
      - `RaceCardRestDay` — jour de repos GT
      - `RaceFeedNemesisCard` — card duel nemesis
      - `RaceFeedRemontadaCard` — card boost remontada
    - `GtDnfCard` — card DNF rescue (injectée après son date-group)
    - `RaceFeedPhaseEndBanner` — bannière fin de phase / "Season over"
    - `RaceFeedTacticModal` — modal tactique (rendu conditionnel, overlay)

## Composants partagés utilisés (déjà audités — NE PAS dupliquer leurs violations)
- `RiderCard` → voir shared-components/rider-card.md (non utilisé sur cette page)
- `BackHeader` → voir shared-components/back-header.md (rendu par le layout, pas la page)
- `Pill`, `FilterChips`, `SegmentedControl` → non utilisés sur cette page

## Note sur race-feed-gt-goal-card.tsx
Le fichier `race-feed-gt-goal-card.tsx` mentionné dans le brief **n'existe pas** dans le repo. Vraisemblablement absorbé dans d'autres composants ou non encore implémenté. Aucune violation à reporter.

---

## Violations détaillées

### A · Typographie (5)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | race-card-past.tsx:127 | `text-[10px]` | `text-[length:var(--type-micro)]` | AUTO | Initiales de l'équipe dans le WinnerCircle — micro est le token DS pour les badges/labels de très petite taille |
| A-002 | race-card-today.tsx:92 | `text-[10px]` | `text-[length:var(--type-micro)]` | AUTO | Identique : initiales WinnerAvatar dans RaceCardToday |
| A-003 | race-feed-remontada-card.tsx:29 | `fontSize: "var(--type-micro)"` | `text-[length:var(--type-micro)]` (className) | MANUAL | Floating label utilise `style={{ fontSize }}` au lieu de className — équivalent fonctionnel mais pas le pattern DS. Migrer vers className pour cohérence. Conserver les autres propriétés du style object (`top`, `paddingLeft`, etc.). |
| A-004 | race-card-past.tsx:42 | `lineHeight: "12px"` (inline style) | `leading-3` | MANUAL | `lineHeight: "12px"` = 12px = Tailwind `leading-3`. Contexte : floating label span. Migrer vers className pour cohérence. |
| A-005 | race-card-past.tsx:29 | `borderRadius: 2` (inline style) | `rounded-[var(--radius-sm)]` ou garder 2px inline | MANUAL | `borderRadius: 2` = 2px — en dessous du token `--radius-sm` (4px). Pas de token DS pour 2px. Proposer `rounded-sm` (Tailwind = 2px) OU garder l'inline si le design souhaite 2px explicite. Note : RaceFeedRemontadaCard ligne 27 a le même pattern. Confidence MANUAL — demander à Jonathan si 2px est volontaire. |

### B · Couleurs (6)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | race-card-past.tsx:57-58 | `rgba(12,14,18,0.92)`, `rgba(12,14,18,0.75)`, `rgba(12,14,18,0.35)` dans `background: "linear-gradient(...)"`  | `--bg-app` avec opacités (inliner proprement) ou `var(--bg-app)` + scrim | MANUAL | Ces valeurs hex `#0c0e12` ≈ `--bg-app` (`#0c1012`). L'overlay gradient sur banner d'équipe est intentionnel (lisibilité texte). Proposer d'extraire en variable : `var(--bg-app)` + alpha = `rgba(12,16,18,0.92)`. Couleur très proche — acceptable si le design valide. Note : couleur hardcodée mais sémantiquement liée à `--bg-app`. |
| B-002 | race-feed-nemesis-card.tsx:44 | `bg-[rgba(239,68,68,0.06)]` | `bg-[var(--danger-bg)]` | AUTO | `--danger-bg: rgba(239, 68, 68, 0.10)` existe dans globals.css. La valeur courante est à 0.06 au lieu de 0.10 — opacité légèrement différente. Confidence MANUAL sur la différence d'opacité : vérifier visuellement si 0.10 convient. Si le designer veut 0.06, extraire un token. |
| B-003 | race-feed-nemesis-card.tsx:44 | `border-[rgba(239,68,68,0.20)]` | `border-[var(--danger-border)]` | AUTO | `--danger-border: rgba(239, 68, 68, 0.30)` existe. Même remarque : 0.20 vs 0.30 token. MANUAL sur l'opacité. |
| B-004 | race-card-future.tsx:26 | `bg-[rgba(6,182,212,0.10)]` | `bg-[var(--badge-bg)]` | AUTO | `--badge-bg: rgba(14, 165, 233, 0.10)` existe. Nuance : valeur courante utilise cyan-500 (#06b6d4) au lieu de sky-500 (#0ea5e9). Deux tokens différents. Confidence MANUAL : vérifier si `--badge-bg` (sky) est plus approprié que cyan pur pour ce bouton. |
| B-005 | race-card-future.tsx:26 | `hover:enabled:bg-[rgba(6,182,212,0.18)]` | Pas de token exact — proposer `bg-[var(--accent-subtle-bg)]` ou conserver | MANUAL | `--accent-subtle-bg: rgba(8, 51, 68, 0.5)` — pas le même registre. Aucun token de hover pour badge-bg. BLOCKED · need DS token : créer `--badge-bg-hover` ou documenter. Logger en follow-up. |
| B-006 | race-feed-phase-end-banner.tsx:36 | `bg-[rgba(6,182,212,0.08)]` et `hover:bg-[rgba(6,182,212,0.14)]` | `bg-[var(--badge-bg)]` / pas de token hover | MANUAL | Même pattern que B-004/B-005. Badge-bg à 0.08 (encore une variation). Pas de token pour 0.14 hover. Logger en follow-up : besoin d'un token `--badge-bg-hover`. |

### C · Spacing & Radius (8)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | race-card-past.tsx:24 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | `--radius-compound: 10px` — correspondance exacte. Pattern card standard dans le DS. |
| C-002 | race-card-past.tsx:41 | `rounded-[10px]` (inner wrapper) | `rounded-[var(--radius-compound)]` | AUTO | Même token — inner overflow-hidden clip. |
| C-003 | race-card-today.tsx:17 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | Card container. |
| C-004 | race-card-future.tsx:17 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | Card container. |
| C-005 | race-card-rest-day.tsx:6 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | Card container. |
| C-006 | race-feed-nemesis-card.tsx:44 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | Card container. |
| C-007 | race-feed-remontada-card.tsx:17 | `rounded-[10px]` | `rounded-[var(--radius-compound)]` | AUTO | Card container. |
| C-008 | race-feed-phase-end-banner.tsx:12 / :22 | `rounded-[10px]` (×2) | `rounded-[var(--radius-compound)]` | AUTO | Card container — deux branches du composant (season-over + next-phase). |

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | race-card-past.tsx:116-131 / race-card-today.tsx:82-98 | `<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)]...">` (empty state) et `<span className="inline-flex h-10/h-7 w-10/h-7 ... rounded-full text-[10px]..." style={{ background: "var(--cta-gradient)" }}>` (initiales) | Candidat `<AvatarCircle>` | Ces deux spans représentent deux variantes d'un même pattern "avatar circulaire" utilisé dans les 2 cards past/today. Non duplicable avec un composant DS existant (Pill/Badge). Cross-cutting issue → logger en follow-up extraction. FP partiel — conserver tel quel maintenant, extraire plus tard. |

### E · Geist Mono numbers (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | race-feed-remontada-card.tsx:41 | `{mult}` dans `<span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">` | Wrapper `<span className="font-mono">{mult}</span>` ou classe `font-mono` sur le span parent | MANUAL | `mult` = valeur numérique "×1.5" ou "×2" — chiffre typique DS. Le span n'a pas `font-mono`. DS §Typographie : "tous les chiffres en Geist Mono". Confidence MANUAL car c'est un chiffre dans une phrase prose. |
| E-002 | race-feed-remontada-card.tsx:41 | `{data.stagesRemaining}` dans le même span prose | Wrapper `<span className="font-mono tabular-nums">{data.stagesRemaining}</span>` | MANUAL | Même span — nombre de stages. Deux variables numériques dans la même phrase sans font-mono. Proposer d'entourer chacune, ou utiliser un composant `<Mono>` si disponible. |

---

## Cross-cutting issues (à logger en follow-ups)

1. **Token manquant — badge-bg hover states** : `rgba(6,182,212,0.14)` (phase-end-banner) et `rgba(6,182,212,0.18)` (future card) n'ont pas de token DS. Besoin de `--badge-bg-hover` ou clarification de la règle hover. Logger dans follow-ups.
2. **Pattern avatar circulaire répété** : `WinnerCircle` (race-card-past) et `WinnerAvatar` (race-card-today) sont des clones avec taille différente (h-10 vs h-7). Candidat à extraction en `<AvatarCircle size>`. Logger en follow-up (hors scope A-E).
3. **Inline styles vs className** : plusieurs composants mélangent `style={{ fontSize: "var(--type-micro)" }}` et `className="text-[length:var(--type-micro)]"` (race-feed-remontada-card, race-card-past). Après sweep, standardiser sur className uniquement.
4. **`race-feed-gt-goal-card.tsx` absent** : le fichier ne figure pas dans le repo. Si une GT Goal card est prévue, créer le fichier ex-nihilo avec les tokens DS dès le départ.

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured — état `feed-active` (race passée expandée)
- [ ] Screenshot before captured — état `feed-gt-active` (stage futur + bouton tactic)
- [ ] Screenshot before captured — état `feed-late-join` (banner info sponsor)
- [ ] Screenshot before captured — état `off-season` (phase-end banner "Season over")
- [ ] Screenshot after captured — mêmes états
- [ ] Diff visuel décrit textuellement (aucune régression visuelle sur les cards)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS (`pnpm test -- race-card race-feed`)
- [ ] Pas de régression sur les tests existants (`components/__tests__/race-feed-nemesis-card.test.tsx`, `race-feed-phase-end-banner.test.tsx`, `race-feed-remontada-card.test.tsx`, `race-feed.test.tsx`)

---

## Résumé des violations

| Classe | Count | Confidence AUTO | Confidence MANUAL | BLOCKED |
|---|---|---|---|---|
| A | 5 | 2 | 3 | 0 |
| B | 6 | 1 | 4 | 1 (B-005 hover token manquant) |
| C | 8 | 8 | 0 | 0 |
| D | 1 | 0 | 1 (FP/follow-up) | 0 |
| E | 2 | 0 | 2 | 0 |
| **Total** | **22** | **11** | **10** | **1** |

**BLOCKED · B-005** : `hover:enabled:bg-[rgba(6,182,212,0.18)]` dans `race-card-future.tsx:26` — aucun token DS existant pour ce state hover. Trancher : créer `--badge-bg-hover` dans globals.css ou documenter la valeur inline comme exception approuvée.

**Faux positifs (D-001 partiel)** : le pattern `WinnerCircle/WinnerAvatar` est du code custom légitime (pas de composant DS équivalent). Aucune substitution immédiate — extraction en follow-up uniquement.

**Refs partagés** : aucun composant partagé de la liste des 7 n'est audité ici. Les violations sur `BackHeader`, `RiderCard`, etc. sont dans leurs rapports dédiés.

**Notes Phase 3** :
- Appliquer les 8 violations C en lot (toutes `rounded-[10px]` → `rounded-[var(--radius-compound)]`) — batch mécanique sans risque.
- A-001/A-002 : substitution directe `text-[10px]` → `text-[length:var(--type-micro)]` (mêmes 2 occurrences que le sweep Jules partiellement corrigé — vérifier si déjà appliqué avant de re-patcher).
- B-002/B-003 : vérifier visuellement la différence d'opacité (0.06 vs 0.10, 0.20 vs 0.30) avant d'appliquer.
- E-001/E-002 : entourer les variables numériques inline de `<span className="font-mono tabular-nums">`.
