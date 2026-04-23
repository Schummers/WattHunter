# Anti-Runaway System — Design Spec

**Date** : 2026-04-23
**Statut** : Spec validée, prête pour plan d'implémentation
**Contexte** : Ligue classique en cours de saison — écart entre leader (780 pts) et dernier (225 pts) devenu trop important, structurellement amplifié par la progression des niveaux.

---

## 1. Problème & Objectifs

### Problème observé
L'écart entre les premiers et les derniers d'une ligue grandit de manière structurelle : le leader accumule des avantages en cascade (plus de slots, meilleur pool, plus de budget via sponsors, plus de stratégies actives), ce qui lui permet de scorer davantage par phase, ce qui creuse encore l'écart. Pour un joueur au fond du classement, il n'existe aucun levier pour tenter une remontée, ce qui encourage le décrochage / désengagement.

### Objectifs
- Permettre aux joueurs hors-podium de tenter des **remontadas méritées jusqu'au podium** (mais pas jusqu'à la victoire).
- Réactiver le joueur désengagé **sans récompenser l'inactivité** : chaque mécanisme demande une action du joueur.
- Empêcher le **runaway leader** de monopoliser les ressources exclusives (top riders PCS).
- Préserver l'équité et le fair-play : pas de régression rétroactive, pas de punition pour des règles qui n'existaient pas.

### Cause racine diagnostiquée (avec l'utilisateur)
- Le retard n'est dû ni à un démarrage tardif, ni à de la malchance.
- Principalement : **mauvais jeu** (choix de coureurs/stratégies/enchères sous-optimaux) + **désengagement** (oubli de valider les phases, rate des rounds).
- Conclusion : le design doit **réactiver le joueur** en créant des moments où "jouer bien" redevient visible et récompensé.

---

## 2. Vue d'ensemble des 3 mécanismes

| # | Mécanisme | Axe traité | Actif quand |
|---|-----------|------------|-------------|
| 1 | **Remontada Boost** | Points rattrapage (in-GT) | Pendant Giro / Tour / Vuelta |
| 2 | **Co-Unlock Rule** | Pool access (anti-monopoly) | Toute l'année |
| 3 | **Level Curve Stretch** | Compression structurelle | Permanent (depuis déploiement) |

Les 3 mécanismes sont **league-wide**, toujours actifs, sans opt-in commissioner. Ils agissent à des échelles différentes :
- Mécanisme 1 = moments dramatiques (GT)
- Mécanisme 2 = rééquilibrage silencieux (pool de riders)
- Mécanisme 3 = compression structurelle (cascade de tout le jeu)

---

## 3. Mécanisme 1 — Remontada Boost

### 3.1 Scope temporel
- Actif **uniquement pendant les Grands Tours** : Giro d'Italia, Tour de France, Vuelta a España.
- Inactif hors-GT (assumé — les 8 mois hors-GT sont des "dead zones" acceptées).

### 3.2 Éligibilité
- Joueurs classés **hors-podium** (rank 4+ dans le classement ligue) **au moment du trigger**.
- Taille minimum de ligue : **≥4 joueurs** (sinon pas de "hors-podium" possible). Si <4 joueurs, le mécanisme n'est jamais actif.

### 3.3 Trigger
- Le joueur A dépasse le joueur B dans le classement ligue (le total de points de A passe au-dessus de celui de B).
- Contrainte anti-ping-pong : **1 trigger max par paire ordonnée A→B par GT**. Les repassements ultérieurs de B par A pendant le même GT ne retriggerent pas. Reset au GT suivant.
- La paire est ordonnée : A→B ≠ B→A. Si A overtake B, puis B overtake A, puis A overtake B à nouveau, seul le premier A→B trigger un boost pour A.
- Éligibilité vérifiée au moment exact du trigger (pas rétroactivement).

### 3.4 Reward
- Tous les points que A gagne pendant les **3 prochaines stages de course effectives** sont multipliés par **2x**.
- "Stage de course effective" = un événement de course officiel avec scoring. Les jours de repos GT sont **skippés** (ne comptent pas dans les 3 stages).
- Applique à : résultats de stage, classifications quotidiennes (général, sprint, KOM, jeunes), tout pt earnable par le joueur durant la fenêtre.

### 3.5 Cumul — règle "Reset"
- Si A déclenche un nouveau trigger (overtake d'un nouveau joueur C) pendant que son boost actuel est encore actif, le **timer se refresh à 3 stages** à partir du nouveau trigger.
- Le multiplicateur reste **2x max** — pas de stacking (jamais 4x).
- Effet pratique : un joueur en très grande forme peut maintenir 2x sur 10-15 stages consécutives s'il enchaîne les overtakes.

### 3.6 Comportement post-trigger
- Si A remonte dans le podium (top 3) pendant la fenêtre de 2x, **le boost continue jusqu'à expiration**. Pas de re-vérification d'éligibilité pendant le boost.
- Justification : simplicité + évite la frustration d'un boost qui s'arrête en plein milieu d'une grosse stage.

### 3.7 UX

**Banner Remontada Boost** — placé en haut de la sub-tab GT de la page Team, visible pendant toute la durée du boost :

```
🔥 Remontada Boost active
2x points for the next 3 stages · N stages remaining
Triggered by overtaking [Player Name]
```

**Notifications** :
- Trigger du boost → notif détaillée au bénéficiaire ("You overtook X! Remontada Boost activated: 2x for 3 stages")
- Les autres joueurs de la ligue → indicateur passif sur la page ranking (petit 🔥 à côté du nom des joueurs boostés)

**Visibilité publique** :
- Le classement ligue affiche un indicateur 🔥 à côté des joueurs actuellement boostés (crée du drama).
- Pas de détail public sur la durée restante du boost d'un autre joueur (info privée du bénéficiaire).

---

## 4. Mécanisme 2 — Co-Unlock Rule

### 4.1 Règle
Un joueur peut **enchérir sur un coureur** uniquement si **≥2 joueurs de la ligue** ont débloqué le niveau requis pour accéder à ce coureur.

### 4.2 Mapping niveau → rang PCS
Dérivé du système de pool existant (`pool min` par niveau) :

| Rang PCS | Niveau requis |
|----------|---------------|
| 1-3      | Lv.8 |
| 4-9      | Lv.7 |
| 10-19    | Lv.6 |
| 20-29    | Lv.5 |
| 30-99    | Lv.4 |
| 100-199  | Lv.3 |
| 200-299  | Lv.2 |
| 300-600  | Lv.1 |

Pour un coureur donné, le niveau requis est le plus bas qui lui donne accès. La règle Co-Unlock exige qu'**au moins 2 joueurs aient ce niveau OU un niveau supérieur**.

### 4.3 Grandfathering
- **Forward-only** : les contrats existants au moment du déploiement de la règle sont conservés tels quels.
- La règle ne s'applique qu'aux **nouvelles enchères** (placées après le déploiement).
- Pas de release forcé des contrats exclusifs déjà acquis.
- Actuellement, la ligue concernée n'a pas d'historique de contrats exclusifs → migration triviale.

### 4.4 Release d'un coureur grandfathered exclusif
Si un joueur release un coureur qu'il est le seul à avoir le niveau de recruter, le coureur retourne en **état "locked"** : visible dans le pool mais non-biddable tant que <2 joueurs n'ont pas le niveau requis. Empêche le contournement par release + rebid.

### 4.5 UX — visibilité
- Les coureurs "locked" sont visibles dans le pool de recrutement **uniquement pour les joueurs qui ont le niveau requis**.
- Les joueurs de niveau inférieur ne voient pas ces coureurs (conforme au gating existant).
- Pour le joueur éligible, le coureur apparaît avec :
  - Icône cadenas
  - Badge "Locked"
  - Message : `Unlock when 1 more player reaches Lv.X`
  - Bouton bid désactivé

---

## 5. Mécanisme 3 — Level Curve Stretch

### 5.1 Nouvelle courbe XP

| Niveau | Seuil actuel | Nouveau seuil | Gap vs précédent |
|--------|--------------|---------------|-------------------|
| Lv.1   | 0            | 0             | —                 |
| Lv.2   | 25           | 25            | +25               |
| Lv.3   | 150          | 150           | +125              |
| Lv.4   | 350          | 350           | +200              |
| Lv.5   | 600          | 600           | +250              |
| Lv.6   | 900          | **1200**      | **+600**          |
| Lv.7   | 1500         | **1800**      | **+600**          |
| Lv.8   | 2000         | **2400**      | **+600**          |

**Pattern** : onboarding rapide préservé (Lv.1→Lv.5 inchangé), puis plateau stable à **+600 XP par niveau** de Lv.5 à Lv.8. Stretch modéré, concentré sur le end-game.

**Justification design** :
- Lv.1-3 (onboarding) : fast ramp pour l'engagement initial — inchangé
- Lv.4-5 (early-game) : inchangé pour ne pas pénaliser les joueurs déjà présents
- Lv.6-8 (mid-late game) : +300 à +400 XP par palier → Lv.8 devient un vrai achievement de fin de saison, réachable seulement par les top performers

### 5.2 Sponsor remapping

Repositionnement des tiers sponsors pour que Lv.4 donne déjà accès à T4 (et non plus T3). Ainsi, la différence entre Lv.4 et Lv.5 se résume aux slots.

| Niveau | Sponsor | Slots | Stratégies actives |
|--------|---------|-------|---------------------|
| Lv.1   | T1      | 6     | 1                   |
| Lv.2   | T2      | 7     | 1                   |
| Lv.3   | T3      | 8     | 2                   |
| Lv.4   | **T4**  | 9     | 2                   |
| Lv.5   | T4      | 10    | 2                   |
| Lv.6   | **T5**  | 11    | 2                   |
| Lv.7   | T5      | 12    | 3                   |
| Lv.8   | **T6**  | 12    | 3                   |

**Changements effectifs vs actuel (référence : 6 tiers CLAUDE.md T1@Lv.1 / T2@Lv.2 / T3@Lv.3 / T4@Lv.5 / T5@Lv.7 / T6@Lv.8)** :
- **T4 avancé** de Lv.5 → Lv.4 (gagné 1 niveau plus tôt)
- **T5 avancé** de Lv.7 → Lv.6 (gagné 1 niveau plus tôt)
- **T6 reste à Lv.8**
- Lv.1-3 inchangés (T1, T2, T3 chacun sur 1 niveau)
- À partir de Lv.4, chaque tier couvre 2 niveaux (Lv.4-5 → T4 ; Lv.6-7 → T5 ; Lv.8 seul → T6)

**Note de réconciliation** : le projet a en parallèle une "Sponsors Rework" spec référencée dans MEMORY.md (mapping différent : 5 tiers avec montants fixes par phase). Pendant l'implémentation, s'aligner sur la version la plus récente et consolider si besoin.

### 5.3 Migration — Grandfather

**Principe** : aucun joueur ne régresse. Chaque joueur conserve son niveau actuel ; seule la barre XP vers le prochain niveau s'ajuste à la nouvelle échelle.

**Exemple** :
- Joueur actuellement à Lv.5 avec 780 XP
- Avant : barre affiche 780/900 vers Lv.6
- Après : barre affiche 780/1200 vers Lv.6
- Niveau inchangé, mais la progression vers le niveau suivant paraît plus longue

Aucune régression de niveau, aucune perte de slot / sponsor / stratégie déjà débloqués.

### 5.4 Timing d'application
- **Immédiat** au déploiement.
- Pas d'attente de la prochaine saison ni du prochain GT.

---

## 6. Interactions entre mécanismes

- **Mécanisme 1 + 2** : points rattrapage (in-GT) + pool rattrapage (toute l'année) = anti-runaway 2 étages complémentaires.
- **Mécanisme 3** renforce Mécanisme 2 : en ralentissant la progression end-game, les joueurs restent clustered aux mêmes niveaux plus longtemps → le Co-Unlock Rule se déclenche moins souvent car les "crown jewels isolés" sont rares.
- **Aucun mécanisme ne modifie l'accumulation d'XP** (les règles de scoring restent inchangées).
- **Grandfathering cohérent** : Mécanismes 2 et 3 appliquent tous deux un forward-only grandfathering. Aucune régression rétroactive.

---

## 7. Impacts en cascade sur le jeu (attendus)

### 7.1 Compression budgétaire
- Sponsors T5 / T6 atteints plus tard → moins de spread entre le budget du leader et celui des derniers pendant une plus grande portion de la saison.

### 7.2 Roster cluster
- Les joueurs restent à 9-10 slots plus longtemps au lieu de progresser rapidement à 11-12.
- Réduit l'asymétrie roster entre leader et laggards.

### 7.3 Stratégies actives
- Le plafond de 3 stratégies actives (Lv.7+) devient beaucoup plus rare.
- La plupart des joueurs jouent à 2 stratégies active toute la saison, ce qui équilibre les décisions stratégiques.

### 7.4 Co-Unlock rarefied
- Les joueurs restant clustered, il est rare qu'un seul joueur atteigne un niveau élevé. La règle Co-Unlock s'applique donc peu en pratique, mais reste un filet de sécurité en cas de performer isolé.

---

## 8. Data model — impacts prévus

Détails techniques à préciser dans le plan d'implémentation. Résumé indicatif :

### Mécanisme 1 (Remontada Boost)
- Nouvelle table : `league_remontada_boosts` (player_id, league_id, gt_id, triggered_at, expires_at_stage_n, multiplier, source_overtake_of_player_id)
- Nouvelle table (ou unique constraint) : `remontada_boost_triggers` (league_id, gt_id, overtaker_id, overtaken_id) avec PK composée pour enforcer "1 par paire A→B par GT"
- Pipeline de scoring étendu : lookup de boost actif, application du multiplicateur
- Détection d'overtake : calcul du classement après chaque événement de scoring, comparaison avec le snapshot précédent

### Mécanisme 2 (Co-Unlock Rule)
- Aucune nouvelle table requise
- Nouvelle fonction de validation au moment du bid : `canBidOnRider(rider_id, league_id) → boolean` qui vérifie ≥2 joueurs au niveau requis
- Computation dynamique (pas de caching nécessaire)

### Mécanisme 3 (Level Curve Stretch)
- Migration de la table `level_thresholds` (ou config équivalente) avec les nouveaux seuils
- Migration du sponsor mapping (table ou config)
- Les XP actuels des joueurs ne sont pas modifiés (grandfather via recalcul de la barre de progression à l'affichage)

---

## 9. Stratégie de test (haute niveau)

### Mécanisme 1 — Remontada Boost
- **Unit** : détection d'overtake, contrainte 1/paire/GT, counting 3 stages (rest days skippés), règle Reset, calcul multiplicateur
- **Integration** : scoring events appliquent 2x correctement, expiration après stage N+3, scenarios multi-overtakes
- **Edge cases** : égalité de points (pas d'overtake), overtakes simultanés dans un même scoring event, transition entre phases

### Mécanisme 2 — Co-Unlock Rule
- **Unit** : mapping rang → niveau correct
- **Integration** : bid bloqué quand <2 joueurs au niveau, bid autorisé dès ≥2, contrats grandfathered conservés
- **Edge cases** : release d'un coureur exclusif (reste locked), arrivée d'un 2e joueur au niveau (unlock automatique), ligue à 2 joueurs

### Mécanisme 3 — Level Curve Stretch
- **Unit** : nouvelle table de seuils appliquée, affichage barre XP correct
- **Integration** : aucune régression de niveau pour les joueurs existants, nouveau sponsor mapping effectif
- **Edge cases** : joueur exactement à un seuil limite, event de level-up utilise les nouveaux seuils

---

## 10. Points à préciser pendant l'implémentation

Décisions défaut prises, à confirmer/ajuster si besoin pendant la phase de plan :

1. **Taille minimum de ligue pour Remontada Boost** : ≥4 joueurs (sinon pas de hors-podium possible). Si <4 joueurs, le mécanisme est inactif.
2. **Comptage des stages** : 3 stages = 3 événements de course effectifs ; les jours de repos sont skippés (la fenêtre s'étend en jours calendaires).
3. **Multi-overtakes dans un même scoring event** : 1 trigger par overtake, donc plusieurs triggers possibles simultanés (soumis à la contrainte 1/paire/GT).
4. **Visibilité publique des boosts** : indicateur 🔥 visible sur le classement ligue pour tous, mais durée restante privée au bénéficiaire.
5. **Contenu des notifications** : bénéficiaire reçoit une notif détaillée ; autres joueurs voient l'indicateur passif dans le ranking.
6. **Réconciliation sponsor mapping** : confirmer les montants exacts des 6 tiers avec la spec "Sponsors Rework" (MEMORY.md) avant implémentation.
7. **Formulation exacte du "locked" label** : `Unlock when 1 more player reaches Lv.X` — ajuster la pluralisation si N > 1 (ex: "Unlock when 2 more players reach Lv.X").

---

## 11. Mesures de succès et suivi

Après le premier déploiement (avant Giro 2026, qui démarre le 2026-05-08) :

- **Mécanisme 1** : mesurer la magnitude réelle des boosts durant le Giro. Si trop puissant (un seul overtake rattrape plus que l'écart actuel), réduire la fenêtre à 2 stages. Si trop faible (peu d'overtakes déclenchés), étendre à 4 stages ou augmenter le multiplicateur.
- **Mécanisme 2** : mesurer la fréquence à laquelle des coureurs sont "locked" (exclusivement accessibles à 1 joueur). Si rare, la règle est bien calibrée. Si fréquent et bloquant, discuter d'un seuil plus bas (ex. permettre bid si 1 joueur seul mais cooldown de X jours).
- **Mécanisme 3** : mesurer la distribution des niveaux en fin de saison. Cible : la majorité des joueurs clustered entre Lv.4 et Lv.6, quelques top performers à Lv.7-8.

---

## 12. Hors scope (pour ce spec)

Éléments évoqués pendant le brainstorming mais non retenus pour cette première itération :

- **Boost hors-GT pendant les Monuments** (Option B du brainstorming) : mis en attente. Si les 3 GT ne suffisent pas à créer assez de moments de rattrapage, reconsidérer plus tard.
- **Boost stacké ou one-shot** : décision arrêtée sur "Reset", pas de revisiter sauf si problème empirique majeur.
- **Rattrapage via money / sponsor direct** : non retenu — donner de l'argent à un joueur désengagé ne le réactive pas.
- **Mécanique opt-in / commissioner-triggered** : non retenu — les 3 mécanismes sont league-wide et toujours actifs pour simplifier et garantir la cohérence de la compétition.

---

## 13. Références

- Brainstorming session : 2026-04-23 (cette session)
- Projet : WattHunter — fantasy cycling
- Contextes liés :
  - Grand Tour Mode V1a (spec lockée 2026-04-22 pour Giro 2026-05-08)
  - Sponsors Rework (spec validée, plan d'impl à faire)
  - Level Rework 8 niveaux (migration `20260402000000_level_rework_8_levels.sql`)

---

**Prochain step** : plan d'implémentation via la skill `superpowers:writing-plans`.
