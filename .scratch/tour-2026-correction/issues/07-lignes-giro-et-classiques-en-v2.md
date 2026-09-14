# 07 — Giro et classiques visibles dans le Ranking de la V2

**What to build:** dans la page Ranking de la ligue Classic V2, le sélecteur de
course propose le Giro 2026 et les classiques de printemps, avec le total XP par
équipe sur chacune, comme il le fait déjà pour le Tour et la Vuelta. Le total
saison (`cumulative_xp`) ne bouge pas d'un centime.

**Pourquoi c'est une copie de lignes et pas « juste un total » :** le sélecteur
se construit depuis les `race_slug` présents dans `rider_xp_daily` pour les
équipes de la ligue, et un total par course est la somme de ces lignes. La V2
n'a aucune ligne avant le Tour : au seed du 2026-06-25, `cumulative_xp` a été
copié depuis la V1 (« Classiques de l'individualisme ») sans les lignes. On
copie donc les lignes V1 vers V2, `team_id` remappé par `user_id`.

**Écart connu, assumé, à documenter, pas à corriger :** en V1, `cumulative_xp`
est déjà supérieur à la somme des lignes (Klimax +124,5 ; Leopard_Trek +177,1 ;
TheAussieMate +125,4 ; GoudalEnergies +586,0 ; Dixon Hormous +331,8 ;
Peejee +79,0 ; Muskatel Muskadji +100,0 ; bigdaddy +220,0), XP crédité sans ligne,
suspect principal : cutover du Giro du 2026-06-03 injecté à la main. Après la
copie, la somme des filtres par course d'une équipe ne retombera pas sur son
total, de cet écart-là. On ne touche ni aux lignes ni au total pour forcer la
cohérence : ce serait inventer de l'XP. Las Chivas Pendejas n'a pas d'équipe V1
(late-join) : 0 ligne copiée, 0 XP sur ces filtres, total inchangé.

**Blocked by:** 06 (même base locale, même mécanique local puis prod).

**Status:** ready-for-agent

- [ ] Mapping V1 → V2 par `user_id` établi et listé dans le ticket : 8 correspondances, Las Chivas Pendejas sans source, aucune équipe V2 sans source non listée
- [ ] Migration SQL (Rule #2) qui insère dans `rider_xp_daily` les lignes V1 des slugs hors Tour / Vuelta, `team_id` et `contract_id` remappés, idempotente sur la clé `(team_id, rider_id, race_slug)` ; rejouée deux fois en local, même résultat
- [ ] `contract_id` : décision explicite (remap vers le contrat V2 si présent, sinon NULL ou contrat V1) écrite dans la migration, et les pages qui joignent `contracts` depuis `rider_xp_daily` vérifiées pour ne pas casser
- [ ] Appliquée en local d'abord : le Ranking V2 propose Giro et classiques, le total par équipe sur chaque filtre égale la somme des lignes V1 de la même équipe (Klimax Giro = 1887,7)
- [ ] `teams.cumulative_xp` et `level` des 9 équipes V2 strictement identiques avant / après, en local puis en prod
- [ ] Le rider-detail reste scopé à la ligue (mémoire `rider-detail-league-scoping`) : aucun doublon de ligne visible côté V2 ni côté V1
- [ ] Appliquée en prod par `supabase db push --linked`, fichier de migration commité
- [ ] Runbook (celui du 06 ou une section dédiée) : table des écarts `cumulative_xp − somme des lignes` par équipe, origine présumée, et la phrase qui dit que les filtres par course ne somment pas au total pour l'historique pré-Tour
