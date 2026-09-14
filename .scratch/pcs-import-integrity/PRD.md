# Intégrité de l'import PCS — décalage rang ↔ coureur

Status: `ready-for-agent`
Created: 2026-09-14 (session de clôture Vuelta 2026)
Bloque: la clôture de la Vuelta 2026, et la confiance dans tout l'historique de scoring

## Problem Statement

Les résultats d'étape stockés en base n'associent pas toujours le bon coureur au
bon rang. Un joueur qui compare sa page WattHunter au classement affiché sur
procyclingstats voit un écart : un coureur crédité d'un rang qu'il n'a pas fait,
donc d'un XP qu'il n'a pas gagné, et son voisin de classement lésé d'autant.

Mesuré le 2026-09-14 sur la Vuelta 2026, en confrontant la base à sept captures
d'écran PCS prises à la main (étapes 4, 7, 10, 13, 16, 19, 20) :
**137 rangs conformes, 13 écarts, 5 étapes touchées sur 7.** Environ 9% des rangs
vérifiés sont faux.

Le problème est invisible depuis l'intérieur du système. Toutes les vérifications
menées jusqu'ici (`verify_tdf2026_closeout.py`, les audits « 0 écart » du Tour et
de la Vuelta) recalculent l'XP **à partir du rang stocké**. Si le rang est faux,
le recalcul est faux de la même manière et le diff sort à zéro. Ces « 0 écart »
prouvent la justesse du barème, jamais celle de l'import.

## Solution

Trois temps, dans cet ordre :

1. **Trancher la cause** avant toute correction. Deux hypothèses concurrentes
   (voir ci-dessous), un test qui les sépare.
2. **Corriger la source** du décalage, avec un test de non-régression bâti sur
   une fixture HTML réelle, pas sur un squelette synthétique.
3. **Décider du rattrapage** des données déjà scorées, en connaissance de
   l'impact XP chiffré.

La clôture de la Vuelta 2026 ne passe pas par le scraper : elle se fait depuis
les captures fournies par l'utilisateur, seule source dont la justesse est établie.

## Observations (2026-09-14)

Les 13 écarts se rangent en deux familles, et la seconde est la preuve décisive.

### Famille A — transposition de deux coureurs voisins (5 cas, 10 rangs)

| Étape | Rangs | Capture | Base |
|---|---|---|---|
| 4 | 8 / 9 | Carapaz / Skjelmose | Skjelmose / Carapaz |
| 4 | 15 / 16 | Brenner / Berthet | Berthet / Brenner |
| 7 | 6 / 7 | Sosa / Lutsenko | Lutsenko / Sosa |
| 13 | 19 / 20 | Berthet / Craps | Craps / Berthet |
| 16 | 9 / 10 | Dainese / Macías | Macías / Dainese |

### Famille B — héritage du rang d'un coureur hors pool (3 cas)

Un coureur absent de la table `riders` est sauté, et un coureur voisin récupère
**son rang et ses points PCS**.

| Étape | Observé | Attendu |
|---|---|---|
| 13 | Bisiaux rang 9, 8 pts | Bisiaux rang 8, 10 pts (rang 9 = Dalby, hors pool) |
| 7 | Pickering rang 15, 1 pt | Pickering rang 16, 0 pt (rang 15 = Samitier, hors pool) |
| 19 | Vermaerke rang 10, 6 pts | Vermaerke rang 9, 8 pts (rang 10 = Samitier, hors pool) |

### Pourquoi la famille B innocente notre code

`import_race_results()` itère sur les entrées de `stage.results()`. Chaque entrée
porte son propre `rider_url`, `rank` et `pcs_points`, et un coureur non résolu
fait un `continue`. **Sauter une entrée ne peut décaler aucune autre entrée.**
Notre boucle d'import est structurellement incapable de produire cet effet.

Le décalage est donc déjà présent dans ce que `stage.results()` retourne — soit
parce que la lib mélange ses colonnes, soit parce que le HTML qu'on lui donne est
déjà faux.

### Observation corroborante (même session)

En lisant la page KOM finale de la Vuelta dans un navigateur piloté, un `<tr>`
unique contenait `rider/jarno-widar` avec `team = Movistar Team`. Widar court chez
Lotto Intermarché. L'incohérence était **à l'intérieur d'une seule ligne du HTML
reçu**, pas dans notre lecture.

## Hypothèses

**H1 — PCS sert du HTML altéré aux clients automatisés.** Le site est déjà derrière
Cloudflare et nous bloque régulièrement (nodriver KO depuis Chrome 151, `/kom` et
`/youth` finaux inaccessibles au scraper le 2026-09-14 alors que `/points` passait).
Servir des données subtilement permutées est une contre-mesure anti-scraping connue.
Si H1 est vraie, **aucune donnée scrapée de ce site n'est fiable**, et la stratégie
produit change : source humaine ou fournisseur payant.

**H2 — `procyclingstats.Stage.results()` désaligne ses colonnes.** La lib construit
des listes parallèles par colonne puis les zippe. Une cellule manquante ou en trop
sur certaines lignes (icône de maillot, temps `,,` du même groupe, ligne de coureur
non partant) décale tout le reste. Si H2 est vraie, le correctif est local et le
scraper reste exploitable.

**H3 — les deux, indépendamment.** À ne pas exclure : H2 peut être réelle sans
expliquer l'incohérence intra-ligne observée sur la page KOM.

Le test qui sépare H1 de H2 est dans le ticket 01 : sauvegarder le HTML brut reçu
sur l'étape 4 et lire à qui la ligne du rang 8 associe le nom. Si le HTML dit
Skjelmose, c'est H1. S'il dit Carapaz et que seul `stage.results()` se trompe,
c'est H2.

## User Stories

1. En tant que joueur, je veux que le rang affiché pour un coureur corresponde à son rang réel sur PCS, pour que mon XP soit celui que j'ai mérité.
2. En tant que joueur, je veux que le classement de ma ligue reflète les performances réelles, pour que la compétition ait du sens.
3. En tant que joueur lésé par une erreur d'import, je veux que la correction soit rétroactive, pour ne pas rester pénalisé par un bug.
4. En tant que joueur, je veux savoir qu'une étape a été corrigée et pourquoi, pour ne pas croire à une triche ou à un bug de l'app.
5. En tant que commissaire de ligue, je veux pouvoir vérifier un classement final ligne à ligne contre la source, pour clore une phase en confiance.
6. En tant que commissaire, je veux un état daté de ce qui a été vérifié et de ce qui ne l'a pas été, pour savoir où porte ma confiance.
7. En tant que développeur, je veux savoir si le scraper reçoit des données altérées, pour décider si la source est encore exploitable.
8. En tant que développeur, je veux un test qui échoue si l'import désaligne rang et coureur, pour que le bug ne revienne pas.
9. En tant que développeur, je veux que ce test s'appuie sur du HTML réel de PCS, pour qu'il attrape ce qu'un squelette synthétique ne verra jamais.
10. En tant que développeur, je veux que l'import refuse d'écrire plutôt que d'écrire faux quand il détecte une incohérence, pour que le silence ne soit plus le mode d'échec.
11. En tant que développeur, je veux une vérification qui confronte la base à une source externe et non à elle-même, pour que « 0 écart » veuille enfin dire quelque chose.
12. En tant que développeur, je veux chiffrer l'impact XP d'une erreur de rang avant de décider d'un rescore, pour arbitrer sur des nombres.
13. En tant que développeur, je veux pouvoir injecter un classement depuis une source manuelle, pour clôturer une course même quand le scraper est hors service.
14. En tant que développeur, je veux que cette injection manuelle soit tracée comme telle en base, pour distinguer plus tard les données scrapées des données saisies.
15. En tant que développeur, je veux connaître l'étendue du problème sur l'historique (Giro, Tour, Vuelta), pour savoir si le passé est rattrapable.
16. En tant que propriétaire du produit, je veux savoir si la dépendance à PCS est tenable, pour arbitrer entre source gratuite fragile et fournisseur payant.
17. En tant que propriétaire du produit, je veux que la clôture de la Vuelta 2026 aboutisse malgré le bug, pour ne pas laisser la ligue playtest en suspens.
18. En tant que propriétaire du produit, je veux que l'incident soit documenté en runbook, pour que la prochaine clôture n'ait pas à redécouvrir tout ça.

## Implementation Decisions

- **Aucune correction de données avant le verdict du ticket 01.** Corriger sous
  H2 alors que H1 est vraie reviendrait à réécrire proprement des données fausses.
- **La clôture de la Vuelta 2026 se fait depuis les captures**, pas depuis le
  scraper, quel que soit le verdict. Cinq jeux : étape 21, GC final, Points final,
  KOM final, Youth final.
- **Les classements finaux KOM et Youth sont déjà reconstruits** depuis les
  captures et validés (`.scratch/pcs-import-integrity/finals-kom-youth.json`,
  produit en session). Seuls les rangs 1 à 10 rapportent de l'XP
  (`GT_SECONDARY_FINAL_SCALES`), la zone est couverte par les captures.
- **Traçabilité de la saisie manuelle** : une donnée injectée à la main doit être
  distinguable d'une donnée scrapée. La table `backfill_traceability` et le script
  du même nom existent déjà, à évaluer comme support plutôt qu'en créer un autre.
- **Le garde-fou d'import** est préféré à la correction silencieuse : si
  l'alignement n'est pas vérifiable, l'import échoue bruyamment. Un import qui
  écrit faux sans rien dire est le mode d'échec qui a produit cet incident.
- **Le harnais de vérification confronte la base à une source externe.** Un
  recalcul interne ne peut pas, par construction, détecter une erreur d'import.
- **Les ex æquo ne sont pas des écarts.** Deux coureurs à égalité stricte (mêmes
  points au classement par points, même temps d'arrivée) peuvent être ordonnés
  différemment d'un rendu à l'autre. Le harnais doit les traiter comme
  interchangeables, sous peine de crouler sous les faux positifs.

## Testing Decisions

Un bon test ici ne teste que le comportement externe : **on donne un HTML, on
vérifie les lignes écrites en base.** Il ne connaît ni les listes internes de la
lib, ni l'ordre des colonnes, ni la mécanique de zip.

- **Seam unique et existant** : `import_race_results()`, avec `fetch_html` patché
  et le vrai `Stage` qui parse. Prior art : `tests/test_sync_race.py:65` patche
  déjà `sync_race.Stage` et `fetch_html` ; `tests/test_stage_events.py:16` utilise
  déjà un squelette HTML. La nouveauté est d'utiliser du **HTML PCS réel
  sauvegardé** plutôt qu'un squelette, parce que le bug vit précisément dans ce
  que le squelette simplifie.
- **Fixtures golden** : une page d'étape réelle, plus le tableau rang → coureur
  transcrit de la capture correspondante. L'étape 4 de la Vuelta 2026 est le
  meilleur candidat (deux transpositions connues), l'étape 13 le second (un
  héritage et une transposition).
- **Cas à couvrir** : coureur hors pool en milieu de classement (famille B),
  deux coureurs du même groupe au même temps (famille A), coureur non partant ou
  abandon en milieu de tableau, ligne portant une icône de maillot.
- **Module testé** : `sync_race`. `scoring` n'est pas en cause et n'a pas à bouger.

## Seconde source de données

Le harnais du ticket 02 dépend aujourd'hui de captures d'écran manuelles. Le
ticket 07 instruit une seconde source automatisable et indépendante de PCS, qui
rendrait la vérification systématique et trancherait H1 au passage : deux sources
indépendantes d'accord entre elles et en désaccord avec ce que notre scraper
reçoit, c'est la démonstration.

Première sonde de `firstcycling.com` le 2026-09-14 : bloqué par Cloudflare lui
aussi. Deux sites de statistiques sur deux derrière une protection anti-bot — si
le motif se confirme, c'est un risque structurel du produit, pas un incident.

## Out of Scope

- Le barème et la formule de scoring. Ils sont justes, c'est leur entrée qui est fausse.
- Le blocage Cloudflare en tant que tel (nodriver KO Chrome 151, `/kom` et `/youth`
  inaccessibles) : problème voisin, suivi ailleurs, sauf si le ticket 01 conclut
  que c'est la même cause.
- La migration vers un fournisseur de données payant. Les tickets 01 et 07 peuvent
  la rendre nécessaire, ils ne la décident pas.
- L'écriture du collecteur de la seconde source. Le ticket 07 choisit la source,
  il ne l'implémente pas.
- Le rattrapage du Giro 2026 et du Tour 2026. À évaluer après la Vuelta, ticket 06.

## Further Notes

L'erreur a été trouvée parce que l'utilisateur a fourni des captures d'écran, pas
parce qu'un test a échoué. C'est la leçon la plus coûteuse de l'incident : le
système n'avait aucun moyen de se savoir faux. Le ticket 02 existe pour supprimer
cette dépendance à la chance.

Contexte de session : la clôture de la Vuelta 2026 était la tâche demandée. Étape 21,
GC final et Points final ont été importés en prod le 2026-09-14 **avec le bug**, et
le rescore des slugs de clôture n'a volontairement pas été lancé. La base est donc
dans un état intermédiaire, décrit au ticket 04.
