# 08 — Décomposition de l'XP par catégorie, maillots séparés

**What to build:** chaque résultat devient interrogeable par catégorie, même sans
écran pour l'afficher. Après ce ticket on sait, pour une équipe et une épreuve,
combien d'XP vient de l'arrivée d'étape, des sommets, des sprints intermédiaires,
de l'échappée, des équipiers, puis du maillot jaune, du vert, du pois et du blanc.

Presque tout existe déjà. **Le seul vrai manque est la séparation des trois
premiers maillots** : jaune, vert et pois sont aujourd'hui fusionnés dans un unique
champ de bonus de classement. Deux voies possibles, à trancher par l'agent et à
justifier dans le ticket : trois colonnes de traçabilité supplémentaires, ou un
recalcul depuis les classements quotidiens, qui portent bien le type de
classement. Le maillot blanc n'existe qu'en classement final.

Aucun écran n'est livré ici. La donnée doit simplement exister et être juste.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] On peut obtenir, pour une équipe et une épreuve, la répartition complète de
      son XP par catégorie.
- [x] Jaune, vert et pois sont séparés, plus fusionnés dans un champ unique.
- [x] Le maillot blanc est disponible, en notant explicitement qu'il n'existe qu'en
      classement final.
- [x] La somme des catégories d'un résultat égale son XP total, vérifié sur une
      épreuve complète déjà scorée.
- [x] Le choix entre colonnes de traçabilité et recalcul est justifié en une ligne
      dans la migration ou le code.
- [x] `supabase db reset` rejoue la migration sans erreur.

## Livré — 2026-09-14 (`8fb31cf`)

**Choix : colonnes de traçabilité, pas recalcul.** Justifié en tête de migration
`20260914000100`. Un recalcul depuis `gt_daily_classifications` re-dériverait le
split avec le barème d'aujourd'hui, ce que le postmortem Vuelta interdit
explicitement. Les colonnes enregistrent ce qui a été crédité, au moment où ça
l'a été.

`gt_classif_bonus` reste écrit comme la somme des quatre : aucun lecteur existant
ne change, et le split est vérifiable contre lui.

Lecture : `team_race_xp_breakdown(team_id, race_prefix)`. Le terme d'arrivée
d'étape est le **résidu** (XP stocké moins les termes additifs), donc la somme
des catégories égale l'XP stocké par construction, au lieu d'égaler un second
calcul qui peut avoir dérivé.

**Vérifié sur la Vuelta 2026 complète**, 1352 lignes réelles rejouées en local :
0 écart sur les 7 équipes. L'équipe de tête, 4255.85 XP = 2824.85 arrivées
+ 40 sommets + 60.5 sprints + 79 échappée + 44 équipiers + 460.5 jaune
+ 361 vert + 291 pois + 95 blanc.

Backfill des lignes antérieures : `services/pcs-sync/scripts/backfill_classif_breakdown.py`,
dry-run par défaut. Il ne re-dérive pas le rôle en vigueur au scoring (un cutoff
rejoué des mois plus tard est une source d'erreur à lui seul) : il essaie chaque
rôle candidat et n'écrit que si les candidats qui reproduisent le total stocké
s'accordent tous sur le même split. Dry-run contre la prod sur la Vuelta 2026 :
1352 lignes, **0 non résolue** (74 classements finaux exacts par le slug, 327
quotidiennes reconstruites, 951 à zéro). **Pas encore appliqué** : la migration
n'est pas en prod.

### Une prémisse du ticket est fausse

« Le maillot blanc n'existe qu'en classement final » : non. `DAILY_CLASSIF_SCALES`
porte bien un barème `youth` quotidien ([4, 3, 2, 1, 1]), et `gc_leader` touche
un ×1.5 dessus. Le blanc est donc distribué au quotidien comme les trois autres.
Les quatre colonnes le traitent comme les autres ; la vérification Vuelta montre
95 XP de blanc sur l'équipe de tête, qui ne viennent pas tous du final.
