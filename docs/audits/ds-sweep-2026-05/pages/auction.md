# Audit · /league/[id]/auction
Generated: 2026-05-21
Files: auction/page.tsx + auctions-client.tsx + auction/layout.tsx
States (sitemap): round-active-round1, round-active-round2+, round-closed-with-bids, round-closed-no-bids, no-team

---

## Component tree (1 niveau)

**layout.tsx**
- `<SubTabs>` (masqué sur routes `/auction/rounds` et `/auction/[auctionId]/*`)

**page.tsx** (Server Component)
- `<AuctionsClient>` (client, reçoit toutes les données en props)

**auctions-client.tsx** (Client Component)
- `<RoundStepper>` — section Rounds
- `<ConfigCards>` — section Sponsor & Strategies
- `<RiderCard>` (×N) — section Roster, via `rightContent`
- `<DraftBidCard>` (×N) — section Draft Bids
- `<BudgetSummary>` — section Summary
- `<StickyBar>` — barre d'action validate sticky
- `<ReleaseConfirmModal>` — dialog de confirmation release (conditionnel)

---

## Composants partagés utilisés (déjà audités → référencés, PAS audités à nouveau)

- `SubTabs` → non listé dans shared-components/ (< 3 consommateurs selon sitemap — auditer en page uniquement, voir section D ci-dessous)
- `RoundStepper` → non listé dans shared-components/ (composant spécifique auction)
- `ConfigCards` → non listé dans shared-components/
- `RiderCard` → voir shared-components/rider-card.md
- `DraftBidCard` → non listé dans shared-components/
- `BudgetSummary` → non listé dans shared-components/
- `StickyBar` → voir shared-components/sticky-bar.md
- `ReleaseConfirmModal` → non listé dans shared-components/

---

## Violations sur le code spécifique de cette page

### A · Typographie (0)

Aucune violation. `page.tsx` ne rend que des early-returns avec tokens corrects (L.31 et L.49 utilisent `text-[length:var(--type-body)]`). `auctions-client.tsx` utilise exclusivement `text-[length:var(--type-section)]`, `text-[length:var(--type-caption)]`, `text-[length:var(--type-body)]`, `text-[length:var(--type-micro)]` — tous conformes DS. `layout.tsx` ne contient pas de CSS inline.

---

### B · Couleurs (5)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | auctions-client.tsx:318 | `text-red-400` | `text-[var(--danger)]` | AUTO | Bouton release rider (×). Contexte danger — `--danger` = `#ef4444` est le token sémantique DS normalisé pour les actions destructives. `text-red-400` (`#f87171`) dévie légèrement (rouge plus clair). Substitution identique à sticky-bar.md B-001. |
| B-002 | auctions-client.tsx:343 | `text-red-400` (dans l'interpolation ternaire) | `text-[var(--danger)]` | AUTO | Compteur "slots — over limit" : `${totalCount > maxSlots ? 'text-red-400' : 'text-[var(--text-low)]'}`. Le cas d'alerte doit utiliser `--danger` pour cohérence avec le token DS "Perte, budget dépassé". |
| B-003 | auctions-client.tsx:401 | `text-red-400` | `text-[var(--danger)]` | AUTO | Banner d'erreur validate. Même sémantique danger. La bannière utilise déjà `border-[var(--danger-border)]` et `bg-[var(--danger-bg)]` — incohérence d'avoir `text-red-400` sur le texte alors que border et bg utilisent les tokens sémantiques. |
| B-004 | auctions-client.tsx:410 | `text-emerald-400` | `text-[var(--success)]` | AUTO | Banner de succès validate. Même logique : `border-[var(--success-border)]` + `bg-[var(--success-bg)]` utilisés → le texte doit aussi utiliser `--success` = `#10b981` (alias de `emerald-500`). `text-emerald-400` = `#34d399` (légèrement plus clair). Cohérence sémantique exige le token. |
| B-005 | auctions-client.tsx:410 | `text-emerald-400` (déjà couvert en B-004) | — | — | Voir B-004 — même ligne, même violation. |

> **Note B-005** : la ligne 410 ne contient qu'une seule violation (l'outil détecte correctement `text-emerald-400` une seule fois). B-005 est redondant — compter 4 violations réelles : B-001, B-002, B-003, B-004.

**Récapitulatif B réel : 4 violations.**

---

### C · Spacing & Radius (2 — faux-positifs potentiels, analyse ci-dessous)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | auctions-client.tsx:401 | `rounded-lg` | Garder `rounded-lg` — **FALSE-POSITIVE** | — | `rounded-lg` = `--radius-lg` = 8px. DS §Radius Tokens : `--radius-lg` (8px) = "Cards, L2 tab active chip, filter chip containers — Structural / sub-nav chip". Les banners d'erreur/succès sont des conteneurs informatifs structurels, pas des contrôles interactifs. 8px est le radius correct. Aucune correction requise. |
| C-002 | auctions-client.tsx:410 | `rounded-lg` | Garder `rounded-lg` — **FALSE-POSITIVE** | — | Même raisonnement que C-001 — banner de succès, conteneur structural. |

**Récapitulatif C : 0 violations réelles (2 false-positifs documentés).**

---

### D · Patterns composants (1)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | auctions-client.tsx:307 | `+<span className="font-mono">{rider.xp}</span> XP` (span sans classes typographiques dédiées) | Appliquer `tabular-nums` : `+<span className="font-mono tabular-nums">{rider.xp}</span> XP` | Ce span rend un nombre XP. Le DS impose `tabular-nums` sur tous les nombres (voir rider-card.md E-003, même pattern). Ce n'est pas un remplacement de composant D pur mais une correction E (voir E-001 ci-dessous) — classé D car le pattern de `<span>` inline avec nombre numérique sans `tabular-nums` est un anti-pattern récurrent à normaliser. Confidence : AUTO. |

> **Note D-001** : ce span est dans le `rightContent` du `<RiderCard>` — code spécifique à cette page, pas dans le composant partagé. La violation est légitime ici.

---

### E · Geist Mono numbers (3)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | auctions-client.tsx:307 | `<span className="font-mono">{rider.xp}</span>` | `<span className="font-mono tabular-nums">{rider.xp}</span>` | AUTO | `rider.xp` est un entier (XP cumulé). DS §Typographie règle 2 : "Geist Mono pour TOUT ce qui est numérique, toujours avec `tabular-nums`". Le `tabular-nums` garantit la stabilité de largeur dans les listes. Convention codebase confirmée (`budget-client.tsx`, `rider-card.tsx E-003`). |
| E-002 | auctions-client.tsx:281 | `<span className="font-mono">{rosterCount}/{maxSlots}</span>` | `<span className="font-mono tabular-nums">{rosterCount}/{maxSlots}</span>` | AUTO | Compteur roster `N/M`. Même règle que E-001. `rosterCount` et `maxSlots` sont des entiers — `tabular-nums` évite le saut visuel entre ex: `7/8` et `10/8`. |
| E-003 | auctions-client.tsx:344 | `<span className="font-mono">{totalCount}/{maxSlots}</span>` | `<span className="font-mono tabular-nums">{totalCount}/{maxSlots}</span>` | AUTO | Compteur draft bids `N/M`. Même règle — ce span est dans le header "Draft Bids", son état "over limit" rend d'autant plus critique la stabilité de l'affichage. |

> **Note sur E-003 du détecteur :** `audit-ds` a flaggé `{treasury}` à la ligne 389 (prop passée à `<BudgetSummary>`). Ce n'est **pas** une violation — `{treasury}` est une prop JSX, pas du texte rendu directement dans le JSX de cette page. Le rendu du treasury est géré par `BudgetSummary` (composant non encore audité). **False-positive détecteur ligne 389.**

---

## Cross-cutting issues

- **`rounded-lg` sur les banners d'erreur/succès** (L.401 et L.410) : utilise déjà les tokens `--danger-border`/`--danger-bg`/`--success-border`/`--success-bg` pour border et bg, mais le texte utilise des couleurs Tailwind hardcodées (`text-red-400`, `text-emerald-400`). Après corrections B-003 et B-004, la cohérence sémantique sera totale sur ces banners.

- **Pattern `hover:bg-[var(--danger-bg)]`** (L.318) : le bouton release a `bg-[var(--danger-bg)]` ET `hover:bg-[var(--danger-bg)]` (même valeur). L'état hover ne change pas visuellement — absence d'affordance hover. Hors scope A-E mais logger pour suivi. → **follow-up hors scope sweep**.

- **`tabular-nums` manquant systématiquement** sur les `<span className="font-mono">` de cette page (E-001, E-002, E-003). Pattern récurrent dans l'app — recommander une règle ESLint custom ou un commentaire dans le CLAUDE.md pour le renforcer.

---

## False-positifs documentés

| Élément | Ligne | Raison |
|---------|-------|--------|
| `{treasury}` prop JSX | auctions-client.tsx:389 | Prop passée à `<BudgetSummary>`, pas de rendu direct sur cette page. Rendu géré par le composant enfant. |
| `rounded-lg` banners | auctions-client.tsx:401, 410 | Token `--radius-lg` correct pour conteneurs structurels (messages/banners). Pas un contrôle interactif. |
| `font-bold` (L.303) | auctions-client.tsx:303 | `font-bold` + `font-mono` sur le salaire formaté — poids 700 avec Geist Mono conforme DS. `tabular-nums` manquant est capturé en E-001 (via le span XP adjacent) — le salaire lui-même utilise `formatThousands()` qui retourne une chaîne, non un nombre variable. Note : `formatThousands` retourne du texte avec séparateurs — `tabular-nums` reste recommandé mais la chaîne ne change pas de largeur de façon imprévisible (toujours padded par les milliers). MANUAL si appliqué ici. |

---

## Checklist verification

- [ ] Screenshot before captured — état `round-active-round1` (roster peuplé, draft bids)
- [ ] Screenshot before captured — état `round-closed-with-bids` (validate success visible)
- [ ] Screenshot before captured — état `round-closed-no-bids` (liste vide)
- [ ] Screenshot before captured — état `no-team` (early return p.32/49)
- [ ] Screenshot after captured — mêmes états
- [ ] Diff visuel attendu : `text-red-400` → `text-[var(--danger)]` (rouge légèrement plus sombre, perceptible sur le bouton release et les banners d'erreur) ; `text-emerald-400` → `text-[var(--success)]` (vert légèrement plus foncé sur banner succès) ; `tabular-nums` ajout invisible sauf en typographie variable-width
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS
- [ ] Pas de régression sur les composants partagés (RiderCard, StickyBar — déjà auditées séparément)
