# 11 — Palmares : onglet Jerseys

**What to build:** l'onglet Jerseys compte les titres de maillot du groupe. Un
tableau par joueur, une colonne par maillot (YEL, GRN, POL, WHT) plus un total.

Un titre de maillot va à l'équipe qui **cumule le plus de points de la catégorie**
sur un grand tour, pas à celle qui possède le coureur classé premier. C'est la
statistique la moins intuitive du lot : la règle s'écrit **sous** le tableau, où
elle se lit une fois qu'on sait de quoi elle parle, et pas au-dessus, où elle
repoussait la donnée hors de l'écran.

Les Classiques n'en distribuent aucun : une course d'un jour n'a pas de maillot.
Seuls les grands tours comptent, 19 des 24 épreuves d'historique.

Aucun commentaire éditorial : le tableau dit déjà que Marino Alex n'a jamais pris
le jaune et détient six blancs.

**Blocked by:** 09 — Page Palmares et onglet Seasons ; 08 — Décomposition de l'XP
par catégorie.

**Status:** ready-for-agent

- [ ] Un tableau joueur par maillot, quatre colonnes plus un total.
- [ ] Seuls les grands tours sont comptés, les classiques n'apparaissent pas.
- [ ] La règle de calcul est écrite sous le tableau, en une note.
- [ ] Les valeurs concordent avec `research/laroutedutour/palmares_stats.py` pour
      la partie historique : 15 maillots pour Peejee, 14 pour Klimax, 6 blancs
      pour Marino Alex.
- [ ] Les maillots des saisons WattHunter viennent des catégories séparées du
      ticket 08, pas du champ fusionné.
- [ ] Aucun commentaire éditorial.
- [ ] Tout le texte est en anglais.
