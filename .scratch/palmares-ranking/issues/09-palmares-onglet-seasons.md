# 09 — Page Palmares et onglet Seasons

**What to build:** la nouvelle page Palmares apparaît dans la navigation, avec ses
quatre onglets (Seasons, Wins, Jerseys, Players) dont seul le premier est rempli
par ce ticket. Ce ticket porte donc la coquille de la page, la navigation par
onglets, et l'onglet Seasons complet.

L'onglet Seasons affiche une carte par saison, de la plus récente à 2017, non
dépliable. Chaque carte porte l'année en haut à gauche, puis le champion de la
saison présenté **comme une ligne de Ranking** : emblème équipé à gauche, nom en
gras, bannière en fond atténuée. Sous le nom, en sous-titre, les deuxième et
troisième de la saison au format `champion · ahead of X (2nd) and Y (3rd)`.

Sous ce bloc, quatre lignes et trois colonnes : Classics, Giro, Tour de France,
Vuelta en lignes ; 1st, 2nd, 3rd en colonnes. Seul le vainqueur est en primaire,
les deux autres en secondaire. Une épreuve non jouée occupe les trois colonnes
avec « not played », une saison en cours dit « ongoing » et « upcoming ».

Une saison en cours affiche le joueur en tête plutôt qu'un champion, même bloc,
seul le mot change. Une mention à droite de l'année quand il y a quelque chose à
dire, par exemple « 2 of 4 phases ».

Sous la liste des cartes, une seule note explique que le champion est le joueur au
plus gros cumul d'XP de l'année, que les podiums d'épreuve sont les classements
d'origine, et qu'un nom en italique est un ancien joueur.

Aucune valeur d'XP n'est affichée nulle part sur cette page.

**Blocked by:** 01 — Entité saison ; 06 — Import historique ; 07 — Emblèmes vers
les réglages.

**Status:** ready-for-agent

- [ ] La page Palmares existe avec ses quatre onglets, Seasons actif par défaut.
- [ ] Une carte par saison de 2017 à l'année en cours, la plus récente en haut.
- [ ] Le champion est affiché avec son emblème équipé, dans le même composant que
      la ligne de Ranking.
- [ ] Le sous-titre suit exactement le format `champion · ahead of X (2nd) and
      Y (3rd)`.
- [ ] Une saison en cours affiche le leader avec le mot « leading ».
- [ ] Les épreuves non jouées occupent les trois colonnes, sans case vide.
- [ ] Les noms sont abrégés selon une règle explicite, pas tronqués à l'ellipse
      par le CSS.
- [ ] JibsEPAULE apparaît en italique comme vainqueur du Tour de France 2019.
- [ ] Aucun XP affiché, aucun commentaire éditorial, une seule note de règle sous
      la liste.
- [ ] Tout le texte est en anglais.
- [ ] Les emblèmes manquants sur les saisons antérieures à WattHunter tombent sur
      une réserve lisible, et le choix retenu est noté dans le ticket.
