# 05 — Ranking : sélecteur d'année

**What to build:** un sélecteur d'année apparaît à droite du titre Ranking. Il
s'ouvre sur l'année en cours et permet de remonter les saisons passées. Choisir
une année affiche le classement de cette saison, toutes ligues de la saison
agrégées par joueur.

Sur une saison antérieure à l'arrivée de WattHunter, il n'existe aucune donnée
coureur : le segmented control Teams / Riders est alors **désactivé**, sans
légende ni phrase d'explication. Le masquer ferait sauter la mise en page d'une
année à l'autre ; grisé, il se suffit.

**Blocked by:** 01 — Entité saison et rattachement des ligues.

**Status:** done

- [x] Le sélecteur d'année est à droite du titre et s'ouvre sur l'année en cours.
- [x] Choisir une année recharge le classement de cette saison.
- [x] Le classement d'une saison agrège toutes les ligues de cette saison, par
      joueur, sans doublon.
- [x] Le contrôle Teams / Riders est désactivé, sans légende, sur toute saison
      dépourvue de donnée coureur.
- [x] Le contrôle reste pleinement actif sur les saisons WattHunter.
- [x] Les noms affichés sont ceux des comptes WattHunter.

## Livré — 2026-09-14

Sélecteur d'année à droite du titre Ranking, ouvert sur l'année en cours. Il
n'apparaît que s'il y a plus d'une saison à proposer.

Contrôle Teams / Riders **désactivé, pas masqué**, sur une saison antérieure à
WattHunter : masquer ferait sauter la mise en page d'une année à l'autre. Grisé,
il se suffit, sans légende.

### Interprétation retenue, à valider

Le ticket dit « choisir une année affiche le classement de cette saison, toutes
ligues agrégées par joueur ». Appliqué littéralement à l'année en cours, cela
remplacerait la vue par équipe de la ligue, ce que personne n'a demandé.

Retenu : **l'année en cours garde la vue actuelle** (équipes de la ligue, quatre
groupes d'épreuve, onglet coureurs actif), **les années passées affichent le
classement de saison par joueur**. C'est la seule lecture qui n'enlève rien.

L'agrégation par joueur toutes ligues confondues existe bien et est testée
(`season_player_xp`, ticket 01, et `loadCurrentSeason` pour le palmarès) : c'est
elle qui alimente le champion de saison 2026 à partir des deux ligues classic.
