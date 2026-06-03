# Handoff — Spec C : Économie Bonus & Sponsors

> Lire d'abord : `docs/handoffs/2026-06-02-refonte-equilibrage-index.md` + le spec `docs/superpowers/specs/2026-06-01-spec-c-bonus-economy-design.md`.

## Statut : ~90% — 3 opens à fermer

## Décisions lockées (résumé — détail dans le spec)

- **Système 2-valeurs partout** (base bonus ET goals) : colonne gauche = course d'une semaine / one-day, droite = **GT / Monument (×2)**.
- **Base bonus** : T4 = GC 10k/20k, podium(top3) 5k/10k, one-day 10k/20k. **T5 (Visma/RB) = identique T4** (`monthly_budget` plus élevé). **T1-T3** = montants actuels + ajout du doublement, **pas de goals**, colonne `orientation` supprimée. **T6 = DIFFÉRÉ**.
- **Philosophie** : tiers bas = base haute / pas de goals ; tiers hauts = base réduite / goals riches. Inversion T3>T4 assumée.
- **Goals (2-valeurs, cumul par coureur)** : GC podium 30/60, top5 20/40, maillot leader 15/30, jeune 10/20 · Sprint classement-points 30/60, 2 étapes 20/40, 1 étape 10/20, maillot 10/20 · CLM étape 15/30, 2-top10 10/20 · Grimpeur/Stage-hunter : KOM 20/40, 2 étapes (2 SH) 20/40, 1 étape 10/20, maillot KOM 10/20.
- **Mapping** : Ineos GC+CLM · Decathlon GC+Sprint · Soudal/Lidl Sprint+StageHunter · Visma GC+Sprint · RedBull GC+StageHunter.
- **Nationalité** : ×1.20 (ex 1.25) pour T1-T4 ; aucune pour T5-T6.
- **Maillot blanc (youth) tracké** + **goals KOM ajoutés** (résout les ex-trous de tracking).
- **UI** : `sponsor-bonus-details.tsx` → 2 colonnes partout (wireframe validé dans le spec, section C4) → maquette HTML dans le handoff UI.

## Opens à fermer (ce qui reste de cette spec)

1. **Nom générique du "maillot leader"** (rose/jaune/rouge selon le GT). Proposition : "Race Leader". À valider.
2. **T6 (UAE)** : DIFFÉRÉ — l'utilisateur le retravaillera plus tard. Aujourd'hui il garde son prestige (100k + ×2 GT) → c'est le sponsor le plus riche, ce qui va contre la compression. TODO connu.
3. **Rétroactif Giro** (NON tranché) :
   - Périmètre : recalculer seulement bonus/treasury au nouveau barème, OU re-score complet (XP : no-mult GC, classif ×2, finals points/kom/youth, stage_hunter, sprinter) ? (cross-ref Spec A doute #2)
   - **Treasury négative** : réduire les bonus passés peut faire passer une équipe sous ses enchères engagées (Leopard avait 250k de bonus). Comment gérer : clamp à 0 + ligne d'audit ? autoriser négatif temporaire ? annuler des enchères ?

## Impl. (fichiers)

- Table `sponsors` (migration) : montants 2-valeurs par tier, drop `orientation` T1-T3.
- `services/pcs-sync/sponsor_bonus.py` : barème 2-valeurs + nationalité 1.20 + doublement GT/monument.
- `apps/web/lib/gt-goals.ts` + `services/pcs-sync/goal_evaluator.py` : montants 2-valeurs, archétypes par sponsor, gating profil des win-stage sprinter, nouveaux évaluateurs (KOM, youth jersey, leader jersey générique).
- Migration recompute rétroactif Giro (selon périmètre choisi).

## Prompt à coller dans la nouvelle discussion

```
On finalise puis on planifie "Spec C — Économie Bonus & Sponsors" de la refonte équilibrage WattHunter.
Lis d'abord, sans relire d'anciennes conversations :
- docs/handoffs/2026-06-02-refonte-equilibrage-index.md
- docs/handoffs/2026-06-02-spec-c-bonus-economy-handoff.md
- docs/superpowers/specs/2026-06-01-spec-c-bonus-economy-design.md
Reste 3 opens à fermer avec moi : (1) nom du "maillot leader", (2) T6 (différé, à confirmer qu'on le laisse), (3) rétroactif Giro (périmètre XP+bonus + gestion treasury négative). Ensuite lance superpowers:writing-plans. NB : la grille des montants par tier (T1-T3, T5) est à dériver des valeurs actuelles en base — requêter via le client python pcs-sync (voir index).
```
