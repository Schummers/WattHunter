# 12 — Palmares : onglet Players

**What to build:** la fiche d'un joueur, relative plutôt qu'absolue, avec un
sélecteur en haut qui permet de regarder celle de n'importe qui. Trois blocs.

**Les chiffres de carrière** : départs, saisons jouées, victoires, titres de
saison, podiums et maillots.

**Le rang de chaque saison** : un histogramme, une barre par année, dont la
hauteur est la place au classement de l'année rapportée au nombre de joueurs.
**Le chiffre du rang est écrit au-dessus de chaque barre**, sans quoi une hauteur
seule ne dit pas si « haut » vaut 2e sur 5 ou 2e sur 10. Jamais un score : le
barème a changé plusieurs fois, seules les places se comparent d'une année à
l'autre.

**Le face à face** : une ligne par adversaire, avec le nom, une barre remplie
jusqu'à la part d'épreuves où le joueur a fini devant, et le score. Vert quand il
domine, rouge quand il subit, neutre à égalité ; ce sont les deux seules couleurs
de tout le palmarès et elles portent un sens. La liste est triée du plus
favorable au moins favorable, avec un repère d'égalité au milieu.

Le face à face ne compte que les épreuves disputées par les deux joueurs : c'est
la seule statistique où jouer plus ne donne aucun avantage. La règle s'écrit sous
le bloc, avec un exemple chiffré.

Rien sur cet onglet n'est calculé sur l'XP : on compare des rangs d'arrivée et des
places au classement.

**Blocked by:** 09 — Page Palmares et onglet Seasons.

**Status:** ready-for-agent

- [ ] Un sélecteur de joueur en haut permet d'ouvrir la fiche de n'importe qui.
- [ ] Les six chiffres de carrière sont affichés.
- [ ] L'histogramme porte le rang en chiffre au-dessus de chaque barre et l'année
      en dessous.
- [ ] Le face à face est trié, coloré vert et rouge, avec un repère d'égalité.
- [ ] Le face à face ne compte que les épreuves communes aux deux joueurs,
      vérifié : 24 épreuves communes contre Dixon Hormous, 22 contre David
      Choncoutié.
- [ ] Deux notes de règle, sous l'histogramme et sous le face à face, avec un
      exemple chiffré pour le face à face.
- [ ] Aucune valeur d'XP n'apparaît.
- [ ] Tout le texte est en anglais.

## Comments

Six pistes supplémentaires ont été explorées pour cette fiche et écartées de la
première version : terrains de prédilection (rang moyen par type d'épreuve),
palmarès personnel, la disette entre deux victoires, le meilleur jour, la
collection des quatre épreuves, et la liste des noms d'équipe portés au fil des
ans. Recommandation retenue : terrains de prédilection et palmarès personnel en
priorité si l'onglet doit s'étoffer, le reste sont des plaisirs plutôt que des
informations. Détail dans les wireframes, section 06.
