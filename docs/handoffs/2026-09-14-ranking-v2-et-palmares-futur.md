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
