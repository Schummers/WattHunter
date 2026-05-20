# Sitemap DS Compliance Sweep 2026-05
Status: pending review
Generated: 2026-05-21

## Résumé
- 34 routes totales (33 pages visuelles + 1 prototype)
- 7 composants partagés à auditer séparément (3+ consommateurs)
- Total unités d'audit : 34 + 7 = **41 unités**

---

## Groupes de routes

### Root (redirect-only — pas de rendu visuel)
| Route | File | Notes |
|---|---|---|
| `/` | `apps/web/app/page.tsx` | Redirect pur — pas d'audit nécessaire |

### Auth & Onboarding

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/onboarding` | `apps/web/app/(auth)/onboarding/page.tsx` | default | Landing onboarding — logo, 3 InfoCards, CTA. Pas de state conditionnel. |
| `/login` | `apps/web/app/(auth)/login/page.tsx` | default, password-updated | `?message=password_updated` affiche une confirmation. Formulaire email+password + Google OAuth. |
| `/signup` | `apps/web/app/(auth)/signup/page.tsx` | default, error | Formulaire d'inscription. |
| `/forgot-password` | `apps/web/app/(auth)/forgot-password/page.tsx` | default, email-sent | Formulaire email. |
| `/reset-password` | `apps/web/app/(auth)/reset-password/page.tsx` | default, error | Formulaire nouveau mot de passe. |
| `/league/choose` | `apps/web/app/(auth)/league/choose/page.tsx` | default | Choix create/join. Rendu après login si l'user n'appartient à aucune league. |
| `/league/create` | `apps/web/app/(auth)/league/create/page.tsx` | default, error | Formulaire création de ligue. |
| `/league/join` | `apps/web/app/(auth)/league/join/page.tsx` | default, error, invalid-code | Formulaire saisie invite code. |

### Game — League Home / Race Feed

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]` | `apps/web/app/(game)/league/[leagueId]/page.tsx` | lobby-pending, feed-no-team, feed-late-join, feed-active, feed-gt-active | État `lobby-pending` → `LobbyView`. États `feed-*` → `RaceFeed` avec variantes. `feed-late-join` affiche la banner d'info sponsorship. `feed-gt-active` inclut le tactic context + DNF cards. |

### Game — Auction (layout avec SubTabs : Auctions / Market / League / History)

> Les SubTabs sont rendus par `auction/layout.tsx` — masqués sur les routes `/auction/rounds` et `/auction/[auctionId]/*`.

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/auction` | `apps/web/app/(game)/league/[leagueId]/auction/page.tsx` | round-active-round1, round-active-round2+, round-closed-with-bids, round-closed-no-bids, no-team | Client `AuctionsClient`. Affiche roster + draft bids + stepper. |
| `/league/[leagueId]/auction/market` | `apps/web/app/(game)/league/[leagueId]/auction/market/page.tsx` | round-active, round-closed, round-scheduled, no-member | Client `MarketClient` + `FilterChips` + `RiderCard`. |
| `/league/[leagueId]/auction/status` | `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` | round-open, no-open-round | `RoundStepper` + `Tag` (Validated / Auto-validated / Pending / Not yet bid). |
| `/league/[leagueId]/auction/history` | `apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx` | has-history, empty, with-emergency-bids | Historique rounds fermés + GT Emergency Bids section conditionnelle. |
| `/league/[leagueId]/auction/rounds` | `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx` | creating (no rounds), editing (rounds exist) | Commissioner only. Client `RoundsClient`. SubTabs masquées sur cette route. |
| `/league/[leagueId]/auction/[auctionId]` | `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/page.tsx` | round-open-with-bids, round-open-no-bids | `TreasuryWidget` + `AuctionClient`. SubTabs masquées. |
| `/league/[leagueId]/auction/[auctionId]/results` | `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/results/page.tsx` | **tab=round-1**, **tab=round-2**, **tab=round-3** | TABS — Underline Tabs `<Tabs variant="line">` avec 3 onglets Round 1/2/3. Chaque onglet = rendu `Table` différent ou état empty. |

### Game — Team (layout avec SubTabs : My Team / GT Team / Budget)

> Les SubTabs sont rendus par `team/layout.tsx` — masquées sur `/strategies` et `/rescue`.

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/team` | `apps/web/app/(game)/league/[leagueId]/team/page.tsx` | roster-has-riders, roster-empty, strategies-active, strategies-empty | Affiche `BrandCard` (XP hero), stratégies actives/slots vides, roster `RiderCard` + open slots. |
| `/league/[leagueId]/team/gt` | `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` | gt-active-with-squad, gt-active-empty-squad, gt-inactive-next-known, gt-inactive-no-gt | Client `GtTeamClient` + `RemontadaBannerSlot` (conditionnel). Modaux : `RiderPickerSheet` (fill/swap), `TacticBoostModal` (unleash/overdrive/call-the-bus), `TacticNemesisModal` (nemesis-gc/sprint). `NemesisIncomingBanner` conditionnel. |
| `/league/[leagueId]/team/gt/rescue` | `apps/web/app/(game)/league/[leagueId]/team/gt/rescue/page.tsx` | has-eligible-riders, empty-pool, existing-bid | `GtRescueMarket`. SubTabs masquées. Accessible uniquement si `dnf_refund_claimed = true`. |
| `/league/[leagueId]/team/budget` | `apps/web/app/(game)/league/[leagueId]/team/budget/page.tsx` | filter-all, filter-income, filter-salaries, filter-bonuses | Client `BudgetClient` avec `FilterChips` (filtre par type de transaction). Phase selector via `?phase=N`. |
| `/league/[leagueId]/team/budget/transactions` | `apps/web/app/(game)/league/[leagueId]/team/budget/transactions/page.tsx` | has-transactions, empty | Client `TransactionsClient`. `BackHeader` + `SegmentedControl`. SubTabs masquées (hors layout team). |
| `/league/[leagueId]/team/budget/marketplace` | `apps/web/app/(game)/league/[leagueId]/team/budget/marketplace/page.tsx` | no-sponsor, sponsor-active, sponsor-pending-change, immediate-change | Client `MarketplaceClient`. `BackHeader` + sponsor cards. |
| `/league/[leagueId]/team/strategies` | `apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx` | has-active-strategies, all-empty, auction-open-immediate | Client `StrategiesClient`. `BackHeader`. SubTabs masquées. |

### Game — Rider Detail

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/rider/[riderId]` | `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx` | **tab=pcs-stats** (default), **tab=game-stats** | TABS — `SegmentedControl` 2 segments. tab=0 → `PcsStatsSection` (season rankings + startlists). tab=1 → `GameResultsSection` (race results). Modal : `ReleaseConfirmModal` (conditionnel si contrat actif). `StickyBar` (bid/release). |

### Game — Ranking

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/ranking` | `apps/web/app/(game)/league/[leagueId]/ranking/page.tsx` | **tab=teams**, **tab=riders** | TABS — `SegmentedControl` 2 segments. tab=0 → classement équipes. tab=1 → classement riders (filtrable par race via `?race=slug`). |
| `/league/[leagueId]/ranking/team/[teamId]` | `apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx` | has-active-riders, has-former-riders, empty | Détail équipe : roster actif + anciens coureurs. `BackHeader` + `MetricBox` + `MovementTag`. |

### Game — Achievements (Palmares)

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/achievements` | `apps/web/app/(game)/league/[leagueId]/achievements/page.tsx` | **filter=monuments** (default), **filter=grand-tour** | FILTER CHIPS (FilterChips) — 2 filtres actifs (Monuments / Grand Tour). "Budget" et "Roster" désactivés (à venir). Chaque filtre = contenu complètement différent. |

### Game — Settings, Help, Levels

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/league/[leagueId]/settings` | `apps/web/app/(game)/league/[leagueId]/settings/page.tsx` | regular-user, commissioner | Commissioner voit le lien "Edit round dates". `BackHeader`. |
| `/league/[leagueId]/help` | `apps/web/app/(game)/league/[leagueId]/help/page.tsx` | default | `BackHeader` + `GameGuideAccordion`. |
| `/league/[leagueId]/levels` | `apps/web/app/(game)/league/[leagueId]/levels/page.tsx` | default | `BackHeader` + `LevelsTimeline`. |

### Legal

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/terms` | `apps/web/app/(legal)/terms/page.tsx` | default | Article texte pur. |
| `/privacy` | `apps/web/app/(legal)/privacy/page.tsx` | default | Article texte pur. |

### Prototype (hors scope jeu — à auditer en dernier si du tout)

| Route | File | States/Tabs | Notes |
|---|---|---|---|
| `/prototype` | `apps/web/app/prototype/page.tsx` | default | Page de prototypage des achievements visuels. Styles inline inline avec hardcoded hex couleurs. Hors scope si considéré "non-production". |

---

## Composants partagés (3+ pages)

| Composant | File | Used by (count) | Used by (pages/clients) |
|---|---|---|---|
| `back-header` | `apps/web/components/back-header.tsx` | 9 | settings, ranking/team/[teamId], auction/rounds-client, rider/rider-detail-client, team/strategies, team/budget/marketplace-client, team/budget/transactions-client, levels, help |
| `pill` (Tag/Pill) | `apps/web/components/pill.tsx` | 7+ | auction/status, team/strategies-client, team/budget/marketplace-client + composants partagés internes (`race-feed-*`, `rider-card`) |
| `sticky-bar` | `apps/web/components/sticky-bar.tsx` | 5 | auction/auctions-client, auction/market/market-client, rider/rider-detail-client, team/strategies-client, (indirectement via modaux) |
| `rider-card` | `apps/web/components/rider-card.tsx` | 5 | auction/auctions-client, auction/market/market-client, team/page, team/gt/gt-team-client, (+ test files) |
| `movement-tag` | `apps/web/components/movement-tag.tsx` | 4 | ranking/ranking-client, ranking/team/[teamId]/page, (+ rider detail indirect) |
| `segmented-control` | `apps/web/components/segmented-control.tsx` | 3 | ranking/ranking-client, rider/rider-detail-client, team/budget/transactions-client |
| `filter-chips` | `apps/web/components/filter-chips.tsx` | 3 | auction/market/market-client, achievements/achievements-client, team/budget/budget-client |

> **Note** : les composants `ui/button` (12 pages), `ui/avatar` (4 pages), `ui/badge` (3 pages) sont des primitives Shadcn UI. Leurs violations éventuelles remontent aux composants qui les wrappent — les auditer en priorité via les composants partagés ci-dessus.

---

## Modaux & overlays critiques (à screenshoter)

Ces modaux/overlays sont listés dans l'audit de la page/composant qui les contient (pas d'audit séparé).

| Modal/Overlay | Composant | Rendu par | Variantes |
|---|---|---|---|
| Tactic Boost Modal | `tactic-boost-modal.tsx` | `team-tactics-section` (sur GT team) | unleash, overdrive, call-the-bus |
| Tactic Nemesis Modal | `tactic-nemesis-modal.tsx` | `team-tactics-section` (sur GT team) | nemesis-gc (step 1: select rival, step 2: confirm), nemesis-sprint |
| Rider Picker Sheet | `rider-picker-sheet.tsx` | `gt-team-client` (sur GT team) | fill-role, swap-rider |
| Release Confirm Modal | `release-confirm-modal.tsx` | `rider-detail-client` | default, blocked-this-phase, paid-phase |
| DNF rescue (inline) | `gt-dnf-card.tsx` | `race-feed.tsx` (sur Home) | unclaimed, claimed-no-bid, claimed-with-bid |

---

## Ordre d'audit recommandé

### Vague 1 — Composants partagés (parallélisable, 7 agents simultanés max 5 par batch)

**Batch 1A** (5 composants en parallèle) :
1. `back-header` (9 pages — impact maximal)
2. `rider-card` (5 pages — cœur du game loop)
3. `filter-chips` (3 pages)
4. `segmented-control` (3 pages)
5. `pill` / `Tag` (7+ pages — composant DS critique)

**Batch 1B** (2 composants restants) :
6. `sticky-bar` (5 pages — StickyBar action bar)
7. `movement-tag` (4 pages)

### Vague 2 — Pages, groupées par feature (batch de 5 en parallèle par batch)

**Batch 2A — Auction** (5 pages) :
- `/league/[id]/auction` (auctions-client)
- `/league/[id]/auction/market` (market-client)
- `/league/[id]/auction/status`
- `/league/[id]/auction/history`
- `/league/[id]/auction/[auctionId]/results` (tabs round 1/2/3)

**Batch 2B — GT** (3 pages) :
- `/league/[id]/team/gt` (gt-team-client + tactic modaux)
- `/league/[id]/team/gt/rescue` (gt-rescue-market)
- `/league/[id]/auction/rounds` (rounds-client)

**Batch 2C — Home & Rider** (3 pages) :
- `/league/[id]` (race feed — états multiples)
- `/league/[id]/rider/[riderId]` (rider-detail-client — tabs pcs/game)
- `/league/[id]/ranking/team/[teamId]`

**Batch 2D — Team & Budget** (5 pages) :
- `/league/[id]/team`
- `/league/[id]/team/budget`
- `/league/[id]/team/budget/transactions`
- `/league/[id]/team/budget/marketplace`
- `/league/[id]/team/strategies`

**Batch 2E — Ranking, Achievements, Settings** (5 pages) :
- `/league/[id]/ranking` (tabs teams/riders)
- `/league/[id]/achievements` (filter chips monuments/gt)
- `/league/[id]/settings`
- `/league/[id]/levels`
- `/league/[id]/help`

**Batch 2F — Auth & Onboarding** (5 pages) :
- `/onboarding`
- `/login`
- `/signup`
- `/forgot-password`
- `/league/choose`

**Batch 2G — Misc** (4 pages) :
- `/league/[id]/auction/[auctionId]` (auction detail)
- `/reset-password`
- `/league/create`
- `/league/join`

**Legal + Prototype** (3 pages, en dernier) :
- `/terms`
- `/privacy`
- `/prototype` (⚠ hors scope si non-production — décision Jonathan)

---

## Notes pour les auditeurs Phase 2

### Tabs et états distincts
- **`/league/[id]/auction/[auctionId]/results`** : tab Round 1/2/3 = états séparés (Underline Tabs via `ui/tabs.tsx`). Auditer les 3 tabs + état empty (no riders assigned).
- **`/league/[id]/rider/[riderId]`** : tab PCS Stats vs Game Stats = `SegmentedControl` 2 segments. Même fichier `rider-detail-client.tsx`, contenu fondamentalement différent. Auditer les 2.
- **`/league/[id]/ranking`** : tab Teams vs Riders = `SegmentedControl`. Auditer les 2.
- **`/league/[id]/achievements`** : FilterChips Monuments / Grand Tour = 2 états de contenu distincts.
- **`/league/[id]/team/budget`** : FilterChips par type de transaction = 4 filtres (All / Income / Salaries / Bonuses) — pas de rendu structurellement différent, 1 audit suffit.
- **`/league/[id]/auction`** (auctions-client) : SubTabs via `auction/layout.tsx` — le layout est audité comme partie de la navigation globale, pas comme composant séparé.

### Modaux
- Inclus dans l'audit de la page parente. Ne pas créer d'audit séparé sauf `tactic-modal-shell` + `tactic-nemesis-modal` si la complexité le justifie (2-step flow).
- Pour les screenshots : capturer l'état modal ouvert en plus de l'état page.

### Composants partagés vs pages
- Ne PAS dupliquer les violations de `back-header`, `rider-card`, `filter-chips` dans les audits des pages qui les utilisent. Référencer `shared-components/<slug>.md`.
- Exception : si une page surcharge un composant partagé avec des classes locales (ex: `className="..."` passé en prop), noter ces violations dans l'audit de la page.

### Page `prototype`
- Contient des hex hardcodés intentionnels (prototypage). Decision Jonathan : auditer ou ignorer.
- Si audité, noter class B (hex) uniquement — le prototype est statique et non-interactif.

### Layouts visuels
- `apps/web/app/(game)/league/[leagueId]/layout.tsx` : rendu `Sidebar`, `TopBar`, `BottomNav` → ces composants sont audités séparément si violation (ils ne font pas partie du scope des 7 composants partagés listés, mais `back-header` s'y retrouve imbriqué).
- `auction/layout.tsx` et `team/layout.tsx` : rendu `SubTabs` → `sub-tabs.tsx` a 2 consommateurs (< 3 → pas dans la liste des partagés). Violations reportées dans les audits des pages concernées.
