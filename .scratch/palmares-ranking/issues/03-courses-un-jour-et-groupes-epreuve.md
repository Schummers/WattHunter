# 03 — Quatre groupes d'épreuve dans Ranking, et une source de vérité des courses d'un jour

**What to build:** le sélecteur de course de Ranking ne liste plus les courses une
à une. Il propose « All races » par défaut, puis quatre entrées seulement :
Classics, Giro, Tour de France, Vuelta. Choisir Classics agrège **toutes les
courses d'un jour de l'année** en un seul classement.

Ce ticket introduit aussi le helper partagé qui dit si une course est une course
d'un jour ou une course par étapes. Sa source de vérité est le champ `type` du
calendrier World Tour, pas une liste de slugs recopiée à la main, et surtout pas
`race_results.stage IS NULL` (le classement général d'une course d'une semaine
peut arriver sans étape et serait compté comme une course d'un jour).

Le regroupement course vers phase est dérivable des fenêtres de dates des phases
d'enchères et de la date de chaque course. Attention : les Classiques sont deux
phases dans ce découpage, à fusionner en une seule entrée.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Un helper partagé répond « course d'un jour ou course par étapes » à partir
      du calendrier World Tour.
- [ ] Le sélecteur de Ranking propose All races, Classics, Giro, Tour de France,
      Vuelta, et rien d'autre.
- [ ] Choisir Classics agrège les seules courses d'un jour de l'année.
- [ ] Paris-Nice, Tirreno-Adriatico, le Dauphiné et les autres courses d'une
      semaine n'apparaissent dans aucun des quatre groupes.
- [ ] Les deux phases de classiques sont fusionnées en une entrée.
- [ ] La page n'affiche que des totaux, aucun détail par coureur ni par catégorie.
- [ ] Des tests couvrent le classement d'une course d'un jour et celui d'une
      course par étapes.
