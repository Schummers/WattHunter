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

**Status:** done

- [x] La page Palmares existe avec ses quatre onglets, Seasons actif par défaut.
- [x] Une carte par saison de 2017 à l'année en cours, la plus récente en haut.
- [x] Le champion est affiché avec son emblème équipé, dans le même composant que
      la ligne de Ranking.
- [x] Le sous-titre suit exactement le format `champion · ahead of X (2nd) and
      Y (3rd)`.
- [x] Une saison en cours affiche le leader avec le mot « leading ».
- [x] Les épreuves non jouées occupent les trois colonnes, sans case vide.
- [x] Les noms sont abrégés selon une règle explicite, pas tronqués à l'ellipse
      par le CSS.
- [x] JibsEPAULE apparaît en italique comme vainqueur du Tour de France 2019.
- [x] Aucun XP affiché, aucun commentaire éditorial, une seule note de règle sous
      la liste.
- [x] Tout le texte est en anglais.
- [x] Les emblèmes manquants sur les saisons antérieures à WattHunter tombent sur
      une réserve lisible, et le choix retenu est noté dans le ticket.

## Livré — 2026-09-14

Route `/league/[leagueId]/palmares`, entrée remise dans la sidebar et la bottom
nav. La page est **cross-ligue et cross-saison par nature** : elle vit sous une
route de ligue pour garder le layout du jeu et sa place dans la navigation, mais
rien de son contenu n'est scopé à `leagueId`.

Underline tabs (`ui/tabs.tsx` variant `line`, pattern du design system), Seasons
actif par défaut.

### Le modèle de données est le vrai travail

Les deux ères produisent **la même forme** : `PalmaresEvent[]` + `SeasonStanding[]`
(`lib/palmares/types.ts`). L'archive La Route du Tour et la saison WattHunter
entrent par deux loaders distincts et ressortent identiques, ce qui fait que les
quatre onglets ne savent rien de la frontière entre les deux jeux.

Clé de joueur = le **nom du compte WattHunter**, jamais l'équipe (un nom d'équipe
change à chaque saison) et jamais le pseudo d'origine. C'est le seul pont
disponible entre une archive close et la base vivante. Fragilité connue et
assumée : renommer un compte scinderait l'historique du joueur en deux.

### Emblèmes des saisons pré-WattHunter — choix retenu

**Les initiales, pas le badge actuel.** Personne n'avait de badge équipé en 2019 ;
afficher celui d'aujourd'hui sur une carte 2019 affirmerait quelque chose de faux.
La réserve est le carré d'initiales, exactement ce que fait déjà l'avatar coureur
quand la photo manque. `SeasonStanding.source` (`watthunter` | `archive`) porte la
distinction, plutôt qu'une comparaison d'années qui vieillirait mal.

### Abréviation des noms

Règle explicite dans `lib/palmares/format.ts`, jamais une troncature CSS : une
colonne qui coupe à sa propre largeur produit un nom différent à chaque taille
d'écran. Deux formes, moyenne (`D. Choncoutié`) et courte (`D. Chonco.`).

Écart assumé avec le wireframe : il écrit `Muscat R.` (initiale du **second** mot)
et `D. Choncoutié` (initiale du **premier**). Rien dans un nom d'affichage ne dit
quelle moitié est le prénom, donc la règle initialise toujours le premier mot :
`M. Romain`. Prévisible plutôt que joli.
