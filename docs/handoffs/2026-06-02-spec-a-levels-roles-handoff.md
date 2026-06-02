# Handoff — Spec A : Levels & Rôles & Scoring

> Lire d'abord : `docs/handoffs/2026-06-02-refonte-equilibrage-index.md` + le spec `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` (source de vérité détaillée).

## Statut : DESIGN COMPLET ✅ (prêt pour writing-plans)

> ⚠️ Scope élargi le 2026-06-02 (review utilisateur) : ajout **A8** (doc front du scoring) + **A9** (escouade « Race Team » = sélection d'escouade pour les courses à étapes d'1 semaine, réutilise gt_squad, tactics étendues). L8 relevé à 5000. Nemesis gaté par profil. Voir le spec pour le détail — ce handoff résume l'état d'origine.

## Décisions lockées (résumé — détail dans le spec)

- **Levels** : L1-L5 inchangés ; **L6=1200, L7=2600, L8=4000**. No-regression. (`scoring.py:35`, `apps/web/lib/levels.ts`, migration `compute_level`.)
- **Multiplicateurs de classement** : daily gc/points/kom matché **×2** ; **youth daily** matché (gc_leader) **×1.5** ; **GC final ×1.0** (pas de mult, déjà gros windfall) ; **Points/KOM finals ×2** ; **Youth final** custom **80/20/10** (PCS=0) ×1.5 gc_leader.
- **Finals des 4 classements scorés** : aujourd'hui seul `/gc` est importé (`import_gc_results`) → ajouter import/scoring de Points/KOM/Youth finals.
- **Sprinter** : ×1.5 uniquement sur profils **P1/P2/P3** (pas montagne) ; goals "Win a stage"/"Win 2 stages" sprinter gatés P1/P2/P3 ; per-result inchangé. Pas de restriction de rôle.
- **Stage hunter** : ×1.0 défaut, **×1.5 en échappée** (`breakaway_kms ≥ 30km`) + **1 pt/10 km additif** (non multiplié), **pas de cap**. Combativité supprimée.
- **GC leader** : intouché.
- **Tactics** : **Overdrive** → stage_hunter **×2 si échappée seulement** (base 1.5→2). Unleash (dom ×1.5), Call the Bus (bench ×1.0), Nemesis : **inchangés**.

## Pré-requis techniques (nouveaux captures)

- Colonne `race_results.breakaway_kms` + extraction dans `sync_race.py:import_race_results`.
- Colonne `race_results.profile_icon` (p0-p5) + extraction (pour le gating sprinter).
- `youth` ajouté à l'enum `classification_type` + `("youth", stage.youth()[:50])` dans `import_daily_classifications` (~ligne 513) — même fetch, scoré daily.
- Import/scoring des finals Points/KOM/Youth (slugs `/points`,`/kom`,`/youth` ou table).
- `scoring.py` : `CLASSIF_TOP["youth"]=5`, matchs de rôle, barème youth final custom, mult /gc forcé 1.0, gating sprinter par profil, stage_hunter échappée, Overdrive ×2 conditionnel.

## Doutes / opens mineurs — RÉSOLUS 2026-06-02

1. ~~Finals secondaires (Points/KOM/Youth)~~ → **RÉSOLU** : PCS ne donne de points finals secondaires qu'en GT (Youth jamais). Barème custom **commun** dérivé du rang, 2-valeurs **80/20/10 GT/Monument · 40/10/5 1-semaine**, uniforme pour les trois. GC final reste sur points PCS bruts ×1.0.
2. ~~Rétroactif Giro~~ → **RÉSOLU : forward-only** (à partir du Tour ; pas de re-score Giro). GC final Giro importé sous nouvelles règles (×1.0).
3. ~~Cap bonus distance échappée~~ → **RÉSOLU : aucun cap** (à surveiller en prod).
4. Ordre d'application dans `scoring.py` (tactics avant per-rider loop existe déjà) — point **technique**, à traiter au writing-plans (vérifier interaction breakaway/profil au scoring).

## Prompt à coller dans la nouvelle discussion

```
On finalise puis on planifie l'implémentation de "Spec A — Levels & Rôles & Scoring" de la refonte équilibrage WattHunter.
Lis d'abord, sans relire d'anciennes conversations :
- docs/handoffs/2026-06-02-refonte-equilibrage-index.md
- docs/handoffs/2026-06-02-spec-a-levels-roles-handoff.md
- docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md
Le design est complet. Confirme avec moi les 3 doutes ouverts du handoff, puis lance superpowers:writing-plans pour le plan d'implémentation détaillé (scoring.py, sync_race.py, migrations, levels.ts).
```
