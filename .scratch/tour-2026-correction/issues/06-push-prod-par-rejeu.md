# 06 — Push prod par rejeu, pas par ré-exécution

**What to build:** la prod reçoit exactement ce qui a été validé en local :
mêmes scripts, mêmes pages en cache, même périmètre, et une preuve d'égalité
prod-après / local-après avant de déclarer terminé. Puis la documentation qui
empêche l'incident suivant.

**Blocked by:** 05 **et** validation explicite de l'utilisateur.

**Status:** ready-for-agent

## Périmètre arrêté : option A + événements

L'utilisateur a tranché le 2026-09-14, après le ticket 05 : **rangs corrigés et
événements importés, aucun rescore.** Ce ticket n'exécute donc **que**
`reimport` puis `import-events`. L'étape `rescore` est hors périmètre et ne
doit pas être lancée en prod.

Conséquence directe, à afficher partout : **aucun XP ne bouge.** `rider_xp_daily`,
`teams.cumulative_xp`, les niveaux, le classement du Tour et le classement
cumulé sont strictement identiques avant et après. Les 29 XP au pire par équipe
que le bug avait mal attribués restent mal attribués : on corrige la donnée,
pas le score déjà payé.

Ce que la correction change vraiment : tout ce que l'app affiche à partir d'un
rang (résultats d'étape, GC, maillots, palmarès), et la fiabilité de la base
pour tout calcul futur.

Les 503 lignes d'événements sont poussées bien qu'elles ne rapportent aucun XP
sans rescore : c'est de la donnée juste, inerte pour le scoring, et sans elle un
futur rescore devrait rescraper des pages PCS dont le brouillage aura tourné.

- [ ] Baseline prod pris avec l'outil du 02, écrit sur disque, date notée
- [ ] Vérifié avant d'écrire : les compteurs de lignes prod des tables du périmètre sont identiques à ceux du dump du 01 (personne n'a écrit entre-temps) ; sinon, stop et re-dump
- [ ] Enchaînement `reimport` → `import-events` en `--target prod --write`, dans cet ordre, depuis le cache. **Pas de `rescore`.**
- [ ] Preuve centrale : diff `prod-après` vs `local-après` du 04 sur `race_results`, `gt_final_classifications`, `stage_event_results`, `rider_xp_daily`, `teams` (9 équipes) = **0 ligne**. Tout écart arrête le ticket
- [ ] Crosscheck Wikipedia sur la prod : **0 / 200**. Balayage zone scorée : **0 / 459** (dénominateurs élargis, voir ticket 03)
- [ ] Invariants du 03 revérifiés sur la prod : `stage-1` intacte ligne à ligne, `rider_xp_daily` / `teams` / `team_ranking_daily` à 0 ligne de diff
- [ ] L'écran Ranking (Tour de France 2026 et cumulé) affiche **les mêmes valeurs qu'avant** : Leopard_Trek 3743.0, Muskatel Muskadji 3555.0, GoudalEnergies 3382.72, Klimax 2698.38, Las Chivas Pendejas 2287.74, Dixon Hormous 2087.0, Peejee 1915.7, bigdaddy 1257.92, TheAussieMate 0
- [ ] Ticket `pcs-import-integrity/09` passé en `done` avec un lien vers ce ticket
- [ ] Runbook `docs/runbooks/tdf2026-correction-<date>.md` : ce qui a été fait, les chiffres avant / après, la commande de rejeu, et la marge résiduelle (rangs 11-20 validés par le correctif seul)
- [ ] `scoring.py` : le commentaire « Giro/Tour 2026 keep the old values » est **laissé tel quel — il redevient exact**, le Tour n'étant pas rescoré. Mais le piège qu'il décrit reste actif : c'est un commentaire, pas un mécanisme. À traiter dans le ticket « barème daté » ci-dessous
- [ ] Mémoire projet : une ligne dans `MEMORY.md` (rangs du Tour 2026 corrigés le <date>, événements importés, **aucun XP modifié**, rescore impossible et pourquoi)
- [ ] **Pas de mot aux joueurs** : rien de visible ne change dans les classements. Un message ne se justifie que si l'utilisateur veut annoncer la correction des résultats affichés

## Tickets ouverts par ce chantier, à créer séparément

Aucun n'est bloquant pour ce ticket.

1. **Rescore rétroactif impossible** (ticket 05). `calculate_daily_scores` lit les
   contrats `active`/`notice` d'aujourd'hui, donc aucun Grand Tour ne peut être
   rescoré une fois sa phase terminée. Correctif : charger les contrats dont la
   fenêtre couvre la date de l'étape, quel que soit leur statut.
2. **Barème daté** (diagnostic 09). `_points_from_rank` et
   `_secondary_final_points` lisent une constante unique ; l'intention « le
   passé reste au passé » n'existe que dans un commentaire.
3. **Côte franchie deux fois** (ticket 04). La clé primaire de
   `stage_event_results` ignore l'ordre de franchissement : une côte du même nom
   franchie deux fois n'en garde qu'une, en silence. Sans effet ici (cat.3 et
   cat.4), mais une HC en circuit final ferait perdre de l'XP sans bruit.
4. **Dérives prod / local** (ticket 01) : `auction_bids_round_check` plus stricte
   en local qu'en prod, et les droits PostgREST absents des migrations, donc un
   `db reset` ne rend pas une base utilisable par le pipeline.
