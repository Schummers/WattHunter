# WattHunter — Beta Economy Design

> Validé le 2026-03-05. Source de vérité pour les mécaniques économiques de la beta.

## Vue d'ensemble

Deux mécaniques de jeu pour la beta :
1. **Salaire minimum des coureurs** — basé sur les points PCS glissants 1 an
2. **Économie du jeu** — sponsor fixe + revenus des coureurs (bonus seulement positif)

### Objectif stratégique

Créer **deux stratégies viables** :
- **Stars** : coureurs chers, beaucoup de points XP → monte vite en niveau
- **Pépites** : coureurs pas chers, peu de points mais bon ratio → plus d'argent pour les prochaines enchères

---

## 1. Salaire minimum (= prix plancher d'enchère)

Le salaire minimum d'un coureur définit la **mise minimale** aux enchères. Ce n'est PAS le salaire mensuel payé — c'est juste le plancher.

### Formule

```
salaire_min = clamp(
  (pcs_points_1yr / 1000) × 500 000 / 12,
  plancher = 5 000,
  plafond  = 300 000
)
```

### Source de données

- `pcs_points_1yr` : points PCS glissants sur 365 jours (colonne `riders.pcs_points_1yr`)
- Disponible pour les 294 riders en base
- Mis à jour à chaque sync PCS (`run_pipeline.py post-race`)

### Exemples (données réelles)

| Coureur | pcs_points_1yr | Salaire min (= enchère min) |
|---|---:|---:|
| Pidcock | 1 770 | 73 750€ |
| De Lie | 1 560 | 65 000€ |
| Coureur moyen (530 pts) | 530 | 22 083€ |
| Coureur sans résultats | 0 | 5 000€ (plancher) |

---

## 2. Enchère = Salaire mensuel

**Changement majeur vs les règles actuelles :**

Le prix d'enchère gagnant **devient le salaire mensuel récurrent** du coureur.

| Avant (GAME_RULES.md) | Beta (nouveau) |
|---|---|
| Enchère = coût one-shot (purchase_price) | Enchère = salaire mensuel récurrent |
| Salaire = formule PCS (verrouillé) | Salaire = prix d'enchère gagnant |
| Deux colonnes : purchase_price + contract_salary | Une seule colonne : contract_salary = enchère |

### Implications

- Plus tu surenchéris, plus le coureur te coûte **chaque mois**
- Impossible d'enchérir au-delà du cash disponible
- Les stars sont naturellement plus chères (salaire min élevé + surenchère entre joueurs)
- Les pépites restent bon marché (peu de compétition)

---

## 3. Sponsor par défaut

| Constante | Valeur |
|---|---|
| Montant | 300 000€/mois |
| Fréquence | 1er de chaque mois |
| Conditions | Aucune (inconditionnel) |
| Disponibilité | Aussi actualisé avant chaque enchère |

Le système de sponsors par tiers (Tier 1-5 dans GAME_RULES.md) est **désactivé** pour la beta. Il sera réintroduit post-beta.

---

## 4. Revenus des coureurs (bonus seulement positif)

### Formule

```
bonus_coureur = max(0, points_PCS_du_mois × 500 − salaire_enchère)
```

- **Pas de négatif** : si un coureur sous-performe, il ne coûte "que" son salaire
- **500€/point PCS** : taux de conversion fixe
- Le bonus est calculé **par coureur, par mois**

### Pourquoi "seulement positif" ?

- Simplifie la compréhension : "tes coureurs peuvent te rapporter de l'argent, jamais t'en faire perdre (au-delà du salaire)"
- Les malus sont implicites : un coureur qui ne génère pas de bonus te coûte quand même son salaire
- Récompense les pépites : un coureur à 5K€/mois qui fait 30 pts = +10K€ bonus. Un star à 150K€ qui fait 200 pts = 0€ bonus.

### Exemples avec vrais points de Pidcock (début saison 2026)

| Mois | Pts PCS | Revenu (×500€) | Salaire enchéri | Bonus |
|---|---:|---:|---:|---:|
| Février (Vuelta Andalucia) | 128 | 64 000€ | 150 000€ | **0€** |
| Mars (Strade Bianche + Tirreno) | 340 | 170 000€ | 150 000€ | **+20 000€** |
| Avril (Ardennaises) | 236 | 118 000€ | 150 000€ | **0€** |

Pidcock à 150K€ ne génère un bonus que lors de son **meilleur mois** (mars).

---

## 5. Budget mensuel

```
Budget du mois =
  + 300 000€             (sponsor par défaut)
  − Σ salaires_enchère   (de tous les coureurs sous contrat)
  + Σ bonus_coureur      (seulement positif, par coureur)
```

### Simulation : Stars vs Pépites (3 mois)

**Joueur Stars** (3 coureurs : Pidcock 150K, De Lie 120K, Scaroni 90K) :
- Salaires : 360K€/mois > sponsor 300K€ → déficit structurel de -60K€/mois
- Bonus rares : +20K€ sur 3 mois
- **XP : ~1 300 pts** | **Cash après 3 mois : ~140K€**

**Joueur Pépites** (6 coureurs : ~15K-40K chacun) :
- Salaires : 101K€/mois < sponsor 300K€ → marge de +199K€/mois
- Quelques bonus : +14K€ sur 3 mois
- **XP : ~345 pts** | **Cash après 3 mois : ~909K€**

→ Stars = 4× plus de points, Pépites = 6× plus de cash.

---

## 6. Faillite

### Libération manuelle
- Le joueur peut libérer un coureur à tout moment
- **Préavis de 1 mois** : le coureur continue à coûter son salaire pendant 1 mois
- Le slot est libéré immédiatement
- Le coureur retourne au pool après le préavis

### Libération automatique (faillite)
- **Déclencheur** : 1 mois de trésorerie négative (déficit)
- **Ordre** : le coureur avec le **plus de points XP générés** est libéré en premier
- **Cascade** : on libère un par un jusqu'à retour à l'équilibre (trésorerie ≥ 0)
- **Pas de préavis** : libération immédiate
- Le coureur retourne au pool et sera disponible à la prochaine enchère

### Pourquoi libérer le meilleur scoreur ?

C'est punitif par design. Si on libérait le plus cher (salaire), le joueur en faillite garderait ses meilleurs assets tout en réduisant ses coûts — ce qui irait dans son sens. Libérer le meilleur scoreur force le joueur à bien gérer son budget sous peine de perdre ses atouts les plus précieux.

---

## 7. Constantes beta (résumé)

| Constante | Valeur | Notes |
|---|---|---|
| Trésorerie de départ | 300 000€ | Changé de 500K → 300K |
| Sponsor par défaut | 300 000€/mois | Nouveau — remplace le système de tiers |
| Taux de conversion | 500€/point PCS | Pour le calcul des bonus |
| Salaire plancher (= enchère min) | 5 000€/mois | Inchangé |
| Salaire plafond (= enchère min max) | 300 000€/mois | Inchangé |
| Formule salaire min | (pcs_points_1yr / 1000) × 500 000 / 12 | Inchangé |
| Enchère = salaire mensuel | Oui | NOUVEAU — changement majeur |
| Bonus = seulement positif | Oui | NOUVEAU |
| Faillite : libérer meilleur scoreur | Oui | Changé (était : salaire le plus élevé) |

---

## 8. Changements vs documentation existante

| Document | Section | Changement |
|---|---|---|
| GAME_RULES.md §4.1 | Trésorerie de départ | 500K → 300K |
| GAME_RULES.md §4.2 | Entrées | Ajouter sponsor par défaut 300K/mois |
| GAME_RULES.md §4.4 | Formule de salaire | Clarifier : salaire min = enchère min, pas salaire mensuel |
| GAME_RULES.md §4.5 | Rentabilité | Remplacer par bonus = max(0, pts×500 - enchère) |
| GAME_RULES.md §4.6 | Faillite | Libérer meilleur scoreur (pas salaire le plus élevé) |
| GAME_RULES.md §5 | Enchères | Enchère = salaire mensuel (pas one-shot) |
| GAME_RULES.md §6 | Contrats | Supprimer purchase_price, contract_salary = enchère |
| GAME_RULES.md §9 | Sponsors | Désactiver tiers, sponsor par défaut 300K |
| CLAUDE.md | Constantes | Trésorerie 300K, sponsor 300K |
| ARCHITECTURE.md | Pipeline | Ajouter calcul bonus mensuel |

---

## 9. TODO post-beta

- [ ] Corriger les données PCS riders fausses (task #7)
- [ ] Investiguer bug données 2024/2025 identiques dans rider_season_rankings
- [ ] Réintroduire le système de sponsors par tiers
- [ ] Ajouter les points négatifs (malus) si les joueurs veulent plus de challenge
- [ ] Calibrer les constantes après retour des premiers joueurs beta
