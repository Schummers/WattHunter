# 10 — Palmares : onglet Wins

**What to build:** l'onglet Wins compte les victoires d'épreuve du groupe sur tout
l'historique. Deux blocs sur le même écran.

En haut, un tableau par joueur avec **les victoires à l'extrême droite, en
primaire**, et les deuxièmes et troisièmes places à leur gauche, en secondaire,
sous leurs en-têtes 3rd, 2nd, 1st. Le nombre de départs figure en sous-titre du
nom : c'est ce qui rend l'absence de seuil honnête sans avoir à l'expliquer.

En dessous, le tableau croisé joueur par épreuve : combien de Classics, de Giro,
de Tours et de Vueltas chacun a gagnés, avec un point pour zéro.

Aucune moyenne, aucun seuil de participation, aucun commentaire éditorial. Une
seule note sous les tableaux rappelle qu'une victoire est un rang 1 sur une
épreuve, que les courses d'une semaine ne comptent pas, et que le titre de saison
n'est pas une victoire.

**JibsEPAULE figure dans les deux tableaux, en italique**, avec la mention
d'ancien joueur : il a gagné le Tour de France 2019, l'exclure donnerait neuf
victoires listées pour dix Tours joués.

**Blocked by:** 09 — Page Palmares et onglet Seasons.

**Status:** done

- [x] Colonnes dans l'ordre joueur, 3rd, 2nd, 1st, la dernière en primaire.
- [x] Le nombre de départs est en sous-titre du nom.
- [x] Le tableau croisé couvre les quatre épreuves, avec un point pour zéro.
- [x] JibsEPAULE apparaît dans les deux tableaux, en italique.
- [x] Le total des victoires par épreuve égale le nombre d'épreuves jouées de ce
      type, vérifié sur les quatre colonnes.
- [x] Les titres de saison n'apparaissent pas sur cet onglet.
- [x] Une seule note de règle, sous les tableaux, aucun commentaire éditorial.
- [x] Tout le texte est en anglais.

## Livré — 2026-09-14

Colonnes `Player · 3rd · 2nd · 1st`, les victoires à l'extrême droite en primaire.
Départs en sous-titre du nom. Tableau croisé par épreuve avec `·` pour zéro.
JibsEPAULE figure dans les deux tableaux, en italique, avec la mention
`former player`.

Le garde-fou est vérifié **au niveau des données**, pas seulement de l'écran :
victoires par épreuve = épreuves jouées de ce type. classics 5/5, giro 6/6,
tour-de-france 7/7, vuelta 6/6. C'est la victoire de JibsEPAULE sur le Tour 2019
qui fait tomber la colonne TDF juste ; sans lui, 6 victoires pour 7 Tours.
