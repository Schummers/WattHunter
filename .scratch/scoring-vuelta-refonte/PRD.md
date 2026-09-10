# Refonte scoring Vuelta 2026 — lot unique

Status: `ready-for-human`
Created: 2026-08-27 (spec complétée le 2026-08-27, session benchmark Velogames/LRDT)

## Contexte

Deux origines convergentes :

1. **Bug Underdog** (retour joueur 2026-08-27) : le boost `clamp(pcs_rank/100,1,4)`
   multiplie tout le total du jour au lieu des seuls points d'étape. Contraire à
   GAME_RULES §14. Vérifié, cas chiffré dans l'issue 01.
2. **Benchmark scoring** (session 2026-08-27, données réelles Tour 2026 + 19 GT
   archivés de La Route du Tour + barèmes Velogames) : décision d'ajouter les
   sprints intermédiaires et les côtes (GPM en course), et de rehausser les
   classements finaux (GC 250→450, Points/KOM 100→150, Youth 50→75).

## Décisions de design (actées 2026-08-27, ne pas re-débattre ici)

- **Périmètre** : Grands Tours uniquement. Un seul pipeline, les deux modes
  (manager sera tué, mais on ne code pas de branche dédiée).
- **Formule** : les points d'événement (côtes + sprints) sont un terme **additif
  dans la parenthèse** — sous `nemesis_modifier`, PAS multipliés par la stratégie,
  PAS par l'underdog. Cohérent avec le fix 01 (underdog = role_mult sur
  `rank_points` seulement).
- **Barème côtes** (arrivées au sommet incluses, comme Velogames et LRDT) :
  HC top 8 `8/6/5/4/3/2/1/1` · cat 1 top 5 `4/3/2/1/1` · rien en cat 2/3/4.
- **Barème sprints intermédiaires** : top 8 `6/5/4/3/2/2/1/1`.
- **Multiplicateurs d'événement** : grimpeur ×2 (côtes), sprinteur ×2 (sprints),
  stage_hunter ×1.5 (les deux, inconditionnel), underdog ×1, autres ×1.
- **Finaux** : GC `450,360,300,255,220,190,165,145,130,115,100,90,80,72,64,56,
  48,40,34,28,24,20,16,13,10,8,6,4,2,1` (écart 1er→2e −20%) ·
  Points/KOM `150,120,100,75,60,45,32,22,15,8` · Youth `75,60,50,38,30,22,16,11,8,4`.
- **Calibrage vérifié** (simulation sur le Tour 2026, ligue classic V2) : le paquet
  côtes+sprints = ~4.4% de l'XP de la ligue, 0 équipe déplacée au classement,
  top bénéficiaires Pedersen 175 / Carapaz 111 / Philipsen 98. GC final 450 = ratio
  3.0 vs victoire d'étape ×1.5 (Velogame 2.73, LRDT 3.33).

## Réponses aux deux questions ouvertes du lot initial

1. **La donnée est disponible sur la page d'étape déjà fetchée.** `Stage.climbs()`
   (lib procyclingstats) donne catégorie + rang + points par col ; les sprints
   intermédiaires sont dans le même HTML (onglet Points, `<h4>Sprint | …</h4>`,
   tableau de 15 rangs), parseur maison ~40 lignes prototypé et validé sur les 21
   étapes du Tour 2026. Zéro requête HTTP supplémentaire.
2. **Additif vs multiplié : tranché ci-dessus**, cohérent entre 01 et le nouveau
   terme d'événement.

## Stratégie

Un seul rescore de la Vuelta (3 étapes courues, étape 3 annulée) après livraison
de tout le lot. Les finaux (issue 04) ne nécessitent AUCUN rescore : ils ne sont
distribués qu'à la clôture du GT — il suffit qu'ils soient en place avant la fin
de la Vuelta.

Ordre : 01 (fix) ∥ 02 (données) ∥ 04 (finaux) → 03 (scoring) → 05 (rescore).

## Issues

- `issues/01-underdog-mult-scope.md` — fix underdog. **Option B retenue.** Prêt.
- `issues/02-event-data-scrape-store.md` — scraper + stocker côtes et sprints. Prêt.
- `issues/03-event-scoring-terms.md` — nouveaux termes de scoring. Bloqué par 01+02.
- `issues/04-finals-baremes.md` — nouveaux barèmes finaux. Prêt.
- `issues/05-rescore-vuelta-2026.md` — rescore unique. Bloqué par 01+03.

## Non-objectifs

- Ne pas rescorer le Giro ni le Tour 2026 (clos ; doctrine « le passé est le
  passé », ADR 2026-07). Le cumul 2026 mélange les barèmes, assumé.
- Ne pas toucher aux courses 1 semaine (chantier A9, plus tard).
- Ne pas toucher au barème d'étape rank-based (ADR `2026-07-rank-based-gt-barème`).
