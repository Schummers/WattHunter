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

**Status:** ready-for-agent

- [ ] Le sélecteur d'année est à droite du titre et s'ouvre sur l'année en cours.
- [ ] Choisir une année recharge le classement de cette saison.
- [ ] Le classement d'une saison agrège toutes les ligues de cette saison, par
      joueur, sans doublon.
- [ ] Le contrôle Teams / Riders est désactivé, sans légende, sur toute saison
      dépourvue de donnée coureur.
- [ ] Le contrôle reste pleinement actif sur les saisons WattHunter.
- [ ] Les noms affichés sont ceux des comptes WattHunter.
