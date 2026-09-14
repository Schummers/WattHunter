# Palmarès & Ranking

Refonte de la page Ranking (changements minimes) et création d'une page Palmares
en quatre onglets, fondée sur les rangs et non sur l'XP, couvrant l'historique du
groupe depuis 2017 : neuf saisons jouées sur *La Route du Tour* puis WattHunter.

## Sources

- **Spécification complète** : `docs/handoffs/2026-09-14-ranking-v2-et-palmares-futur.md`
- **Wireframes annotés** : `research/laroutedutour/wireframes/palmares-quatre-onglets.html`
  (publié : https://claude.ai/code/artifact/7e1a0ec3-a196-4705-9ac7-22b4a19464a8)
- **Données historiques** : `research/laroutedutour/rankings.csv`, dictionnaire de
  colonnes et mapping des joueurs dans `research/laroutedutour/README.md`
- **Agrégats de référence** : `research/laroutedutour/palmares_stats.py` et son JSON

## Règles transverses

- **Une victoire** = rang 1 sur une épreuve : Classiques, Giro, Tour de France,
  Vuelta. Les courses d'une semaine sont hors périmètre. 24 épreuves d'historique.
- **Le titre de saison** est un trophée d'une autre nature, jamais additionné aux
  victoires.
- **Un titre de maillot** va à l'équipe qui cumule le plus de points de la
  catégorie sur un grand tour. Les Classiques n'en distribuent aucun.
- **Aucun seuil de participation**, aucune moyenne lissée. On compte les places.
- **L'XP n'intervient qu'une fois** dans tout le palmarès, pour désigner le champion
  d'une saison. Tout le reste compare des rangs, ce qui rend l'ensemble valide
  entre les deux jeux.
- **Noms affichés** : toujours le compte WattHunter, jamais le pseudo La Route du
  Tour. Mapping dans le README de la recherche.
- **Joueurs sans compte** : Fangio et JoeDills sont exclus, ils n'ont jamais rien
  gagné. **JibsEPAULE est conservé partout, affiché en italique**, avec la mention
  d'ancien joueur : il a gagné le Tour de France 2019 et deux maillots, l'exclure
  casserait l'arithmétique des compteurs.
- **Tout le texte visible est en anglais** (règle n°1 du CLAUDE.md projet). Onglets
  Seasons, Wins, Jerseys, Players. Codes d'épreuve CLS, GIR, TDF, VTA. Maillots
  YEL, GRN, POL, WHT.
- **Les règles de calcul s'écrivent sous les tableaux**, jamais au-dessus, et aucun
  commentaire éditorial : un commentaire se périme à chaque saison, une règle non.
- Design system d'abord : `docs/watthunter-design-system-v3.md`. Aucune taille en
  pixels en dur, aucune couleur hexadécimale.
