# Racing Feed v1 — Implementation Spec (immediate scope)

**Date :** 2026-05-09
**Statut :** À implémenter ce soir (étape 2 du Giro 2026 — 5 mai)
**Scope :** Refonte de la homepage `/league/[leagueId]/` pour afficher un feed chronologique de courses. Tout le reste (navigation, header, ranking, rider detail) est hors-scope (voir `2026-05-09-navigation-redesign-vision.md`).

---

## 1. Objectif

Remplacer le `HomeFeed` actuel (calendrier + auctions) par un `RaceFeed` qui montre les résultats des courses de la phase WT en cours, organisés chronologiquement. La date est sortie de la carte (en label de groupe), permettant d'afficher plusieurs cards sous la même date (course parallèle, Nemesis, Remontada).

L'utilisateur doit pouvoir, en arrivant sur la homepage :
1. Voir immédiatement la course/étape du jour avec le détail XP+bonus de **toutes les équipes** ayant marqué
2. Identifier le winner de chaque étape passée d'un coup d'œil (avatar du winner sur la card collapsed)
3. Placer une tactique sur les étapes futures (`+` cliquable)
4. Voir les Nemesis activés et les boost Remontada inline
5. Voir la date du Round 1 de la prochaine phase en fin de feed

Le V1 ne touche **pas** la navigation, le header, ni les autres pages.

---

## 2. Contraintes & non-objectifs

### Ce qui ne change pas
- Navigation actuelle (5 tabs + footer) **inchangée**
- Header top actuel (`WattHunter` + nom de ligue) **inchangé**
- Pages Auction, Team, Budget, Ranking **inchangées**
- Sidebar desktop **inchangée**
- Lobby view (ligue pending) **inchangée**

### Ce qui n'est pas dans le V1
- Pas de Phase winner banner (vainqueur de phase précédente)
- Pas de Mouvement cards (notifications d'overtake auto)
- Pas de StatusBadge / header refonte
- Pas de toggle GC cumulé dans la Today card (un bouton "Voir le classement GC →" à la place)
- Pas de Peloton view
- Pas de modale tactique inline (le `+` sur les future cards lie vers la page existante `team/gt/tactics`)
- Pas de modifications du schéma DB
- Pas de collapse/expand par équipe dans la Today card (tout reste expanded)

---

## 3. Layout général

### 3.1 Structure verticale du feed

```
[Header WattHunter inchangé]

  [Date X]                  ← date hors carte, top-left
    [card étape passée]
    [card Nemesis si applicable]

  [Date Y]
    [TODAY card expanded]   ← scroll par défaut arrive ici
    [card Nemesis si applicable]

  [Date Z]
    [card étape future]
    [card Remontada si applicable]

  [Date W]
    [card étape future Giro]
    [card étape future course parallèle]    ← courses en parallèle même date

  ...

  [Phase end banner]        ← fin de feed
```

### 3.2 Date label

Position : hors de la card, alignée top-left, groupe les cards d'une même date.

- Format : `5 mai` (jour + mois abrégé en français)
- Style : `text-[length:var(--type-data-label)]` (11-12px), font-medium (500), `text-mid`, padding-left 4px, margin-top 16px (entre groupes), margin-bottom 6px

### 3.3 Card commune — anatomy

Chaque card "course" partage la même structure :

```
┌──────────────────────────────────────────┐
│ Giro · Étape 2                  [TA○]   │  ← title + avatar (right)
│ [...contenu spécifique au type...]      │
└──────────────────────────────────────────┘
```

- **Titre :** une seule ligne. Format `[Course] · Étape N` pour les courses par étape, juste `Paris-Roubaix` pour les classiques d'un jour. Pas de villes / trajectoire.
- **Avatar / bouton (right) :** rond 28px aligné à droite du titre.
  - Past/Today : avatar du winner (équipe ayant fait le plus de XP sur la course)
  - Future : bouton `+` cyan, ouvre la page tactique GT
- **Padding :** 12-14px
- **Radius :** 10px

---

## 4. Composants à créer

### 4.1 `<RaceFeed />` — composant racine

**Path :** `apps/web/components/race-feed.tsx`

**Props :**
```ts
type RaceFeedProps = {
  leagueId: string
  myTeamId: string
  currentPhase: AuctionPhase
  groups: RaceFeedDateGroup[]   // groupes triés par date
  nextPhaseRound1Date?: string  // ISO, pour le banner de fin
  nextPhaseLabel?: string
}

type RaceFeedDateGroup = {
  date: string  // ISO
  cards: RaceFeedCard[]  // peut contenir plusieurs cards (étapes parallèles, Nemesis, Remontada)
}

type RaceFeedCard =
  | { type: 'past',     race: RaceData }
  | { type: 'today',    race: RaceDataWithBreakdown }
  | { type: 'future',   race: RaceData }
  | { type: 'nemesis',  data: NemesisData }
  | { type: 'remontada',data: RemontadaData }
```

**Comportement :**
- Render une liste verticale de groupes (un par date) avec leurs cards à l'intérieur
- Au montage : `scrollIntoView({block: 'start'})` sur la Today card si elle existe ; sinon sur la première card future ; sinon top
- Default collapsed pour past cards, expanded pour today, dashed pour future

### 4.2 `<RaceCardPast />` — card collapsed

**Path :** `apps/web/components/race-card-past.tsx`

**Layout :**
```
┌──────────────────────────────────────────┐
│ Giro · Étape 1                  [TA○]   │
└──────────────────────────────────────────┘
```

**Specs :**
- Container : `bg-surface` (#151b1e), border 1px `border-default` (#273339), radius 10px, padding 12px 14px
- Titre : 13-14px, font-bold (700), `text-high`
- Avatar winner : 28px diameter, gradient ou photo équipe gagnante de l'étape (initiales 2 lettres si pas de skin)
- État au tap : expand vers le format `<RaceCardToday />` (sans le scroll auto, l'avatar reste visible)
- État expanded : persisté en local state (pas en URL)

**Si aucune équipe n'a marqué (cas rare) :** avatar grisé, no winner.

### 4.3 `<RaceCardToday />` — card expanded par défaut

**Path :** `apps/web/components/race-card-today.tsx`

**Layout :**
```
┌──────────────────────────────────────────────┐
│ Giro · Étape 2                       [TA○] │
│ ─────────────────────────────────────────── │
│ TEAM ASTRID            12 000€      +340    │
│   T. Pogacar  GC       +12 000€    +180     │
│   J. Vingegaard              —      +90     │
│   E. Mas      DOM            —      +70     │
│ MON ÉQUIPE ★            8 000€      +280    │
│   M. van Aert SPR       +8 000€    +120     │
│   J. Almeida  DOM            —      +90     │
│   N. Pedersen                —      +70     │
│ JORDAN'S PICK                —      +190    │
│   J. Cairoli  GC             —      +120    │
│   ...                                        │
│ ─────────────────────────────────────────── │
│ [ Voir le classement GC du Giro →  ]        │
└──────────────────────────────────────────────┘
```

**Specs :**
- Container : `bg-surface`, border 1px `#334249` (plus marqué que past), radius 10px, padding 14px
- Titre : 13-14px, font-bold (700), `text-high`
- Avatar winner : 28px (logique identique à past)
- Divider après le titre : 1px `border-subtle` (#1a2226)
- **Team header row** :
  - Nom équipe : 12-13px, font-bold (700), UPPERCASE, letter-spacing 0.05em, `text-high` (sauf Mon équipe : `accent-default` (cyan-500) + étoile ★)
  - Bonus € total : 11px, font-mono, font-semibold (600), `text-mid`, format `12 000€`. Si 0 : `—` en `text-ghost`
  - XP total : 12-13px, font-mono, font-bold, `accent-highlight` (cyan-400), format `+340`
- **Rider row** (visible uniquement si le coureur a marqué ≥ 1 XP) :
  - Indentation : 12px à gauche
  - Nom : 11-12px, font-semibold (600), `text-high`, format abrégé "T. Pogacar"
  - Badge rôle GT (si phase GT et coureur a un rôle assigné) : 9px, UPPERCASE, font-bold, `text-mid`, bg `bg-surface-active` (#1f292e), padding 1px 4px, radius 4px
  - Bonus € : 10-11px, font-mono, font-semibold, `Emerald-500` (vert) si > 0 sinon `—` en `text-ghost`
  - XP : 11-12px, font-mono, font-bold, `accent-highlight` (cyan-400), format `+180`
- **Espacement entre équipes** : 6px (séparation visuelle sans divider)
- **Bouton "Voir le classement GC du Giro →"** :
  - Visible uniquement pour les courses par étapes (GT + courses d'une semaine), pas pour les classiques d'un jour
  - Format texte : "Voir le classement GC du [Course parent] →" (ex: "Giro", "Paris-Nice")
  - Style : 11-12px, font-medium, `accent-default`, bg `rgba(6,182,212,0.06)`, padding 8px 12px, radius 6px, full-width, text-align center, margin-top 10px
  - Action : `Link` vers `/league/[leagueId]/ranking?race=${parentRaceSlug}` (la Ranking page filtre déjà par race_slug)

**Filtrage des équipes affichées :**
- Toutes les équipes de la ligue ayant marqué ≥ 1 XP sur cette course sont affichées
- Mon équipe : affichée seulement si elle a marqué ≥ 1 XP (sinon section masquée)
- Tri : par XP total descendant
- Pas de numérotation des rangs (l'ordre + l'XP à droite suffisent)

**Pour les classiques d'un jour :** layout identique sans le bouton GC + sans badge rôle (pas de GT actif).

**Pour les rest days du GT :** pas de Today card pour cette date — le label de date n'apparaît même pas.

### 4.4 `<RaceCardFuture />` — card dashed collapsed

**Path :** `apps/web/components/race-card-future.tsx`

**Layout :**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  Giro · Étape 3                  [+]
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Specs :**
- Container : `bg-app` (légèrement plus sombre que surface), border 1px **dashed** `#1f292e`, radius 10px, padding 12px
- Titre : 13-14px, font-bold, `text-high` à 0.85 opacity (effet "non disputé")
- Bouton `+` :
  - Cercle 28px, bg `rgba(6,182,212,0.1)`, border 1px `accent-default` à 30% opacity
  - Icône `Plus` Lucide, 14px, `accent-default`
  - Visible **et cliquable** uniquement si la phase courante est :
    - Un Grand Tour : `giro-italia`, `tour-france`, `vuelta-espana`
    - Une course d'une semaine : Paris-Nice, Tirreno, Romandie, Catalogne, Pays-Basque, Dauphiné, Suisse (à confirmer dans la liste des phases existantes)
  - Pour les classiques d'un jour : pas de bouton `+` (ou avatar vide grisé en placeholder)
  - Action : `Link` vers `/league/[leagueId]/team/gt/tactics?race=${raceSlug}`

### 4.5 `<NemesisCard />` — card intercalée

**Path :** `apps/web/components/race-feed-nemesis-card.tsx`

**Layout :**
```
┌──────────────────────────────────────────┐
│ ⚔ Nemesis · Pogacar VS Vingegaard       │
│   +50 XP → Mon équipe                    │
└──────────────────────────────────────────┘
```

**Specs :**
- Container : bg `rgba(239,68,68,0.06)`, border 1px `rgba(239,68,68,0.2)`, radius 10px, padding 10px 12px
- Icône ⚔ Phosphor Sword (12px) à gauche du titre
- Titre : 12px, font-semibold (600), `text-high`. Format : `Nemesis · {Coureur A} VS {Coureur B}`
- Sous-ligne (résultat) : 11px, font-medium, `Emerald-500` si Mon équipe gagne, `Red-500` si Mon équipe perd, `text-mid` si neutre
- Affichée **directement sous** la card étape concernée, dans le même groupe de date

**Données :** lecture depuis `gt_tactic_activations` table où `tactic_type IN ('nemesis_gc', 'nemesis_sprint')` et résolution dans `gt_tactic_activations.nemesis_*` champs.

### 4.6 `<RemontadaCard />` — card intercalée

**Path :** `apps/web/components/race-feed-remontada-card.tsx`

**Layout :**
```
┌──────────────────────────────────────────┐
│ 🔥 Remontada · Pelu's Crew              │
│    Boost +30% pendant 3 jours            │
└──────────────────────────────────────────┘
```

**Specs :**
- Container : bg `rgba(245,158,11,0.06)`, border 1px `rgba(245,158,11,0.2)`, radius 10px, padding 10px 12px
- Icône 🔥 Phosphor Flame (12px) ou Lucide Flame
- Titre : 12px, font-semibold, `text-high`. Format : `Remontada · {Team Name}`
- Sous-ligne : 11px, font-medium, `text-mid`. Format : `Boost +{X}% pendant {N} jours`
- Affichée **à la date de déclenchement** du boost, dans le groupe de date correspondant. Pas répétée chaque jour du boost (une seule card au déclenchement).

**Données :** lecture depuis `remontada_boosts` table — détecter les nouveaux boosts dans la fenêtre temporelle de la phase courante.

### 4.7 `<PhaseEndBanner />` — banner de fin de feed

**Path :** `apps/web/components/race-feed-phase-end-banner.tsx`

**Layout :**
```
┌──────────────────────────────────────────┐
│ 🏁 Prochaine phase                       │
│    Round 1 ouvre le 28 mai               │
│    [Voir l'enchère →]                    │
└──────────────────────────────────────────┘
```

**Specs :**
- Container : `bg-surface`, border 1px `accent-default` à 30% opacity, radius 10px, padding 14px
- Icône 🏁 Phosphor FlagCheckered (14px) à gauche du titre
- Titre : 13px, font-bold, `text-high`. Texte fixe : `Prochaine phase`
- Sous-ligne 1 : 12px, font-medium, `text-mid`. Format : `Round 1 ouvre le {date}` (ex: `Round 1 ouvre le 28 mai`)
- Sous-ligne 2 (sous forme de bouton link) : 11-12px, font-semibold, `accent-default`. Texte : `Voir l'enchère →`
  - Action : `Link` vers `/league/[leagueId]/auction`
- Affichée **une fois en fin de feed** uniquement, après la dernière card course/Remontada

**Si pas de prochaine phase connue (fin de saison) :** banner remplacé par `Saison terminée`.

### 4.8 `<RaceFeedDateGroup />` — wrapper de groupe

**Path :** `apps/web/components/race-feed-date-group.tsx`

**Props :** `date: string`, `children: ReactNode`

**Layout :**
```
[Date label hors carte]
  [card 1]
  [card 2]
  [card N]
```

- Date label : voir §3.2
- Children : stack vertical avec gap 7-8px entre cards

### 4.9 Empty state

Si aucune course dans la phase courante (entre phases) :
- Le feed n'affiche que le `<PhaseEndBanner />` (qui contient déjà l'info utile : prochaine phase)
- Pas de message "Aucune course" séparé — le banner suffit

---

## 5. Sources de données

### 5.1 Server-side fetching

**Path :** `apps/web/app/(game)/league/[leagueId]/page.tsx`

Au lieu de `getPhaseRaces()` (existant), créer un nouveau loader :

```ts
async function getRaceFeedData(
  leagueId: string,
  myTeamId: string,
  currentPhase: AuctionPhase
): Promise<{
  groups: RaceFeedDateGroup[]
  nextPhaseRound1Date?: string
  nextPhaseLabel?: string
}>
```

**Logique :**
1. Récupérer les courses de la phase courante via `race_startlists` + `race_results`
2. Pour chaque course :
   - Détecter `raceType` (regex sur slug, cf. §6)
   - Si la date est passée ou aujourd'hui : agréger `rider_xp_daily` par `team_id` filtré sur `race_slug`
   - Joindre `sponsor_bonuses` filtrés par `race_slug` et `team_id` pour les bonus €
   - Identifier le winner team (max XP gagné)
3. Récupérer les Nemesis activations pour la phase via `gt_tactic_activations`
4. Récupérer les Remontada boosts récents via `remontada_boosts`
5. Récupérer la date de Round 1 de la phase suivante via `auction_rounds` (round 1 de la phase WT suivante)
6. Grouper toutes les cards (course, Nemesis, Remontada) par date
7. Trier les groupes de date ascendant
8. Marquer le statut `past` / `today` / `future` selon la date du jour

### 5.2 Tables utilisées (existantes, aucune mutation)

| Table | Usage |
|-------|-------|
| `race_startlists` | Liste des courses futures de la phase |
| `race_results` | Métadonnées (race_name, race_date) + résultats passés |
| `rider_xp_daily` | XP gagnés par coureur par course (agrégé par team_id) |
| `sponsor_bonuses` | Bonus sponsor € par coureur par course |
| `contracts` | Identifier les coureurs de chaque équipe au moment de la course |
| `gt_tactic_activations` | Nemesis activés et résolus |
| `remontada_boosts` | Boosts Remontada actifs/historique |
| `auction_rounds` | Date de Round 1 de la phase suivante |

### 5.3 Pas de modification du schéma

Aucune migration SQL. Tout est calculé côté serveur à partir des tables existantes.

---

## 6. Détection du type de course (sans normalisation DB)

Le V1 vit avec les `race_slug` PCS bruts. Heuristique :

```ts
function detectRaceType(raceSlug: string): 'stage' | 'classic' {
  if (/\/stage-\d+$/.test(raceSlug)) return 'stage'
  return 'classic'
}

function getParentRaceSlug(raceSlug: string): string | null {
  const match = raceSlug.match(/^(.+)\/stage-\d+$/)
  return match ? match[1] : null
}

function getParentRaceLabel(parentSlug: string): string {
  // ex: "race/giro-italia/2026" → "Giro"
  // logique simple basée sur les slugs connus, fallback sur le slug brut
}

function getRaceTitle(race: RaceData): string {
  // Stage : "{Course} · Étape {N}"
  // Classic : "{Course}"
}

function isGrandTourPhase(phaseId: string): boolean {
  return ['giro-italia', 'tour-france', 'vuelta-espana'].includes(phaseId)
}

function isWeekRacePhase(phaseId: string): boolean {
  return ['week-races-1', 'week-races-2', 'week-races-3'].includes(phaseId)
  // À ajuster selon la nomenclature des phases existantes
}
```

Si un slug est en `/gc` ou `/results` (incohérences PCS), traiter comme `classic` pour le V1. La normalisation propre vient en V2.

---

## 7. Layout & scroll behavior

### 7.1 Structure de la page

```tsx
// app/(game)/league/[leagueId]/page.tsx
<MainLayout>
  <RaceFeed
    leagueId={leagueId}
    myTeamId={myTeamId}
    currentPhase={currentPhase}
    groups={groups}
    nextPhaseRound1Date={nextPhaseRound1Date}
    nextPhaseLabel={nextPhaseLabel}
  />
</MainLayout>
```

Le composant remplace l'actuel `HomeFeed` quand la ligue est en mode actif. Le `LobbyView` (ligue pending) reste inchangé.

### 7.2 Scroll par défaut

Au mount, dans `<RaceFeed />` :
1. Si une `today` card existe → `ref.scrollIntoView({block: 'start', behavior: 'instant'})`
2. Sinon, si une `future` card existe → scroll sur la première future
3. Sinon → scroll en haut

Implémentation : `useLayoutEffect` (pas `useEffect`) pour éviter le flash visuel.

### 7.3 Pas de virtualisation

Une phase WT contient au max ~25 courses (Giro = 21 stages + repos). Pas de besoin de virtualisation. Render simple.

### 7.4 Comportement past card expand

Tap sur une past card → expand au format Today (mêmes contenus, sans scroll auto). Re-tap → collapse. State local, pas en URL.

---

## 8. Tests

### 8.1 Vitest (unit + intégration)

**Path :** `apps/web/components/__tests__/race-feed.test.tsx` (et fichiers par composant)

Cas à couvrir :
- `<RaceCardPast />` : render, expand au tap, avatar du winner correctement affiché
- `<RaceCardToday />` :
  - render avec breakdown de plusieurs équipes
  - Mon équipe surlignée + étoile
  - filtrage : seuls les coureurs ayant marqué ≥ 1 XP sont affichés
  - Mon équipe masquée si 0 XP
  - bouton "Voir le classement GC" affiché pour les stages, pas pour les classiques
  - badge rôle GT affiché si phase GT, masqué sinon
- `<RaceCardFuture />` : bouton `+` visible si GT/week-race, masqué sinon
- `<NemesisCard />` : render, résultat Mon équipe (+/−) styling
- `<RemontadaCard />` : render, format "+X% pendant N jours"
- `<PhaseEndBanner />` : render avec date Round 1, lien vers Auction
- `getRaceFeedData()` : mock Supabase, vérifie le grouping par date, le marquage past/today/future, l'inclusion des Nemesis/Remontada cards aux bonnes dates

### 8.2 Playwright e2e

**Path :** `apps/web/e2e/race-feed.spec.ts` (`test.fixme()` jusqu'à seed dispo)

Happy path : login → homepage → vérifie qu'une Today card est en haut du viewport, qu'une Past card est au-dessus, qu'une Future card est en dessous, qu'une Phase end banner est en bas.

---

## 9. Critères d'acceptation

- [ ] La homepage affiche un feed vertical de cards groupées par date
- [ ] Au chargement, la card "Aujourd'hui" est en haut du viewport visible
- [ ] La date est affichée hors de la carte, en haut à gauche du groupe
- [ ] Une même date peut contenir plusieurs cards (étape + Nemesis + Remontada, ou courses parallèles)
- [ ] La Past card collapsed affiche : titre `[Course] · Étape N` + avatar du winner
- [ ] Tap sur une Past card → expand au format Today
- [ ] La Today card affiche le détail de toutes les équipes ayant marqué (team header avec bonus € + XP, riders rows uniquement si XP ≥ 1)
- [ ] Mon équipe est surlignée avec étoile ★ et color `accent-default`
- [ ] La Today card d'un GT/week-race affiche un bouton "Voir le classement GC du [Course] →" qui mène vers Ranking pré-filtré
- [ ] La Future card affiche un bouton `+` cyan qui mène vers la page tactique pour les phases GT/week-race
- [ ] Les classiques d'un jour n'ont ni bouton GC ni bouton `+` (juste la card vide)
- [ ] La Nemesis card est intercalée sous la card étape concernée, même date
- [ ] La Remontada card apparaît à la date de déclenchement du boost
- [ ] La Phase end banner est affichée une fois en fin de feed avec la date du Round 1 prochaine phase
- [ ] Si pas de course aujourd'hui (rest day), le scroll auto est sur la prochaine Future card
- [ ] Lobby view (ligue pending) inchangée
- [ ] Sidebar desktop inchangée
- [ ] Toutes les pages Auction/Team/Budget/Ranking inchangées
- [ ] `pnpm lint` + `pnpm typecheck` pass
- [ ] Tests vitest pass (10-15 tests sur les composants RaceFeed)
- [ ] Pas de migration SQL

---

## 10. Périmètre temps

Estimé : **5-7h** sur une session focalisée.
- 1h30 : data layer (`getRaceFeedData` avec Nemesis + Remontada + next phase)
- 2h30 : composants (8 composants au total : RaceFeed, RaceFeedDateGroup, RaceCardPast, RaceCardToday, RaceCardFuture, NemesisCard, RemontadaCard, PhaseEndBanner)
- 30min : intégration page + scroll behavior
- 1h : tests + ajustements
- 30min : review styling vs design system

---

## 11. Récap visuel — homepage le 5 mai (étape 2 Giro)

```
┌─ HOMEPAGE ──────────────────────────────────────┐
│ WattHunter        Ma Ligue              [≡]    │
├──────────────────────────────────────────────────┤
│                                                  │
│  4 mai                                           │
│  ┌──────────────────────────────────────────┐   │
│  │ Giro · Étape 1                   [TA○]  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  5 mai                                           │
│  ┌──────────────────────────────────────────┐   │
│  │ Giro · Étape 2                   [TA○]  │   │
│  │ ────────────────────────────────────────│   │
│  │ TEAM ASTRID         12 000€      +340   │   │
│  │   T. Pogacar GC     +12 000€    +180    │   │
│  │   J. Vingegaard          —       +90    │   │
│  │   E. Mas    DOM          —       +70    │   │
│  │ MON ÉQUIPE ★         8 000€      +280   │   │
│  │   M. van Aert SPR   +8 000€     +120    │   │
│  │   J. Almeida DOM         —       +90    │   │
│  │ JORDAN'S PICK            —       +190   │   │
│  │   ...                                    │   │
│  │ ────────────────────────────────────────│   │
│  │ [ Voir le classement GC du Giro → ]    │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │ ⚔ Nemesis · Pogacar VS Vingegaard       │   │
│  │   +50 XP → Mon équipe                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  6 mai                                           │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│    Giro · Étape 3                      [+]      │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│  ┌──────────────────────────────────────────┐   │
│  │ 🔥 Remontada · Pelu's Crew              │   │
│  │    Boost +30% pendant 3 jours            │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ...                                             │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 🏁 Prochaine phase                       │   │
│  │    Round 1 ouvre le 28 mai               │   │
│  │    [Voir l'enchère →]                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Home] [Auct] [Team] [Bgt] [Rank]               │
└──────────────────────────────────────────────────┘
```
