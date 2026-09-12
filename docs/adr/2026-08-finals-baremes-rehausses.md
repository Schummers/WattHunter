# ADR: Rehausse des barèmes des classements finaux de Grand Tour

- **Status**: Accepted (amendé le 2026-09-12 : GC final 450 → 400, courbe rescalée ×0.89, avant la clôture de la Vuelta 2026 ; le 450 n'a jamais été payé)
- **Date**: 2026-08-28 (décision de design actée le 2026-08-27, session benchmark
  Velogames / La Route du Tour)
- **Scope**: classements finaux de GT uniquement (GC / Points / KOM / Youth).
  Amende `2026-07-rank-based-gt-barème.md` sans toucher au barème d'étape ni aux
  dailies. Le legacy 1-semaine `[40, 10, 5]` ne bouge pas (chantier A9).

## Contexte

Depuis la refonte 2026-07, la victoire d'étape « normale » vaut 150 XP (base 100 ×
rôle 1.5) et jusqu'à 200 avec tactique. Le GC final à 250 ne valait donc que ~1.67
victoire d'étape, contre 2.73 chez Velogames et 3.33 chez La Route du Tour : gagner
le général d'un GT de trois semaines payait à peine plus qu'une bonne échappée.

## Décision

Nouveaux barèmes, appliqués à partir de la clôture de la Vuelta 2026 :

- **GC final (top 30)** : `400, 320, 265, 225, 195, 170, 145, 130, 115, 100,
  90, 80, 70, 64, 56, 50, 42, 35, 30, 25, 21, 18, 14, 12, 9, 7, 5, 4, 2, 1`.
  Écarts de tête −20% / −16.7% / −15% : creuser le 1er→2e au-delà des −16% de
  2026-07 sans retomber sur la falaise PCS de −24%.
- **Points final et KOM final (top 10)** : `150, 120, 100, 75, 60, 45, 32, 22, 15, 8`.
- **Youth final (top 10, demi-échelle)** : `75, 60, 50, 38, 30, 22, 16, 11, 8, 4`.

Ratios de contrôle : GC final / victoire d'étape = 2.67 à 400 (2.0 vs victoire ×2
tactique ; 3.0 avec le 450 initial, abandonné le 2026-09-12 pour se caler sur Velogames 2.73 après vérification que les finaux LRDT sont flat, ratio 1.67, et non 3.33) ; Points/KOM = 1.5 victoire ; Youth = moitié de Points/KOM. Toujours flat
pour tous les rôles (règle 2026-07 inchangée : les rôles jouent en course, pas sur
les finaux).

## Conséquences

- **Aucun rescore** : les finaux ne sont distribués qu'à la clôture d'un GT. Giro et
  Tour 2026 restent payés aux anciens barèmes (« le passé est le passé ») ; le cumul
  2026 mélange les barèmes, assumé.
- Constantes : `GT_GC_FINAL_SCALE` et `GT_SECONDARY_FINAL_SCALES` dans
  `services/pcs-sync/scoring.py`. Le miroir `scripts/verify_tdf2026_closeout.py`
  importe ces constantes : le relancer sur le Tour 2026 signalerait désormais des
  écarts sur les finaux — attendu, ne pas « corriger ».
