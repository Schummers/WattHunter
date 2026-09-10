# 04 — Rehausser les barèmes des classements finaux

Status: `done` (2026-08-28 — constantes + tests + GAME_RULES §7/§11 + ScoringDocCard +
ADR `2026-08-finals-baremes-rehausses.md` ; miroir closeout aligné par import des constantes)
Created: 2026-08-27
Blocks: rien directement — DOIT être livré avant la clôture de la Vuelta 2026.

## What to build

À la clôture d'un GT, les classements finaux paient :

- **GC final (top 30)** : `450, 360, 300, 255, 220, 190, 165, 145, 130, 115, 100,
  90, 80, 72, 64, 56, 48, 40, 34, 28, 24, 20, 16, 13, 10, 8, 6, 4, 2, 1`
  (écarts de tête −20% / −16.7% / −15%, décision 2026-08-27 : creuser le 1er→2e
  au-delà des −16% de l'ADR sans retomber sur la falaise PCS de −24%).
- **Points final et KOM final (top 10)** : `150, 120, 100, 75, 60, 45, 32, 22, 15, 8`.
- **Youth final (top 10)** : `75, 60, 50, 38, 30, 22, 16, 11, 8, 4`.

Toujours flat pour tous les rôles (règle ADR 2026-07 inchangée : les rôles jouent
en course, pas sur les finaux). GT uniquement ; le legacy 1-semaine `[40,10,5]`
ne bouge pas (chantier A9).

Rationale : la victoire d'étape « normale » vaut 150 (base 100 × rôle 1.5) et
jusqu'à 200 avec tactique ; l'ancien GC final à 250 ne valait que 1.67 victoire.
À 450 : ratio 3.0 vs 150, 2.25 vs 200 (Velogame 2.73, LRDT 3.33).

Aucun rescore : ces barèmes ne s'appliquent qu'à la clôture. Giro/Tour 2026 restent
payés aux anciens barèmes (doctrine « le passé est le passé », le cumul 2026 mélange
les barèmes, assumé et documenté).

## Acceptance criteria

- [ ] Constantes mises à jour + tests de la fonction de scoring des finaux
- [ ] GAME_RULES §7/§11 + ADR amendé (ou nouvel ADR court) + ScoringDocCard à jour
- [ ] Le miroir de vérification (script closeout) utilise les nouveaux barèmes
- [ ] Aucun changement sur les slugs 1-semaine

## Blocked by

None — can start immediately (parallèle à 01 et 02).
