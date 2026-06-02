# Spec A — Levels + Rôles & Scoring (Refonte équilibrage)

> Statut : **FINAL** (opens résolus 2026-06-02, prêt pour writing-plans) · Partie 1/3 de la refonte équilibrage
> Spec B = Underdog · Spec C = Économie Bonus & Sponsors

## Contexte & problème

À la fin du Giro 2026, les écarts explosent et le jeu perd son intérêt pour le peloton.
Analyse réelle (ligue "Classiques de l'individualisme", 8 équipes) :

- Standings projetés fin Giro (avec la décision D4 ci-dessous) : Klimax 2607, Leopard 2559, AussieMate 1936, Goudal 1764, Peejee 1508, Dixon 1487, Muscat 1119, bigdaddy 961.
- Le leader frôlait le **L8 (dernier level)** avant la fin du Giro → les levels finissent trop vite.
- Le **GC final** est le plus gros événement d'XP de tout le GT (+460 à +925 XP par équipe) ET il est boosté ×1.5 par les rôles → trop fort.

**But de la refonte globale : compresser l'écart sans tuer l'intérêt.**
Spec A = ralentir la progression du leader (levels longs) + corriger les sur-boosts de scoring.

## Décisions

### A1 — Courbe de levels (LOCKED)

| Level | Seuil actuel | **Nouveau seuil** | Écart |
|---|---|---|---|
| L1 | 0 | 0 | — |
| L2 | 25 | 25 | — |
| L3 | 150 | 150 | — |
| L4 | 350 | 350 | — |
| L5 | 600 | 600 | — |
| **L6** | 1200 | **1200** (inchangé) | +600 |
| **L7** | 1800 | **2600** | +1400 |
| **L8** | 2400 | **4000** | +1400 |

- L1-L5 inchangés. Le gros étirement se fait sur L7 et L8 (+1400 chacun).
- **No-regression conservé** : aucune équipe ne perd son level actuel ; on relève seulement la barre du level suivant. (Ex. Leopard à 2559 < 2600 reste L7 car déjà L7 sous l'ancienne courbe.)
- Cible : L8 atteint **après le Tour** (estimation : leader ~4650 fin Tour → seuil 4000 franchi dans la dernière semaine).

**Fichiers à modifier :**
- `services/pcs-sync/scoring.py:35` — `LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 1200, 2600, 4000]`
- `apps/web/lib/levels.ts` — constante `LEVELS[].xp`
- Migration SQL — `public.compute_level()` + recompute `UPDATE teams SET level = compute_level(cumulative_xp)` (avec garde no-regression)
- `docs/GAME_RULES.md §7 / §12.3`

### A2 — Multiplicateur de rôle sur les classements (LOCKED, ex-D4 + Q4)

Le `gt_classif_bonus` (présence dans gc/points/kom) applique un mult quand le rôle matche (gc_leader→gc, sprinter→points, climber→kom). Le GC final est en plus importé comme gros résultat `/gc` (400/290…, via `import_gc_results`, `sync_race.py:178`).

**Nouveau barème de multiplicateur :**

| Élément scoré | Mult rôle qui matche |
|---|---|
| Classif quotidien gc / points / kom (étapes intermédiaires) | **×2** (avant ×1.5) |
| Classif quotidien **youth** (NOUVEAU, tracké) — rôle matché = **gc_leader** | **×1.5** |
| **GC final** — points PCS 400/290/240… (`/gc`) | **×1.0** (aucun mult) |
| **Points final** — points PCS 80/20/10 | **×2** (sprinter) |
| **KOM final** — points PCS 80/20/10 | **×2** (climber) |
| **Youth final** — pas de points PCS → custom 2-valeurs | **×1.5** (gc_leader) |

**Scoring des classements finaux (vérifié sur données réelles stage-21) :**
- Points PCS réels au final : GC 400/290/240… · Points 80/20/10 · KOM 80/20/10 · Youth **0** (PCS n'en donne pas → barème custom 80/20/10).
- Aujourd'hui **seul le GC** est importé/scoré (`import_gc_results`). Il faut désormais **aussi importer/scorer les finals Points, KOM et Youth** (chacun avec ses points × le mult de rôle).

**Youth (meilleur jeune) :**
- Bonus **quotidien** : top 5, base 5/4/3/2/1, rôle matché `gc_leader` ×1.5 (autres ×1.0).
- **Final** : barème custom **2-valeurs** (rangs 1/2/3), ×1.5 si gc_leader. PCS ne donne aucun point jeune → barème inventé, aligné sur le système 2-valeurs de Spec C : **80/20/10 en GT/Monument**, **40/10/5 en course d'1 semaine**.
  - ⚠️ Asymétrie volontaire à tracer : les finals **Points/KOM** utilisent les points PCS **bruts** (80/20/10, non doublés) quel que soit le type de course. Le youth final, lui, suit le doublement 2-valeurs. Donc sur une course **non-GT**, le youth final (40/10/5) vaut la moitié des finals points/kom. C'est un choix produit assumé (décision 2026-06-02), pas un bug.

**Pré-requis technique :**
- **Daily (à chaque étape, dans le pipeline post-race)** : ajouter `youth` à l'enum `classification_type` + ajouter `("youth", lambda: stage.youth()[:50])` à la liste de `sync_race.py:import_daily_classifications` (ligne ~513), au même endroit que gc/points/kom. Même HTML d'étape déjà fetché → **aucun fetch supplémentaire**. Le youth est ainsi scrapé ET scoré chaque jour en même temps que les autres (`_fetch_gt_classifications` dans `run_pipeline.py`).
- `scoring.py` : `CLASSIF_TOP["youth"]=5`, match `youth→gc_leader` (×1.5), traité dans la boucle de bonus de classement quotidien avec gc/points/kom.
- **Finals** : importer/scorer les classements finaux Points/KOM/Youth (slugs dédiés `/points`,`/kom`,`/youth`, ou table), points × mult (gc ×1.0, points→sprinter ×2, kom→climber ×2, youth→gc_leader ×1.5 sur barème custom 2-valeurs 80/20/10 GT · 40/10/5 1-sem). Aujourd'hui seul `/gc` est importé.
- Débloque aussi le goal "maillot jeune" de Spec C.

- Raison du ×1.0 sur le GC final : il paie déjà l'énorme windfall (Gall 290→290 XP sans mult, pas 435). Pas de double-boost. Sprint/KOM n'ont pas de windfall → ×2 conservé pour récompenser le spécialiste qui gagne son maillot.
- Non-matched squad rider dans un classement = ×1.0 partout.
- **NON retenu** : diviser les points GC par 2 au-delà du top 10 (creuse l'écart — les faibles ont les coureurs 11-25). L'inflation des places profondes = filet de rattrapage, on la garde.

**Fichiers :** `services/pcs-sync/scoring.py` — `ROLE_CLASSIF_MULT` (×1.5→×2) + `_role_multiplier()` : forcer 1.0 pour le résultat `/gc` (GC final), garder ×2 pour points/kom.

### A3 — Refonte rôle Stage Hunter (LOCKED, constantes à confirmer)

Aujourd'hui : stage_hunter = ×1.5 sur toute étape, **aucune** détection d'échappée → on peut mettre un 2e sprinter en stage_hunter et farmer. Le rôle est aussi le plus faible en moyenne (89 XP).

**Nouveau comportement :**
- ×1.0 par défaut (comme un domestique) sur les étapes où le coureur **n'est pas** dans l'échappée.
- **×1.5** si le coureur **était dans l'échappée** (`breakaway_kms ≥ SEUIL`) **et** marque des points.
- **+ bonus distance** : +1 pt tous les `KM_PAR_POINT` km passés dans l'échappée.
- **Bonus combativité : SUPPRIMÉ** (donnée PCS absente pour le Giro — la page combativité renvoie le GC, vérifié en live).

Constantes (LOCKED) : `SEUIL = 30 km` · `KM_PAR_POINT = 10` (1 pt tous les 10 km).
⚠️ Le **×1.5 ne s'applique QU'AU résultat d'étape**, **PAS** au bonus distance : `XP = points_étape × 1.5 + floor(breakaway_kms / 10)`. Le bonus distance est additif, non multiplié. (Magnitude : échappée de 150 km = +15 pts ; 250 km = +25 pts.)
- **Cap bonus distance : AUCUN** (décision 2026-06-02). Le bonus 1pt/10km n'est pas plafonné — les très longues échappées sont pleinement récompensées. À surveiller en prod ; si une mégabreakaway éclipse régulièrement les vrais résultats d'étape, rouvrir la question d'un cap.

**Pré-requis technique — capturer `breakaway_kms` :**
- La lib l'expose (`Stage.results()[].breakaway_kms`, float) mais on ne l'importe pas.
- Ajouter colonne `breakaway_kms` à `race_results` (migration).
- `sync_race.py:import_race_results` — extraire `entry.get("breakaway_kms")` dans la row.
- `scoring.py` — appliquer le ×1.5 conditionnel (échappée) + le bonus distance pour le rôle stage_hunter.

### A4 — Sprinter : gating par profil P1/P2/P3 (REVISÉ 2026-06-01)

**Les bonus liés au rôle sprinter ne sont valables que sur les étapes de profil P1, P2 ou P3** (plat + vallonné). Sur P4/P5 (montagne), le sprinter ne touche aucun bonus de rôle (traité comme un domestique sur ces étapes).

Rappel profils PCS : p1 plat · p2 vallonné arrivée plate · p3 vallonné arrivée en côte · p4 montagne arrivée plate · p5 montagne arrivée au sommet. Donc **P1/P2/P3 = tout sauf la montagne**.

- **XP (LOCKED)** : le mult sprinter ×1.5 ne s'applique que si le profil de l'étape ∈ {p1,p2,p3} ; sinon ×1.0.
- **Argent (LOCKED, ex-Q14)** : seuls les **goals de victoire d'étape en rôle sprinter** sont gatés par profil — "Win a stage" (sprinter) et "Win 2 stages" (sprinter) ne comptent que si l'étape gagnée ∈ {p1,p2,p3}. Un sprinter qui gagne une étape de montagne ne valide PAS le goal. (Détail dans Spec C.)
  - Ciclamino / Win points classification = classements globaux → **non gatés**.
  - Per-result 25k/15k → **inchangé** (basé sur le résultat, pas sur le rôle).
- Restriction de rôle : toujours **pas** d'interdiction d'assigner le rôle sprinter à un non-sprinter — le gating par profil suffit à fermer l'exploit Narváez (il ne marquera ×1.5 que sur P1/P2/P3, et ses goals win-stage ne comptent qu'en plat/vallonné).

**Pré-requis technique — capturer le profil de l'étape :**
- La lib expose `Stage.profile_icon()` (p0-p5). On ne le stocke pas.
- Ajouter colonne `profile_icon` (ou `profile`) à `race_results` (migration) + extraction dans `sync_race.py:import_race_results` (même chantier que `breakaway_kms`).
- `scoring.py` — conditionner le mult sprinter au profil.

### A5 — GC leader : INCHANGÉ (LOCKED)

Le rôle reste ×1.5 (scope "all", sauf sur `/gc` désormais ×1.0 via A2). C'est le rôle phare, on n'y touche pas. La compression vient des levels, des bonus (Spec C) et de l'underdog (Spec B).

### A6 — (résolu, fusionné dans A2)

Le multiplicateur du bonus de classement quotidien passe à ×2 (rôle qui matche), avec l'exception GC final ×1.0. Voir A2.

### A7 — Réconciliation GT Tactics (PROPOSÉ — à confirmer)

Les tactics **surchargent** (override, ne stackent pas) le `gt_role_mult` sur les résultats d'étape (`tactics.py`).
Valeurs ACTUELLES : Unleash domestique→1.5 · Overdrive stage_hunter→2.0 · Call the Bus bench→inclus à ×1.0 · Nemesis (attacker_won : attacker 2.0 / target 0.5 ; target_won : attacker 0.75 / target 1.25).

Problème : le nouveau stage_hunter est ×1.0 par défaut, ×1.5 en échappée → Overdrive→2.0 sur-récompense un stage_hunter hors échappée. La refonte oriente le jeu vers le stage-hunting → on re-tune les tactics autour.

**Ajustements (LOCKED) :**
- **Overdrive** : stage_hunter → **×2**, uniquement **si dans l'échappée** (`breakaway_kms ≥ seuil`) ; sinon aucun effet. Bonus distance 1pt/10km toujours additif. (Base échappée ×1.5 → Overdrive ×2 = vrai boost.) → seul changement.
- **Unleash** : INCHANGÉ (domestique → ×1.5 sur étape).
- **Call the Bus** : INCHANGÉ (bench riders inclus à ×1.0).
- **Nemesis** : INCHANGÉ.

Fichiers : `tactics.py` (compute_*_modifier), `scoring.py` (~494-545). `breakaway_kms` (capturé via A3) dispo à la résolution des tactics.

## Hors scope (autres specs)

- Économie bonus per-result + goals + sponsors → **Spec C**
- Système underdog (rôle, boost, réduc salaire, squad élargi) → **Spec B**

## Impact technique (récap)

| Changement | Fichiers |
|---|---|
| Seuils levels | scoring.py, levels.ts, migration compute_level, GAME_RULES.md |
| No-mult /gc | scoring.py `_role_multiplier()` |
| Stage hunter échappée | migration (col `breakaway_kms`), sync_race.py, scoring.py |
| Classif ×1.5 (si neutralisé) | scoring.py |

## Questions ouvertes (Spec A) — TOUTES RÉSOLUES (2026-06-02)
- ~~Q4 — Classif quotidien ×1.5~~ → RÉSOLU : ×2 (rôle matché), GC final ×1.0, sprint/KOM final ×2 (A2).
- ~~Q5 — Stage hunter constantes~~ → RÉSOLU : seuil 30 km, 1 pt/10 km, ×2 sur résultat d'étape seulement.
- ~~Q14 — Sprinter "argent"~~ → RÉSOLU : gating profil P1/P2/P3 sur les goals "Win a stage" + "Win 2 stages" (rôle sprinter) uniquement ; per-result et classements globaux inchangés.
- ~~Q12 — Rétroactif~~ → RÉSOLU : **forward-only**. Nouvelles règles à partir du Tour ; aucun re-score du Giro (évite la corruption rétroactive — cf. Remontada désactivé — et le re-scrape des données breakaway/profil/youth absentes du Giro). Le GC final du Giro, non encore synchro, est importé sous les nouvelles règles (×1.0) de toute façon.
- ~~Cap bonus distance échappée~~ → RÉSOLU : **aucun cap** (voir A3). À surveiller en prod.
- ~~Youth final — doublement 2-valeurs ?~~ → RÉSOLU : **oui**, barème custom 80/20/10 GT/Monument · 40/10/5 1-semaine, aligné sur Spec C (voir A2). Asymétrie assumée vs Points/KOM (points PCS bruts non doublés).
