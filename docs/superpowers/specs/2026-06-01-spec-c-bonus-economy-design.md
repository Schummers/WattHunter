# Spec C — Économie Bonus & Sponsors (Refonte équilibrage)

> Statut : **FINAL** · arbitré 2026-06-02 · Partie 3/3
> Toutes les décisions sont tranchées (§C1-C4 + « Décisions résolues » en bas). Prêt pour `superpowers:writing-plans`.

## Contexte & problème (data réelle Giro 2026)

Les bonus suivent exactement le classement et l'amplifient :

| Équipe | XP Giro | Bonus per-result | Goals | Total bonus |
|---|---|---|---|---|
| Leopard | 1351 | 160k | 90k | **250k** |
| Klimax | 1146 | 180k | 50k | **230k** |
| Dixon | 755 | 160k | 0 | 160k |
| … | | | | |
| Muscat | 321 | 20k | 0 | 20k |

- **Tout l'argent per-result du Giro vient des podiums d'étape** (~670k, type "stage"). Le volume de top-3 creuse l'écart.
- Sur la **dernière étape**, les goals injectent **425k**, dont **300k pour le top 2** (podium GC final 150k × Klimax + Leopard). C'est le pic d'écart.

**But : rendre les exploits spéciaux (goals) agréables sans permettre de générer trop d'écart ; tuer l'accumulation de bonus de résultat.**

## Décisions (REVISÉ 2026-06-01)

### C1 — Base bonus (per-result) : système à deux valeurs

Chaque base bonus a **deux valeurs** : une pour **one-day + courses d'une semaine**, le **double** pour **Grands Tours + Monuments**. Affichage 2 colonnes (gauche normal, droite GT/monument).

**Trois lignes génériques : `GC` / `Stage` / `One-day`.** Le **seuil** (Top N) est un paramètre par tier — on n'écrit jamais "podium" (ce n'en est un que pour T4/T5). Chaque ligne a 2 valeurs : colonne A (1-semaine / one-day) · colonne B = **×2** (Grand Tour / Monument).

Exemple tier T4 :

| Ligne | Seuil | A (1-sem / 1-day) | B (GT / Monument ×2) |
|---|---|---|---|
| GC | Top 10 | 10k | 20k |
| Stage | Top 3 | 5k | 10k |
| One-day | Top 10 | 10k | 20k |

- Remplace le barème unique 25k/15k (abandonné).
- **Bonus nationalité : CONSERVÉ, passé de ×1.25 à ×1.20** — quand la nationalité du coureur matche le sponsor, sur base bonus **et** goals.

**Philosophie (décidée) :** tiers bas = **base élevée, pas de goals** ; tiers hauts = **base réduite, goals riches**. La progression = passer d'une économie "résultats" à une économie "accomplissements". L'inversion base T3 > T4 est donc **assumée**.

**Barème base bonus par tier (seuils inchangés depuis la base — larges en bas, serrés en haut — + valeurs A/B) :**

| Tier | GC | Stage | One-day | Goals ? |
|---|---|---|---|---|
| T1 | Top 25 · 5k/10k | Top 10 · 2.5k/5k | Top 25 · 5k/10k | non |
| T2 | Top 20 · 10k/20k | Top 10 · 5k/10k | Top 20 · 10k/20k | non |
| T3 | Top 15 · 25k/50k | Top 5 · 10k/20k | Top 15 · 20k/40k | non |
| T4 | Top 10 · 10k/20k | Top 3 · 5k/10k | Top 10 · 10k/20k | oui |
| T5 | = T4 | = T4 | = T4 | oui |
| T6 | différé (inchangé) | différé | différé | différé |

- **T1-T3** : montants **et seuils** actuels **conservés**, on ajoute juste la colonne B (×2 GT/Monument). Pas de goals. Colonne `orientation` supprimée (remplacée par les archétypes dès T4).
- **T4** : grosse coupe de base **assumée** (GC 50k → 20k en GT), compensée par les goals d'exploit. Redistribution : un "top 10 tiède" passe de 50k à **20k** ; un **podium GC** = 20k base + 60k goal = **80k**.
- **T5 (Visma, Red Bull)** : base **strictement identique à T4** (mêmes montants ET seuils). La différenciation se joue sur `monthly_budget` (plus élevé) + les sets de goals. Pas de bonus nationalité.
- **T6 (UAE)** : **DIFFÉRÉ** — inchangé (garde son prestige 100k + monument). TODO connu : à aligner plus tard pour ne pas laisser le Lv8 le plus riche.

**Nationalité** : ×1.20 (ex-1.25) pour **T1-T4** ; **aucun** bonus nationalité pour **T5-T6**.

### C2 — Specific bonus (goals) : menu par archétype, système 2-valeurs

Les goals suivent **aussi** le système 2-valeurs : colonne gauche = course d'une semaine, colonne droite = **GT / Monument (×2)**.
Cumul **par coureur** : un même coureur ne cumule pas podium+top5 (prend le meilleur) ; deux coureurs différents valident chacun le leur (3e 60k + 4e 40k = 100k en GT).

| Archétype | Goal | 1-semaine | GT / Monument |
|---|---|---|---|
| **GC** | Podium GC | 30k | 60k |
| | Top 5 GC | 20k | 40k |
| | Porter le maillot de leader *(générique)* | 15k | 30k |
| | Porter le maillot de meilleur jeune | 10k | 20k |
| **Sprint** | Gagner le classement par points | 30k | 60k |
| | Gagner 2 étapes sprint (P1/P2/P3) | 20k | 40k |
| | Gagner 1 étape sprint (P1/P2/P3) | 10k | 20k |
| | Porter le maillot par points | 10k | 20k |
| **CLM** | Gagner 1 étape CLM (tt_specialist) | 15k | 30k |
| | 2 coureurs dans le top 10 d'un CLM | 10k | 20k |
| **Grimpeur / Stage hunter** | Gagner le classement KOM | 20k | 40k |
| | Gagner 2 étapes (2 stage hunters différents) | 20k | 40k |
| | Gagner 1 étape (stage hunter) | 10k | 20k |
| | Porter le maillot KOM | 10k | 20k |

- **Rôle des goals "maillot" (LOCKED 2026-06-02)** : "Porter le maillot de leader" et "Porter le maillot de meilleur jeune" portent le rôle **`gc_leader`** (c'est le GC leader qui porte le maillot jaune et le maillot blanc), **pas** `null`/"All". Impact : `apps/web/lib/gt-goals.ts` (+ miroir `goal_evaluator.py`) — ces deux goals doivent avoir `role: "gc_leader"` (pour l'éval ET l'affichage du rôle dans la carte).
- Résout D2 (youth tracké — requis pour le maillot jeune) et D3 (goals KOM ajoutés).
- **Résolu** : mapping archétype→sponsor = §C3 ci-dessous ; nom générique du maillot leader = **"Race Leader"** (neutre, anglais, valable rose/jaune/rouge).

Source canonique : `apps/web/lib/gt-goals.ts` (le Python `goal_evaluator.py` le mirror).

**Gating profil sur les goals win-stage du sprinter (LOCKED) :** les goals "Win a stage" et "Win 2 stages" en **rôle sprinter** ne comptent que si l'étape gagnée est de profil **P1/P2/P3**. Un sprinter qui gagne une étape de montagne ne valide pas le goal. Implique que `goal_evaluator.py` (évaluateurs `win_stage` / `win_2_stages`) lise le profil de l'étape (`race_results.profile_icon`). Les goals "Win a stage" en rôle stage_hunter ne sont PAS gatés (échappées sur tout profil). Ciclamino / Win points classification = non gatés (classements globaux).

### C3 — Mapping archétype → sponsor (goals)

Un sponsor a : base bonus (son tier) + un ou deux **sets de goals** par archétype.

- **T5 Visma** = GC + **Sprint** · **T5 Red Bull** = GC + **Stage Hunter** (base = T4). ✅
- **T4 (validé)** : Ineos = GC + CLM · Decathlon = GC + Sprint · Soudal = Sprint + Stage Hunter · Lidl-Trek = Sprint + Stage Hunter. ✅
- **T6 UAE** : différé (à définir plus tard).
- **T1-T3** : pas de goals (base bonus seul). Colonne `orientation` supprimée.
- Sponsors T5/T6 : **pas de bonus nationalité**.

**Résolu** : T6 = différé (assumé) ; nom du maillot leader = **"Race Leader"**.

### C4 — Affichage (UI) : 2 colonnes (VALIDÉ + maquetté 2026-06-02)

**Maquette HTML validée : [`docs/mockups/2026-06-02-ui-mockups.html`](../../mockups/2026-06-02-ui-mockups.html)** — section 1 (sponsor card). À ouvrir dans un navigateur (référence visuelle pour l'implémentation).

**Composants prod réels à généraliser** (le handoff parlait de `sponsor-bonus-details.tsx` ; la carte complète avec header/chevron/radio est en fait ailleurs) :
- `apps/web/components/sponsor-bonus-card.tsx` — la carte standalone (Budget / GT-Team) : header + chevron + tags + footer nationalité. Contient `BaseBonusContent` / `PrestigeBonusContent` (les lignes de bonus à passer en 2 colonnes).
- `apps/web/components/gt-goals-preview.tsx` — `GtGoalsPreview` (blocs Goals par catégorie) à passer en 2 colonnes.
- `apps/web/app/(game)/.../team/budget/marketplace/marketplace-client.tsx` — `SponsorCard` (duplique la structure + **radio button** de sélection + état `selected`/`locked`). Même corps à généraliser.
- `apps/web/components/sponsor-bonus-details.tsx` — sous-composant 1-colonne (marketplace expanded row / budget) ; à aligner ou fusionner.

**Décisions de design (LOCKED 2026-06-02, validées sur maquette) :**
- **Ancré sur la prod** : header **toujours visible** (nom + budget + **chevron** d'ouverture + tags rôle/archétype `getOrientationTags` + tag nationalité), corps **expandable**. Le **radio** n'apparaît que dans le contexte marketplace (sélection). États : collapsed / expanded / (marketplace) selected.
- **2 colonnes `A` | `B`** alignées en un seul mini-tableau sur **tous** les blocs (Base Bonus + chaque bloc Goals) :
  - `A` = course d'1 semaine / one-day · `B` = **Grand Tour / Monument (×2)**.
  - **En-têtes `A` / `B` posés sur la ligne du titre de bloc** (`BASE BONUS (CUMULATIVE)`, `[GC] BONUS (ONE-TIME)`…), pas sur une ligne séparée.
  - **Montants colonne A en couleur secondaire** (`--text-mid`), colonne B en `--text-high` — allège la densité.
  - En-têtes de colonnes en neutre (`--text-low`), **pas de couleur** sky sur la colonne B.
- **Libellé de seuil littéral "Top N"** (plus de "Podium"/"Victory") : le seuil varie selon le level → afficher `GC — Top 10`, `Stage — Top 3`, `One-day — Top 10`. (Change le rendu de `thresholdLabel()` pour cette carte.)
- **Goals** : réutilisent le **tag de catégorie** + le label de rôle, comme le fait déjà `GtGoalsPreview`. Les goals **"Wear leader jersey"** et **"Wear young jersey"** portent le rôle **`gc_leader` (GC Leader)** — pas "All" (voir C2).
- **Légende en bas de carte**, dans cet ordre : ligne **nationalité d'abord** (`🇫🇷 French rider: all bonuses ×1.20`), puis `A = 1-week race & one-day`, puis `B = Grand Tour & Monument (×2)`.
- T1-T3 : bloc **Base Bonus seul** (pas de bloc Goals, pas de texte explicatif superflu).
- Design system (Rule #1) : Geist Mono pour tous les nombres, tokens `--text-*`, tags = pattern Tags.

### C4 — Rétroactif Giro (Option 1 — Grandfather, LOCKED 2026-06-02)

**Décision : on ne touche à rien de ce qui est déjà payé.** Le nouveau barème s'applique au **cutover** ; le passé est gelé. Zéro claw-back, zéro chirurgie de treasury (vérifié en base : même en retirant tout, personne ne passe négatif — mais on ne retire rien).

**Cutover temporel par stage** — la ligne de partage est le *type de résultat*, pas une date :

| Rattaché à… | Barème |
|---|---|
| Un **résultat d'étape** (étapes 2 à **21 incluse**) + ses goals stage (Win a stage, Win 2 stages, Win an ITT) | **ANCIEN** |
| Goals déjà payés pendant le Giro (Wear ciclamino, etc.) | **ANCIEN** (gelés) |
| **Classements finaux** : GC final, points final, KOM final, jeune final (pas encore synchronisés) | **NOUVEAU** |
| Tout dès le Tour | **NOUVEAU** |

**Pourquoi ça marche** : le GC final du Giro **n'a jamais été payé** (les 32 bonus Giro en base sont tous `stage`, aucun `gc` ; pas de stage 21). Le pic 150k/75k qu'on veut tuer est donc un événement *futur* — on l'empêche en synchronisant les finals au nouveau barème, sans rien reprendre au passé.

**Exemple Milan (Lidl-Trek, T4) vainqueur étape 21** → ancien barème : Stage Top 3 = **20k** + goal "Win a stage" (sprinter, non gaté à l'ancien) = **50k** = **70k**. Payé comme tout vainqueur d'étape du Giro, c'est fair.

**Contrainte d'implémentation** : la synchro finale du Giro (étape 21 + GC) applique **deux barèmes dans le même import** — ancien pour le résultat d'étape 21, nouveau pour les classements finaux. `sponsor_bonus.py` / `goal_evaluator.py` doivent distinguer "stage ≤ cutover" vs "classement final".

**Garde-fou double-comptage maillots (réconciliation)** : l'ancien "Wear ciclamino" (déjà payé) et le nouveau goal "Gagner le classement par points" (final) sont distincts dans le nouveau système. Si le porteur du maillot finit aussi vainqueur du classement, **ne PAS cumuler** ancien + nouveau. Idem KOM et jeune.

**Étape de réconciliation obligatoire** (à la complétion du Giro : étape 21 + GC + finals) : lister chaque bonus (base + spécifique), recalculer la somme, comparer au `treasury_log`, flaguer tout écart. Toute modif de treasury écrit une **ligne d'audit** (`treasury_log` type dédié) avec montant + raison.

**Nationalité ×1.25 → ×1.20** : suit le cutover (s'applique aux finals + futur ; le déjà-payé reste à 1.25, pas de retro-fix).

## Trou de tracking confirmé

- **Maillot blanc / jeune (youth) jamais synchronisé** : `gt_daily_classifications` ne contient que gc/points/kom. Le goal "Wear maglia bianca" est mort. La lib expose pourtant `Stage.youth()`.
- **Aucun goal pour le KOM/azzurra** : un coureur peut gagner le maillot grimpeur (Ciccone, Dixon) et toucher 0 €.

## Impact technique

| Changement | Fichiers |
|---|---|
| Barème per-result unique | table `sponsors` (migration), `services/pcs-sync/sponsor_bonus.py` |
| Suppression ×2 GT / prestige / nationalité | `sponsor_bonus.py`, migration `sponsors` |
| Montants goals | `apps/web/lib/gt-goals.ts`, `services/pcs-sync/goal_evaluator.py` |
| Goals Visma/Red Bull | `gt-goals.ts` (+ `GT_GOALS`), `team_sponsors` |
| Tracking youth (si Q-D2 = oui) | enum `classification_type` (+ 'youth'), `sync_race.py:import_daily_classifications` |
| Goal KOM (si Q-D3 = oui) | nouvel évaluateur `win_kom_classification` dans `goal_evaluator.py` |
| Rétroactif | migration recompute `sponsor_bonuses` + `treasury` |

## Décisions résolues (ex-questions ouvertes — toutes tranchées 2026-06-02)
- **Q-D1** — Podium GC final : **pas de bonus final séparé**. Un podium GC = base GC (20k en GT) + goal "Podium GC" (60k) = 80k. Le 150k/75k disparaît.
- **Q-D2** — Maillot blanc : **tracker le youth** (`Stage.youth()` → `classification_type` += 'youth'). Le goal maillot jeune fonctionne.
- **Q-D3** — Maillot KOM : **ajouter le goal** (KOM classification 20k/40k + porter maillot KOM 10k/20k). Nouvel évaluateur `win_kom_classification`.
- **Q6** — Barème goals : **validé** tel quel (voir §C2).
- **Q9** — Visma = GC + Sprint · Red Bull = GC + Stage Hunter (base = T4).
- **Q12** — Rétroactif = **Option 1 Grandfather** (voir §C4 Rétroactif).
