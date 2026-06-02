# Spec A — Levels, Rôles, Scoring & Race Team (Refonte équilibrage)

> Statut : **FINAL** (opens résolus + scope élargi A8/A9 le 2026-06-02, prêt pour writing-plans) · Partie 1/3 de la refonte équilibrage
> Spec B = Underdog · Spec C = Économie Bonus & Sponsors
> Périmètre : A1-A7 scoring/levels/tactics · A8 doc front · A9 escouade « Race Team » (sélection 1-semaine)

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
| **L8** | 2400 | **5000** | +2400 |

- L1-L5 inchangés. Le gros étirement se fait sur L7 (+1400) et L8 (+2400).
- **No-regression conservé** : aucune équipe ne perd son level actuel ; on relève seulement la barre du level suivant. (Ex. Leopard à 2559 < 2600 reste L7 car déjà L7 sous l'ancienne courbe.)
- Cible : L8 **pas atteint pendant le Tour** (décision 2026-06-02, relevé de 4000 → 5000). Estimation leader ~4650 fin Tour < 5000 → le dernier level se franchit **après le Tour** (Vuelta / fin de saison). Étire encore la progression du leader.

**Fichiers à modifier :**
- `services/pcs-sync/scoring.py:35` — `LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 1200, 2600, 5000]`
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
| **GC final** — points PCS bruts (400/290/240… en GT) (`/gc`) | **×1.0** (aucun mult) |
| **Points final** — barème custom 2-valeurs **80/20/10 GT · 40/10/5 1-sem** | **×2** (sprinter) |
| **KOM final** — barème custom 2-valeurs **80/20/10 GT · 40/10/5 1-sem** | **×2** (climber) |
| **Youth final** — barème custom 2-valeurs **80/20/10 GT · 40/10/5 1-sem** | **×1.5** (gc_leader) |

**Scoring des classements finaux :**
- **Réalité PCS (vérifié)** : PCS ne distribue de points sur les finals **secondaires** (Points/KOM/Youth) **que pour les grands tours**. En GT : Points 80/20/10 · KOM 80/20/10 · Youth **0** (jamais de points jeune). En **course d'1 semaine** : Points/KOM/Youth = **aucun point PCS**. Le **GC final** a toujours des points PCS (400/290/240… en GT ; barème PCS propre aux 1-sem) → importé tel quel.
- **Décision (2026-06-02)** : les trois finals secondaires sont scorés via un **barème custom dérivé du rang** (pas des points PCS, qui n'existent qu'en GT), avec un système **2-valeurs** : rangs 1/2/3 → **80/20/10 en GT/Monument**, **40/10/5 en course d'1 semaine**. Uniforme pour Points, KOM et Youth → plus d'asymétrie entre eux. Le GC final reste sur points PCS bruts ×1.0.
- Aujourd'hui **seul le GC** est importé/scoré (`import_gc_results`). Il faut désormais **aussi importer/scorer les finals Points, KOM et Youth** (rang → barème 2-valeurs × le mult de rôle).

**Youth (meilleur jeune) :**
- Bonus **quotidien** : top 5, base 5/4/3/2/1, rôle matché `gc_leader` ×1.5 (autres ×1.0).
- **Final** : barème custom **2-valeurs** dérivé du rang (1/2/3), ×1.5 si gc_leader → **80/20/10 en GT/Monument**, **40/10/5 en course d'1 semaine**. Identique aux finals Points et KOM (mêmes valeurs, même logique rang→barème) — les trois finals secondaires sont traités de façon uniforme. PCS ne donne aucun point jeune nulle part, et aucun point Points/KOM hors GT → d'où le barème custom commun.

**Pré-requis technique :**
- **Daily (à chaque étape, dans le pipeline post-race)** : ajouter `youth` à l'enum `classification_type` + ajouter `("youth", lambda: stage.youth()[:50])` à la liste de `sync_race.py:import_daily_classifications` (ligne ~513), au même endroit que gc/points/kom. Même HTML d'étape déjà fetché → **aucun fetch supplémentaire**. Le youth est ainsi scrapé ET scoré chaque jour en même temps que les autres (`_fetch_gt_classifications` dans `run_pipeline.py`).
- `scoring.py` : `CLASSIF_TOP["youth"]=5`, match `youth→gc_leader` (×1.5), traité dans la boucle de bonus de classement quotidien avec gc/points/kom.
- **Finals** : importer/scorer les classements finaux Points/KOM/Youth (slugs dédiés `/points`,`/kom`,`/youth`, ou table). **Lire le rang** (pas les points PCS — absents hors GT), puis appliquer le barème custom 2-valeurs (80/20/10 GT/Monument · 40/10/5 1-sem) × mult de rôle : points→sprinter ×2, kom→climber ×2, youth→gc_leader ×1.5. Le **GC final** reste importé via ses points PCS bruts ×1.0 (`import_gc_results` actuel). Aujourd'hui seul `/gc` est importé.
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

### A7 — Réconciliation GT Tactics (LOCKED 2026-06-02)

Les tactics **surchargent** (override, ne stackent pas) le `gt_role_mult` sur les résultats d'étape (`tactics.py`).
Valeurs ACTUELLES : Unleash domestique→1.5 · Overdrive stage_hunter→2.0 · Call the Bus bench→inclus à ×1.0 · Nemesis (attacker_won : attacker 2.0 / target 0.5 ; target_won : attacker 0.75 / target 1.25).

Problème : le nouveau stage_hunter est ×1.0 par défaut, ×1.5 en échappée → Overdrive→2.0 sur-récompense un stage_hunter hors échappée. La refonte oriente le jeu vers le stage-hunting → on re-tune les tactics autour.

**Ajustements (LOCKED) :**
- **Overdrive** : stage_hunter → **×2**, uniquement **si dans l'échappée** (`breakaway_kms ≥ seuil`) ; sinon aucun effet. Bonus distance 1pt/10km toujours additif. (Base échappée ×1.5 → Overdrive ×2 = vrai boost.)
- **Unleash** : INCHANGÉ (domestique → ×1.5 sur étape).
- **Call the Bus** : INCHANGÉ (bench riders inclus à ×1.0).
- **Nemesis — gating par profil d'étape (NOUVEAU, LOCKED 2026-06-02)** : le duel ne peut être **activé** que sur une étape dont le profil correspond au type de duel. Gating à l'**activation** (`place_tactic`), pas au scoring : on ne peut pas cibler un nemesis sur une étape hors-profil.
  - **Nemesis Sprint** : activable uniquement sur **P1/P2/P3** (plat + vallonné — cohérent avec le gating sprinter A4).
  - **Nemesis GC** : activable uniquement sur **P3/P4/P5** (vallonné arrivée en côte + montagne — là où le GC se décide ; exclut p2 vallonné arrivée plate).
  - Résolution du duel (valeurs attacker/target) **inchangée** une fois activé. Le `profile_icon` (capturé via A4) est disponible à l'activation.

Fichiers : `tactics.py` (compute_*_modifier), `scoring.py` (~494-545), server action `place_tactic` (validation du profil à l'activation pour Nemesis). `breakaway_kms` (capturé via A3) + `profile_icon` (capturé via A4) dispo à la résolution/activation des tactics.

### A8 — Documentation front du scoring (NOUVEAU, LOCKED 2026-06-02)

Les changements de barème (A2/A3/A4/A7) modifient en profondeur la façon dont les points sont gagnés. Il faut **l'expliquer aux joueurs dans l'app**, pas seulement dans `GAME_RULES.md`.

- **Où** : page « Race team » (ex-« GT team », voir A9) — encart/section pédagogique « Comment marche le scoring ».
- **Quoi expliquer** :
  - Multiplicateurs de rôle : classifs quotidiennes gc/points/kom ×2 (rôle matché), youth ×1.5 (gc_leader).
  - Finals : GC ×1.0 (pas de mult, gros windfall), Points/KOM ×2, Youth ×1.5 ; barème secondaire 2-valeurs 80/20/10 GT · 40/10/5 1-sem.
  - Stage hunter : ×1.5 en échappée (≥30 km) + 1 pt/10 km additif, ×1.0 sinon.
  - Sprinter : bonus ×1.5 seulement sur P1/P2/P3.
  - Nemesis : gating profil (Sprint P1-P3, GC P3-P5).
- **Contraintes** : **Rule #1 — lire `docs/watthunter-design-system-v3.md` avant tout dev front**. Le design visuel (composant, emplacement exact, copy EN) se décide à l'étape frontend ; ce spec acte uniquement l'**exigence** de documenter le scoring in-app. Textes en **anglais** (Language rule).
- `docs/GAME_RULES.md §7/§11/§12.3` mis à jour en parallèle (source de vérité des constantes).

### A9 — Escouade « Race team » : sélection pour les courses d'1 semaine (NOUVEAU, LOCKED 2026-06-02)

Étend la sélection d'escouade (aujourd'hui GT-only) aux **courses à étapes d'1 semaine** (Paris-Nice, Tirreno, Dauphiné, etc.). Étend le périmètre de Spec A au-delà du scoring pur (décision utilisateur).

**Mécanique cœur :**
- Une course à étapes d'1 semaine exige désormais une **escouade sélectionnée**. Les coureurs contractés **non sélectionnés scorent 0** sur cette course (comme en GT). Aujourd'hui ces courses scorent *tous* les contractés `pcs_points > 0` (`scoring.py:483-485`) → on ajoute le gating d'escouade pour ce type de course.
- **Inchangé** : GT (escouade existante) et **courses d'1 jour** (Monuments/Classics → toujours all-roster, pas d'escouade).

**Escouade (LOCKED) :**
- **Réutilise la structure `gt_squad`** : **8 slots, mêmes 6 rôles** (gc_leader 1, sprinter 1, climber 1, tt_specialist 1, stage_hunter 2, domestique 2). Coureurs = contrats actifs.
- **Lifecycle = identique au GT** : cutoff roulant **11:00 CET par étape**, **swaps libres** pendant la course (réutilise `gt_add/remove/swap` généralisés).

**Tactics (LOCKED) :**
- Les GT Tactics **s'étendent** aux courses à étapes d'1 semaine (cohérence — même généralisation que l'escouade). Mécaniques identiques + gating profil Nemesis (A7).
- **Usage limit par course d'1 semaine = 1 de chaque tactic** (défaut, ajustable) — réduit depuis les limites GT (Unleash 2 / Overdrive 2 / Call the Bus 3 / Nemesis 1/1) car ~1/3 des étapes.

**Tab rename (LOCKED) :**
- « GT Team » → **« Race Team »**. `getGTSubTabLabel()` (`apps/web/lib/gt-phases.ts:52-61`) renvoie le nom de la course active (ex. « Paris-Nice Team ») quand une escouade de course est active, sinon « Race Team ». Route `/team/gt` conservée ou renommée `/team/race` (décision frontend).

**Détection du type de course :**
- `wt_calendar_2026.json` a déjà `"type": "stage-race" | "one-day"`. Une **stage-race NON-GT** (pas de préfixe GT) = course d'1 semaine → exige une escouade. GT détectés par préfixe de slug (existant).
- Le scoring (`scoring.py`) doit appliquer le gating `if not in_squad: continue` aussi pour ces courses (aujourd'hui réservé aux GT).

**Open technique (writing-plans, pas une décision produit) :**
- `gt_squad` et `gt_tactic_activations` sont clés sur `phase_id (4/6/8)`. Les courses d'1 semaine ne sont pas des phases → **généraliser** : soit ajouter une colonne identifiant de course (`race_slug`) en relâchant `phase_id`, soit tables parallèles. Reco : généraliser les tables existantes (notion « race campaign » dont les phases GT sont un cas). À trancher au plan d'implémentation.

## Hors scope (autres specs)

- Économie bonus per-result + goals + sponsors → **Spec C**
- Système underdog (rôle, boost, réduc salaire, squad élargi) → **Spec B**

## Impact technique (récap)

| Changement | Fichiers |
|---|---|
| Seuils levels (L7=2600, L8=5000) | scoring.py:35, levels.ts, migration compute_level, GAME_RULES.md |
| No-mult /gc + classif ×2 | scoring.py `_role_multiplier()`, `ROLE_CLASSIF_MULT` |
| Finals secondaires (rang→barème 2-valeurs) Points/KOM/Youth | sync_race.py (import finals), scoring.py (barème 80/20/10 GT · 40/10/5 1-sem) |
| Youth daily (enum + scrape + score) | migration enum `classification_type`, sync_race.py:~513, scoring.py `CLASSIF_TOP["youth"]=5` |
| Stage hunter échappée + bonus distance | migration (col `breakaway_kms`), sync_race.py, scoring.py |
| Sprinter gating profil P1/P2/P3 | migration (col `profile_icon`), sync_race.py, scoring.py |
| Nemesis gating profil (Sprint P1-P3, GC P3-P5) | tactics.py, scoring.py, `place_tactic` (validation activation) |
| **A8 — Doc front scoring** | page Race team (composant pédago, design system), GAME_RULES.md |
| **A9 — Escouade Race team 1-sem** | migration (généraliser `gt_squad`/`gt_tactic_activations` au `race_slug`), scoring.py (gating squad non-GT), RPCs gt_add/remove/swap, gt-phases.ts (label), route `/team/gt` |

## Questions ouvertes (Spec A) — décisions produit résolues (2026-06-02) ; 2 points mineurs en bas
- ~~Q4 — Classif quotidien ×1.5~~ → RÉSOLU : ×2 (rôle matché), GC final ×1.0, sprint/KOM final ×2 (A2).
- ~~Q5 — Stage hunter constantes~~ → RÉSOLU : seuil 30 km, 1 pt/10 km, ×2 sur résultat d'étape seulement.
- ~~Q14 — Sprinter "argent"~~ → RÉSOLU : gating profil P1/P2/P3 sur les goals "Win a stage" + "Win 2 stages" (rôle sprinter) uniquement ; per-result et classements globaux inchangés.
- ~~Q12 — Rétroactif~~ → RÉSOLU : **forward-only**. Nouvelles règles à partir du Tour ; aucun re-score du Giro (évite la corruption rétroactive — cf. Remontada désactivé — et le re-scrape des données breakaway/profil/youth absentes du Giro). Le GC final du Giro, non encore synchro, est importé sous les nouvelles règles (×1.0) de toute façon.
- ~~Cap bonus distance échappée~~ → RÉSOLU : **aucun cap** (voir A3). À surveiller en prod.
- ~~Finals secondaires (Points/KOM/Youth) — barème ?~~ → RÉSOLU : PCS ne donne de points finals Points/KOM/Youth **qu'en GT** (Youth jamais). Donc barème custom **commun** dérivé du rang, 2-valeurs **80/20/10 GT/Monument · 40/10/5 1-semaine**, uniforme pour les trois (voir A2). Pas d'asymétrie. Seul le GC final reste sur points PCS bruts ×1.0.
- ~~L8 seuil~~ → RÉSOLU : **5000** (relevé de 4000). L8 non atteint pendant le Tour (voir A1).
- ~~Nemesis gating profil~~ → RÉSOLU : Sprint P1/P2/P3, GC P3/P4/P5, gating à l'activation (voir A7).
- ~~Escouade courses d'1 semaine~~ → RÉSOLU : A9 (réutilise gt_squad 8 slots/6 rôles, cutoff roulant+swaps, tactics étendues 1-of-each, non-sélectionnés = 0).
- **A9 — usage limit tactics 1-sem** : défaut posé à **1 de chaque** ; à confirmer/ajuster en revue.
- **A9 — généralisation tables** (`gt_squad`/`gt_tactic_activations` → `race_slug`) : décision d'implémentation au writing-plans.
