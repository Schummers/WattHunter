# Racing Feed v1 — Implementation Spec (immediate scope)

**Date :** 2026-05-09
**Statut :** À implémenter ce soir (étape 2 du Giro 2026 — 5 mai)
**Scope :** Refonte de la homepage `/league/[leagueId]/` pour afficher un feed chronologique de courses. Tout le reste (navigation, header, ranking, rider detail) est hors-scope (voir `2026-05-09-navigation-redesign-vision.md`).

---

## 1. Objectif

Remplacer le `HomeFeed` actuel (calendrier + auctions) par un `RaceFeed` qui montre les résultats des courses de la phase WT en cours, organisés chronologiquement avec un point de focus visuel sur la course du jour.

L'utilisateur doit pouvoir, en arrivant sur la homepage :
1. Voir immédiatement la course/étape du jour et son classement par équipe
2. Comprendre où il se situe vs les autres équipes sur cette course
3. Voir le détail XP + bonus de chacun de ses coureurs sur cette course
4. Scroller pour voir les courses passées de la phase
5. Scroller pour voir les courses à venir

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
- Pas de Nemesis card (pattern documenté pour V2)
- Pas de Phase start banner ni Phase winner banner
- Pas de StatusBadge / header refonte
- Pas de toggle GC cumulé (les Today cards d'un GT affichent par défaut le résultat de l'étape — pas de cumul)
- Pas de Peloton view
- Pas de modale tactique depuis le feed (le bouton "+ Tactique" sur les future cards lie vers la page existante `team/gt/tactics`)
- Pas de modifications du schéma DB

---

## 3. Composants à créer

### 3.1 `<RaceFeed />` — composant racine

**Path :** `apps/web/components/race-feed.tsx`

**Props :**
```ts
type RaceFeedProps = {
  leagueId: string
  myTeamId: string
  currentPhase: AuctionPhase  // phase WT en cours (ex: "giro-italia")
  races: RaceFeedItem[]       // toutes les courses de la phase, triées par date
}

type RaceFeedItem = {
  raceSlug: string
  raceName: string
  raceDate: string  // ISO
  raceType: 'stage' | 'classic'  // déduit par regex sur raceSlug (cf. §5)
  parentRaceSlug?: string  // pour les stages : slug du GT parent
  parentRaceName?: string
  status: 'past' | 'today' | 'future'
  teamRankings?: TeamRaceRanking[]  // populated pour past + today
  myRiders?: RiderRaceResult[]      // populated pour past + today
}
```

**Comportement :**
- Render une liste verticale de cards en respectant l'ordre `pastA → pastB → today → futureA → futureB`
- Au montage : `scrollIntoView({block: 'start'})` sur la Today card si elle existe
- Si pas de Today card (jour de repos) : scroll auto sur la première Future card
- Si pas de Future card non plus : scroll en haut

### 3.2 `<RaceCardPast />` — card collapsed

**Path :** `apps/web/components/race-card-past.tsx`

**Layout :**
```
┌─────────────────────────────────────────┐
│ Étape 1 · Durazzo → Tirana    4 mai     │
│ ● Top équipe : Team Astrid              │
└─────────────────────────────────────────┘
```

**Specs :**
- Container : `bg-surface` (#151b1e), border `border-default` (#273339), radius 10px, padding 12px
- Race name : `text-[length:var(--type-content)]` (12-14px), font-bold (700), `text-high`
- Date : `text-[length:var(--type-caption)]` (10-11px), `text-low`, alignée à droite
- Winner row : dot vert (Emerald-500, 5px), label "Top équipe :" en `text-mid`, nom équipe en `text-high` 11-12px font-semibold
- État au tap : expand vers le format `<RaceCardToday />` (sans le badge "AUJOURD'HUI")
- État expanded persisté en local state (pas en URL)

### 3.3 `<RaceCardToday />` — card expanded par défaut

**Path :** `apps/web/components/race-card-today.tsx`

**Layout :**
```
┌─────────────────────────────────────────┐
│ [AUJOURD'HUI · ÉTAPE 2]                 │
│ Tirana → Shkodra              5 mai     │
│ ─────────────────────────────────────── │
│ CLASSEMENT ÉQUIPES                      │
│ 1  Team Astrid          +340            │
│ 2  Mon équipe ★         +280            │
│ 3  Jordan's Pick        +190            │
│ ─────────────────────────────────────── │
│ DÉTAIL — Mon équipe                     │
│ T. Pogacar  GC    +180 XP  +12 000€     │
│ M. van Aert SPR    +60 XP               │
│ J. Almeida  DOM    +40 XP               │
└─────────────────────────────────────────┘
```

**Specs :**
- Container : `bg-surface`, border `border-default` mais **plus marqué** que past (border-color step 7 #334249), radius 10px, padding 14px
- Badge "AUJOURD'HUI · ÉTAPE N" : 9px, font-bold (700), uppercase, letter-spacing 0.1em, color `cyan-500`, bg `rgba(6,182,212,0.1)`, padding 2px 7px, radius 4px, margin-bottom 6px
- Race name : 12-14px, font-bold, `text-high`
- Date : 10-11px, `text-low`, alignée à droite
- Section labels : 10px, font-bold, uppercase, letter-spacing 0.12em, `text-low` ("CLASSEMENT ÉQUIPES", "DÉTAIL — Mon équipe")
- Team ranking row :
  - Position : 10-11px, font-mono, font-bold, `text-low`, width fixe 14px
  - Nom équipe : 12-14px, font-semibold, `text-high` (sauf Mon équipe : `accent-default` + étoile ★)
  - XP gagné : 12-14px, font-mono, font-bold, `accent-highlight` (cyan-400), aligné droite, format `+340`
  - Border-bottom : `bg-subtle` (#111618) 1px entre rows, sauf dernier
- Détail Mon équipe row :
  - Nom coureur : 12px, font-semibold, `text-high`, abrégé "T. Pogacar"
  - Badge rôle GT (si GT actif) : 9px, uppercase, font-bold, `text-mid`, bg `bg-surface-active` (#1f292e), padding 1px 5px, radius 4px
  - XP : 12px, font-mono, font-bold, `accent-highlight` (cyan-400), format `+180 XP`
  - Bonus sponsor (si > 0) : 11px, font-mono, font-semibold, `Emerald-500`, format `+12 000€`

**Pour les classiques (one-day race) :**
- Badge "AUJOURD'HUI" sans suffixe étape
- Sinon layout identique

**Pour les rest days du GT :**
- Pas de Today card (la prochaine Future card devient le scroll target)

### 3.4 `<RaceCardFuture />` — card dashed collapsed

**Path :** `apps/web/components/race-card-future.tsx`

**Layout :**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  Étape 3 · Shkodra → Prizren   6 mai
  [+ Placer une tactique]
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Specs :**
- Container : `bg-app` (légèrement plus sombre que surface), border 1px **dashed** `border-default` à 70% opacity (`#1f292e`), radius 10px, padding 12px
- Race name : 12-14px, font-bold, `text-high` mais avec opacity 0.85 (effet "non encore disputé")
- Date : 10-11px, `text-low`
- Bouton "+ Placer une tactique" :
  - Visible uniquement si `currentPhase` est un Grand Tour (Giro, Tour, Vuelta) ou course d'une semaine (Paris-Nice, Tirreno, Romandie, Catalogne, Pays-Basque, Dauphiné, Suisse, etc.)
  - Pas affiché pour les classiques d'un jour
  - Style : 10-11px, font-semibold, `accent-default`, bg `rgba(6,182,212,0.08)`, padding 4px 8px, radius 4px
  - Action : `Link` vers `/league/[leagueId]/team/gt/tactics?race=${raceSlug}` (page existante)

### 3.5 `<RaceFeedSection />` — wrapper de section

**Path :** `apps/web/components/race-feed-section.tsx`

Affiche un label de section uppercase (ex: "GIRO D'ITALIA · PHASE EN COURS") au-dessus du groupe de cards. 10px, font-bold, uppercase, letter-spacing 0.12em, `text-low`, padding-top 16px, padding-bottom 8px.

### 3.6 Empty state

Si la phase courante n'a aucune course (entre phases, période morte) :
```
┌─────────────────────────────────────────┐
│   Aucune course en cours.               │
│   Prochaine phase : Classiques Part 1   │
│   Démarre le 21 mars                    │
└─────────────────────────────────────────┘
```
- Background `bg-surface`, padding 24px, text-align center
- Texte principal 13px `text-mid`
- Date 12px `text-low`

---

## 4. Sources de données

### 4.1 Server-side fetching

**Path :** `apps/web/app/(game)/league/[leagueId]/page.tsx`

Au lieu de `getPhaseRaces()` (existant), créer un nouveau loader :

```ts
async function getRaceFeedData(leagueId: string, myTeamId: string): Promise<RaceFeedItem[]>
```

**Logique :**
1. Récupérer `currentPhase` (déjà fait dans la homepage)
2. Récupérer les `race_startlists` de la phase (toutes les courses, future + past)
3. Pour chaque course :
   - Détecter `raceType` via regex sur `race_slug` (cf. §5)
   - Si la date est passée ou aujourd'hui : récupérer les XP par équipe via `rider_xp_daily` agrégé par `team_id` filtré sur `race_slug`
   - Si la date est aujourd'hui ou passée : récupérer les coureurs de l'équipe `myTeamId` qui ont marqué sur cette course
   - Récupérer les bonus sponsor via `sponsor_bonuses` filtrés par `race_slug` et `team_id`
4. Trier par `race_date` ascendant
5. Marquer le statut `past` / `today` / `future` selon la date du jour

### 4.2 Tables utilisées (existantes, aucune mutation)

| Table | Usage |
|-------|-------|
| `race_startlists` | Liste des courses de la phase |
| `rider_xp_daily` | XP gagnés par coureur par course (agrégé par team_id) |
| `race_results` | Métadonnées (race_name lisible, race_date) |
| `sponsor_bonuses` | Bonus sponsor par coureur par course |
| `contracts` | Pour identifier mes coureurs au moment de la course |

### 4.3 Pas de modification du schéma

Aucune migration SQL. Tout est calculé côté serveur à partir des tables existantes.

---

## 5. Détection du type de course (sans normalisation DB)

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

function isGrandTourPhase(phaseId: string): boolean {
  return ['giro-italia', 'tour-france', 'vuelta-espana'].includes(phaseId)
}

function isWeekRacePhase(phaseId: string): boolean {
  // les phases qui contiennent des courses d'une semaine type Paris-Nice, Tirreno...
  return ['week-races-1', 'week-races-2', 'week-races-3'].includes(phaseId)
}
```

Si une course `slug` est en `/gc` ou `/results` (incohérences PCS), traitement à la même que `classic` pour le V1. La normalisation propre vient en V2 (cf. dette technique dans le spec vision).

---

## 6. Layout & scroll behavior

### 6.1 Structure de la page

```tsx
// app/(game)/league/[leagueId]/page.tsx
<MainLayout>
  <RaceFeed
    leagueId={leagueId}
    myTeamId={myTeamId}
    currentPhase={currentPhase}
    races={races}
  />
</MainLayout>
```

Le composant remplace l'actuel `HomeFeed` quand la ligue est en mode actif. Le `LobbyView` (ligue pending) reste inchangé.

### 6.2 Scroll par défaut

Au mount, dans `<RaceFeed />` :
1. Si une `today` card existe → `ref.scrollIntoView({block: 'start', behavior: 'instant'})`
2. Sinon, si une `future` card existe → scroll sur la première future
3. Sinon → scroll en haut

Implémentation : `useLayoutEffect` (pas `useEffect`) pour éviter le flash visuel.

### 6.3 Pas de virtualisation

Une phase WT contient au max ~25 courses (Giro = 21 stages + repos). Pas de besoin de virtualisation. Render simple.

---

## 7. Tests

### 7.1 Vitest (unit + intégration)

**Path :** `apps/web/components/__tests__/race-feed.test.tsx`

- `<RaceCardPast />` : render, expand au tap
- `<RaceCardToday />` : render avec myTeam highlight, render sans myTeam (0 XP cette course → ligne quand même affichée avec `+0`)
- `<RaceCardFuture />` : bouton tactique visible si GT, masqué si classique
- `getRaceFeedData()` : mock Supabase, vérifie le tri par date, le marquage past/today/future, le grouping par parent race

### 7.2 Playwright e2e

**Path :** `apps/web/e2e/race-feed.spec.ts` (`test.fixme()` jusqu'à seed dispo)

Happy path : login → homepage → vérifie qu'une Today card est en haut du viewport, qu'une Past card est au-dessus, qu'une Future card est en dessous.

---

## 8. Critères d'acceptation

- [ ] La homepage affiche un feed vertical de cards au lieu du HomeFeed actuel
- [ ] Au chargement, la card "Aujourd'hui" est en haut du viewport visible
- [ ] La Past card affiche le nom, la date, et l'équipe ayant marqué le plus de XP
- [ ] La Today card affiche le classement des équipes et le détail XP+bonus de Mon équipe
- [ ] La Future card affiche le nom, la date, et un bouton "Placer une tactique" uniquement si la phase est un GT ou une course d'une semaine
- [ ] Le bouton tactique mène vers `team/gt/tactics?race=...`
- [ ] Si pas de course aujourd'hui (rest day), le scroll auto est sur la prochaine Future card
- [ ] Le détail XP de Mon équipe inclut le bonus sponsor s'il y en a un sur cette course
- [ ] La hiérarchie typographique respecte les 4 niveaux (page title hors-scope V1, mais section labels en uppercase + content labels en title case)
- [ ] Lobby view (ligue pending) inchangée
- [ ] Sidebar desktop inchangée
- [ ] Toutes les pages Auction/Team/Budget/Ranking inchangées
- [ ] `pnpm lint` + `pnpm typecheck` pass
- [ ] Tests vitest pass (4-6 tests sur le RaceFeed)
- [ ] Pas de migration SQL

---

## 9. Périmètre temps

Estimé : **3-5h** sur une session focalisée.
- 1h : data layer (`getRaceFeedData`)
- 1h30 : composants (RaceCardPast, RaceCardToday, RaceCardFuture, RaceFeedSection)
- 30min : intégration page + scroll behavior
- 30min-1h : tests + ajustements
- 30min : review styling vs design system

---

## 10. Questions ouvertes spécifiques au V1

(Les autres questions sont dans le spec vision.)

1. **Today card sans participants Mon équipe** : si aucun de mes coureurs n'est sur la startlist de cette course, on affiche quand même le classement équipes mais pas la section "DÉTAIL — Mon équipe" ?  *Proposition par défaut : oui, on masque la section détail si vide.*

2. **Number of teams in classement** : on affiche toutes les équipes de la ligue ou top 3 + bouton "voir tout" ? *Proposition par défaut : toutes (les ligues ont 4-8 équipes).*

3. **Cards passées avec 0 XP (course où aucun de mes coureurs n'a couru)** : on les affiche quand même ou on les masque ? *Proposition par défaut : on les affiche (cohérence chronologique du calendrier).*
