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

**Status:** ready-for-agent

- [ ] On peut obtenir, pour une équipe et une épreuve, la répartition complète de
      son XP par catégorie.
- [ ] Jaune, vert et pois sont séparés, plus fusionnés dans un champ unique.
- [ ] Le maillot blanc est disponible, en notant explicitement qu'il n'existe qu'en
      classement final.
- [ ] La somme des catégories d'un résultat égale son XP total, vérifié sur une
      épreuve complète déjà scorée.
- [ ] Le choix entre colonnes de traçabilité et recalcul est justifié en une ligne
      dans la migration ou le code.
- [ ] `supabase db reset` rejoue la migration sans erreur.
