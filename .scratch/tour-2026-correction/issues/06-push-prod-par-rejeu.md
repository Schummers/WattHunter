# 06 — Push prod par rejeu, pas par ré-exécution

**What to build:** la prod reçoit exactement ce qui a été validé en local :
mêmes scripts, mêmes pages en cache, même périmètre, et une preuve d'égalité
prod-après / local-après avant de déclarer terminé. Puis la documentation qui
empêche l'incident suivant.

**Blocked by:** 05 **et** validation explicite de l'utilisateur.

**Status:** done — poussé en prod le 2026-09-14

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

- [x] Baseline prod pris avec l'outil du 02, écrit sur disque, date notée
- [x] Vérifié avant d'écrire : les compteurs de lignes prod des tables du périmètre sont identiques à ceux du dump du 01 (personne n'a écrit entre-temps) ; sinon, stop et re-dump
- [x] Enchaînement `reimport` → `import-events` en `--target prod --write`, dans cet ordre, depuis le cache. **Pas de `rescore`.**
- [x] Preuve centrale : diff `prod-après` vs `local-après` du 04 sur `race_results`, `gt_final_classifications`, `stage_event_results`, `rider_xp_daily`, `teams` (9 équipes) = **0 ligne**. Tout écart arrête le ticket
- [x] Crosscheck Wikipedia sur la prod : **0 / 200**. Balayage zone scorée : **0 / 459** (dénominateurs élargis, voir ticket 03)
- [x] Invariants du 03 revérifiés sur la prod : `stage-1` intacte ligne à ligne, `rider_xp_daily` / `teams` / `team_ranking_daily` à 0 ligne de diff
- [x] L'écran Ranking (Tour de France 2026 et cumulé) affiche **les mêmes valeurs qu'avant** : Leopard_Trek 3743.0, Muskatel Muskadji 3555.0, GoudalEnergies 3382.72, Klimax 2698.38, Las Chivas Pendejas 2287.74, Dixon Hormous 2087.0, Peejee 1915.7, bigdaddy 1257.92, TheAussieMate 0
- [x] Ticket `pcs-import-integrity/09` passé en `done` avec un lien vers ce ticket
- [x] Runbook `docs/runbooks/tdf2026-correction-<date>.md` : ce qui a été fait, les chiffres avant / après, la commande de rejeu, et la marge résiduelle (rangs 11-20 validés par le correctif seul)
- [x] `scoring.py` : le commentaire « Giro/Tour 2026 keep the old values » est **laissé tel quel — il redevient exact**, le Tour n'étant pas rescoré. Mais le piège qu'il décrit reste actif : c'est un commentaire, pas un mécanisme. À traiter dans le ticket « barème daté » ci-dessous
- [x] Mémoire projet : une ligne dans `MEMORY.md` (rangs du Tour 2026 corrigés le <date>, événements importés, **aucun XP modifié**, rescore impossible et pourquoi)
- [x] **Pas de mot aux joueurs** : rien de visible ne change dans les classements. Un message ne se justifie que si l'utilisateur veut annoncer la correction des résultats affichés

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


## Exécuté le 2026-09-14

`reimport --target prod --write`, depuis le cache, sans erreur. `import-events`
**n'a pas eu à tourner** : `import_race_results` importe les côtes et sprints de
la même page sur toute étape de Grand Tour, donc les 503 lignes sont arrivées
avec le ré-import. L'étape 1, seule que le ré-import laisse de côté, n'a ni côte
ni sprint (CLM par équipes à plat) : il n'y avait rien à ajouter.

| Table | Avant | Après |
|---|---|---|
| `race_results` (slugs Tour) | 3207 | **3348** |
| `gt_final_classifications` | 200 | **206** |
| `stage_event_results` (Tour) | 0 | **503** |
| `rider_xp_daily` | 1539 | **1539** |
| `team_ranking_daily` | 261 | **261** |

### Preuves, mesurées sur la prod après écriture

| Vérification | Résultat |
|---|---|
| **prod-après vs local-après** | **0 écart** — 9 équipes à +0,00, aucune ligne de slug, `team_ranking_daily` +0 |
| Base vs Wikipedia | **0 / 200** |
| Base vs PCS réparé, rangs 1-15 | **0 / 300** |
| Zone scorée | **0 / 459** |
| `stage-1` | 18 lignes identiques, ligne à ligne |
| `rider_xp_daily` / `teams` / `team_ranking_daily` | 0 ligne de diff |

Aucun XP n'a bougé, aucun `level`, aucun classement. Les 9 équipes sont à
`cumulative_xp` identique au centime.

Artefacts : `verif/prod-apres-crosscheck.json`, `verif/prod-apres-etendue.json`.
Snapshots prod : `20260914-175032-baseline.json` (avant),
`20260914-181128-apres-reimport.json` (après).

Les deux JSON de `pcs-import-integrity/` ont été restaurés à leur version
d'origine : ils documentent l'état d'avant correction, ce sont les pièces du
diagnostic.

### Pas de mot aux joueurs

Rien de visible ne change dans les classements. Ce qui change, ce sont les
résultats affichés (étapes, GC, maillots, palmarès). À annoncer seulement si
l'utilisateur le souhaite.
