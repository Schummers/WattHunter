# WattHunter, synthèse de l'audit rewrite

> Basée sur 6 rapports d'audit read-only (`findings/01` à `06`), 27 août 2026.
> Lecteur visé : le fondateur, solo, qui décide de ses prochaines semaines.

---

## Verdict en une phrase

**Ne réécris pas la base ni le pipeline, réécris le client : scénario B.** Le
couplage classic/manager n'est pas le problème (il est petit et bien isolé), la
couche de présentation web est de toute façon condamnée par le pivot mobile, et
le vrai blocage à traiter avant toute ligne de code mobile est une seule
fonction : `forceResolveRound`.

---

## 1. Les trois scénarios

| | A. Amputation | B. Rewrite client, backend préservé | C. Rewrite complet |
|---|---|---|---|
| Ce qu'on fait | On garde le repo, on supprime le manager, on nettoie, on reste sur le web | Nouveau client mobile (React Native + Expo), on garde Supabase (schéma nettoyé) et le pipeline Python | On reconstruit aussi le schéma DB et les RPCs from scratch |
| Effort relatif | 1x | 3 à 4x | 6 à 8x |
| Livre le mobile | Non | Oui | Oui |
| Risque de régression données | Faible | Moyen (migrations de nettoyage sur une prod avec 9 équipes actives) | Élevé (migration de données inévitable, historique XP à préserver) |
| Verdict | Insuffisant | **Recommandé** | Gaspillage |

**Pourquoi pas A.** L'amputation est peu coûteuse (voir §2) mais elle ne répond
pas à la demande. Elle produit une app web classic-only propre, et le pivot
mobile reste entier derrière. Pire : nettoyer soigneusement un front web dont
95 % de la couche présentation ne se porte pas sur mobile est du travail jeté.

**Pourquoi pas C.** Le schéma relationnel est sain. Sur 33 tables vivantes, le
cible classic-only en compte 24 à 26, et la majorité du cœur (riders,
race_results, rider_xp_daily, auctions, gt_squad) est déjà mode-agnostique. Le
poids mort est concentré sur peu de tables (`treasury_log`, `sponsor_bonuses`,
`strategies`, `underdog_eligibility`). Reconstruire ça de zéro coûterait une
migration de données (l'XP cumulée de la ligue V2 est un actif à préserver)
pour un gain nul.

---

## 2. Le fait qui change la lecture : le couplage classic/manager est petit

Les quatre agents qui ont creusé le couplage arrivent au même endroit, chacun
par son côté.

- **Schéma** : un seul discriminant, `leagues.mode`. Le schéma est propre.
- **Front** : 30 fichiers manager-only (~3834 lignes), soit 10 à 11 % des
  lignes. Plus ~23 fichiers à éditer pour retirer un branchement. Total touché,
  18 % des fichiers.
- **RPCs** : sur 24 fonctions auditées, 6 survivent telles quelles, 6 se
  réécrivent (dont 3 fusionnables en une), 2 attendent une décision produit,
  ~9 disparaissent.
- **Python** : deux fichiers portent une garde explicite `is_classic_league()`
  (`sponsor_bonus.py`, `goal_evaluator.py`). Tout le reste, y compris le
  scoring, ne sait même pas dans quel mode il tourne.

**Conclusion** : le mode manager n'est pas un cancer diffus, c'est un membre
identifiable. Si le seul objectif était de le retirer, le refactor gagnerait
haut la main contre le rewrite. Ce n'est donc pas ça qui justifie de repartir
de zéro.

Une nuance importante, trouvée par l'axe RPC : classic n'a jamais été isolé au
sens **invariants**, seulement au sens routage. Deux fonctions écrivent
aujourd'hui dans le monde classic sans garde de mode,
`recompute_underdog_eligibility` et `gt_claim_dnf_refund` (celle-ci crédite une
trésorerie dans un mode censé être à budget plat). Ce sont des lectures
statiques, pas des incidents confirmés en base, mais elles méritent une
vérification SQL avant tout chantier.

---

## 3. Le vrai problème : la dette est ailleurs, et elle est structurelle

Ce qu'un rewrite éliminerait **par construction** et qu'un refactor ne fera que
poursuivre :

1. **La troncature silencieuse PostgREST à 1000 lignes.** Trois fois en trois
   mois, dans trois couches différentes (`goal_evaluator.py`, puis
   `sponsor_bonus.py` malgré le précédent explicitement cité dans le commit,
   puis le front avec 14 lectures affectées et Pogačar disparu du feed sur les
   étapes 13 à 20). Il n'existe aucune barrière : un appel Supabase brut peut
   toujours retourner un résultat tronqué sans erreur. La correction structurelle
   est une couche d'accès unique qui pagine par défaut, ou des agrégats calculés
   en DB.

2. **La mutation de trésorerie hors RPC.** Deux occurrences sur trois ont été
   corrigées après incident (+400k€ en trop sur 6 reruns). La troisième,
   `resolve_gt_rescue.py:102-111`, fait toujours le read-modify-write non
   atomique, avec un commentaire dans le code qui assume de contourner le
   garde-fou. La règle CLAUDE.md l'interdit depuis le début. La convention seule
   ne suffit pas, il faut que ce soit techniquement impossible.

3. **Deux sources de vérité par runtime.** Le calendrier (`wt_calendar_2026.json`
   côté Python contre `gt-stage-schedule.ts` côté front) a coûté 113 assignations
   de rôles silencieusement ignorées sur le Tour. Le multiplicateur de salaire
   est dupliqué entre `format.ts` et `sync.py`, il a changé deux fois en 2026
   (2000, 2500, 2700), à chaque fois par double édition manuelle sans test de
   parité.

4. **Le doublon démo.** 20 pages portent une fonction `renderDemo*` quasi
   identique à la fonction réelle. Sur les 5 plus gros fichiers du repo, c'est
   entre 37 % et 42 % du fichier. C'est le premier facteur de gonflement du
   front, et il n'a rien à voir avec classic/manager.

5. **Aucun test n'exerce la logique SQL.** Les tests vitest vérifient qu'on
   appelle le bon RPC avec les bons arguments, jamais que la RPC produit le bon
   résultat. Les 4 e2e Playwright sont tous en `test.fixme`, et l'un d'eux teste
   encore un budget de 1.5M et un cap de 8, périmés depuis juin. Un test
   désactivé qui n'est plus mis à jour n'est pas en pause, il est mort.

6. **Pas de source canonique par RPC.** `place_bid` a été redéfinie
   intégralement dans 10 fichiers de migration, `validate_round` 9 fois. Chaque
   changement recopie 100 à 230 lignes. C'est ce qui explique qu'une policy
   d'INSERT direct sur `auction_bids`, rendue obsolète par la RPC `place_bid`,
   n'ait jamais été droppée et permette encore de contourner tous les contrôles.

Ce qu'un rewrite **ne réglera pas** : le scraping local-only (contrainte externe
Cloudflare, pas un choix d'architecture) et l'absence de notifications, qui est
une décision produit jamais tranchée. Deux équipes ont scoré 0 XP sur l'étape 1
de la Vuelta parce que personne ne les a prévenues du cutoff. Aucune stack ne
répare ça.

---

## 4. Tableau croisé : composant × scénario

| Composant | A. Amputation | B. Rewrite client | C. Rewrite complet |
|---|---|---|---|
| Schéma DB (33 tables) | Nettoyer (DROP ciblés), coût S/M | **Nettoyer**, même travail | Reconstruire + migrer les données, coût L |
| RPCs Postgres (42 fonctions) | Adapter, 6 gardées, 6 réécrites, 9 supprimées | **Adapter, même travail, plus le portage de `forceResolveRound`** | Réécrire toutes, coût L, gain marginal |
| Pipeline Python (58 fichiers) | Adapter, retirer sponsor_bonus + goal_evaluator + code mort | **Garder tel quel**, même adaptation | Garder quand même (il ne parle qu'à Postgres) |
| `apps/web/lib/*.ts` (~5000 lignes de TS pur) | Garder | **Garder**, déplacer dans un package partagé | Réécrire, pure perte |
| Front présentation web (~30 000 lignes) | Nettoyer le manager, garder le reste | **Jeter**, redessiner en React Native | Jeter |
| Design system v3 (189 tokens) | Garder | **Garder comme spécification**, reprojeter en thème NativeWind | Garder |
| `forceResolveRound` (275 lignes TS) | Laisser en place (ça marche sur le web) | **Porter en RPC Postgres, bloquant** | Porter |
| Sponsors | Supprimer | **Supprimer, puis redesigner XP-only** (barème à refaire, décision produit) | Idem |
| Tests | Adapter | **Adapter**, ajouter les tests d'intégration Postgres qui manquent | Tout réécrire |

---

## 5. Le premier pas concret, et l'ordre qui compte

Le premier geste n'est pas d'ouvrir Expo.

**Étape 0, avant tout : amputer le manager dans la DB et les RPCs.** DROP des
tables manager-only, retrait des branches manager des 6 RPCs partagées, suppression
des 9 RPCs mortes.

**Étape 1 : porter `forceResolveRound` en RPC Postgres SECURITY DEFINER.** C'est
le blocage réel du mobile, indépendant de la stack choisie. Cette fonction fait
275 lignes de résolution d'enchère en TypeScript avec la service_role key. Un
client mobile ne peut ni l'appeler (les Server Actions utilisent un protocole
propriétaire lié au runtime Next) ni la reproduire (il ne doit jamais détenir la
service_role key, un binaire mobile se décompile). Sans ce portage, le backend
n'est pas appelable par un client natif.

**L'ordre 0 puis 1 n'est pas interchangeable.** `forceResolveRound` contient du
level gating manager (lignes 528-540) et déclenche la cascade payday. Le porter
avant l'amputation, c'est traduire en PL/pgSQL du code qu'on va supprimer la
semaine suivante. Amputer d'abord réduit la fonction à porter, et le portage
devient l'occasion de la rendre atomique (aujourd'hui 5 mutations séquentielles
sans transaction, avec un try/catch par coureur en guise de compensation).

**Étape 2 : le client React Native + Expo.** Classement complet de l'axe mobile :
RN/Expo, puis PWA comme filet de sécurité, puis Flutter, puis natif Swift+Kotlin
écarté. RN gagne pour une raison mesurée, pas idéologique : sur 6367 lignes de
`lib/`, environ 5000 à 5500 sont du TypeScript pur sans dépendance framework
(souvent grâce à une injection de `SupabaseClient` en paramètre). C'est le seul
stack qui récupère du code et pas seulement des concepts. Flutter et le natif
imposent une retraduction manuelle de chaque règle de jeu, avec le risque de
dérive que ce projet connaît déjà par cœur.

---

## 6. Les 5 risques du scénario B

1. **La ligue V2 tourne en production avec 9 joueurs.** Les migrations de
   nettoyage s'appliquent sur des données vivantes, dont l'XP cumulée d'une
   saison. Le pipeline de scoring n'est pas conçu pour être rejoué de façon
   isolée : un backfill ciblé sur 2 coureurs a déjà fait dériver l'XP de 6
   équipes non ciblées. Toute migration touchant au scoring doit être précédée
   d'un diff de `cumulative_xp` sur toutes les équipes.

2. **Deux mécaniques sont bloquées sur une décision produit, pas sur du code.**
   `gt_claim_dnf_refund` et `gt_place_emergency_bid` remboursent 50 % d'un
   salaire récurrent qui n'existe pas en classic. Et les sponsors XP-only n'ont
   pas de barème : les colonnes en euros ne se convertissent pas
   automatiquement. Ces deux design sont à faire avant le code, sinon ils
   bloquent le chantier au milieu.

3. **Le pipeline Python dépend sémantiquement du front.** Il recopie à la main
   61 définitions de goals depuis `gt-goals.ts`, plus le multiplicateur de
   salaire et les seuils de pool. Un test parse le fichier TypeScript par regex
   pour garder les goals en phase. Si le rewrite déplace ou restructure ces
   fichiers, ce test casse et la parité disparaît silencieusement. À traiter
   explicitement au moment du déplacement de `lib/` vers un package partagé.

4. **`ARCHITECTURE.md` a un mois de retard.** Les 4 derniers PR (Vuelta,
   commissioner-only, squad cap, validation à 10 coureurs) n'y figurent pas, et
   le document affirme encore que la Vuelta est absente du calendrier front
   alors qu'elle tourne en prod. C'est le document sur lequel un rewrite
   s'appuierait. Le regénérer depuis le code avant de s'y fier. `GAME_RULES.md`
   est en revanche le document le plus fiable du corpus.

5. **La couche présentation est un vrai travail d'UI, pas un portage.** Un
   `<div className>` ne devient pas un `<View>`. Les 89 composants Shadcn ne se
   réutilisent pas, les 25 pages en Server Components changent de paradigme (il
   n'y a pas de RSC en React Native, il faut revenir à du fetch client avec state
   explicite), et la couche 4 du design system (mesh gradient WebGL) est marquée
   "Web only" dans le doc lui-même. Le design system survit comme spécification,
   pas comme code.

---

## 7. Ce qu'on garderait tel quel, même en repartant de zéro

- **Le principe RPC SECURITY DEFINER pour les mutations d'argent et de squad.**
  Le locking `FOR UPDATE` fonctionne, aucune fuite de logique métier vers le
  client n'a été trouvée, et l'alternative (logique côté client avec RLS
  permissive) est pire. Ce qui doit changer, c'est l'outillage autour : des
  fichiers source canoniques par fonction, des helpers SQL réellement partagés
  (`team_max_slots` est le seul exemple du genre dans tout le corpus), et des
  tests d'intégration contre une vraie base au lieu de mocks.
- **Le pipeline de scraping et son contournement Cloudflare.** C'est la brique
  la plus dure à refaire, elle est stabilisée, et elle ne parle qu'à Postgres.
- **Supabase en direct depuis le client, sans couche API HTTP intermédiaire.**
  Adapté à la taille du produit et au mobile. Ce qui manque n'est pas une API,
  c'est une couche de requêtes centralisée en DB (des vues), pour tuer à la fois
  la duplication `contracts + riders(*)` sur 5+ pages et le zéro caching actuel.
- **La discipline de documentation.** REX honnête, postmortems chiffrés,
  MEMORY.md détaillé. C'est ce qui a permis de reconstruire toute cette
  chronologie sans ambiguïté, et c'est rare sur un projet solo.

---

## Incertitudes assumées

- Les deux findings d'invariants non gardés (`recompute_underdog_eligibility`,
  `gt_claim_dnf_refund` sur une équipe classic) sont des lectures statiques du
  code, pas des incidents constatés en base. À vérifier par une requête SQL
  avant d'en tirer une conclusion.
- Une quinzaine de RPC sur 42 n'ont pas été auditées ligne à ligne.
- Le contenu de `turbo.json` n'a pas été lu : le jugement sur l'utilité de
  Turborepo pour une seule app reste à confirmer.
- Aucun `pnpm test` ni `pnpm typecheck` n'a été lancé (audit read-only) : les
  chiffres de couverture sont des comptages de fichiers, pas un rapport de
  couverture de lignes.
