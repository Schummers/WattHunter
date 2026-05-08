# Market & My Bids — Plan d'implémentation

Basé sur la spec [2026-04-02-market-mybids-design.md](file:///Users/jonathanschummers/Documents/WattHunter/docs/superpowers/specs/2026-04-02-market-mybids-design.md).

## User Review Required

> [!IMPORTANT]
> **Rename global** : Le renommage `Recruts → Market` touche les routes (= changement d'URL), les composants, la sidebar, le layout des sous-tabs, les search params `?from=recruts`, et les labels BackHeader. Pas de redirect puisqu'on est en pré-alpha.

> [!WARNING]
> **Birthdate** : La spec suppose que `birthdate` est dispo en DB sur la table `riders`. Le champ existe déjà — vérifié dans `rider-detail-client.tsx` (L25) et le query du team page (L80). Il faut juste l'ajouter au SELECT de `recruts/page.tsx` et le passer au client.

---

## Proposed Changes

Les étapes sont ordonnées par dépendance. Chaque étape peut être commitée indépendamment.

---

### Étape 1 — Rename Recruts → Market (routes + labels)

Renommage global du terme "Recruts" en "Market" dans tout le codebase.

#### [MODIFY] [team/layout.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/layout.tsx)
- SubTabs : `"Recruts"` → `"Market"`, href `team/recruts` → `team/market`

#### [NEW] `team/market/` (dossier route)
- Renommer le dossier `team/recruts/` → `team/market/`
- Fichiers impactés :
  - `page.tsx` → import `MarketClient` au lieu de `RecrutsClient`
  - `recruts-client.tsx` → renommé en `market-client.tsx`, export `MarketClient`
  - `loading.tsx` → déplacé tel quel
  - `history/page.tsx` → BackHeader `"Market"` au lieu de `"Recruts"`

#### [DELETE] `team/recruts/` (ancien dossier)

#### [MODIFY] [sidebar.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/sidebar.tsx)
- L37 : `"Recruts"` → `"Market"`, href → `/league/${id}/team/market`

#### [MODIFY] [rider-detail-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx)
- L14 : type `"recruts"` → `"market"` dans `RiderContext`
- L96 : `BACK_LABELS.recruts` → `BACK_LABELS.market: "Market"`
- L165, 297 : `context === "recruts"` → `context === "market"`

#### [MODIFY] [rider page.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx)
- L7, L101, L136 : `"recruts"` → `"market"`

#### [MODIFY] [rider-detail-rail.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/rail-pages/rider-detail-rail.tsx)
- L15, L89, L115, L144 : `"recruts"` → `"market"`

#### [MODIFY] [team/page.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/page.tsx)
- L371 : open slot href → `team/market`
- L407 : `?from=recruts` → `?from=market`

#### [MODIFY] [home-feed.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/home-feed.tsx)
- Tout `?from=recruts` → `?from=market`

**Fichiers total** : ~10 fichiers modifiés + 1 dossier renommé.

---

### Étape 2 — FilterPills component + remplacement SegmentedControl dans Market

#### [NEW] [filter-pills.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/filter-pills.tsx)
Nouveau composant réutilisable :
```tsx
interface FilterPillsProps {
  options: Array<{ label: string; count?: number }>;
  activeIndex: number;
  onChange: (index: number) => void;
}
```
- Scrollable horizontal : `overflow-x-auto scrollbar-none`
- Style pill : `rounded-[var(--radius-pill)]`, `border`, `--type-caption`
- Active : `bg-[var(--bg-surface-active)] text-[var(--text-high)] font-semibold`
- Inactive : `text-[var(--text-low)] font-medium`
- Le dernier pill "My Bids" aura un style accent quand actif

#### [MODIFY] [market-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx)
- Remplacer `<SegmentedControl>` par `<FilterPills>`
- Ajouter `"My Bids"` au tableau des options avec count badge `(N)` = nombre de bids actives
- Quand "My Bids" est sélectionné → afficher la vue dédiée (étape 4)

---

### Étape 3 — Fix filtre Age (passer birthdate, 3 groupes)

#### [MODIFY] [market/page.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/market/page.tsx)
- Ajouter `birthdate` au SELECT Supabase de riders (L150)
- Passer le champ au client via l'interface `Rider`

#### [MODIFY] [market-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx)
- Ajouter `birthdate: string | null` à l'interface `Rider`
- Remplacer le placeholder Age (L188) par un vrai calcul :
  - `≤ 23` → **"Young Talents"**
  - `24–32` → **"24–32 yrs"**
  - `> 32` → **"Veterans"**
- Utiliser la même formule `getAge()` que dans `rider-detail-client.tsx`

---

### Étape 4 — BidAdjustCard + vue My Bids

#### [NEW] [bid-adjust-card.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/bid-adjust-card.tsx)
Nouveau composant (PAS un variant de RiderCard) :
```
┌──────────────────────────────────────────────┐
│         Tadej Pogačar 🇸🇮 ▲12                │
│  48px   UAE Team Emirates · GC               │
│  photo  [−]    [ 42,500 € ]    [+]        › │
│                 min 38,200 €                 │
└──────────────────────────────────────────────┘
```

Props :
```tsx
interface BidAdjustCardProps {
  rider: {
    id: string;
    full_name: string;
    nationality: string | null;
    real_team: string | null;
    specialty: string | null;
    pcs_rank: number | null;
    pcs_rank_diff: number | null;
    photo_url: string | null;
    pcs_points_1yr: number | null;
  };
  bidAmount: number;
  minSalary: number;
  onBidChange: (riderId: string, amount: number) => void;
  hasUnsavedChanges: boolean;
  leagueId: string;
}
```

Comportement :
- **Stepper** : `[−]` et `[+]` avec pas de **500€** (spec décision)
- **[−] disabled** quand `amount === minSalary`
- **Input** : éditable directement, mono font, validé à `multiple de 100, ≥ minSalary`
- **Border accent** quand valeur modifiée (non sauvée)
- **Min salary** en `--type-micro` / `--text-ghost` sous le stepper
- **Avatar 48px** (plus grand que RiderCard standard 36px)
- **Chevron `›`** : seul élément clickable via `RailLink` vers `/rider/${riderId}?from=mybids`
- Le reste de la card n'est PAS wrappé dans un lien

#### [MODIFY] [market-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx)
- Quand le pill "My Bids" est actif :
  - Masquer la recherche et le compteur "N available"
  - Afficher le titre section **"Your active bids"**
  - Rendre la liste des riders avec `BidAdjustCard` au lieu de `RiderCard`
  - Filtrer `riders` pour ne garder que ceux avec un bid actif (`bids[rider.id] > 0`)
  - StickyBar : slots | budget restant | Save
  - **Empty state** : `"No active bids — browse the market to place your first bid"` + bouton vers pill "All"

---

### Étape 5 — Rider Detail bid section cleanup

#### [MODIFY] [rider-detail-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx)

1. **Supprimer "No active round" text** (L299-303)
   - Le `opacity-50 pointer-events-none` suffit

2. **Step increment : 100€ → 500€** (L310 et L348)
   - `bidAmount - 100` → `bidAmount - 500`
   - `bidAmount + 100` → `bidAmount + 500`

3. **Min salary déplacé** : le retirer du MetricBox grid (L176-181) et l'afficher en `--type-micro` / `--text-ghost` sous le champ de bid
   - MetricBox 3ème box devient **"PCS Points"** : `rider.pcs_points_1yr`

4. **Remplacer le bloc "Save bid" button par StickyBar** (L355-389)
   - Réutiliser `<StickyBar>` existant : slots | budget | Save
   - "Remove bid" reste comme lien texte au-dessus du StickyBar

---

### Étape 6 — Rider Detail dans le Rail : hide bid section pour `from=mybids`

#### [MODIFY] [rider-detail-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx)
- Ajouter `hideBidSection?: boolean` aux props
- Quand `hideBidSection === true` : masquer le stepper, le save button, le StickyBar
- Le MetricBox affiche min salary en read-only dans la 3ème box

#### [MODIFY] [rider-detail-rail.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/rail-pages/rider-detail-rail.tsx)
- Quand `from === "mybids"` : passer `hideBidSection={true}` à `RiderDetailClient`

#### [MODIFY] [rider page.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx)
- Ajouter `"mybids"` comme valeur possible de `from` search param
- Le context reste `"market"` mais le prop `hideBidSection` est passé

---

### Étape 7 — Contexte `"market"` dans le RiderContext type + search params

#### [MODIFY] [rider-detail-client.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx)
- `RiderContext = "market" | "team" | "ranking"` (déjà couvert par étape 1)

#### [MODIFY] [rail-router.tsx](file:///Users/jonathanschummers/Documents/WattHunter/apps/web/components/rail-router.tsx)
- Vérifier que le search param `?from=mybids` est correctement parsé et transmis au Rail

---

## Récapitulatif des fichiers

| Action | Fichier | Étape |
|--------|---------|-------|
| RENAME | `team/recruts/` → `team/market/` | 1 |
| RENAME | `recruts-client.tsx` → `market-client.tsx` | 1 |
| MODIFY | `team/layout.tsx` | 1 |
| MODIFY | `sidebar.tsx` | 1 |
| MODIFY | `rider-detail-client.tsx` | 1, 5, 6 |
| MODIFY | `rider/[riderId]/page.tsx` | 1, 6 |
| MODIFY | `rider-detail-rail.tsx` | 1, 6 |
| MODIFY | `team/page.tsx` | 1 |
| MODIFY | `home-feed.tsx` | 1 |
| MODIFY | `market/history/page.tsx` | 1 |
| NEW | `filter-pills.tsx` | 2 |
| MODIFY | `market-client.tsx` | 2, 3, 4 |
| MODIFY | `market/page.tsx` | 3 |
| NEW | `bid-adjust-card.tsx` | 4 |
| MODIFY | `rail-router.tsx` | 7 |

**Total : 3 nouveaux fichiers, ~12 fichiers modifiés.**

---

## Open Questions

> [!IMPORTANT]
> **1. PhaseSetup** : La page `recruts/page.tsx` affiche un composant `<PhaseSetup>` quand la phase n'est pas confirmée. Ce composant a un import local `./phase-setup`. Faut-il le renommer/déplacer aussi ou est-ce qu'il reste dans le dossier `market/` tel quel ?

> [!IMPORTANT]
> **2. My Bids count** : Dans le pill "My Bids (N)", `N` doit compter les bids en cours côté client (`Object.keys(bids).length`) ou les bids sauvées côté serveur (`initialBids.length`) ? Recommandation : les bids locales (état courant) pour refléter les ajouts non encore sauvés.

> [!IMPORTANT]
> **3. Scroll restoration** : Quand l'utilisateur switch entre "My Bids" et "All", le scroll doit-il revenir en haut ou garder sa position ? Recommandation : reset en haut lors du changement de pill.

---

## Verification Plan

### Automated Tests
- `pnpm typecheck` — s'assurer que le renommage ne casse pas les types
- `pnpm lint` — vérifier la propreté du code
- Vérifier que la build passe : `pnpm build`

### Manual Verification (browser)
1. **Route rename** : `/league/[id]/team/market` se charge correctement
2. **Pills** : les 6 pills scrollent horizontalement, le filtre actif est visuellement distinct
3. **Age filter** : les 3 groupes apparaissent avec les bons riders
4. **My Bids view** : le stepper ±500€ fonctionne, le champ est éditable, le save persiste
5. **Rider Detail** : "No active round" ne s'affiche plus, le step est de 500€, min salary est sous l'input
6. **Desktop Rail** : cliquer sur le chevron dans My Bids ouvre le rider detail dans le Rail SANS section bid
7. **Desktop Rail** : cliquer sur un rider dans les autres filtres ouvre le rider detail AVEC section bid
