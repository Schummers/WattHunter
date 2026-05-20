# WattHunter — Achievements PALMARÈS (brainstorm)

> Catégorie 1/4. Document de travail — sélection à faire avant finalisation.
> Types : **Statique** (permanent une fois obtenu) · **Season Trophy** (dynamique pendant saison, permanent à la clôture) · **Live Record** (dynamique en temps réel, peut être perdu) · **Shame** (auto-équipé 14 jours, badge honte)
> DB : ✅ faisable · ⚠️ nécessite mise à jour pipeline · ❌ pas faisable actuellement

## Décisions techniques validées (2026-05-10)

| Décision | Choix | Raison |
|---|---|---|
| **Structure visuelle** | Badge + Banner = un set équipable | Cohérence identité, modèle Fortnite outfit+backbling |
| **Shame override** | Auto-équipé 14 jours, puis retour au set précédent | Mécanique pénalité légère |
| **Format badge** | Image générée clippée en cercle CSS | Plus premium que SVG codé |
| **Format banner** | Image générée + gradient overlay CSS + texte | WebP background + typography overlay |
| **Modèle badges** | `nano_banana_2` — Nano Banana Pro (2 crédits) | Meilleur détail 3D, rim light prononcé, profondeur supérieure à NB2 (1.5 cr) et FLUX.2 |
| **Modèle banners** | `flux_2` — FLUX.2 (1 crédit) | On voit les coureurs — Seedream V5 Lite produisait trop de paysages sans cyclistes visibles |
| **Style badge** | Objet 3D réaliste sur fond noir | Identité unique par course, premium |
| **Style banner** | Documentary sport — coureurs en course visibles | Gritty, authentique, prompt à affiner par course pour maximiser la présence des cyclistes |

---

## Groupe 1 — Monuments individuels

Un set par monument × 2 variantes (victoire / podium) = 10 sets.

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **L'Enfer du Nord** | Un coureur de ton équipe gagne Paris-Roubaix | Statique | ✅ | Hexagone doré + pavé | Gris ardoise + texture pavés |
| **Rescapé du Nord** | Top 3 Paris-Roubaix | Statique | ✅ | Hexagone argent + pavé | Gris ardoise + pavés, teinte froide |
| **Patron des Flandres** | Victoire Tour des Flandres | Statique | ✅ | Lion belge doré | Vert collines flamandes |
| **Soldat des Flandres** | Top 3 Tour des Flandres | Statique | ✅ | Lion argent | Vert + brume flamande |
| **La Doyenne** | Victoire Liège-Bastogne-Liège | Statique | ✅ | Couronne + fleur de printemps | Rose/mauve dégradé fleuri |
| **Dame de Bronze** | Top 3 Liège-Bastogne-Liège | Statique | ✅ | Fleur argent | Rose/mauve froid |
| **Il Diavolo** | Victoire Il Lombardia | Statique | ✅ | Feuille d'automne dorée | Orange/rouge feuilles d'automne |
| **L'Ombre de Côme** | Top 3 Il Lombardia | Statique | ✅ | Feuille argent | Orange automne tamisé |
| **Primavera** | Victoire Milan-San Remo | Statique | ✅ | Soleil méditerranéen doré | Bleu mer + lumière chaude |
| **Riviera** | Top 3 Milan-San Remo | Statique | ✅ | Soleil argent | Bleu méditerranée + brume |

> **Requête DB** : `race_results` WHERE `race_class = 'monument'` AND `race_slug LIKE '%[monument]%'` AND `rank <= 1` (victoire) ou `rank <= 3` (podium), jointure `contracts` pour identifier le team owner.

---

## Groupe 2 — Monuments & Classiques combinés + Rankings

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **Le Chasseur** | Top 5 sur 3 monuments différents en une saison | Statique | ✅ | 3 étoiles + route | Dégradé terre/gris, 3 symboles |
| **Le Collectionneur** | Au moins un top 10 sur chacun des 5 monuments en une saison | Statique | ✅ | 5 étoiles en couronne | Noir + 5 icônes monuments |
| **Le Double** | Victoires sur 2 monuments distincts (carrière) | Statique | ✅ | 2 trophées croisés | Or double gradient |
| **Monument Man [YYYY]** | Meilleur total XP bruts (`raw_pcs_points`) sur les 5 monuments — 1 gagnant/saison | Season Trophy | ✅ | Couronne dorée + 5 étoiles | Noir royal + couronne en surimpression |
| **Classique King [YYYY]** | Meilleur total XP bruts sur toutes les courses `one_day` + `classic` en saison | Season Trophy | ✅ | Trophée doré + route | Or + silhouette peloton |
| **Week Race King [YYYY]** | Meilleur total XP bruts sur toutes les `stage_race` en saison | Season Trophy | ✅ | Trophée doré + calendrier | Vert/or + étapes |
| **Le Figurant des Classiques** | Dernier XP bruts sur les 5 monuments à la clôture de saison | Shame | ✅ | Tortue sur vélo rouillé | Gris terne + route vide |

> **Requête DB** : `rider_xp_daily` JOIN `race_results` ON `race_slug`, filtré par `race_class IN ('monument', 'classic', 'one_day', 'stage_race')`, groupé par `team_id`, SUM(`raw_pcs_points`). Season Trophy : calculé à `league.status = 'completed'` ou à chaque fin de course (live).

---

## Groupe 3 — Grands Tours GC individuels

Un set par GT × 2 variantes (victoire GC / podium GC) = 6 sets.

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **Maillot Jaune** | Un coureur gagne le TdF GC | Statique | ✅ | Cercle jaune + Tour Eiffel | Or/jaune gradient |
| **Le Podium de Paris** | Top 3 TdF GC | Statique | ✅ | Cercle jaune pâle | Jaune froid + Champs-Élysées |
| **Maglia Rosa** | Victoire Giro GC | Statique | ✅ | Cercle rose + Dolomites | Rose vif gradient |
| **Il Podio di Roma** | Top 3 Giro GC | Statique | ✅ | Cercle rose pâle | Rose doux + Colisée |
| **Camisa Roja** | Victoire Vuelta GC | Statique | ✅ | Cercle rouge + soleil espagnol | Rouge/orange ibérique |
| **El Podio de Madrid** | Top 3 Vuelta GC | Statique | ✅ | Cercle rouge pâle | Rouge tamisé + architecture |

> **Requête DB** : `race_results` WHERE `race_class = 'grand_tour'` AND `race_slug LIKE '%/gc'` AND `rank <= 1` (victoire) ou `rank <= 3` (podium).

---

## Groupe 4 — Maillots spéciaux GTs

⚠️ Ces 6 badges nécessitent que le pipeline scrape les classements grimpeur/points séparément du GC. À valider avant de les inclure.

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **Roi de la Montagne** | Victoire classement grimpeur TdF | Statique | ⚠️ pipeline | Montagne rouge + pointillés | Rouge/blanc montagneux |
| **Maglia Azzurra** | Victoire classement grimpeur Giro | Statique | ⚠️ pipeline | Montagne bleue | Bleu azur + pic alpin |
| **Lunares Rojos** | Victoire classement grimpeur Vuelta | Statique | ⚠️ pipeline | Point rouge + montagne | Rouge à pois + Espagne |
| **Maillot Vert** | Victoire classement points TdF | Statique | ⚠️ pipeline | Cercle vert + éclair sprint | Vert électrique |
| **Maglia Ciclamino** | Victoire classement points Giro | Statique | ⚠️ pipeline | Cyclamen + éclair | Violet cyclamen |
| **Maillot Verde Vuelta** | Victoire classement points Vuelta | Statique | ⚠️ pipeline | Vert espagnol + élan | Vert chaud |

> **TODO pipeline** : scraper `race/[gt]/[year]/points` et `race/[gt]/[year]/kom` comme des race_results dédiés.

---

## Groupe 5 — Grands Tours combinés + Rankings

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **Triple Couronne** | Top 5 GC sur les 3 GTs la même saison | Statique | ✅ | 3 couronnes imbriquées | Tricolore jaune/rose/rouge |
| **Le Grand Podium** | Top 3 GC sur les 3 GTs la même saison | Statique | ✅ | Podium triple | Gradient triple GT |
| **Les Trois Cimes** | Victoire GC sur les 3 GTs (carrière, saisons différentes ok) | Statique | ✅ | 3 sommets dorés | Panorama montagne épique |
| **Vert Partout** | Gagner les 3 classements points la même saison | Statique | ⚠️ pipeline | 3 cercles verts | Vert cascade |
| **Rouge Partout** | Gagner les 3 classements grimpeur la même saison | Statique | ⚠️ pipeline | 3 montagnes | Rouge montagne triple |
| **GT King [YYYY]** | Meilleur total XP bruts sur les 3 GTs combinés en saison | Season Trophy | ✅ | Couronne + 3 étoiles GT | Noir prestige + initiales GT |
| **Le Touriste** | Dernier XP bruts sur les 3 GTs à la clôture de saison | Shame | ✅ | Touriste avec appareil photo | Carte postale kitsch |

> **Requête DB** : `race_results` WHERE `race_class = 'grand_tour'`, SUM(`raw_pcs_points`) par `team_id` sur la saison. Triple Couronne/Grand Podium : vérifier que les 3 GC slugs (`/gc`) sont tous couverts.

---

## Groupe 6 — Chasse aux étapes

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **L'Étapier** | 3 victoires d'étapes dans un seul GT (`rank = 1`, même GT, `stage IS NOT NULL`) | Statique | ✅ | 3 drapeaux + route | Dégradé route + ligne d'arrivée |
| **Le Dominateur** | 5 victoires d'étapes dans un seul GT | Statique | ✅ | 5 drapeaux en éventail | Route dominée, gradient fort |
| **Le Chasseur d'Étapes** | 10 victoires d'étapes combinées sur les 3 GTs (carrière) | Statique | ✅ | Carquois + 10 flèches | Noir + explosion confetti |
| **La Légende des Étapes** | 15 victoires d'étapes combinées sur les 3 GTs (carrière) | Statique | ✅ | Couronne + 15 étoiles | Or/noir légendaire |
| **Le Roi des Étapes** | Plus grand nombre de victoires d'étapes GT dans la ligue (record en cours) | Live Record | ✅ | Sceptre + drapeau | Fond vif + compteur |

> **Requête DB** : `race_results` WHERE `race_class = 'grand_tour'` AND `stage IS NOT NULL` AND `stage NOT LIKE '%gc'` AND `rank = 1`, COUNT par `team_id`. Pour le Roi des Étapes : MAX COUNT dans la ligue, recalculé à chaque scoring.

---

## Groupe 7 — Podiums & Records tristes

| Nom | Condition | Type | DB | Badge (idée) | Banner (idée) |
|---|---|---|---|---|---|
| **L'Artiste** | 5+ podiums en GT sans aucune victoire GT | Statique | ✅ | Pinceau + podium vide | Peinture abstraite, tons pastel |
| **Le Dauphin des Monuments** | 5+ podiums sur monuments sans aucune victoire monument | Statique | ✅ | Dauphin + pavé argent | Gris froid + éclat argent |
| **Le Dauphin des Tours** | 5+ podiums GC/étapes GT sans aucune victoire GT | Statique | ✅ | Dauphin + maillot argent | Rose/jaune pâle délavé |
| **L'Éternel Second** | 10+ deuxièmes places résultats toutes courses confondues (carrière) | Statique | ✅ | Médaille argent + larme | Argent mat + reflet |
| **L'Éternel Vice des Monuments** | Détenteur du record de fois classé 2ème au ranking XP ligue — monuments | Live Record | ✅ | Podium argent + ombre | Argent + shadow derrière |
| **L'Éternel Vice des Tours** | Même chose pour les GTs | Live Record | ✅ | Podium argent + nuage | Argent + brume |

> **Requête DB** : `rider_xp_daily` groupé par `team_id` / race, RANK() OVER dans la ligue, compter les fois où `rank = 2` par catégorie.

---

## Récapitulatif

| Groupe | Sets | Types |
|---|---|---|
| 1 — Monuments individuels | 10 | Statique |
| 2 — Monuments & Classiques combinés | 7 | Statique + Season Trophy + Shame |
| 3 — Grands Tours GC individuels | 6 | Statique |
| 4 — Maillots spéciaux GTs | 6 | Statique ⚠️ pipeline |
| 5 — Grands Tours combinés | 7 | Statique + Season Trophy + Shame |
| 6 — Chasse aux étapes | 5 | Statique + Live Record |
| 7 — Podiums & Records tristes | 6 | Statique + Live Record |
| **Total** | **47** | |

### Prochaine étape
Sélectionner les sets à garder pour V1 (objectif : 15-20 sets PALMARÈS max).
Ensuite : catégories BUDGET & MARCHÉ, ROSTER, LIGUE & MÉTA.
