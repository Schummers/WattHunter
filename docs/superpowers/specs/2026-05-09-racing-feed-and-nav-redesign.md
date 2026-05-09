# WattHunter — Racing Feed & Navigation Redesign

**Date :** 2026-05-09  
**Statut :** Validé par Jonathan — implémentation séquencée (feed d'abord)  
**Scope immédiat :** Feed Racing sur la homepage existante (pour l'étape 2 du Giro ce soir)  
**Scope futur :** Refonte complète de la navigation (Phase 2, date à définir)

---

## 1. Contexte & Problèmes identifiés

### Homepage actuelle — inutile

La homepage (`/league/[leagueId]/`) affiche un HomeFeed centré sur les enchères et un calendrier de la phase. Elle ne montre aucun résultat de course, aucun classement live, aucun storytelling sur ce qui s'est passé. Pour un jeu de fantasy cycling, c'est la page la plus consultée qui répond le moins bien à la question "qu'est-ce qui s'est passé ?".

### Hiérarchie typographique cassée

Dans Auction (et d'autres pages), les tab labels et les section labels ont la même taille de police → impossible de distinguer navigation et contenu.

### Navigation fragmentée

- Auction et Team sont deux tabs séparés alors que les workflows sont entrelacés (on draft dans Auction, on voit son équipe dans Team)
- Budget est un tab standalone peu visité
- La page GT Team duplique partiellement le roster de My Team
- Les résultats de course sont enfouis dans Ranking derrière un filtre dropdown

### Header top redondant

Le header actuel affiche "WattHunter" + nom de la ligue. Sur une web app mobile-first avec une seule ligue par défaut, ça prend de la place pour peu de valeur.

---

## 2. Vision complète (Phase 2 — future)

### 2.1 Navigation bottom — 4 tabs

```
Racing  ·  Team  ·  Auction  ·  Ranking
```

| Tab | Contenu |
|-----|---------|
| **Racing** | Feed chronologique de courses + 4 sous-tabs (Feed · Squad · Tactics · Peloton) |
| **Team** | Roster + stratégies + budget + achievements (segmented 3 options) |
| **Auction** | Bids · Pool · History · League (underline tabs 4 options) |
| **Ranking** | Teams · Riders · Peloton (segmented 3 options) |

Budget disparaît comme tab principal → sub-tab de Team.  
Help + Settings + Skins → accessibles via bouton avatar/profil en haut à droite.

### 2.2 Header universel

Chaque page a :
- **Gauche :** titre de la page (17-18px, 700, casse normale)
- **Droite :** `StatusBadge` compact → `[#2 · +125 XP ↑ | [Avatar JS]]`

Le StatusBadge est un composant réutilisable qui affiche la position globale + delta XP du jour + avatar cliquable (→ Settings/Help/Skins).

Le nom "WattHunter" disparaît du header. Il reste en favicon + title du browser.

### 2.3 Page Racing — sous-tabs

Racing a 4 tabs (underline + barre bleue cyan) :

| Tab | Visibilité | Contenu |
|-----|-----------|---------|
| **Feed** | Toujours | Feed chronologique de courses (voir §3) |
| **Squad** | Dès J-5 avant un GT ou course d'1 semaine | Gestion du squad GT — roster avec badges de rôles assignés |
| **Tactics** | Même condition que Squad | Placement des tactiques GT par étape |
| **Peloton** | Toujours | Vue macro de toutes les équipes (rôles GT, XP, composition) |

**Squad/Tactics tabs :** grayed out + non-cliquables hors-période GT. Dot cyan sur le tab quand actif.  
**Pas de nav variable :** les tabs existent toujours, ils changent juste d'état (actif/inactif).

### 2.4 Page Team — simplifiée

Budget et GT Squad disparaissent comme tabs séparés.

```
Segmented control : [My Team] [Budget] [Achievements]
```

- **My Team :** roster complet + badges de rôles GT inline sur chaque carte rider (quand GT actif) + stratégies actives
- **Budget :** P&L par phase, sponsor actif, transactions
- **Achievements :** skins équipe, historique victoires de phase

GT Squad n'est plus un écran séparé. Les rôles GT sont visibles directement sur les rider cards dans My Team (badge `GC`, `SPR`, `DOM`, `HUN`, `DOM`).

### 2.5 Hiérarchie typographique — règle universelle

4 niveaux, jamais inversés :

| Niveau | Taille | Poids | Casse | Token couleur | Usage |
|--------|--------|-------|-------|----------------|-------|
| Page title | 17-18px | 700 | Normale | `--text-high` | "Auction", "Racing", "Team" |
| Tab label | 12px | 600 (actif) / 500 (inactif) | Normale | `--text-high` / `--text-mid` | "Bids", "Pool", "Feed" |
| Section label | 10px | 700 | UPPERCASE + letter-spacing 0.12em | `--text-low` | "ROUND ACTIF", "ROSTER", "GIRO D'ITALIA" |
| Data label inline | 11-12px | 400-500 | Normale | `--text-mid` | "Trésorerie", "Salaires/mois" |

Badges (`GC`, `SPR`, `DOM`) : 9px, 700, UPPERCASE — cas spécifique (étiquettes très courtes).

---

## 3. Racing Feed — spec détaillée (Scope immédiat)

### 3.1 Principe général

Le feed est un scroll vertical de **cards chronologiques** organisées par phase WT en cours. Il remplace le HomeFeed actuel (enchères + calendrier).

Default scroll position : la **card du jour** (étape ou course actuelle) est la première card visible à l'écran, en état "expanded". Les cards passées sont au-dessus (scroll up), les cards futures en dessous.

### 3.2 Types de cards

#### A. Past race card (collapsed)

Affichée pour chaque étape/course déjà disputée de la phase.

```
┌─────────────────────────────────────────┐
│ Étape 1 · Durazzo → Tirana    4 mai     │
│ ● Top équipe : Team Astrid              │
└─────────────────────────────────────────┘
```

- **Background :** `--bg-surface` (#151b1e)
- **Border :** `--border-default` (#273339), radius 10px
- **Race name :** 12px, 700, `--text-high`
- **Date :** 10px, `--text-low`, aligné à droite
- **Winner row :** dot vert (Emerald-500) + "Top équipe : [Team name]" en 11px, `--text-mid`
- **Cliquable :** tap → expand pour voir le détail complet (même format que Today card)

#### B. Today card (expanded by default)

La card de la course/étape actuelle. Expanded par défaut, collapsible via tap sur le header.

```
┌─────────────────────────────────────────┐
│ [AUJOURD'HUI · ÉTAPE 2]                 │
│ Tirana → Shkodra              5 mai     │
│ ─────────────────────────────────────── │
│ CLASSEMENT ÉQUIPES                      │
│ 1  Team Astrid          +340    340 XP  │
│ 2  Mon équipe ★         +280    280 XP  │
│ 3  Jordan's Pick        +190    190 XP  │
│                                         │
│ DÉTAIL — Mon équipe                     │
│ T. Pogacar  GC    +180 XP  +€12k bonus │
│ M. van Aert SPR   +60 XP               │
│ J. Almeida  DOM   +40 XP               │
└─────────────────────────────────────────┘
```

**Header :**
- Badge "AUJOURD'HUI · ÉTAPE N" : 9px, cyan-500 bg @10%, texte cyan-500
- Race name : 12px, 700, `--text-high`
- Date : 10px, `--text-low`, aligné droite

**Classement équipes :**
- Section label : "CLASSEMENT ÉQUIPES" (10px, uppercase)
- Ligne par équipe : position + nom + XP de l'étape
- Mon équipe surlignée (couleur cyan-500 sur le nom + étoile ★)
- Delta XP : colonne verte (Emerald-500) si positif
- Max 3 équipes visibles par défaut, bouton "voir tout" si + de 3 équipes dans la ligue

**Détail coureurs (section expandable) :**
- Visible uniquement pour "Mon équipe"
- Section label : "DÉTAIL — Mon équipe"
- Ligne par coureur : nom (12px, 700) + badge rôle GT + XP gagné + bonus sponsor si applicable
- XP en cyan-400 (--accent-highlight), bonus en Emerald-500

**Pour les classiques (one-day race) :** même structure, pas de notion d'étape dans le badge.

**Pour un Grand Tour (GC cumulé) :** 
- Option de toggle en bas de la Today card : "Voir cumul GC Giro" → ouvre une mini-vue avec le classement GC cumulé de toutes les étapes jusqu'à aujourd'hui

#### C. Nemesis card (intercalée entre étapes)

Apparaît entre deux cards d'étapes quand une tactique Nemesis est résolue.

```
┌─────────────────────────────────────────┐
│ [⚔ NEMESIS · ÉTAPE 2]                  │
│ Mon équipe · Pogacar                    │
│ VS  Team Astrid · Vingegaard            │
│                                         │
│ Résultat : +50 XP bonus → Vous         │
└─────────────────────────────────────────┘
```

- **Background :** `rgba(239,68,68,0.06)`, border rouge @ 20% opacité
- **Label :** "NEMESIS · ÉTAPE N", 9px, rouge
- **Corps :** nom équipe + coureur en 12px, 600
- **Résultat :** 11px, Emerald-500 si victoire, rouge si défaite

#### D. Future race card (collapsed, dashed)

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  Étape 3 · Shkodra → Prizren   6 mai
  [+ Placer une tactique]
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- **Border :** dashed, `--border-default` @ 70%
- **Background :** `--bg-app` (légèrement plus sombre)
- **Bouton tactique :** uniquement si GT ou course d'1 semaine active — ouvre la modale de placement de tactique existante

#### E. Phase start banner (card spéciale)

Affichée une fois au début de chaque phase, en tête du groupe de cards de cette phase.

```
┌─────────────────────────────────────────┐
│ 🏁  Giro d'Italia — Phase 5            │
│     Les enchères du Round 1 sont        │
│     ouvertes. C'est parti !             │
│                                  [→]   │
└─────────────────────────────────────────┘
```

- **Background :** gradient subtil cyan-950 → bg-surface
- **Bouton →** : lien vers Auction (tab Bids)
- Affichée une seule fois, non-dismissable (fait partie de la timeline)

#### F. Phase winner banner (card spéciale)

Affichée après la dernière étape/course d'une phase.

```
┌─────────────────────────────────────────┐
│ 🏆  Vainqueur Classiques Part 1         │
│     Team Astrid · 4 820 XP             │
└─────────────────────────────────────────┘
```

- **Background :** `--bg-surface`, border cyan @ 30%

### 3.3 Organisation du feed

```
[Phase start banner — Phase courante]
  [Card past étape N-2]       ← visible au scroll up
  [Card past étape N-1]       ← visible au scroll up
  [Nemesis card si applicable]
  [Card TODAY expanded]        ← position par défaut (top du viewport)
  [Card future étape N+1]     ← visible sans scroll
  [Card future étape N+2]
  ...
[Phase précédente]
  [Phase winner banner — Phase précédente]
  [Cards collapsées des étapes de la phase précédente]
```

**Scroll par défaut :** la Today card est positionnée en haut du viewport visible au chargement (`scrollIntoView` ou calcul de l'offset).

### 3.4 Données requises

Pour afficher le feed, on a besoin de :

| Données | Source DB |
|---------|-----------|
| Liste des courses de la phase (nom, slug, date, type) | `race_startlists` + calendrier phase |
| Résultats des courses passées (XP par équipe + coureur) | `rider_xp_daily` groupé par `race_slug` + `team_id` |
| Classement des équipes par étape | Agrégation `rider_xp_daily` par `(race_slug, team_id)` |
| Résultats des tactiques Nemesis | `gt_tactic_activations` + `resolve_nemesis_for_stage` output |
| Bonus sponsor appliqués | `sponsor_bonuses` |
| Mon équipe (pour highlight) | `contracts` → `team_id` du user courant |

**Pas de nouvelle table requise.** Le feed est une vue calculée côté serveur à partir de données existantes.

### 3.5 Périmètre de l'implémentation immédiate

**Ce qu'on fait ce soir (v1 feed) :**
- [ ] Composant `RaceFeed` dans la homepage existante (remplace HomeFeed)
- [ ] Card types A (past collapsed), B (today expanded), D (future dashed)
- [ ] Classement équipes dans Today card
- [ ] Détail coureurs Mon équipe dans Today card
- [ ] Positionnement scroll auto sur Today card

**Ce qu'on NE fait PAS maintenant (Phase 2) :**
- Refonte navigation (tabs Racing, header, Team merge, Budget in Team)
- Card types C (Nemesis), E (Phase start banner), F (Phase winner)
- Toggle GC cumulé dans Today card
- Peloton view
- Squad/Tactics tabs

---

## 4. Ranking — améliorations (Phase 2)

- Afficher **bonus sponsor cumulés** à côté des XP dans le classement équipes (pas la treasury)
- Ajouter sous-tab **Peloton** : vue compacte de toutes les équipes côte à côte (roster, rôles GT, XP)
- Liens depuis les cards du Racing feed → Ranking pré-filtré sur la course cliquée

---

## 5. Rider Detail — améliorations (Phase 2)

- Breakdown par course : XP stage + classification bonus (GC/Sprinter/KOM daily) distincts
- Lien depuis les cards du feed → rider detail

---

## 6. Race slug normalization — dette technique

**Problème :** les race_slugs PCS ne distinguent pas GC vs stage vs classique. Le groupement se fait par regex (`stage-N` suffix). Les noms affichés dans Ranking ("race/tour-de-romandie/2026/gc/results") viennent directement de PCS sans normalisation.

**Fix à prévoir (Phase 2) :** normalisation des `race_name` dans `race_results` lors du scraping + colonne optionnelle `race_type` (`stage` | `gc` | `one-day`).

---

## 7. Ce qui ne change pas (décision explicite)

- Navigation actuelle conservée (Home, Auction, Team, Budget, Ranking) jusqu'à Phase 2
- Système de tabs existant (segmented control dans Team, underline tabs dans Auction) conservé
- Header top actuel conservé
- Pas de frosted glass / pill tabs / animations de navigation
