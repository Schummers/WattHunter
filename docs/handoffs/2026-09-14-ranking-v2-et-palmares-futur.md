# Ranking V2 (livrable) + Palmarès (vision différée)

Rédigé le 2026-09-14. Remplace la vision « grande feature palmarès » comme prochaine
action. Le contexte historique complet reste dans
`docs/handoffs/2026-09-12-palmares-lrdt-handoff.md` et dans
`research/laroutedutour/` (CSV, README, wireframes).

Décision du 2026-09-14 : **la page Palmarès reste en l'état.** Tout l'effort passe
dans **Ranking**, pour sortir quelque chose de shippable en prod maintenant.

---

## 1. Ce qu'on livre : Ranking V2

### Structure de l'en-tête

Une seule ligne sous le titre, deux contrôles :

- **Gauche, liste déroulante course** : `All races` par défaut, puis une entrée par
  course de la ligue. Le composant existe déjà
  (`ranking-client.tsx`, `<Select>` alimenté par `races`, avec regroupement
  parent/étapes via `getRankingRaceName` et `childSlugs`).
- **Droite, au même niveau que le titre « Ranking », liste déroulante saison** :
  `2026` par défaut, avec les saisons passées.

Le segmented control `Teams / Riders` est retiré de cet emplacement.
**Point non tranché** : le classement Riders est aujourd'hui le seul endroit qui
donne le classement XP des coureurs de la ligue. Le supprimer supprime la
fonctionnalité, pas seulement un onglet. À déplacer (underline tabs sous le
header, ou vers la page coureurs) plutôt qu'à jeter.

### Les trois vues

| Sélection | Contenu |
|---|---|
| Course X + saison Y | Le tableau actuel, filtré sur la course. Rien à inventer. |
| All races + saison Y | Le tableau cumulé de la saison, **plus** un bandeau de podiums par phase au-dessus : qui a gagné les Classiques, le Giro, le Tour, la Vuelta. |
| All races + toutes saisons | Podium des saisons (qui a gagné le plus de saisons), puis podiums par épreuve cumulés sur toutes les saisons. Chaque podium se déplie en tableau complet au clic. |

**Définition du champion de saison** : le plus gros cumul d'XP sur la saison. C'est
exactement ce que calcule déjà la vue `All races` d'une ligue. Aucune nouvelle
formule. Conséquence assumée : pour gagner une saison il faut avoir joué toutes les
phases.

### Le composant podium

Idée validée le 2026-09-14 : **le podium n'est pas un composant séparé, c'est le
tableau tronqué à trois lignes**, avec un bouton « voir le reste du classement ».
Une seule implémentation, deux usages, pas de dérive visuelle entre les deux.

Dans les lignes du podium, retirer :
- le **level** (`Lv.8` en classic, constant, donc sans information),
- la **trésorerie** (`formatMoney(treasury)`, hors sujet dans un classement).

Ne restent que rang, badge équipé, nom d'équipe, XP, et le mouvement.

---

## 2. Le blocage dur : la saison n'existe pas

C'est le seul vrai obstacle du lot, et il ne se contourne pas par du front.

- Une **ligue = une saison**. `leagues` n'a ni colonne saison, ni colonne type de
  course. Le seul axe existant est `mode` (manager/classic), qui est l'économie.
- La page ranking est scopée à `leagueId`. **Il n'existe aucun mécanisme de saison
  archivée**, aucune agrégation cross-ligue, aucune notion de « même groupe de
  joueurs d'une année sur l'autre ».
- Côté WattHunter, **il n'y a qu'une seule saison de données** : 2026. Les saisons
  antérieures n'existent que dans La Route du Tour.

Conséquences, à trancher avant de coder :

1. Le sélecteur de saison **ne peut afficher que 2026** tant qu'il n'y a pas
   d'entité saison. Deux options honnêtes : l'afficher figé sur 2026 (poser
   l'emplacement, sans promesse), ou le sortir du lot 1.
2. La vue « All races + toutes saisons » est **la même dépendance**. Elle ne peut
   pas être livrée dans le lot 1.
3. L'entité manquante est probablement `seasons` (année + groupe de joueurs) avec
   `leagues.season_id`, plus un classement cross-ligue par `users.id` et non par
   `teams.id` (une équipe est rebaptisée chaque saison, comme sur LRDT).

**Découpage recommandé** :

- **Lot 1, shippable** : course + `All races` sur la ligue 2026, podiums par phase,
  composant podium tronqué, retrait level et trésorerie. Zéro migration.
- **Lot 2** : entité saison, sélecteur réel, classements cross-saisons.
- **Lot 3** : import LRDT et palmarès (section 4 ci-dessous).

---

## 3. Mapping course → phase

Pour les podiums « qui a gagné les Classiques / le Giro / le Tour / la Vuelta »
d'une saison, il faut regrouper les courses par phase. Les deux pièces existent :

- `AUCTION_PHASES` (`apps/web/lib/phases.ts`) donne les 9 phases avec leurs
  fenêtres de dates.
- Chaque course de `races` porte une `date`.

Le regroupement est donc dérivable côté client, sans migration. Attention : les
Classiques sont **deux** phases (`Classics Part 1` et `Classics Part 2`), à fusionner
en un seul podium « Classiques ». Et `phases.ts` contient toujours le décalage
playtest du Tour au 30/06, year-agnostic donc permanent tant qu'il n'est pas revert.

---

## 4. Vision palmarès, différée (ne pas implémenter)

Tout ce qui suit a été exploré les 20-21 août puis le 12-13 septembre 2026. Gardé
ici pour ne pas le re-découvrir.

### 4.1 Les contraintes dures découvertes

1. **Ne jamais reclasser l'histoire.** Convertir les points LRDT en XP change
   l'ordre d'arrivée de 13 tours sur 30 et le vainqueur de 2 (Giro 2024, Tour 2023).
   Le rang affiché doit toujours venir de la source.
2. **Le lissage bayésien seul ne suffit pas.** Un joueur à 1 victoire en 2 tours
   reste sur le podium même à C=40. Il faut lissage **et** seuil de participation.
3. **Participation très inégale** : 4 joueurs à 30/30, d'autres à 8, 3, 2. C'est le
   vrai problème de design du palmarès, pas un détail d'affichage.
4. **Nouveau, 2026-09-13** : les points ne sont pas comparables entre les deux ères.
   Tout agrégat cross-ères doit se faire **sur les rangs** (victoires, podiums, rang
   moyen, titres de maillot), jamais sur l'XP. Ce point remet en cause la conversion
   décidée en août, qui reste utilisable seulement à l'intérieur d'une même ère.

### 4.2 Ce que le dataset LRDT permet et ne permet pas

- **Permet** : classement final de chaque tour, rang par joueur, points par
  catégorie (général, sprinteur, grimpeur, jeune, étapes, sommets, sprints
  intermédiaires, combatif), nom d'équipe d'époque.
- **Ne permet pas** : le détail étape par étape. **Impossible de calculer un
  nombre de victoires d'étape depuis LRDT** (le scrape ne couvre que la vue
  « Classement général » de chaque tour). Un classement « qui a gagné le plus
  d'étapes » sera donc WattHunter-only.
- **Ne permet pas non plus** : tout ce qui touche aux enchères, aux transferts, à la
  rentabilité d'un coureur par euro dépensé. LRDT n'expose rien de tout ça. Ces
  classements « insolites » sont WattHunter-only par nature.

### 4.3 Les stats explorées dans les wireframes

18 maquettes dans `research/laroutedutour/wireframes/palmares-wireframes.html`
(artifact publié : https://claude.ai/code/artifact/868307df-6980-4df2-92b6-0141f6416212).

**Palmarès tous temps (écran A)**
- A1 titres bruts : nombre de victoires. Simple, mais met à égalité 1 victoire en 30
  tours et 1 en 2.
- A2 volume et régularité côte à côte, deux colonnes assumées.
- A3 **recommandé** : un classement unique, seuil de participation visible, les
  petits échantillons relégués dans une zone « hors classement ».
- A4 **recommandé en second onglet** : grille victoires par épreuve (joueur × type
  de course). La seule vue immunisée contre la participation inégale, et celle qui
  fait ressortir les récits (un joueur spécialiste du Tour).
- A5 score lissé : **écarté**, gardé comme preuve que le lissage seul ne suffit pas.
- A6 frise des champions par saison.

**Saison (écran B)**
- B1 liste des épreuves de l'année et leur vainqueur.
- B2 classement cumulé de la saison, avec un titre de champion rétrospectif.
- B3 **recommandé** : grille épreuve × joueur affichant le rang, avec un point pour
  les absences. La seule vue qui distingue une absence d'une contre-performance.
- B4 densité des saisons (nombre de tours par an).
- B5 titres de maillot de l'année, par catégorie.
- B6 podium éditorial avec « le fait de la saison ».

**Profil joueur (écran C)**
- C1 fiche carrière (tours, victoires, podiums, rang moyen, maillots).
- C2 **recommandé** : vitrine, victoires par épreuve et titres de maillot. Les cases
  vides dessinent un objectif.
- C3 courbe d'XP par saison. Piège : mesure autant l'activité du groupe que la forme
  du joueur, à doubler d'un XP par tour.
- C4 comparaison relative au groupe (assiduité, podiums, victoires, XP par tour).
- C5 **recommandé** : terrains de prédilection, rang moyen par type d'épreuve. La
  vue la plus actionnable pour le joueur.
- C6 historique complet tour par tour, en points bruts LRDT.

### 4.4 Fusion badges et palmarès

Idée du 2026-09-13 : badges, bannières et palmarès doivent être la même chose.
Obstacle de schéma : la page `/league/{id}/achievements` (label nav « Palmares »)
est déjà une page joueur, mais **scopée à une seule ligue**. Un palmarès est
cross-ligue, donc niveau `users`. Fusionner les deux est un chantier de schéma, pas
un chantier d'écran.

### 4.5 Couverture de l'historique LRDT

Le scrape a été fait depuis le seul compte `Alpaga`, donc il ne contient que les
tours auxquels Jonathan a participé. Douze cases vides sur 36 (hors courses d'une
semaine, écartées le 2026-09-13).

| Année | Classiques | Giro | Tour | Vuelta |
|---|---|---|---|---|
| 2017 | - | - | - | 5 |
| 2018 | 6 | - | 9 | 7 |
| 2019 | 7 | 7 | 9 | 7 |
| 2020 | - | 7 | 7 | - |
| 2021 | 8 | 8 | 8 | 8 |
| 2022 | 6 | 8 | 9 | - |
| 2023 | 9 | 9 | 10 | 9 |
| 2024 | - | 9 | 9 | - |
| 2025 | - | - | - | 6 |

Le chiffre est le nombre d'équipes classées, le tiret une absence. À réclamer aux
autres joueurs, en gardant en tête que certaines cases sont peut-être de vrais
non-jeux (2020 covid, 2025 en cours de bascule).

### 4.6 Questions restées ouvertes

- Seuil de participation du classement à la régularité. Proposé 15 tours sur 30, à
  recalibrer sur 24 si les courses d'une semaine sortent définitivement.
- Fangio : 3 tours, aucun compte WattHunter identifié. Profil placeholder ou exclu.
- Où stocker la donnée migrée. Recommandé : table dédiée type
  `legacy_palmares_results`, jamais de fausses lignes dans `leagues` ou `teams`.
- Points de sommet côté WattHunter : `Stage.climbs()` existe dans la lib PCS et
  n'est appelé nulle part. Piste séparée, hors chantier palmarès.

---

## 5. Vision produit de fond (2026-09-13)

Contexte qui explique les choix ci-dessus, à ne pas reperdre.

- Une **ligue couvre une saison entière**, découpée en phases. À chaque phase, un
  joueur décide s'il participe ou non. Le classement annuel récompense donc
  l'assiduité autant que la performance.
- La **Home devient la vue racing** : résultats du jour, vainqueurs d'étape, scores,
  et la gestion d'équipe intégrée (vue peloton, squad GT, tactiques en modale). Les
  onglets Team et les écrans d'équipe se replient dedans.
- L'**onglet Auction reste** : c'est le cœur du jeu.
- Les **courses d'une semaine** (Paris-Nice, Dauphiné) sont écartées du périmètre
  palmarès. Elles font tomber l'historique de 30 tours à 24.

Ces trois points ne sont pas dans le lot 1 et n'ont pas encore été confrontés au
code existant.

---

## 6. Décisions du 2026-09-14 (deuxième passe)

### 6.1 Mécanisme de saison : à construire

Tranché : **une saison est une année**. Ce n'est plus un lot différé, c'est la
condition d'existence du sélecteur saison et de toutes les vues cross-saisons.

Ce qu'il faut :

- Une entité saison (année) et un rattachement des ligues à une saison.
- Les classements cross-saisons agrègent par **joueur** (`public.users.id`), pas par
  équipe : un nom d'équipe change chaque saison, comme sur LRDT.
- À charger avant toute migration : `supabase:supabase-postgres-best-practices`.

### 6.2 Rapatrier la saison 2026 dans une seule ligue

La saison 2026 est éclatée sur deux ligues classic. Il faut que les **Classiques
(phases 2 et 3) et le Giro**, joués dans la ligue Classic V1, comptent dans la
saison 2026 de Classic V2.

C'est une opération de données, à instruire avant de coder : mêmes joueurs des deux
côtés, mais équipes et contrats différents. Deux approches possibles, à trancher :

- **rattachement** : les deux ligues pointent vers la même saison 2026, et
  l'agrégation se fait par joueur au moment de la lecture. Rien n'est réécrit, donc
  rien n'est perdu ;
- **import** : recopier les lignes d'XP de V1 dans V2. Plus simple à lire, mais
  destructif et non rejouable.

Le rattachement est préférable. Note : un précédent existe déjà, le
`HARDCODED_GRANTS` de la page achievements, qui transfère à la main le palmarès V1
vers V2. Ce hack devra disparaître quand le mécanisme propre existera.

### 6.3 Les Classiques = uniquement des courses d'un jour

Tranché : le classement Classiques ne compte que les courses d'un jour. Paris-Nice,
Tirreno-Adriatico, le Dauphiné et les autres courses d'une semaine en sont exclus.

**Source de vérité** : `services/pcs-sync/wt_calendar_2026.json`, champ `type`
(`one-day` / `stage-race`), déjà typé côté front dans `apps/web/lib/calendar.ts`.
21 courses d'un jour sur 36 au calendrier WT 2026.

**Bug existant à corriger au passage** : la constante `ONE_DAY_WT_PATTERNS` de
`app/(game)/league/[leagueId]/achievements/page.tsx` inclut `race/paris-nice/%` et
`race/tirreno-adriatico/%`, qui sont des courses par étapes. L'achievement
« Classic Man » compte donc aujourd'hui deux courses d'une semaine comme des
classiques.

Ne pas se rabattre sur `race_results.stage IS NULL` : le classement général d'une
course d'une semaine peut arriver avec un `stage` nul et serait compté comme une
course d'un jour.

### 6.4 Ce qu'on abandonne

- **Le détail par coureur dans les classements** : on ne veut pas savoir quel
  coureur a marqué le plus dans une course. Le classement est un classement de
  joueurs.

### 6.5 Le tableau dense, au clic sur le podium

Nouvelle direction : le podium reste la vue par défaut, avec les visualisations.
Au clic, il ouvre un **tableau dense** à la manière de La Route du Tour, avec le
détail par catégorie et pas seulement le total.

**Ce que la base permet déjà.** `rider_xp_daily` stocke une décomposition complète
de l'XP, agrégeable par équipe :

| Colonne LRDT | Équivalent WattHunter | État |
|---|---|---|
| Arrivée d'étape | `raw_pcs_points` | disponible |
| Sommets | `kom_event_bonus` | disponible depuis le lot 08/2026 |
| Sprints intermédiaires | `sprint_event_bonus` | disponible depuis le lot 08/2026 |
| Combatif | `gt_distance_bonus` (échappée) | équivalent d'intention, pas identique |
| (sans équivalent LRDT) | `assist_bonus` (équipiers) | propre à WattHunter |
| Maillot jaune, vert, pois | `gt_classif_bonus` | **fusionnés dans une seule colonne** |
| Maillot blanc | `gt_final_classifications` (`youth`) | seulement en final, pas en quotidien |

**Le seul vrai manque** : `gt_classif_bonus` agrège général, points et montagne. Pour
afficher une colonne par maillot il faut soit les séparer en trois colonnes de
traçabilité dans `rider_xp_daily`, soit recalculer depuis
`gt_daily_classifications` (qui porte bien `classification_type`) et
`gt_final_classifications`. La deuxième voie ne demande aucune migration mais coûte
une jointure de plus.

Note : `gt_daily_classifications` ne contient pas `youth`, seulement `gc`, `points`
et `kom`. Le maillot blanc n'existe qu'en classement final.

---

## 7. Règles de comptage verrouillées (2026-09-14, troisième passe)

- **Une victoire** = gagner une phase : Classiques, Giro, Tour, Vuelta.
- **Gagner la saison** au cumul est un titre d'une autre nature, compté à part.
- **Un titre de maillot** = meilleur cumul d'une catégorie sur une épreuve, grands
  tours seulement. Une course d'un jour ne distribue aucun maillot, donc pas de
  maillot sur les Classiques, et aucun équivalent maison n'est créé.
- **Aucun seuil de participation.** Tout le monde apparaît. La régularité se lit en
  comptages de places (1res, 2es, 3es), jamais en moyenne lissée. La décision
  d'août (seuil à 15 tours + lissage bayésien) est annulée.
- **Une seule frise 2017-2026**, La Route du Tour et WattHunter à la suite.

Conséquence : le script d'agrégats est reconstruit et **versionné** dans
`research/laroutedutour/palmares_stats.py`, avec sa sortie
`palmares_stats.json`. Il exclut les courses d'une semaine, fusionne les identités,
et ne convertit jamais en XP. 24 épreuves retenues sur 30.

Chiffres de référence produits : David Choncoutié 6 victoires, PeeJee 5,
Marseillais 4, Klimax 3 mais **3 titres de saison** (le plus du groupe), PeeJee 15
titres de maillot.

## 8. Wireframes du découpage Palmarès / Ranking

`research/laroutedutour/wireframes/palmares-ranking-split.html`
(publié : https://claude.ai/code/artifact/92a31117-13f9-4317-ad5e-436c4fa2b54c)

Quatre découpages maquettés, noir et blanc, sur données réelles :

- **A, passé contre présent** : Ranking ne connaît que la saison en cours, Palmarès
  que ce qui est terminé. Règle énonçable en une phrase, mais la saison en cours
  apparaît dans les deux et bascule au 1er janvier.
- **B, une seule page** : Palmarès disparaît, le sélecteur saison gagne une valeur
  « tous temps ». L'onglet libéré revient aux badges. Défaut : le mot Ranking
  désigne deux choses très différentes selon la valeur du sélecteur.
- **C, Ranking classe et Palmarès compte** : coupe par nature de l'information, pas
  par temporalité. La plus solide, et la seule qui ne demande rien de redéplacer
  quand une saison s'ajoute.
- **D, la frise partagée** : un composant unique à deux profondeurs, résumé en pied
  de Ranking et dépliable dans Palmarès.

**Retenu** : C pour la règle de découpage, D pour la frise, tableau détaillé partout.
La fiche joueur (terrains de prédilection, comparaison au groupe, historique complet)
est le troisième niveau, après la mise en prod des deux premiers.

---

## 9. Spécification arrêtée (2026-09-14, quatrième passe)

Wireframes annotés : `research/laroutedutour/wireframes/palmares-quatre-onglets.html`
(publié : https://claude.ai/code/artifact/7e1a0ec3-a196-4705-9ac7-22b4a19464a8)

Le découpage C de la passe précédente est retenu et resserré : **Ranking ne bouge
presque pas**, tout le travail neuf est dans Palmarès.

### 9.1 Ranking — la liste exacte des changements

1. Retirer le level et la trésorerie des lignes.
2. Retirer le segmented control Teams / Riders. **Décider où va le classement des
   coureurs avant de le supprimer**, c'est le seul endroit qui existe pour ça.
3. Ajouter le sélecteur d'année à droite du titre, année en cours par défaut,
   remontant jusqu'à 2017.
4. Réduire le sélecteur de course à quatre entrées groupées (Classiques, Giro, Tour
   de France, Vuelta) plus « All races » par défaut. Les Classiques regroupent toutes
   les courses d'un jour de l'année en une seule entrée.
5. Ne montrer que des totaux. Pas de détail par coureur, pas de répartition par
   catégorie sur cette page.

Le tableau détaillé façon Route du Tour **n'est plus un livrable front**. La donnée
doit exister en base, l'écran viendra plus tard ou jamais.

### 9.2 Palmarès — quatre onglets, aucune valeur d'XP

La page actuelle (emblèmes, badges, bannières) **part dans les réglages**, derrière un
bouton. Rien n'est jeté, l'interface change d'adresse.

| Onglet | Contenu |
|---|---|
| **Frise** | Une ligne par saison, 2017 à 2026. Première ligne le champion au cumul, seconde ligne les quatre vainqueurs d'épreuve. Une épreuve non jouée garde sa case, en pointillé. Un tap ouvre le détail de la saison, avec les noms d'origine des tours. |
| **Victoires** | Compteur général (victoires, départs, triplet de podiums) puis tableau croisé joueur × épreuve. Le titre de saison n'y figure pas, il vit dans la frise. |
| **Maillots** | Tableau joueur × maillot (jaune, vert, pois, blanc) plus total. Grands tours seuls, 19 sur les 24 épreuves. |
| **Joueurs** | Fiche relative : carrière en six chiffres, puis les **duels** (combien de fois devant chaque autre joueur, sur les seules épreuves jouées par les deux). |

**Le triplet de podiums remplace le rang moyen.** Sans seuil de participation une
moyenne est inexploitable, les trois comptages restent lisibles à tout volume.

**Les duels sont la trouvaille de cette passe.** Ils ne comptent que les épreuves
jouées par les deux joueurs, donc l'assiduité n'y donne aucun avantage, et ils ne
manipulent que des rangs, donc ils traversent les deux ères sans conversion.

### 9.3 Pistes supplémentaires, toutes fondées sur des rangs

L'éternel second (Klimax, 6 deuxièmes pour 3 victoires) ; l'assiduité (4 joueurs à
9 saisons sur 9) ; les séries et disettes (Alpaga, 7 ans entre ses deux victoires) ;
les terrains de prédilection (rang moyen par type d'épreuve, légitime à l'échelle
d'une carrière puisqu'on ne compare plus les joueurs entre eux) ; le doublé (PeeJee
2022, Giro, Tour et le titre) ; les quatre épreuves (David Choncoutié est le seul à
avoir gagné les quatre au moins une fois).

### 9.4 Chantiers de données

- Créer le mécanisme de saison (une saison = une année), agrégation par joueur.
- Rattacher la ligue Classic V1 à la saison 2026.
- Stocker la répartition par catégorie de chaque résultat, **même sans écran** :
  arrivée, sommets, sprints, échappée, puis jaune, vert, pois, blanc. Presque tout
  existe déjà, sauf la séparation des trois premiers maillots.
- Importer l'historique La Route du Tour dans une table dédiée, jamais sous forme de
  fausses ligues ou de fausses équipes.
- Corriger l'achievement Classic Man, qui compte Paris-Nice et Tirreno-Adriatico
  comme des classiques.

### 9.5 Amendements (v2 des wireframes, même URL)

- **Le segmented control Teams / Riders est conservé**, contrairement à la décision
  de la passe 3. Il est **désactivé sur les saisons antérieures à 2026**, avec une
  ligne d'explication : La Route du Tour n'a aucune donnée coureur, seulement des
  classements d'équipes. Le masquer ferait sauter la mise en page d'une année à
  l'autre. **Ranking est validé en l'état.**
- **Noms affichés** : toujours le compte WattHunter actuel, y compris pour un titre
  gagné sous un ancien pseudo. Le mapping couvre 9 joueurs. **Trois n'ont aucun
  compte** : Fangio, JibsEPAULE et JoeDills. À trancher, garder leur pseudo d'époque
  ou les exclure.
- **Frise redessinée.** La v1 empilait des cases et noyait le champion. Deux
  variantes proposées, F1 retenue : rail chronologique sans aucune boîte, champion
  en gros dans la police de titrage, quatre vainqueurs en ligne sous lui, et un
  soulignement quand le vainqueur d'une épreuve est aussi le champion de l'année.
- **Onglet Victoires** : le triplet 6·4·2 devient trois colonnes chiffrées avec
  en-têtes (1er en primaire, 2e et 3e en gris à droite). **Un commentaire de la v1
  était faux** : David Choncoutié a bien gagné les quatre épreuves, il est même le
  seul du groupe.
- **Onglet Maillots** : la règle de calcul est écrite sur l'écran (le maillot va à
  l'équipe qui cumule le plus de points de la catégorie, pas à celle qui possède le
  coureur classé premier). Le bloc « sur 19 grands tours » est supprimé.
- **Onglet Joueurs** : la règle du duel est écrite sur l'écran (seules comptent les
  épreuves disputées par les deux). Ajout du **rang de saison année par année**, une
  barre par année dont la hauteur est la place au classement de l'année, jamais les
  points : la seule façon honnête de tracer une trajectoire à travers deux barèmes.
- **Six pistes de plus pour la fiche joueur** : terrains de prédilection, palmarès
  personnel, la disette, le meilleur jour, la collection des quatre épreuves, et la
  liste des noms d'équipe portés au fil des ans.

### 9.6 Amendements (v3 des wireframes, même URL)

**Validés : Ranking et l'onglet Frise.**

- **Ranking** : le contrôle Teams / Riders désactivé n'a plus de phrase
  d'explication. L'état grisé se suffit.
- **Frise** : passée en **cartes non dépliables**, une par saison. L'intitulé de la
  carte est « 2023 · CHAMPION », le nom du champion suit à 16 px (taille de titre de
  section du design system, au lieu de 24 px), puis les quatre vainqueurs. Une seule
  ligne sous la liste explique le calcul du champion. Le soulignement marque le
  doublé épreuve + titre.
- **Victoires** : colonnes inversées, **1er à l'extrême droite en primaire**, 2e et
  3e à sa gauche en secondaire.
- **Maillots** : la règle de calcul passe **sous** le tableau.
- **Règle générale posée** : les règles de calcul vont sous les tableaux, jamais
  au-dessus, et **aucun commentaire éditorial** (« X est le seul à… »). Un
  commentaire se périme à chaque saison, une règle non.
- **Joueurs** : le face à face avait un visuel cassé (barre et score sur deux lignes).
  Refait en une ligne par adversaire, tri du plus favorable au moins favorable, avec
  un repère d'égalité. Le « rang de saison » est conservé et renommé **« ta place au
  classement de chaque saison »**.
- **Noms** : partout les comptes WattHunter, jamais les pseudos LRDT. Les wireframes
  utilisent désormais Muscat Romain, TheAussieMate, Dixon Hormous, Jonathan
  Schummers, Marino Alex, Peejee.

**Question ouverte n°1, importante** : Fangio et JoeDills n'ont jamais rien gagné,
les exclure ne coûte rien. **JibsEPAULE a gagné le Tour de France 2019 et deux
maillots.** L'exclure des compteurs tout en le montrant dans la frise casse
l'arithmétique : la colonne TDF totalisera 9 victoires pour 10 Tours joués.
Recommandation : le garder partout, en italique, avec la mention d'ancien joueur.

Trois autres questions ouvertes : le rattachement Classic V1 → saison 2026 bloque le
champion 2026 de la frise ; l'onglet par défaut (recommandation : Frise) ; et
lesquelles des six pistes de la fiche joueur entrent en V1 (recommandation : terrains
de prédilection et palmarès personnel).

### 9.7 Amendements (v4 des wireframes, même URL)

- **L'onglet « Frise » est renommé « Saisons ».** Frise décrivait une forme graphique
  abandonnée au passage en cartes. Autres candidats écartés : Archives, Historique,
  Années.
- **Carte de saison en grille trois colonnes.** Cinq lignes : Saison, Classiques,
  Giro, Tour, Vuelta. Trois colonnes : 1er, 2e, 3e. Seul le vainqueur est en
  primaire, les deux autres en secondaire. La ligne Saison est détachée par un filet
  plus marqué, parce qu'elle est un classement calculé là où les quatre autres sont
  des résultats bruts.
- **Le champion n'est plus répété en gros titre de carte.** Il est dans la ligne
  Saison, colonne 1er. La carte porte seulement l'année. 2026 porte « 2 phases sur
  4 » au lieu de « en cours ».
- **Noms abrégés selon une règle** (« D. Choncoutié », « Muscat R. »), pas tronqués
  à l'ellipse par le CSS.
- **Une épreuve non jouée occupe les trois colonnes** au lieu de laisser trois cases
  vides.
- **Rang de saison** : le chiffre du rang est affiché au-dessus de chaque barre. Une
  hauteur seule ne dit pas si « haut » vaut 2e sur 5 ou 2e sur 10.
- **Face à face en couleur** : vert quand le joueur domine, rouge quand il subit,
  neutre à égalité. Ce sont les deux seules couleurs de tout le palmarès et elles
  portent un sens.

**Clarification importante, souvent reposée** : dans tout le palmarès, **l'XP
n'intervient qu'une seule fois**, pour désigner le champion d'une saison (plus gros
cumul de l'année). Le face à face compare deux rangs d'arrivée. Le graphique de rang
de saison compare des places. Les podiums d'épreuve sont les classements d'origine.
C'est ce qui rend l'ensemble valide entre les deux jeux.

### 9.8 Amendements (v5 des wireframes, même URL) — onglet Saisons validé

- **Le champion reprend le bloc de ligne de Ranking** : emblème équipé à gauche
  (34 px, même composant `AchievementBadge`), nom en gras, bannière en fond atténuée.
  Rien de neuf à dessiner.
- **Les 2e et 3e de la saison passent en sous-titre** du champion
  (« champion · devant D. Choncoutié et Peejee »). **La ligne Saison disparaît de la
  grille**, qui ne garde que les quatre épreuves. Une information, une seule place.
- **L'année reste l'entrée de la carte**, en haut à gauche, avec une mention à droite
  quand il y a quelque chose à dire (« 2 phases sur 4 »).
- **Une saison en cours affiche le joueur en tête**, même bloc, seul le mot change.
  Pas d'état vide en attendant la fin de saison.

**Point à trancher** : les emblèmes n'existent pas pour les saisons La Route du Tour,
un joueur n'avait pas de badge équipé en 2019. Afficher son badge actuel, ou une
initiale en réserve comme le fait déjà l'avatar coureur quand la photo manque.

**État de la spec** : Ranking validé, onglet Saisons validé, onglets Victoires,
Maillots et Joueurs validés en v3/v4. Restent les quatre questions de la section 06
des wireframes, dont la plus structurante est le sort de JibsEPAULE dans les
compteurs.
