# La Route du Tour — classements archivés

Données scrapées depuis [laroutedutour.fr](http://www.laroutedutour.fr/) (jeu fantasy cyclisme comparable) pour analyse/référence dans le cadre de WattHunter. Scrapé le 2026-08-20, compte `Alpaga`.

## Fichier

`rankings.csv` — 231 lignes, une ligne = une équipe dans le classement général final d'un tour archivé. 30 tours (34 scrapés initialement, 4 exclus — voir "Tours exclus" plus bas).

## Dictionnaire de colonnes

| Colonne | Source | Description |
|---|---|---|
| `tour_id` | URL `/viewLeague/{id}` | Identifiant unique du tour sur le site. Sert de clé stable (les noms de tours sont parfois dupliqués). |
| `tour_name` | Nom affiché dans les archives | Nom original/fun donné par le créateur (ex. "Le Giro de Pogi"). |
| `canonical_name` | Dérivé | Nom officiel généré : `{canonical_type} {year}`, désambiguïsé si collision (voir plus bas). Vide si l'année n'a pas pu être déterminée. |
| `canonical_type` | Dérivé du "type de course" brut | Normalisé : `Vuelta`/`La Vuelta`→**Vuelta**, `Giro`/`Giro d'italia`→**Giro**, `Critérium du dauphiné`/`Critérium du Dauphiné`→**Critérium du Dauphiné**, `Tour de France`/`Classiques`/`Paris - Nice`→inchangés (Paris-Nice sans espaces autour du tiret). |
| `year` | Première date d'étape trouvée sur `/viewLeague/{id}` | Année de la 1ère étape du tour. Vide pour 2 tours (voir Limites). |
| `creator` | "Créé par X" dans les archives | Créateur du tour (pas forcément un participant). |
| `rank` | Colonne `#` du classement | Rang final. |
| `team` | Colonne `Équipe` | Nom d'équipe (change à chaque tour, normal). |
| `user` | Colonne `Utilisateur` | Joueur. |
| `bonus` | Icône ⬆⬆ | Points bonus. |
| `combative` | Icône carré | Prix de la combativité. |
| `mountain` | Icône sommet | Points grimpeurs/sommets. |
| `intermediate_sprint` | Icône drapeau | Sprints intermédiaires. |
| `stage_finish` | Icône trophée | Points arrivée d'étape. |
| `stage_total` | Colonne "Étape" | = combative+mountain+intermediate_sprint+stage_finish (bonus exclu — vérifié). |
| `gc_points` | Icône maillot jaune | Classement général (maillot jaune). |
| `young_rider` | Icône maillot blanc | Meilleur jeune. |
| `sprinter` | Icône maillot vert | Meilleur sprinteur. |
| `climber` | Icône maillot à pois | Meilleur grimpeur. |
| `general_total` | Colonne "Géneral" | = gc_points+young_rider+sprinter+climber. Vaut 0 pour les Classiques (pas de maillot cumulatif sur des courses d'un jour indépendantes — normal, pas une donnée manquante). |
| `total` | Colonne "Total" | = stage_total + general_total. Vérifié sans écart sur les 231 lignes. |

## Règle de désambiguïsation `canonical_name`

1. `{canonical_type} {year}` si unique.
2. Sinon, `+ (creator)` si ça suffit à distinguer.
3. Sinon (même type+année+créateur, ex. deux tours "Vuelta" créés par la même personne la même année), `+ [id{tour_id}]`.

Après exclusions (voir plus bas), aucune collision ne subsiste dans le jeu de données actuel — la règle 2/3 reste documentée au cas où un futur re-scrape en réintroduit une.

## Tours exclus

Décision utilisateur (2026-08-20), après revue de tous les tours candidats :

| Tour | tour_id | Raison |
|---|---|---|
| `La vuelta V2` | 3370 | 3 des 4 joueurs (`Thomasprs`, `H_57`, `AntoineF`) n'apparaissent dans aucun autre tour des 34 scrapés — groupe différent du crew régulier (11 joueurs récurrents), seul `Alpaga` est commun. |
| `Bob 2017` | 786 | Seulement 2 équipes, le minimum du dataset (la norme est 6-9). Tour probablement avorté/incomplet. |
| `Classic Haribo avec les Springboks` | 2543 | Confirmé par l'utilisateur : tour resté en phase d'enchères, jamais commencé (colonnes à 0, pas d'année). |
| `Giroud d'Italia` | 842 | Idem : resté en phase d'enchères, jamais commencé. |

**Tours signalés mais gardés** : `Le Chouffe Tour` (1264) et `Le Tour de Chouffe` (900) — confirmé par l'utilisateur, ce sont de vrais tours joués jusqu'au bout. Les 2 joueurs one-off (`JibsEPAULE`, `JoeDills`, présents uniquement dans ces deux tours 2018-2019) ont simplement arrêté de jouer avant que le crew actuel se stabilise à 11 joueurs réguliers — pas un problème de donnée.

## Limites connues

- **`kli_max` et `Klimax`** (colonnes `creator`/`user`) sont la même personne, confirmé par l'utilisateur (2026-08-20). Gardé tel quel en donnée brute (fidélité à la source) plutôt que fusionné — à normaliser au moment de l'analyse si besoin.
- **`Sandy Chazar` et `David Choncoutié`** sont aussi la même personne, confirmé par l'utilisateur (2026-08-20). Vérifié : aucun tour où les deux apparaissent comme participants distincts (pas de contradiction). Même traitement que `kli_max`/`Klimax` : gardé brut, à fusionner à l'analyse.
- **Mapping joueurs LRDT → comptes WattHunter** (`public.users.display_name`, confirmé/vérifié 2026-08-20) : Alpaga→Jonathan Schummers, Benny Lee→Dixon Hormous, Marseillais→Muscat Romain, PeeJee→Peejee, Marino→Marino Alex, kli_max/Klimax→Klimax, bigdaddy→bigdaddy, David Choncoutié/Sandy Chazar→David Choncoutié, Patron→TheAussieMate. Seul `Fangio` (3/30 tours) reste sans compte WattHunter identifié.
- Colonnes `bonus`/`combative` : peu fiables si vous changez de méthode d'extraction — l'arbre d'accessibilité du navigateur les fait disparaître (bug responsive DataTables côté site), l'extraction ici est faite sur le DOM/HTML brut donc correcte.
- Pas de granularité par étape : seulement le classement final de chaque tour (`Classement général` / vue "Général", pas "Général individuel" ni étape par étape).
