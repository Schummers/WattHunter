# 03 — Nouveaux termes de scoring : côtes et sprints intermédiaires

Status: `done` (2026-08-28 — termes additifs dans la parenthèse, colonnes
`kom_event_bonus`/`sprint_event_bonus` (migration `20260828000100` prod), garde
anti-silence p4/p5, miroir closeout, GAME_RULES §7/§11 + ScoringDocCard, 15 tests.
Les 6 critères d'acceptation passent.)
Created: 2026-08-27
Blocks: `05-rescore-vuelta-2026.md`

## What to build

Sur une étape de GT, un coureur de la squad marque en plus de ses points actuels :
ses points de franchissement de côtes (HC top 8 `8/6/5/4/3/2/1/1`, cat 1 top 5
`4/3/2/1/1`, rien en cat 2/3/4, arrivées au sommet incluses) et ses points de
sprints intermédiaires (top 8 `6/5/4/3/2/2/1/1`). Multiplicateurs d'événement :
grimpeur ×2 sur les côtes, sprinteur ×2 sur les sprints, stage_hunter ×1.5 sur les
deux (inconditionnel, pas de condition d'échappée), underdog ×1, autres rôles ×1.

Placement dans la formule : terme **additif dans la parenthèse**, à côté de
`gt_classif_bonus` / `gt_distance_bonus` / `assist_bonus` — donc sous
`nemesis_modifier`, PAS multiplié par `(1 + strategy_bonus)`, PAS par l'underdog
(cohérent avec le fix 01). ITT : aucun événement (pas de sprint/col sur un chrono).
GT uniquement ; un seul pipeline pour les deux modes.

Traçabilité : deux nouvelles colonnes sur la ligne d'XP quotidienne (côtes /
sprints séparés), même migration-pattern que `assist_bonus`.

Vérifiabilité : Richard Carapaz (grimpeur) sur le Tour 2026 aurait cumulé ~111 XP
de côtes sur 3 semaines, sous le KOM final — la hiérarchie maillot > cumul des
franchissements est le garde-fou de calibrage.

## Acceptance criteria

- [ ] Grimpeur 1er d'un HC = 16 XP ; sprinteur 1er d'un sprint intermédiaire = 12 XP ; stage_hunter 2e d'un cat 1 = 4.5 XP ; underdog 1er d'un HC = 8 XP (×1)
- [ ] Le terme n'est pas affecté par `strategy_bonus`, l'est par `nemesis_modifier`
- [ ] Étape ITT → 0 partout, sans erreur
- [ ] Le miroir de vérification (script closeout) reproduit la nouvelle formule
- [ ] GAME_RULES §7 + §11 et la ScoringDocCard mis à jour dans la même session (Rule #4)
- [ ] Tests : un cas par rôle (grimpeur/sprinteur/stage_hunter/underdog/domestique), un cas nemesis, un cas ITT

## Blocked by

- `01-underdog-mult-scope.md` (la parenthèse de la formule doit être stabilisée d'abord)
- `02-event-data-scrape-store.md` (la donnée)
