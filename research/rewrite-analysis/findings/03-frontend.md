# Axe 3 — Frontend : couplage et qualite structurelle

Perimetre audite : `apps/web/` (294 fichiers TS/TSX hors node_modules, dont
2040 lignes generees dans `lib/database.types.ts`). 290 fichiers source reels,
33 688 lignes hors le fichier de types genere. Lectures prealables faites :
`docs/ARCHITECTURE.md`, `docs/ROADMAP_ET_REX.md`, `CLAUDE.md` racine,
`docs/GAME_RULES.md` §14/§19.

Methode : `grep`/`wc` sur mots-cles, lecture directe des fichiers cites.
Chaque chiffre ci-dessous est reproductible avec les commandes indiquees en
note. Rien n'est extrapole sans le dire explicitement.

---

## 0. Fait produit qui reoriente toute la lecture (GAME_RULES.md §19, lignes 691-805)

Classic n'est PAS un systeme parallele. Citation directe (GAME_RULES.md:780-785) :

> "Classic is not a parallel system. Round resolution (forceResolveRound) and
> scoring (scoring.py) are fully shared and never branch on mode. Classic adds
> only three shallow branch points: the place_bid slot cap (10), the
> phase-reset RPC choice, and budget display."

Consequence pour l'audit : GT squad, GT tactics, GT rescue, scoring et
resolution d'enchere sont **partages**, pas manager-only. Seuls treasury
persistant, sponsors, strategies/policies, levels/pool-gating et anti-runaway
sont strictement manager-only. Underdog est un cas hybride : le role et son
multiplicateur de scoring sont reutilises en classic (2 slots Underdog fixes,
`underdog_eligible` reste `false`), seule l'eligibilite dynamique manager est
neutralisee. Ce fait corrige a la baisse toute estimation naive du perimetre
"manager" qui compterait `gt_`, `tactic`, `underdog` comme manager-only.

---

## 1. Cartographie classic / manager / branchement

Comptage brut par mot-cle (`grep -rli <mot> --include="*.ts" --include="*.tsx" apps/web | grep -v node_modules | wc -l`) :

| Mot-cle | Fichiers |
|---|---|
| `classic` (case-insensitive) | 47 |
| `isClassic(` (branchement explicite) | 16 fichiers, 21 sites d'appel |
| `"classic"` litteral hors `isClassic(` | 7 fichiers supplementaires |
| `treasury` | 30 |
| `level` | 55 (bruite : "level" est aussi un mot generique JS/CSS) |
| `budget` | 37 |
| `salary`/`salaries` | 23 |
| `sponsor` | 51 |
| `tactic` | 30 (**partage**, pas manager-only, voir §0) |
| `gt_` / Grand Tour | 32 (**partage**) |
| `underdog` | 11 (hybride, voir §0) |
| `anti-runaway`/`co-unlock`/`level curve` | 4 |
| `remontada` | 0 (mecanique droppee, code deja purge du front) |

Le chiffre "47 fichiers classic" du brief est confirme exactement. Le chiffre
"23 branchements de mode" est proche : 16 fichiers utilisent `isClassic()`
(21 sites), plus 7 fichiers qui testent la string `"classic"` sans passer par
le helper (`app/(auth)/league/create/actions.ts`,
`app/(auth)/league/create/page.tsx`,
`app/(game)/league/[leagueId]/team/page.tsx`, `lib/league-creation.ts`,
`lib/race-feed-helpers.ts`, `lib/race-feed-types.ts`, `lib/league-mode.ts`) —
soit ~23 fichiers au total, coherent avec le chiffre de depart.

**Perimetre manager-only reel (verifie), candidat a suppression totale si le
mode manager est tue :**

| Zone | Fichiers | Lignes |
|---|---|---|
| `app/(game)/league/[leagueId]/team/budget/**` (P&L, marketplace, transactions) | ~9 | 1154 |
| `app/(game)/league/[leagueId]/team/strategies/**` | ~5 | 849 |
| `app/(game)/league/[leagueId]/levels/**` | ~3 | 280 |
| `components/budget-summary.tsx`, `sponsor-bonus-card.tsx`, `team-level-card.tsx`, `transaction-row.tsx`, `brand-card.tsx`, `config-cards.tsx`, `gt-goals-preview.tsx` | 7 | 995 |
| `lib/sponsors.ts`, `lib/strategies.ts`, `lib/levels.ts`, `lib/co-unlock.ts`, `lib/boost.ts`, `lib/gt-goals.ts` | 6 | 556 |
| **Total core manager-only** | **~30 fichiers** | **~3834 lignes** |

`lib/budget.ts` est exclu de cette liste : il contient `computeAvailableBudget`
(manager) ET `computeClassicBudget` (classic), donc partage — voir §2.

`components/budget-summary.tsx` merite une note : il est deja
mode-conditionnel (`isClassic(` ligne detectee) et affiche `computeClassicBudget`
en classic — donc pas purement manager-only malgre son nom, mais 80% de son
contenu (sponsor income, salary breakdown detaille) ne sert qu'au manager.

**Underdog reste entrelace dans le code partage GT**, pas isolable proprement :
`app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`,
`app/(game)/league/[leagueId]/team/gt/page.tsx`,
`app/(game)/league/[leagueId]/team/gt/actions.ts`,
`components/scoring-doc-card.tsx`, `components/rider-picker-sheet.tsx`,
`components/rider-price.tsx`, `lib/gt-roles.ts` mentionnent tous `underdog`
au milieu de code GT partage classic+manager. Jeter le mode manager ne
supprime pas ces fichiers : ca oblige a y retoucher (retirer l'eligibilite
dynamique manager, garder les 2 slots fixes classic).

**Verdict axe 1** : l'entrelacement est reel mais localise. Le coeur du jeu
(auctions, contracts, GT squad/tactics/rescue, scoring) est deja partage et
mode-agnostique cote code (confirme par le commentaire GAME_RULES.md ci-dessus
et par `scoring.py` cote Python, hors perimetre de cet axe). Ce qui est
manager-only est concentre dans des repertoires entiers et facilement
supprimables (budget/, strategies/, levels/) — **GARDER cette architecture de
separation**, cout de nettoyage estime **M** (suppression de fichiers +
nettoyage de ~23 points de branchement, pas une refonte).

---

## 2. `computeClassicBudget` et les surfaces de budget

`apps/web/lib/budget.ts` (48 lignes) contient deux fonctions pures et testees
(`lib/budget.test.ts`, 5 cas sur `computeClassicBudget` lignes 66-87) :

- `computeAvailableBudget(treasury, sponsorIncome, activeSalaries, draftBidsTotal, phaseConfirmed)` — manager
- `computeClassicBudget(treasury, activeSalaries, draftBidsTotal)` — classic, ligne 42

**Le calcul final (le bug historique corrige) n'est plus duplique.** Trois
surfaces consomment `computeClassicBudget` :
- `app/(game)/league/[leagueId]/auction/auctions-client.tsx:139`
- `app/(game)/league/[leagueId]/auction/market/market-client.tsx:334`
- `components/budget-summary.tsx:29`

**Mais l'ingredient en amont (`activeSalaries`, la somme des
`contracts.locked_salary`) reste duplique independamment, en dehors de
`lib/budget.ts`.** Meme pattern `reduce((sum, c) => sum + (c.locked_salary ?? 0), 0)`
copie-colle a 6 endroits :

- `app/(game)/league/[leagueId]/auction/page.tsx:305` et `:597` (deux copies dans le meme fichier — voir §3, doublon demo)
- `app/(game)/league/[leagueId]/auction/market/page.tsx:121` et `:290` (idem)
- `app/(game)/league/[leagueId]/auction/status/page.tsx:137-148` et `:401-410` (variante `Map`, meme calcul, deux copies)
- `lib/rider-detail-data.ts:351`

Soit **7 implementations independantes** du meme calcul "salaires actifs de
l'equipe" qui alimentent ensuite le helper centralise. Si `locked_salary`
changeait de semantique (ex: distinguer salaire brut/net), il faudrait
retoucher 7 endroits a la main — aucun test ne couvre cette duplication (les
tests de `budget.test.ts` ne testent que la fonction finale, pas les sites
d'agregation).

**Verdict** : le fix du bug original (4 surfaces oubliant de soustraire les
salaires) a bien centralise la formule finale — GARDER `lib/budget.ts`. Mais
il n'a pas traite la cause racine amont (l'agregation `activeSalaries` elle-meme
n'est pas une fonction partagee) — ADAPTER : extraire un
`computeActiveSalaries(contracts)` dans `lib/budget.ts` et remplacer les 7
sites. Cout **S** (mecanique, faible risque, pas de migration DB).

---

## 3. Qualite structurelle independante du mode

### 3.1 Doublon demo, le vrai probleme de taille du front

`docs/ARCHITECTURE.md:552` note deja : "Chaque page a un doublon démo
(`DEMO_LEAGUE_ID`) : corriger les deux." Verification par lecture directe : ce
n'est pas un doublon de quelques lignes, ce sont des **fonctions completes
dupliquees** dans les plus gros fichiers du repo, une pour la ligue reelle, une
`renderDemo*` quasi-identique pour le mode visiteur anonyme :

| Fichier | Lignes totales | Fonction reelle | Fonction demo | Part demo |
|---|---|---|---|---|
| `app/(game)/league/[leagueId]/auction/page.tsx` | 671 | `AuctionsPage` (31-385, 355L) | `renderDemoAuction` (386-671, 285L) | 42% |
| `app/(game)/league/[leagueId]/ranking/page.tsx` | 580 | `RankingPage` (16-344, 328L) | `renderDemoRanking` (345-580, 235L) | 41% |
| `app/(game)/league/[leagueId]/auction/status/page.tsx` | 538 | `StatusPage` (39-321, 282L) | `renderDemoAuctionStatus` (322-538, 216L) | 40% |
| `app/(game)/league/[leagueId]/achievements/page.tsx` | 513 | `AchievementsPage` (85-322, 237L) | `renderDemoAchievements` (323-513, 190L) | 37% |
| `app/(game)/league/[leagueId]/auction/market/page.tsx` | 385 | `MarketPage` (22-240, 218L) | `renderDemoAuctionMarket` (241-385, 144L) | 37% |

20 fichiers `page.tsx` au total portent ce pattern (`grep -rln
"renderDemo\|DEMO_LEAGUE_ID" apps/web`, liste complete dans le fichier de
recherche). Sur les 5 plus gros fichiers du repo (hors `database.types.ts`),
c'est **entre 37% et 42% du fichier qui est une quasi-copie** du meme
data-fetching + de la meme logique d'affichage, avec juste la source de
donnees qui change (vraie ligue vs `DEMO_LEAGUE_ID`).

C'est independant de l'axe classic/manager et bien plus structurant : c'est le
plus gros facteur de gonflement de fichier du repo. Un rewrite paramétrerait
la source de donnees (repository/adapter pattern, ou un seul fetcher avec un
flag) au lieu de copier-coller la fonction. Un refactor in-place est possible
mais toucherait les 20 memes fichiers un par un — le risque de regression
(le mode demo est deja fragile, RLS a 33 policies dediees) rend ce chantier
aussi gros qu'un rewrite partiel.

**Verdict** : ADAPTER, mais gros morceau — cout **L** en refactor, quasi
gratuit si rearchitecture (le README de conception d'un rewrite devrait traiter
"vraie ligue vs demo" comme un parametre de source de donnees des le depart,
pas comme deux chemins de code).

### 3.2 Logique metier critique dans une server action TS (violation ADR-015 documentee dans le code lui-meme)

`app/(game)/league/[leagueId]/auction/actions.ts` (687 lignes, le 3e plus gros
fichier du repo) contient `forceResolveRound` (lignes 413-687, ~275 lignes) qui
resout une enchere sealed-bid complete directement en TypeScript via le client
`service_role` (`createAdminClient()`, ligne 440) : tri des offres, arbitrage
vainqueur/perdants, level gating (ligne 528-540), garde anti-doublon de contrat
(542-559), creation du contrat (580-589), nettoyage des draft_bids obsoletes
(613-632), ouverture du round suivant (634-664), declenchement de la cascade
payday (660).

Ceci contredit directement CLAUDE.md ("NEVER mettre de logique metier dans une
server action TS — pattern obligatoire : Zod validation -> supabase.rpc(...) ->
error forwarding") et `docs/ARCHITECTURE.md` ADR-015 ("Le code TS se limite a
Zod validation + supabase.rpc(...)"). Le code en a conscience : les
commentaires disent explicitement "port of services/pcs-sync/auction.py::
resolve_current_round" (ligne 382) et "Mirrors Python's per-rider try/except
... services/pcs-sync/auction.py:136-264" (ligne 499), "Mirrors auction.py::
_cleanup_stale_drafts" (ligne 614). **La logique de resolution d'enchere existe
en double, en TypeScript et en Python, maintenue a la main en parallele.**

Consequences concretes verifiees dans le code :
- Non-atomicite : 5+ mutations Supabase sequentielles (update auctions, update
  bids won/outbid, insert contracts, update riders, delete draft_bids, update
  next auction) sans transaction Postgres. Le commentaire ligne 603-610 admet
  qu'une erreur par coureur est catchee individuellement pour ne pas avorter
  le round entier — c'est une compensation manuelle de l'absence de
  transaction, pas une garantie d'integrite.
- `addDraft`/`removeDraft`/`updateDraftAmount` (lignes 67-223) font aussi des
  ecritures directes sur `draft_bids` (upsert ligne 115-120) avec logique
  metier en TS (calcul min-salary ligne 96, garde anti-doublon roster ligne
  102-112) au lieu d'un RPC SECURITY DEFINER, contrairement au pattern des 12
  RPCs cite dans ADR-015.

**Verdict** : JETER l'emplacement de cette logique (elle doit vivre dans un
RPC Postgres atomique comme les 12 autres). C'est le candidat le plus solide
du front pour "dette qu'un refactor n'eliminerait pas facilement mais qu'un
rewrite eviterait d'entree" : porter ces 275 lignes vers SQL est un chantier a
part entiere (deja quasi fait cote Python, il faudrait le refaire une 3e fois
en PL/pgSQL), alors qu'un rewrite qui suit son propre ADR-015 des le premier
jour n'aurait jamais laisse cette fonction grossir en TS. Cout **L** en place,
**inclus gratuitement** dans un rewrite qui applique la regle des le depart.

### 3.3 Taille des fichiers

Top 10 hors fichier genere (`find apps/web -name "*.ts*" | xargs wc -l | sort -rn`) :

| Fichier | Lignes |
|---|---|
| `app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` | 802 |
| `app/(game)/league/[leagueId]/auction/actions.ts` | 687 |
| `app/(game)/league/[leagueId]/auction/page.tsx` | 671 |
| `app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx` | 620 |
| `app/(game)/league/[leagueId]/team/page.tsx` | 597 |
| `app/(game)/league/[leagueId]/auction/market/market-client.tsx` | 582 |
| `app/(game)/league/[leagueId]/ranking/page.tsx` | 580 |
| `app/(game)/league/[leagueId]/auction/status/page.tsx` | 538 |
| `app/(game)/league/[leagueId]/achievements/page.tsx` | 513 |
| `lib/rider-detail-data.ts` | 509 |

8 des 10 sont des `page.tsx`/`*-client.tsx` de plus de 500 lignes, la plupart
gonfles par le pattern demo (§3.1) plus par melange data-fetching/logique
metier/JSX dans le meme fichier (peu de separation container/presentation :
`rider-detail-client.tsx` a 802 lignes est un seul composant client qui gere
3 etats d'affichage — recruts/team/ranking — sans decoupage en sous-composants
par etat).

### 3.4 Design system v3 — conformite

- Pixels en dur (`text-[Npx]`) : 3 occurrences seulement, toutes dans
  `components/race-team-breakdown.tsx:58,73,84` (`text-[10px]`). Tres bonne
  conformite globale sur ce point precis.
- Hex en dur hors `app/prototype/page.tsx` (page de scratch non liee a la nav,
  a part) et `app/layout.tsx` (meta theme-color, hors scope tokens) :
  - `lib/achievements.ts:78-114` — ~25 lignes de couleurs de tier
    d'achievement en hex brut (`#f59e0b`, `#eab308`, `#d946ef`, `#f97316`,
    `#06b6d4`, `#ed5298`, `#4a90e2`, `#d83cab`, `#facc15`, `#22c55e`,
    `#ef4444`) au lieu de tokens semantiques `--accent-*`.
  - `components/achievement-badge.tsx:6-9` — memes hex repetes localement.
  - `components/gt-dnf-card.tsx:156` — `#ef4444` en dur.
  - `app/(lobby)/lobby/[leagueId]/_components/rider-pool-list.tsx:28` — a
    verifier manuellement, faux-positif probable (`#600` ressemble a un rang
    PCS en commentaire, pas une couleur).
- Achievements est explicitement une feature a GARDER dans la roadmap
  (`docs/ROADMAP_ET_REX.md:83` "Achievements : a garder, retravailler") — donc
  cette dette de tokens n'est pas neutralisee par le futur tri manager/classic,
  elle survivra et vaut la peine d'etre nettoyee. Cout **S**.

### 3.5 Pattern Zod -> RPC -> forwarding, au-dela du cas §3.2

`grep -c "z.object\|.safeParse\|zod"` sur les 15 fichiers `actions.ts` montre
une utilisation de Zod quasi-systematique en entree (bon signe), mais le
respect du "puis RPC" est inegal : `validateRound` (ligne 224) et
`forceResolveRound` (413) melangent RPC (`validate_round`,
`submit_conforming_drafts`, `close_remaining_rounds_if_complete`,
`auto_validate_unactionable_teams` — 4 RPC differents dans le meme fichier)
ET logique/ecritures directes (§3.2). Ce n'est pas homogene : certaines
mutations sont bien deleguees (RPC), d'autres non, dans le meme fichier et
parfois la meme fonction.

### 3.6 Gestion des erreurs et etats de chargement

- 14 `loading.tsx` (`find app -name loading.tsx`) couvrent la plupart des
  routes principales — bon niveau de granularite pour le suspense App Router.
- Seulement 2 `error.tsx` (`app/error.tsx` racine et
  `app/(game)/league/[leagueId]/error.tsx`) — aucune route imbriquee
  (auction/, team/budget/, achievements/) n'a de boundary dediee ; une erreur
  y remonte au boundary de ligue generique, perdant le contexte de la page.
- Aucun `not-found.tsx` dans tout `apps/web/app/` (`find app -name
  not-found.tsx` = vide) — un `rider/[riderId]` ou `ranking/team/[teamId]`
  invalide tombe sur le comportement par defaut Next.js, pas sur un ecran
  produit.

### 3.7 Couverture de tests

- 57 fichiers `*.test.ts(x)` sur 290 fichiers source (~20%).
- `components/` : 17 fichiers `__tests__`/`*.test.tsx` sur 90 composants
  (~19%) — concentres sur race-feed, tactics, budget-summary, config-cards ;
  aucun test sur `rider-detail-client.tsx` (802 lignes, le plus gros fichier
  du repo), `sidebar.tsx`, `topbar.tsx`, `bottom-nav.tsx`.
- e2e Playwright (`apps/web/e2e/*.spec.ts`) : **les 14 tests des 4 fichiers
  sont `test.fixme`**, donc 0 test e2e reellement execute
  (`grep -n "test.fixme" e2e/*.spec.ts`). MEMORY.md le documente ("test.fixme
  until seed data") mais deux points aggravants verifies par lecture directe :
  - `e2e/classic-mode.spec.ts:21` teste encore "flat **1.5M** budget ... cap
    **8**" — perime, `GAME_RULES.md:718` et `lib/league-mode.ts:6-9`
    confirment que le budget est passe a 2M et le cap squad a 10 depuis les
    migrations `20260630120000`/`20260703100000` (voir MEMORY.md "Salaire
    2500x + decalage calendrier Tour"). Un test desactive n'a pas ete
    remis a jour quand la regle a change — signe que la suite e2e n'est pas
    entretenue, pas seulement en pause.
  - Aucun test e2e ne couvre le flux d'enchere reel (le coeur du jeu), qui est
    pourtant la logique la plus fragile identifiee en §3.2.

**Verdict couverture** : ADAPTER. Les tests unitaires existants (budget.ts,
league-mode.ts, classic-phases.ts, co-unlock.ts) sont bien cibles sur la
logique pure et donnent confiance sur les points qu'ils couvrent. Mais rien ne
protege le chemin critique (resolution d'enchere de bout en bout, cf. §3.2) ni
les plus gros composants. Cout pour remettre l'e2e a niveau : **M**, mais
suppose de stabiliser le seed data d'abord (bloquant deja note dans MEMORY.md).

---

## 4. Livrable cle : impact de la suppression du mode manager, et le front est-il une base saine

### Chiffres

- Perimetre manager-only strictement supprimable (routes + composants + libs
  dedies, §1) : **~30 fichiers, ~3834 lignes**, soit **~10%** des fichiers
  source (30/290) et **~11%** des lignes (3834/33688).
- Fichiers a **editer** (branchement mode-conditionnel a retirer plutot que
  supprimer, §1) : ~23 fichiers supplementaires — retirer le branchement
  laisse le fichier en place mais le simplifie (ex : `sidebar.tsx` perd 2
  conditions, `auction/page.tsx` perd son slot cap manager, `team/layout.tsx`
  perd sa redirection conditionnelle).
- Total fichiers **touches d'une facon ou d'une autre** par la suppression du
  manager : ~53/290, soit **~18%**. Mais en lignes strictement supprimees
  (pas editees), on reste autour de **10-11%**.

Ce chiffre est nettement plus bas que ce qu'un rewrite complet "on jette tout"
suggererait intuitivement — **et c'est la le vrai signal** : la dette qui
justifierait un rewrite du front n'est majoritairement pas la dette
manager/classic (bien geree, deja isolee dans des repertoires dedies, cf. §0
et §1), c'est la dette independante du mode identifiee en §3 :
- le doublon demo systematique sur 20 pages (§3.1, 37-42% des plus gros
  fichiers),
- la logique metier critique en TS server action au lieu d'un RPC (§3.2, ADR
  deja ecrit mais pas respecte sur le chemin le plus sensible du jeu),
- l'agregation `activeSalaries` dupliquee 7 fois sous le helper centralise
  (§2),
- l'absence de granularite error/not-found (§3.6),
- une e2e suite entierement desactivee et partiellement perimee (§3.7).

### Tranche

**Le front n'est pas un candidat au rewrite complet.** La separation
classic/manager est deja propre a l'echelle attendue (~10% de code strictement
manager-only, facilement supprimable ; le coeur du jeu — auction, GT, scoring —
est deja mode-agnostique par construction, confirme noir sur blanc dans
GAME_RULES.md). Le design system est globalement bien respecte (3 violations
px, ~30 lignes de hex en dur sur 33 688 lignes). Le pattern Server
Component + Server Action + Zod est majoritairement suivi.

**GARDER l'architecture front, ADAPTER trois chantiers cibles avant ou pendant
la refonte post-Tour :**
1. Supprimer le perimetre manager-only (§1) — cout **M**, mecanique.
2. Porter `forceResolveRound` (et le trio addDraft/removeDraft/
   updateDraftAmount) vers un RPC atomique, faire converger la logique
   dupliquee TS/Python vers une seule source de verite Postgres (§3.2) — cout
   **L**, le plus gros risque technique du front si on ne le traite pas avant
   le pivot mobile (une resolution d'enchere non-atomique sur iOS avec
   connexion instable serait pire qu'aujourd'hui).
3. Traiter le doublon demo comme un parametre de source de donnees plutot
   qu'une fonction copiee (§3.1) — cout **L**, gain de lisibilite majeur sur
   les 5-10 plus gros fichiers du repo.

Ces trois chantiers sont **independants de la question mobile** (§5) : ils
vaudraient la peine meme si le web restait la cible. Le fait que la dette
la plus lourde du front ne soit pas liee au mode change la lecture de "si on
repartait de zero" : repartir de zero pour desentrelacer classic/manager n'est
pas justifie par les chiffres (10-11%, deja bien isole) ; repartir de zero
pourrait en revanche eviter nativement le doublon demo et la logique metier
hors-RPC si l'architecture cible (mobile, cf. §5) est de toute facon un projet
distinct.

---

## 5. Ce qui tombe de toute facon si la cible devient une app mobile native (iOS/Android)

Rien de ce qui suit n'est une question de qualite de code : c'est
structurellement lie a Next.js App Router et ne se porte pas vers React
Native ou Swift/Kotlin natif.

- **Layout desktop entier** : `components/sidebar.tsx` (249L, sidebar 180px
  fixe), `components/detail-rail.tsx` (42L) + `components/rail-router.tsx`
  (62L) + `components/rail-pages/*` (rider-detail-rail, levels-rail,
  strategies-rail) — le pattern "detail rail flex:2 min 380px" documente dans
  `docs/ARCHITECTURE.md:264-276` n'a pas d'equivalent mobile natif direct (au
  mieux un ecran push/pop). `components/topbar.tsx` (114L) et
  `components/bottom-nav.tsx` (86L) sont deja penses mobile-web mais restent
  du HTML/CSS, pas des primitives natives.
- **Routing App Router** : les route groups `(auth)/(game)/(lobby)/(legal)`,
  le middleware (`lib/supabase/middleware.ts`, 51L, protection de route via
  cookies), les `revalidatePath` (65 occurrences dans le repo) — tout le
  systeme de navigation/cache serait remplace par React Navigation (RN) ou
  le systeme de navigation natif iOS/Android.
- **Server Components** : 25 pages `export default async function ...Page`
  qui font le data-fetching Supabase directement dans le rendu serveur —
  ce pattern n'existe pas en React Native (pas de RSC), il faudrait revenir a
  du fetch client + state management explicite. C'est un changement de
  paradigme, pas un portage.
- **Server Actions** : 16 fichiers `"use server"` (mutations via
  `supabase.rpc()` essentiellement) — la logique de validation Zod et les
  appels RPC eux-memes sont reutilisables tels quels (ce sont des appels HTTP
  vers Supabase, independants du framework), mais le mecanisme `"use server"`
  et son integration formulaire/revalidation ne l'est pas.
- **Auth via cookies httpOnly** : le flux `signup_intent` cookie (10 min,
  httpOnly, sameSite=lax, `docs/ARCHITECTURE.md:315-320`) est un pattern web ;
  mobile utiliserait le SDK Supabase natif (stockage securise type Keychain/
  Keystore) et un flux OAuth different (deep link plutot que callback HTTP).
- **89 fichiers `components/ui/*`** (Shadcn) sont HTML/CSS/Tailwind — aucun ne
  se reutilise sur mobile natif ; seule la couche de **tokens** (palette,
  scale typographique, radius-as-affordance de `docs/watthunter-design-
  system-v3.md`) est portable comme *specification de design*, pas comme
  code.

**Ce qui survit integralement, quelle que soit la cible (web ou mobile)** :
- Toute la couche `lib/*.ts` pure et testee sans dependance React/Next :
  `lib/budget.ts`, `lib/levels.ts`, `lib/format.ts`, `lib/phases.ts`,
  `lib/gt-stages.ts`, `lib/tactics.ts`, `lib/co-unlock.ts`,
  `lib/league-mode.ts`, `lib/classic-phases.ts` — logique metier front
  reutilisable telle quelle derriere n'importe quelle UI, deja testee
  (`lib/*.test.ts`).
- Les schemas Zod des server actions (validation reutilisable cote mobile via
  un client API mince).
- Toute la couche Supabase (RPCs SECURITY DEFINER, RLS, migrations) — hors
  perimetre de cet axe mais evidemment 100% reutilisable, c'est le vrai
  backend du jeu quelle que soit la UI.
- `database.types.ts` (types generes Supabase).

**Estimation grossiere** : sur les ~33 700 lignes de `apps/web`, la part
"UI web non portable" (route groups, layouts desktop, composants Shadcn,
Server Components/Actions specifiques Next) domine tres largement ; la part
"logique pure portable" (`lib/*.ts` hors wrappers Supabase-client) pese
quelques milliers de lignes tout au plus (les fichiers `lib/` cites
totalisent grossierement 600-800 lignes de logique metier pure hors
sponsors/strategies/levels deja comptes manager-only en §1). **Un pivot mobile
natif est de facto une reecriture quasi-complete de la couche presentation**,
independamment de toute question classic/manager — c'est un argument fort
pour ne pas sur-investir dans le nettoyage du front web existant au-dela des
trois chantiers cites en §4 si le mobile est vraiment la prochaine etape
serieuse.

---

## Incertitudes

- Les comptages "manager-only" (§1) sont bases sur la structure de dossiers et
  des mots-cles ; je n'ai pas trace fichier par fichier si chaque ligne de
  `team/budget/**` est strictement inutilisee en classic (GAME_RULES.md le
  confirme au niveau systeme : "Sponsors + bonuses + GT goals: Remove", mais
  je n'ai pas verifie l'absence totale de code mort residuel dans ces
  dossiers).
- Je n'ai pas execute `pnpm test` ni `pnpm typecheck` (audit read-only) : la
  couverture de tests citee est un comptage de fichiers, pas un rapport de
  couverture de lignes reel (pas d'outil de coverage lance).
- L'estimation "quelques milliers de lignes portables" en §5 est une lecture
  a l'oeil des fichiers `lib/`, pas un comptage exhaustif ligne par ligne de
  ce qui est independant de React/Next dans chaque fichier.
