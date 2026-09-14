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

**Status:** done

- [x] Un helper partagé répond « course d'un jour ou course par étapes » à partir
      du calendrier World Tour.
- [x] Le sélecteur de Ranking propose All races, Classics, Giro, Tour de France,
      Vuelta, et rien d'autre.
- [x] Choisir Classics agrège les seules courses d'un jour de l'année.
- [x] Paris-Nice, Tirreno-Adriatico, le Dauphiné et les autres courses d'une
      semaine n'apparaissent dans aucun des quatre groupes.
- [x] Les deux phases de classiques sont fusionnées en une entrée.
- [x] La page n'affiche que des totaux, aucun détail par coureur ni par catégorie.
- [x] Des tests couvrent le classement d'une course d'un jour et celui d'une
      course par étapes.

## Livré — 2026-09-14 (`d845e49`)

Helper `apps/web/lib/race-groups.ts`, 15 tests. Source de vérité = le champ
`type` du calendrier World Tour, clé year-agnostic (`race/<nom>/<année>` →
`<nom>`) pour tenir sur l'archive historique.

Le piège du ticket est verrouillé par un test : `race/paris-nice/2026/gc` arrive
sans étape et serait compté comme une course d'un jour ; le helper répond
`stage-race`.

Effets de bord assumés :
- La requête de métadonnées sur `race_results` disparaît de la page Ranking (les
  groupes n'ont plus besoin de noms ni de dates de course). `lib/ranking-race-name.ts`
  devenait mort, supprimé avec son test.
- Les liens `?race=<slug>` déjà émis par le feed continuent de fonctionner via
  `resolveRaceGroupParam`, qui accepte un slug comme un identifiant de groupe.
- « Aucun détail par coureur » : la page n'affichait déjà que des totaux, et
  l'onglet Riders reste en place (ticket 02 : « rien ne change sur l'onglet
  coureurs »).

**Débloque le ticket 04**, qui n'attendait que ce helper.
