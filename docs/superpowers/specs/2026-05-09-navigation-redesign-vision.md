# Navigation & UX Redesign — Vision Spec (Phase 2)

**Date :** 2026-05-09
**Statut :** Vision exhaustive, à séquencer en plusieurs PRs après le V1 du Racing Feed
**Spec V1 lié :** `2026-05-09-racing-feed-v1-implementation.md` (à shipper d'abord)

Ce document recense **tout** ce qui a été discuté pour la refonte de la navigation et de l'UX. Il sert de source de vérité pour les itérations futures. Les questions encore ouvertes sont listées en §13.

---

## 1. Contexte & raisons de la refonte

### 1.1 Problèmes structurels identifiés

| Problème | Impact |
|----------|--------|
| Homepage actuelle = lobby + calendrier auctions, pas de résultats | Utilisateur ne voit pas ce qui s'est passé sur les courses |
| Auction et Team fragmentés (2 tabs séparés) alors que workflows entrelacés | Va-et-viens constant, charge mentale |
| Budget = tab standalone peu visité | Place gaspillée dans la nav primaire |
| GT Team page distincte du roster My Team | Doublon, deux endroits où voir "ses coureurs" |
| Hiérarchie typographique cassée (tabs et section labels mêmes tailles) | Auction tab "Bids" = même apparence que section "Sponsor" → confusion |
| Header top redondant (`WattHunter` + nom de ligue) | Place gaspillée pour info peu utile (1 seule ligue par défaut) |
| Résultats de course enfouis dans Ranking derrière dropdown | Pas de storytelling, vue tableur sèche |
| Pas de preview du classement sur la homepage | Doit aller dans Ranking pour voir où on en est |
| Race slugs PCS bruts (incohérences GC/stage/results) | Filtres Ranking confusants |

### 1.2 Deux phases de jeu, deux focuses différents

L'app a deux phases de jeu radicalement différentes :

| Phase | Workflow primaire | Tab le plus utilisé |
|-------|-------------------|---------------------|
| **Phase d'enchères** (avant chaque phase WT) | Drafter, valider rounds, gérer budget | Auction |
| **Phase de course** (pendant la phase WT) | Voir résultats, gérer squad GT, placer tactiques | Racing |

La nav doit refléter ces deux modes sans pour autant changer mécaniquement (pas de nav variable selon le contexte — risque de perdre l'utilisateur).

---

## 2. Architecture de navigation cible

### 2.1 Bottom nav — 4 tabs

```
Racing  ·  Team  ·  Auction  ·  Ranking
```

**Ordre : à confirmer (cf. §13 q1).**

| Tab | Icône Lucide | Rôle |
|-----|-------------|------|
| **Racing** | `Flag` ou `Trophy` | Page d'arrivée par défaut. Feed de courses + sous-tabs Squad / Tactics / Peloton |
| **Team** | `Users` | Mon roster, mon budget, mes achievements |
| **Auction** | `Gavel` | Pool, bids, history, league status |
| **Ranking** | `BarChart3` | Classement teams / riders / peloton |

### 2.2 Footer / sidebar items à fusionner

- **Help** → menu profil (avatar)
- **Settings** → menu profil (avatar)
- **Skins** (nouveau) → menu profil (avatar)
- **Levels** → menu profil (avatar)
- **League switcher** (multi-ligue futur) → menu profil (avatar)

Le footer mobile (Help, Settings) **disparaît**. Le sidebar desktop conserve sa logique, mais avec 4 items au lieu de 5 + footer.

---

## 3. Header universel

### 3.1 Layout

```
┌──────────────────────────────────────────────┐
│ Racing                  [#2 · +125↑] [JS○]   │
├──────────────────────────────────────────────┤
```

**Composants :**

- **Gauche :** titre de la page (17-18px, font-bold, casse normale, `text-high`)
- **Droite :** `<StatusBadge />` + `<ProfileButton />`

### 3.2 `<StatusBadge />` — composant réutilisable

Affiché sur toutes les pages. Format :

```
[#2 · +125↑]
```

- Background : `bg-surface`, border `border-default`, radius 20px (pill), padding 4px 8px 4px 10px
- Position : 11px font-mono font-bold, `accent-highlight` (cyan-400)
- Séparateur : `·` 10px, `text-ghost`
- Delta XP : 10px font-bold, `Emerald-500` (positif) ou `Red-500` (négatif), suffixe ↑↓
- Tap : ouvre `Ranking` (vue par défaut, équipe surlignée et scrollée en vue)

**Données affichées :**
- Position globale dans la ligue (rank teams par cumulative XP)
- Delta XP du jour (somme des XP gagnés aujourd'hui sur toutes les courses)

**Comportement contextuel pendant un GT :**
- Si une phase GT/course-d'une-semaine est active, le tap ouvre Ranking pré-filtré sur cette course (à confirmer cf. §13 q6)

### 3.3 `<ProfileButton />` — avatar + menu

- Cercle 28px, gradient `cta-gradient` (cyan-500 → cyan-400) pour l'avatar
- Initiales 2 lettres en `cta-text` (#020617), 11px font-extrabold
- Si l'utilisateur a un skin actif : remplace l'initiale par l'avatar du skin
- Tap : ouvre un drawer/sheet (mobile) ou un dropdown (desktop) avec :
  ```
  ┌──────────────────────────┐
  │ [JS○] Jonathan          │
  │       Niveau 4 · 7 890XP│
  ├──────────────────────────┤
  │ Levels & XP             │
  │ Skins                   │
  │ ─────────────────────── │
  │ Help / Game Guide       │
  │ Settings                │
  │ Switch league   ▶       │
  │ ─────────────────────── │
  │ Sign out                │
  └──────────────────────────┘
  ```

### 3.4 Pas de logo / nom WattHunter

Décision explicite : pas de logo dans le header. La marque vit dans le favicon, le titre du browser tab, et le splash screen. Les 56px d'header sont précieux pour les fonctionnels.

### 3.5 Sticky behavior

Le header est **sticky** au scroll (toutes les pages). Les sub-tabs (underline tabs / segmented) sont également sticky, juste en dessous du header. Le contenu scroll dessous.

---

## 4. Page Racing — détail

### 4.1 Sous-navigation

Underline tabs (4 sections) :

```
[Feed] [Squad] [Tactics] [Peloton]
```

| Tab | Visibilité | État inactif |
|-----|-----------|-------------|
| **Feed** | Toujours | n/a |
| **Squad** | J-5 avant + pendant un GT/course d'une semaine | Grayed out (color `text-ghost`), non-cliquable, tooltip "Disponible pendant les Grand Tours et courses d'une semaine" |
| **Tactics** | Idem Squad | Idem |
| **Peloton** | Toujours | n/a |

**Indicateur "actif" :** dot cyan (4px, `accent-default`) à côté du label quand un GT/week-race est en cours sur les tabs Squad et Tactics.

### 4.2 Sub-tab Feed — c'est le RaceFeed v1 (§ déjà spécifié)

+ ajouts V2 :
- **Nemesis card** intercalée entre étapes
- **Phase start banner** au début de chaque phase
- **Phase winner banner** à la fin de chaque phase
- **Toggle "Cumul GC"** dans la Today card d'un GT (à confirmer cf. §13 q2)
- **Section "Mouvements"** : "Team Astrid vous a dépassé de 40 XP" mini-cards qui apparaissent inline dans le feed quand un overtake significatif a lieu

### 4.3 Sub-tab Squad

Gestion du squad GT. Page (pas modale) car interaction complexe.

**Layout :**
```
┌──────────────────────────────────────────────┐
│ Giro d'Italia · Phase en cours              │
│ ─────────────────────────────────────────── │
│ RÔLES ASSIGNÉS                              │
│ [GC]  Tadej Pogacar          ×              │
│ [SPR] Mathieu van der Poel   ×              │
│ [HUN] Stage Hunter           ×              │
│ [DOM] Jonas Vingegaard       ×              │
│ + Assigner un domestique                    │
│ ─────────────────────────────────────────── │
│ ROSTER NON-ASSIGNÉ                          │
│ José De Cauwer                              │
│ Egan Bernal                                 │
│ ...                                          │
└──────────────────────────────────────────────┘
```

- Réutilise les RPCs existants `gt_assign_role`, `gt_remove_from_squad`, `gt_swap_slot`
- Drag & drop sur desktop, tap-tap sur mobile

### 4.4 Sub-tab Tactics

Placement des tactiques GT. Page (pas modale).

**Layout :**
```
┌──────────────────────────────────────────────┐
│ Giro d'Italia · 5 tactiques disponibles     │
│ ─────────────────────────────────────────── │
│ ÉTAPE 3 · 6 mai · Montagne                  │
│   [Unleash] [Overdrive] [Nemesis GC] [Bus]  │
│   Aucune tactique placée · [+ Placer]       │
│ ─────────────────────────────────────────── │
│ ÉTAPE 4 · 7 mai · Plat                      │
│   ★ Nemesis Sprint · vs Team Astrid         │
│   [Modifier] [Annuler]                      │
└──────────────────────────────────────────────┘
```

- Réutilise les composants existants (`tactic-card`, `tactic-modal-shell`, `tactic-stage-list`, `tactic-boost-modal`, `tactic-nemesis-modal`)
- L'écran sert de hub. Le placement effectif passe par les modales existantes.

### 4.5 Sub-tab Peloton

Vue macro de toutes les équipes de la ligue. Toujours visible.

**Layout :**
```
┌──────────────────────────────────────────────┐
│ PELOTON · 6 équipes · Giro 2026             │
│ ─────────────────────────────────────────── │
│ Team Astrid          Niv. 4    8 420 XP     │
│   ├─ GC  · J. Vingegaard         (1/1)      │
│   ├─ SPR · M. van der Poel       (1/1)      │
│   └─ DOM · 4 coureurs                       │
│ ─────────────────────────────────────────── │
│ Mon équipe ★         Niv. 3    7 890 XP     │
│   ├─ GC  · T. Pogacar            (1/1)      │
│   └─ DOM · 3 coureurs                       │
│ ─────────────────────────────────────────── │
│ ...                                          │
└──────────────────────────────────────────────┘
```

- Une carte par équipe, condensée
- Roles count (combien de leaders, sprinters, hunters, domestiques) en visu compact
- Icônes Phosphor pour gamification
- Tap sur une équipe → ouvre `Ranking > Team detail`

---

## 5. Page Team — détail

### 5.1 Sous-navigation

Segmented control (3 options) :

```
[ My Team ] [ Budget ] [ Achievements ]
```

### 5.2 Tab My Team

**Sections :**

1. **XP Progress card** (existant, conservé)
2. **Stratégies actives** (existant, conservé)
3. **Roster** (existant, augmenté) :
   - Chaque rider card affiche un badge de rôle GT inline si un GT est actif
   - Format badge : 9px UPPERCASE, `text-mid`, bg `bg-surface-active`, padding 1px 5px, radius 4px
   - Rôles : `GC`, `SPR` (sprinter), `HUN` (stage hunter), `DOM` (domestique), `--` (non-assigné)
4. **Slots libres** (existant, conservé)

**La page `team/gt` actuelle disparaît.** Sa logique est absorbée dans My Team (section roster) + le sub-tab Squad de Racing.

### 5.3 Tab Budget

Récupère 100% du contenu actuel de `/league/[leagueId]/budget` :
- Phase selector
- Sponsor card + accès marketplace
- Treasury, salaires, income, outgoing widgets
- Recent transactions + lien "View all" → `/league/[leagueId]/team/budget/transactions` (page profonde)

Sponsors marketplace : conserve son écran dédié (action peu fréquente, 1x par phase).

### 5.4 Tab Achievements (nouveau)

Contient :
- **Skins équipe** (nouveau feature) : grid des skins débloqués + skin actif highlighted
- **Sponsors history** : liste des sponsors utilisés par phase
- **Phase wins** : timeline des phases où on a fini #1
- **Nemesis records** : ratio victoires/défaites en Nemesis (lien Sociaux)

Section secondaire, peu visitée. Pas le focus principal.

---

## 6. Page Auction — détail

### 6.1 Sous-navigation

Underline tabs (4 sections, conservé) :

```
[Bids] [Pool] [History] [League]
```

| Tab | Contenu actuel | Changement V2 |
|-----|---------------|---------------|
| **Bids** | Mes draft bids, contracts actifs | Léger refactor pour aligner sur la nouvelle hiérarchie typo |
| **Pool** | Pool coureurs filtré par level | Inchangé fonctionnellement |
| **History** | Historique closed rounds | Inchangé |
| **League** | Status table commissioner | Inchangé |

### 6.2 Hiérarchie typographique corrigée

Avant :
```
Auction
Bids · Pool · History · League    ← 13px
Round 1                            ← 13px (même taille → confusion)
Sponsor
Strategies
```

Après :
```
[Page Title]  Auction              ← 17-18px, 700, casse normale
[Tab Label]   Bids ★ Pool · ...    ← 12px, 600 actif / 500 inactif
[Section]     ROUND ACTIF          ← 10px, 700, UPPERCASE, letter-spacing 0.12em
[Data Label]  Trésorerie           ← 11px, 500, casse normale
[Data Value]  148 200€             ← 12-14px, font-mono, 600/700
```

### 6.3 Pages profondes

Inchangées dans leur contenu :
- `/auction/[id]` — auction detail
- `/auction/[id]/results` — round results
- `/auction/rounds` — commissioner round dates

Mais respectent la nouvelle hiérarchie typo.

---

## 7. Page Ranking — détail

### 7.1 Sous-navigation

Segmented control (3 options) :

```
[ Teams ] [ Riders ] [ Peloton ]
```

| Tab | Contenu actuel | Changement V2 |
|-----|---------------|---------------|
| **Teams** | Cumulative XP + treasury + level | Remplace **treasury par bonus sponsor cumulés** (plus pertinent pour comparer la perf) |
| **Riders** | XP per rider | Ajoute breakdown "stage XP" / "GC bonus" / "Daily classif bonus" en colonnes (mobile : tap pour expand) |
| **Peloton** | (nouveau) | Vue compacte toutes équipes côte à côte avec leurs rôles GT (cf. §4.5 — peut être partagé entre Racing/Peloton et Ranking/Peloton) |

### 7.2 Filtres

Le dropdown actuel "filter by race" est **conservé** mais visuellement intégré comme filter chip pill (pas tab). Pre-filtering :
- Lien depuis Racing feed → Ranking pré-filtré sur la course
- Lien depuis Today card → Ranking pré-filtré sur la course

### 7.3 Rider detail (page profonde)

Réutilise la page existante `/rider/[riderId]`. Améliorations :

- **Race form section** : breakdown par course en 3 colonnes
  - Stage XP
  - GC bonus (si grand tour, cumul)
  - Daily classification bonus (sprinter/KOM/jeune)
- **Lien depuis le feed** : tap sur un coureur dans la Today card → rider detail avec `from=racing` pour back nav

---

## 8. Cards du feed Racing — types détaillés

### 8.1 Past stage card (collapsed)
Voir spec V1 (§3.2 du fichier `racing-feed-v1`).

### 8.2 Today stage card (expanded)
Voir spec V1.
+ V2 : **toggle "Cumul GC"** pour les GT (cf. §13 q2)
+ V2 : **mini-cards de mouvement** dans la même card ("Team Astrid vous a dépassé sur cette étape")

### 8.3 Future stage card (dashed)
Voir spec V1.

### 8.4 Nemesis card (intercalée — V2)

Apparaît entre 2 cards d'étapes quand une tactique Nemesis est résolue.

```
┌──────────────────────────────────────────────┐
│ ⚔ NEMESIS · ÉTAPE 2                         │
│                                              │
│  Mon équipe                  Team Astrid     │
│  T. Pogacar      VS         J. Vingegaard    │
│                                              │
│  Résultat : +50 XP bonus → Vous              │
└──────────────────────────────────────────────┘
```

- Background : `rgba(239,68,68,0.06)`
- Border : `rgba(239,68,68,0.2)`, radius 10px
- Label "NEMESIS · ÉTAPE N" : 9px, font-bold, UPPERCASE, letter-spacing 0.1em, `Red-500`
- Equipes : 12px, font-semibold, en deux colonnes
- VS : `text-ghost`, 11px, séparateur central
- Coureurs : 10px, `text-low`
- Résultat : 11px, `Emerald-500` si victoire, `Red-500` si défaite, font-semibold

### 8.5 Phase start banner (V2)

```
┌──────────────────────────────────────────────┐
│ 🏁  Giro d'Italia · Phase 5                 │
│     Round 1 ouvert · Place tes enchères     │
│                                       [→]   │
└──────────────────────────────────────────────┘
```

- Background : gradient subtil `cyan-950` → `bg-surface`, radius 12px
- Title : 14px, font-bold, `text-high`
- Subtitle : 12px, `text-mid`
- Tap : navigation vers Auction tab Bids

### 8.6 Phase winner banner (V2)

```
┌──────────────────────────────────────────────┐
│ 🏆  Vainqueur Classiques Part 1             │
│     Team Astrid · 4 820 XP                  │
└──────────────────────────────────────────────┘
```

- Background : `bg-surface`, border `accent-default` à 30% opacité
- Trophée Phosphor icon
- Equipe : 13px, font-bold, `text-high`
- XP : 12px, font-mono, `accent-highlight` (cyan-400)

### 8.7 Mouvement card (V2 — nouveau)

```
┌──────────────────────────────────────────────┐
│ ↑ Team Astrid vous a dépassé                │
│   +40 XP · Étape 2 du Giro                  │
└──────────────────────────────────────────────┘
```

- Apparaît automatiquement après une étape qui a entraîné un overtake significatif (>20 XP de différence)
- Background : `bg-subtle`, border `border-default`
- Icône flèche : `Red-500` si on a perdu une place, `Emerald-500` si on en a gagné une
- Inline dans le feed après la Today card concernée

---

## 9. Hiérarchie typographique — règle universelle

### 9.1 Les 4 niveaux

| Niveau | Taille | Poids | Casse | Token couleur | Usage |
|--------|--------|-------|-------|---------------|-------|
| **Page title** | 17-18px | 700 | Title Case | `text-high` | "Auction", "Racing", "Team" |
| **Tab label** | 12px | 600 actif / 500 inactif | Title Case | `text-high` / `text-mid` | "Bids", "Pool", "Feed" |
| **Section label** | 10px | 700 | UPPERCASE + letter-spacing 0.12em | `text-low` | "ROUND ACTIF", "ROSTER", "GIRO D'ITALIA" |
| **Data label inline** | 11-12px | 400-500 | Title Case | `text-mid` | "Trésorerie", "Salaires/mois" |

### 9.2 Exception : badges courts

Les badges 1-3 lettres (`GC`, `SPR`, `DOM`, `HUN`) :
- 9px, font-bold (700), UPPERCASE, letter-spacing 0.05em
- Justifié par leur fonction (étiquette compacte, pas du texte de lecture)

### 9.3 Tokens à ajouter au design system

**Action :** mettre à jour `apps/web/app/globals.css` :

```css
:root {
  /* Type tokens */
  --type-page-title: 18px;
  --type-page-title-md: 20px;
  --type-tab-label: 12px;
  --type-section-label: 10px;
  --type-data-label: 11px;
  --type-data-value: 13px;
  --type-content: 13px;
  --type-caption: 10px;
  --type-badge: 9px;

  /* Letter spacing tokens */
  --tracking-section: 0.12em;
  --tracking-badge: 0.05em;
}
```

Et compléter le design system v3 (`docs/watthunter-design-system-v3.md`) avec un chapitre "Hiérarchie 4 niveaux".

---

## 10. Patterns visuels — règles de cohérence

### 10.1 Quand utiliser quoi

| Pattern | Quand | Exemples |
|---------|-------|----------|
| **Underline tabs** | 3-5 sections distinctes (navigation lateral) | Auction (4), Racing (4) |
| **Segmented control** | 2-3 vues exclusives du même contenu | Team (3), Ranking (3) |
| **Filter chips (pills)** | Filtres dans une liste, multi-select OK | Pool de coureurs, transaction filtres |

**Règle :** ne jamais mixer underline + segmented dans la même page. Choisir un pattern et s'y tenir au sein d'une page.

### 10.2 Décisions explicites

- **Pas de frosted glass** sur les nav (pas de `backdrop-filter: blur`)
- **Pas de FAB** (floating action button) — incompatible avec desktop
- **Pas d'animations de transition de tabs** (cross-fade, slide) — instantané
- **Pas de pills tabs avec backdrop** — uniquement underline + barre cyan

### 10.3 Cards pour les feed items

Tous les items du feed sont des cards :
- `bg-surface` ou variante teintée (rouge pour Nemesis, gradient pour Phase banners)
- Border 1px (solid sauf Future = dashed)
- Radius 10px
- Padding interne 12-14px
- Margin-bottom 7-8px entre cards

Pas de "direct sur background" comme l'écran Levels actuel — incohérent avec le reste.

---

## 11. Modales vs pages — règle

| Type d'action | Pattern | Justification |
|--------------|---------|--------------|
| **Action rapide < 5 sec** | Modale ou bottom sheet | Tactique placement, swap rapide rôle GT, confirmation |
| **Gestion avec liste + édition** | Page (avec back button visible) | Squad management, Tactics hub, Peloton view, Skins gallery |
| **Lecture profonde** | Page | Rider detail, Team detail, Auction detail |

**Critère de bascule** : si l'action nécessite plus de 2 inputs ou une vue scrollable de liste, c'est une page.

---

## 12. Dette technique liée

### 12.1 Race slug normalization

**Problème :** les slugs PCS sont incohérents :
- Stage : `race/giro-italia/2026/stage-3`
- GC d'un GT : `race/tour-romandie/2026/gc/results`
- Classique : `race/paris-roubaix/2026`

Ça crée des incohérences dans les filtres Ranking (parfois "race/.../gc/results", parfois juste le slug).

**Fix V2 :**
1. Ajouter une colonne `race_type ENUM('stage', 'gc', 'one-day')` dans `race_results`
2. Normaliser `race_name` au scraping (ex: "Giro d'Italia · Étape 3" au lieu de "race/giro-italia/2026/stage-3")
3. Mettre à jour le pipeline `services/pcs-sync/run_pipeline.py post-race` pour populer `race_type`

### 12.2 Granularité du scoring

**Manque actuel :** la table `rider_xp_daily` a `xp_gained` global mais pas de breakdown :
- Stage XP (points pour le résultat de l'étape)
- GC bonus (points pour le maillot rose / jaune cumulé)
- Daily classification bonus (sprinter, KOM, jeune)

**Ajout V2 :** colonnes `stage_xp`, `gc_bonus`, `daily_classif_bonus` dans `rider_xp_daily`. Migration. Backfill possible via re-run du pipeline scoring.

### 12.3 Phase boundaries

**Pas de table** qui marque clairement le début et la fin de chaque phase (Classiques Part 1, Giro, etc.). C'est calculé dynamiquement.

**Ajout V2 :** view ou table `phases_calendar` qui matérialise les dates de début/fin de chaque phase pour faciliter les Phase start/winner banners.

---

## 13. Questions à trancher avant chaque PR

Ces questions n'ont pas été tranchées dans la session du 2026-05-09. Elles sont à arbitrer avant de scoper chaque PR Phase 2.

| # | Question | Options | Mon penchant |
|---|----------|---------|--------------|
| 1 | Ordre des 4 tabs bottom nav | (a) `Racing · Team · Auction · Ranking` (b) `Racing · Auction · Team · Ranking` (c) `Racing · Ranking · Auction · Team` | (a) — Team est plus utilisé que Auction sur la durée ; Ranking en bout = action de "vérification", moins fréquente |
| 2 | Today card pendant un GT : par défaut résultat de l'étape ou cumul GC ? | (a) Étape par défaut + toggle "Voir GC" (b) GC par défaut + toggle "Voir étape" (c) Deux cards distinctes (étape + GC cumul) | (a) — l'info la plus chaude est l'étape du jour |
| 3 | Today card sans participants Mon équipe | (a) Masquer "DÉTAIL — Mon équipe" (b) Afficher avec "Aucun de vos coureurs n'a participé" | (a) — moins de bruit |
| 4 | Number of teams in classement Today card | (a) Toutes (la plupart des ligues ont 4-8 équipes) (b) Top 3 + bouton "voir tout" | (a) — plus simple |
| 5 | Past cards avec 0 XP de Mon équipe | (a) Afficher quand même (b) Masquer | (a) — cohérence chronologique |
| 6 | StatusBadge tap : ouvre quoi ? | (a) Ranking global toujours (b) Ranking pré-filtré sur le GT actif si applicable | (b) — plus contextuel |
| 7 | Tabs Squad/Tactics hors-période GT | (a) Grayed out non-cliquables (b) Cachés purement et simplement | (a) — l'utilisateur comprend la structure |
| 8 | Sticky behavior du header | (a) Sticky toujours (b) Hide-on-scroll (c) Compact-on-scroll (titre rétrécit) | (a) — simple, prévisible |
| 9 | League switcher dans menu profil | (a) Toujours visible (même si 1 seule ligue) (b) Visible seulement si l'user est dans 2+ ligues | (b) — moins de bruit |
| 10 | Mouvement cards (overtake notifications) | (a) Auto-générées par seuil XP (b) Optionnelles (toggle dans Settings) | (a) — automatiques mais avec seuil élevé (>20 XP) |

---

## 14. Roadmap de séquencement (proposition)

Ces PRs sont indépendantes et peuvent être ordonnées différemment selon les priorités produit.

| PR | Scope | Estimé | Dépendances |
|----|-------|--------|-------------|
| **#0 — Racing Feed v1** | Spec dédiée, voir `racing-feed-v1-implementation.md` | 3-5h | aucune |
| **#1 — Hiérarchie typo** | Mise à jour des tokens CSS + design system + refactor des composants tab existants | 4-6h | #0 |
| **#2 — Header compact** | StatusBadge, ProfileButton, suppression du header WattHunter, menu profil | 6-8h | #1 |
| **#3 — Bottom nav 4 tabs** | Réorganisation : Home → Racing, Budget fold dans Team, fusion Auction sub-tabs | 8-10h | #2 |
| **#4 — Racing sub-tabs** | Feed sub-tab + Squad/Tactics/Peloton tabs (réutilise pages existantes) | 4-6h | #3 |
| **#5 — Team merged** | Segmented `My Team / Budget / Achievements`, GT Team page disparaît, badges rôles inline | 6-8h | #3 |
| **#6 — Achievements + Skins** | Nouveau feature + UI | 10-15h | #5 |
| **#7 — Feed V2 cards** | Nemesis, Phase banners, Mouvement cards | 6-8h | #0 |
| **#8 — Ranking améliorations** | Bonus sponsor cumulés, Peloton sub-tab, breakdown Rider | 6-8h | #1 |
| **#9 — Race slug normalization** | Migration DB + pipeline update + backfill | 4-6h | indépendant |

Total estimé : ~60-80h de dev pour la refonte complète, étalable sur plusieurs semaines.

---

## 15. Décisions explicitement écartées

Pour mémoire, ces options ont été discutées et **rejetées** :

| Option | Raison du rejet |
|--------|----------------|
| Bottom nav avec 5 tabs (Racing + Team + Market + Ranking + More) | 4 tabs suffisent, "More" = anti-pattern |
| Bottom nav avec 3 tabs + Ranking dans header | Risque que Ranking ne soit pas trouvé |
| FAB stack vertical bottom-right pour Squad/Tactics | Pas adapté desktop, complexité z-index |
| Pills horizontaux flottants au-dessus de la nav | Effet "double navigation" |
| Frosted glass / backdrop-filter sur la nav | Conflit avec sticky bottom bars d'Auction/Market |
| Pill tabs avec border (style Apple iOS HIG) | Confusion avec filter chips |
| Nav qui change selon le contexte (auction phase vs race phase) | Désorientant pour l'utilisateur |
| Cockpit tab qui remplace Team | Mot inhabituel, 4 sub-tabs trop |
| Logo WattHunter dans le header | UX prime, ajout futur si pertinent |
| Direct sur background (style Levels) pour les feed items | Incohérent visuellement, cards permettent traitements différenciés |

---

## 16. Glossaire

| Terme | Définition |
|-------|-----------|
| **Phase WT** | Une des 8 phases de la saison cycliste (Season Start, Classiques Part 1, etc.) |
| **GT** | Grand Tour (Giro, Tour de France, Vuelta) |
| **Course d'une semaine** | Tirreno, Paris-Nice, Romandie, Catalogne, Pays-Basque, Dauphiné, Tour de Suisse |
| **One-day race / Classique** | Course d'une seule journée (Paris-Roubaix, Liège, etc.) |
| **Phase d'enchères** | Période avant chaque phase WT où les joueurs draftent des coureurs |
| **Phase de course** | Période pendant la phase WT où les courses sont disputées |
| **Squad GT** | Sous-ensemble du roster assigné à des rôles pour un Grand Tour |
| **Tactic Nemesis** | Tactique PvP : duel direct entre deux équipes sur une étape (Nemesis Sprint, Nemesis GC) |
| **StatusBadge** | Composant proposé qui affiche `[#X · +XP↑]` dans le header de chaque page |
| **ProfileButton** | Composant proposé qui affiche l'avatar du user et ouvre le menu (Settings, Help, Skins, Levels) |
