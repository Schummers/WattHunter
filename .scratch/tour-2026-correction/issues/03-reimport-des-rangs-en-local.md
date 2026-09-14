# 03 — Ré-import des rangs en local, XP intact

**What to build:** en local, les résultats du Tour deviennent vrais (rangs
d'étape, GC finale, maillots) sans qu'aucun XP ne bouge, ce qui isole la
correction des rangs de tout effet de barème.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] Baseline pris avec l'outil du 02 avant toute écriture
- [ ] Ré-import des 20 étapes (2 à 21) + `gc` dans `race_results` et de `points` / `kom` / `youth` dans `gt_final_classifications`, depuis le cache, correctif `pcs_deobfuscate` actif
- [ ] Crosscheck Wikipedia en local : **0 / 198**, strict, sans liste d'erreurs Wikipedia connues (il n'y en a aucune sur le Tour)
- [ ] Balayage de la zone scorée en local : **0 / 454**
- [ ] `stage-1` : ses 18 lignes de `race_results` sont identiques au baseline, ligne à ligne
- [ ] `rider_xp_daily`, `teams` et `team_ranking_daily` strictement identiques au baseline (0 ligne de diff) : le rescore n'a pas tourné
- [ ] Nombre de lignes par slug avant / après consigné dans le ticket ; un slug qui perd des lignes est expliqué (coureur hors pool) ou le ticket échoue
