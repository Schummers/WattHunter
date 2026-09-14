# 04 — Clôturer la Vuelta 2026 depuis les captures

Status: `ready-for-human`
Created: 2026-09-14

## État exact de la base au 2026-09-14

Écrit en prod pendant la session, **avec le bug d'import** :
- `race/vuelta-a-espana/2026/stage-21` — 106 résultats, classements du jour (gc=43, points=20, kom=10)
- `race/vuelta-a-espana/2026/gc` — 106 lignes, GC final
- `race/vuelta-a-espana/2026/points` — 79 lignes dans `gt_final_classifications`
- 6 sponsor bonuses crédités sur `/gc`, tous en ligues manager (demo + V1), zéro en classic. Conforme.

Non écrit, volontairement :
- `race/vuelta-a-espana/2026/kom` et `/youth` — 0 ligne. Cloudflare a bloqué le scraper sur ces deux pages.
- **Le rescore des slugs de clôture n'a pas été lancé.** L'XP des maillots finaux n'est pas distribué.

Autres constats de session, sans action :
- **Étape 3 annulée** (météo, col de Mont-Louis). Le trou dans les données est légitime, rien à scorer.
- Baseline complet pris **avant** toute écriture : `snapshot-pre-cloture.json` dans ce dossier.

## Ce qu'il reste à faire

1. **Reconstruire les cinq jeux de clôture depuis les captures**, pas depuis le
   scraper : étape 21, GC final, Points final, KOM final, Youth final.
   Les valeurs sont **déjà transcrites** :
   - étape 21, GC final, Points final → `verif/expected_closing.py`
   - KOM final, Youth final → `finals-kom-youth.json` (slugs PCS déjà résolus)

   Attention : les captures de ces cinq classements n'ont jamais existé comme
   fichiers, elles n'étaient que dans le fil de conversation du 2026-09-14.
   `expected_closing.py` en est **la seule trace**. Les captures d'étapes
   (4, 7, 10, 13, 16, 19, 20) sont, elles, dans `captures/` (gitignoré).
2. KOM et Youth sont **déjà reconstruits et validés** : `finals-kom-youth.json`.
   Seuls les rangs 1 à 10 rapportent de l'XP (`GT_SECONDARY_FINAL_SCALES`), la zone
   est intégralement couverte par les captures. Deux erreurs y ont été évitées de
   justesse, dans la zone scorée : KOM 6/7 (Mas/Miquel) et Youth 6/7
   (García Pierna/Widar), toutes deux inversées par la lecture DOM.
3. **Corriger ou assumer les trois slugs déjà écrits** (étape 21, GC, Points).
   Le GC porte au moins une erreur avérée : rangs 6 et 7 inversés, Onley (9:28)
   derrière Omrzel (10:38), soit 170 XP au lieu de 145 pour l'un et l'inverse pour
   l'autre. L'utilisateur a arbitré en session de **garder les valeurs du pipeline**
   pour ces trois slugs ; cet arbitrage a été pris avant le constat des 13 écarts
   sur les étapes, il mérite d'être reposé.
4. **Rescorer** les 5 slugs de clôture ensemble. Attention : un rescore limité à
   `points`/`kom`/`youth` ne fait rien, la boucle de scoring est pilotée par
   `race_results` et ces slugs n'en ont pas. Il faut inclure `stage-21` et `gc`.
5. **Produire le livrable de vérification** demandé : un tableau par équipe, XP
   ventilé par slug de clôture, avec pour chaque coureur son rang, le barème
   appliqué et le total, recoupable contre les captures et `GAME_RULES.md`.
6. **Runbook de clôture**, sur le modèle de `docs/runbooks/tdf2026-closeout-2026-07-27.md`,
   incluant l'incident d'intégrité.

## Pièges connus

- Le rescore doit rester **scopé aux 5 slugs**. Un rescore large fait dériver l'XP
  des autres étapes par code-drift — précédent documenté au backfill Giro.
- La ligue concernée est **Classic V2** (`00000000-0000-4000-8000-c1a551c2026e`),
  mode `classic` : sponsors et goals sont volontairement sautés, c'est normal.
- Deux équipes classic avaient déjà scoré 0 XP à l'étape 1 pour cause de squad
  verrouillée après le `role_cutoff`. Vérifier que le cas ne se reproduit pas sur
  l'étape 21 avant de conclure à une anomalie.

## Comments
