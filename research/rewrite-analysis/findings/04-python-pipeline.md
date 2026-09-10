# Axe 4 — Pipeline Python pcs-sync

Perimetre audite : `services/pcs-sync/` hors `.venv` (58 fichiers .py, dont 27 hors `tests/` et `scripts/`, 24 fichiers de tests = 7333 lignes). Lecture prealable faite : `docs/ARCHITECTURE.md` (section "Pipeline PCS" lignes 489-518, section pagination lignes 546-554), `docs/ROADMAP_ET_REX.md`, `CLAUDE.md` racine, `docs/GAME_RULES.md` §11/§14/§19 (surtout §19 "Game Modes — Manager vs Classic", lignes 691-805).

---

## 1. Cartographie des pipelines (classic / manager / les deux)

Le point d'entree unique est `run_pipeline.py` (1113 lignes). Commandes CLI reellement cablees (`build_parser`, lignes 905-1065) : `init-riders`, `post-race`, `startlists`, `enrich-riders`, `pre-auction`, `backfill-photos`, `detect-dnfs`, `evaluate-goals`, `resolve-gt-rescue`, `underdog-eligibility`. **`auction.py` (resolution des rounds) et `validation.py` (audit tresorerie) ne sont PAS des sous-commandes de `run_pipeline.py`** — verifie par grep, aucune occurrence de `validate_treasury` ou d'import de `validation` dans `run_pipeline.py`.

| Pipeline | Fichier(s) | Mode | Preuve |
|---|---|---|---|
| **init-riders** (top 600 PCS) | `sync.py:sync_top500` | Les deux | Alimente `riders`, table partagee, aucun filtre mode. |
| **post-race** (import resultats + scoring) | `sync_race.py`, `scoring.py` | Les deux | GAME_RULES.md §19 ligne 771 : « `scoring.py` est **mode-agnostic** (ne lit jamais `mode`) — le bareme rank-based 2026-07 s'applique identiquement en classic ». |
| **startlists** (Pipeline C) | `sync_race.py:import_startlist/import_stage_profiles` | Les deux | Alimente `race_startlists`/`stage_profiles`, tables partagees. |
| **enrich-riders** (Pipeline E) | `enrich.py` | Les deux | Donnees coureur (photo, bio, specialite), independantes du mode ligue. |
| **backfill-photos** | `backfill_photos.py`, `photo_storage.py` | Les deux | Idem, coureur global. |
| **Sponsor bonus** (`sponsor_bonus.py`, appele depuis `post-race`) | `sponsor_bonus.py:process_race_bonuses` | **Manager only** | `is_classic_league()` def ligne 25-27 ; filtre explicite lignes 318-337 : `team_sponsors` jointe a `leagues.mode`, `if is_classic_league(league_data): continue` avec log `"classic-mode league (no sponsors)"`. Confirme par le titre de tache : « les pipelines financiers sont a priori manager-only » — **verifie exact**. |
| **Goal evaluator** (`evaluate-goals`, appele depuis `post-race`) | `goal_evaluator.py:evaluate_sponsor_goals` | **Manager only** | Meme garde, lignes 451-466, log `"classic-mode league (no sponsor goals)"`. |
| **Tactics** (modificateurs GT) | `tactics.py` | Les deux | GAME_RULES §19 tableau ligne 708 : classic garde 4 tactiques sur 5 (Call the Bus retire, cote TS uniquement — `tactics.py` ne code aucune notion de mode). |
| **resolve-gt-rescue** | `resolve_gt_rescue.py` | **Incertain — probablement manager only en pratique, non verifie dans le code Python** | Le fichier ne contient **aucun** check de `mode` ou `is_classic_league`. Le mecanisme (§17 GAME_RULES, remboursement 50% du **salaire verrouille**) suppose un salaire recurrent — absent en classic (« Flat 2M budget... no salaries »). Impossible de confirmer depuis le Python seul si la garde existe cote RPC/TS (`gt_place_emergency_bid`) ; a verifier dans les migrations SQL (hors perimetre de cet axe). |
| **detect-dnfs** | `dnf_detection.py` | Les deux (mecanique) | Flags `gt_squad.dnf_stage`, structure partagee ; aucun filtre mode dans le fichier. |
| **underdog-eligibility** | `underdog.py:recompute_eligibility` | **Effectivement manager only** | Appelle la RPC `recompute_underdog_eligibility`. En classic, `underdog_eligible` reste toujours `false` par construction (GAME_RULES §19 ligne 711, §14) — le recompute est donc un no-op cote classic, mais rien dans `underdog.py` (16 lignes, aucune logique, wrapper RPC pur) ne le sait ou ne le documente. |
| **validation.py** (`validate_treasury`) | `validation.py` | **Manager only, et mort** | Hardcode `initial_treasury = 200_000` (ligne 45) = le capital de depart **Manager** (GAME_RULES §4.1 ligne 77 : « New teams start at 200,000 EUR »). En classic le budget est 2 000 000 remis a plat chaque phase (§19) — cette fonction donnerait un faux positif de divergence sur toute equipe classic. **Jamais appelee depuis `run_pipeline.py`** — code mort/orphelin, aucune commande CLI ne l'invoque. |
| **auction.py** (`resolve_current_round`) | `auction.py`, invoque seulement via `resolve_now.py` | Les deux en theorie, **legacy en pratique** | Docstring explicite lignes 12-23 : « Python no longer runs payday — the TS action is the single source of truth » et « invoked manually via `python3 resolve_now.py` ». GAME_RULES §19 ligne 782 confirme : « Round resolution (`forceResolveRound`) ... [est] fully shared and never branch on mode » — mais **`forceResolveRound` est une action TS** (`apps/web/app/(game)/league/[leagueId]/auction/actions.ts`), pas `auction.py`. Le fichier Python n'est cable dans aucune commande de `run_pipeline.py` et n'est plus le chemin de resolution reel du jeu — outil de secours dev uniquement. |

**Verdict axe 1** : la separation manager/classic au niveau pipeline est nette et **verifiee dans le code** (pas seulement documentee) pour les deux morceaux financiers : `sponsor_bonus.py` et `goal_evaluator.py` portent chacun une garde explicite `is_classic_league()`, testee par `tests/test_classic_mode_skips.py` (28 lignes, 5 assertions). Le reste du pipeline (scoring, GT roles/tactics/rescue/DNF, riders, startlists) est **mode-agnostic par construction** — il lit/ecrit des tables partagees sans jamais consulter `leagues.mode`. Deux exceptions dormantes et non gardees : `validation.py` (mort, hardcode manager) et `resolve_gt_rescue.py` (vivant mais sans garde visible, incertitude a lever cote SQL).

---

## 2. Robustesse

### 2.1 Cloudflare / backend nodriver

`browser_session.py` (356 lignes) fait abstraction entre deux backends (nodriver par defaut, Playwright en fallback via `SCRAPER_BACKEND=playwright`). Points durs :
- Chemin Chrome **hardcode macOS** : `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` (ligne 253), overridable par `CHROME_EXECUTABLE` mais la valeur par defaut lie le pipeline a macOS.
- Headless **desactive par defaut** (`SCRAPER_HEADLESS=0`, ligne 50) : Cloudflare flague le headless meme via nodriver sur ce setup — une fenetre Chrome visible s'ouvre a chaque session (confirme aussi par CLAUDE.md racine, section "Variables d'environnement scraper"). Fallback automatique headless→visible si le warm-up echoue (lignes 219-245).
- Warm-up Cloudflare : visite une page "neutre" (`tadej-pogacar`), poll jusqu'a 30s (`WARMUP_POLL_TIMEOUT_S`) pour resoudre le challenge JS, puis reutilise le cookie `cf_clearance` pour le reste de la session (lignes 269-304). Mecanisme fragile mais documente et avec repli.
- **Aucun test automatise ne verifie le comportement reel face a Cloudflare** — `tests/test_browser_session.py` (151 lignes) teste la logique interne (fallback headless, gestion des signaux) avec des mocks, pas de garantie contre une evolution du challenge CF.

### 2.2 Idempotence des ecritures

Deux patterns coexistent, de qualite tres inegale :

- **Pattern correct (RPC atomique)** : `sponsor_bonus.py` credite via `credit_sponsor_bonuses` (lignes 463-475) et `goal_evaluator.py` via `credit_goal_reward` (lignes 701-712, commentaire explicite : « the completion insert, the treasury_log row, and the relative treasury credit happen in ONE transaction ... A rerun is a no-op »). Garde-fous supplementaires en amont : cle d'idempotence explicite sur `(team_id, rider_id, race_slug, result_type)` pour `sponsor_bonuses` (lignes 344-359) et `(team_id, sponsor_id, goal_key)` pour les goals (lignes 582-592), tous deux pre-fetches pour eviter un recredit sur rerun.
- **Pattern a risque (mutation manuelle, hors RPC)** : le meme `sponsor_bonus.py` fait, dans son etape de nettoyage (§477-531, "revert stale GT sponsor bonuses"), une **lecture-modification-ecriture manuelle** de `teams.treasury` (`SELECT` puis `UPDATE`, lignes 496-508) et une insertion manuelle dans `treasury_log` (lignes 510-518) — **en dehors de toute fonction RPC helper**, alors que le CLAUDE.md racine du projet dit explicitement « NEVER muter treasury_log directement — utiliser les fonctions helper ». Meme pattern dans `resolve_gt_rescue.py` (lignes 93-111), avec un commentaire qui l'assume : « Direct treasury update (service_role — **bypasses trigger protection**) ». Ce n'est pas du code mort : c'est le chemin normal du GT Rescue et de la reconciliation post-GT. Le risque concret : une race condition entre deux executions concurrentes du pipeline (deux `post-race` lances en meme temps, ou un `resolve-gt-rescue` en parallele d'un credit sponsor) peut lire un `treasury` perime et ecraser un credit concurrent — la RPC evite ce risque par une transaction atomique cote Postgres, la mutation manuelle Python ne l'evite pas.
- Historique confirmant que ce risque n'est pas theorique : `MEMORY.md` documente un incident reel « Sponsor bonus duplicate credits (2026-05-21) : +400k€ en trop sur 6 reruns », corrige depuis par la migration d'idempotence (le pattern RPC actuel), mais **le chemin de revert manuel dans `sponsor_bonus.py` n'a pas ete migre vers le meme modele**.

### 2.3 Pagination `_fetch_all` (cap PostgREST 1000 lignes)

`db_utils.py` (33 lignes) expose `_fetch_all(query_factory, page_size=1000)` qui pagine via `.range()`. Usage verifie par grep :

- `scoring.py` : 11 usages (lignes 520, 533, 599, 607, 626, 677, 690, 708, 739, 760 + une autre) — tous les fetchs GT/league-wide (race_results, rider_xp_daily, contracts, team_strategies, gt_squad, gt_role_assignments, classifications) passent par `_fetch_all`. Les deux seuls `.select()` restants (lignes 1122, 1166) sont des lectures par equipe/ligue unique, non a risque de troncature.
- `sponsor_bonus.py` : 8 usages couvrant race_results, contracts, team_sponsors, sponsor_bonuses existants, gt_squad, sponsor_goal_completions.
- `goal_evaluator.py` : 8 usages, meme discipline (team_sponsors, race_results, classifications, gt_squad, gt_role_assignments).
- `sync_race.py` : 9 usages.

**Pas de trou detecte** dans les quatre fichiers a fort volume (scoring/sponsor_bonus/goal_evaluator/sync_race), ceux justement identifies dans le contexte comme deja casses deux fois par le cap 1000. Fichiers plus petits sans `_fetch_all` (`underdog.py`, `resolve_gt_rescue.py`, `dnf_detection.py`, `reconcile_bonuses.py`) : requetes scopees a une ligue/un GT/une equipe, volumes structurellement sous 1000 lignes — pas d'anomalie, mais aussi pas de garde explicite si un jour ces perimetres s'elargissent (ex. `reconcile_bonuses.py` ligne 27-34, une requete par table par equipe, non paginee).

### 2.4 Duplication de constantes avec le front — ampleur reelle

Quatre familles identifiees, avec des statuts de garde tres differents :

1. **Guardees par test (bonne discipline)** — `tests/test_constants_drift_guard.py` (152 lignes) :
   - CO-2 : `goal_evaluator.SPONSOR_GOAL_SETS` vs `apps/web/lib/gt-goals.ts` — le test **parse litteralement le fichier TypeScript par regex** (`_parse_ts_goals`, `_parse_ts_sponsor_sets`, lignes 29-70) et compare champ par champ. Couplage fort et assume : `goal_evaluator.py` mirroe `gt-goals.ts` "a la main" (commentaire en tete de fichier, lignes 6-8) — c'est la duplication la plus lourde du pipeline (61 goals structures, reward, role, tier_group) et la seule testee au niveau du parsing source TS.
   - CO-3 : `BREAKAWAY_THRESHOLD_KM` duplique entre `scoring.py` et `tactics.py` (commentaire explicite dans `tactics.py` lignes 12-15 : « Duplicated here to avoid a circular import ... keep them in sync »), garde par assertion simple.
   - CO-4 : `LEVEL_THRESHOLDS`, `FINAL_SECONDARY_SCALE`, `SPRINT_PROFILES` compares aux valeurs documentees dans GAME_RULES.md (pas au TS directement, mais fige les valeurs).
   - `demo_constants.py` / `apps/web/lib/demo-constants.ts` : garde par egalite d'octets, testee (`tests/test_demo_constants_sync.py`, 39 lignes).

2. **Non guardees (angle mort)** :
   - `SALARY_COEFFICIENT` = 2700 : hardcode en clair dans `sync.py:57` (`calculate_monthly_salary`, commentaire « Salary = pcs_points × 2700 / 12 »), duplique de `apps/web/lib/format.ts:57` (`export const SALARY_COEFFICIENT = 2700`). **Aucun test ne compare les deux valeurs** — `grep` sur `tests/*.py` pour `2700`/`SALARY_COEFFICIENT` : zero resultat. C'est le duplicata explicitement signale dans le contexte de la tache, confirme present et non teste. Deja documente comme GOTCHA connu dans `MEMORY.md` (« Multiplicateur salaire dupliqué front (format.ts) + Python (sync.py) ») lors du dernier changement de valeur (2500→2700, 2026-08-19) — donc un point de friction deja vecu au moins une fois en prod, sans que la dette (absence de garde) ait ete comblee depuis.
   - `LEVEL_POOL_MIN` (`sync.py:23`, `[300,200,100,30,20,10,4,1]`) duplique de `poolMin` dans `apps/web/lib/levels.ts` (memes valeurs, lignes 2-9). Aucun test de parite trouve.

Verdict 2.4 : la discipline de garde existe et fonctionne (CO-2/CO-3/CO-4, demo-constants), mais elle est **partielle** — elle couvre ce qui a deja casse une fois (goals) ou ce qui etait deja identifie a la creation du garde-fou (2026-06, audit Phase 2), pas systematiquement toute nouvelle duplication introduite depuis (salaire, pool).

### 2.5 Tests pytest — qualite et couverture

24 fichiers de tests, 7333 lignes. Repartition par volume (les plus gros = le coeur economique/scoring) : `test_goal_evaluator.py` (1281), `test_scoring_gt.py` (1017), `test_sync_race.py` (939), `test_sponsor_bonus.py` (809), `test_scoring.py` (538), `test_scoring_rank_based.py` (390). La quasi-totalite des tests mockent le client Supabase via `tests/conftest.py:make_supabase`/`make_chain` (fluent-chain MagicMock) — tests unitaires rapides, pas d'acces reseau/DB. Une exception : `test_rpc_integration.py` (322 lignes) qui pilote un Postgres local via `docker exec ... psql` (necessite l'infra Supabase locale documentee dans CLAUDE.md, "Local Supabase") — seul test qui verifie le comportement **reel** des RPC SECURITY DEFINER (`credit_sponsor_bonuses`, underdog discount, etc.), donc le seul filet contre une regression SQL silencieuse. Un test dedie `test_classic_mode_skips.py` verifie strictement la fonction `is_classic_league` (pas d'integration classic de bout en bout au niveau pipeline). Pas de test explicite trouve pour `validation.py` (coherent avec le fait qu'il est mort) ni pour `auction.py`/`resolve_now.py` au-dela de `test_auction.py` (262 lignes, existe et teste la logique de resolution malgre le fait que le chemin ne soit plus le chemin de prod).

---

## 3. Interface avec le reste — couplage front/TS

Le pipeline parle **presque exclusivement** a Supabase via la service-role key (`.env` local, jamais exposee), et scrape procyclingstats.com. Deux formes de couplage au reste de l'app identifiees :

1. **Couplage reseau direct (le seul)** : `refresh_demo_league.py` fait un `POST` HTTP vers `{WATTHUNTER_HOST}/api/admin/revalidate-demo` (lignes 341-349) — un appel dans une route API du Next.js app, authentifie par `REVALIDATE_SECRET`. C'est un outil de demo-mode uniquement (pas dans le chemin `run_pipeline.py`), mais c'est le seul fichier Python qui connait l'existence d'un serveur front en cours d'execution.
2. **Couplage de convention/donnees (le vrai risque pour un rewrite)** : le pipeline **duplique manuellement** des structures de donnees et des constantes definies cote TS (voir §2.4) — `SPONSOR_GOAL_SETS` (mirroir de `gt-goals.ts`), `demo_constants.py` (mirroir de `demo-constants.ts`), `SALARY_COEFFICIENT`, `LEVEL_POOL_MIN`. Ce n'est pas un import technique (pas de dependance npm/pip croisee) mais une **dependance semantique forte** : toute regle de jeu qui vit dans `apps/web/lib/*.ts` doit etre recopiee a la main cote Python pour que scoring/bonus/goals restent corrects. Le pendant pagination (`_fetch_all` cote Python / `fetchAllSupabasePages` cote TS, documente ARCHITECTURE.md lignes 546-554) est le meme genre de couplage par convention parallele, pas par code partage.
3. Le reste (scoring.py, sync_race.py, enrich.py, dnf_detection.py, tactics.py, underdog.py, resolve_gt_rescue.py) ne connait que le schema Postgres (noms de tables/colonnes) et les RPC SECURITY DEFINER qu'il appelle — c'est un couplage au **schema DB**, pas au client TS.

**Conclusion §3** : le pipeline ne depend pas du code du client web (aucun import croise, aucun appel a une route Next.js dans le chemin de production), mais il depend fortement des **regles de jeu encodees en dur dans le front** (`gt-goals.ts`, `levels.ts`, `format.ts`) qu'il reimplemente a la main. Un rewrite du client qui changerait ces structures casserait silencieusement le pipeline la ou aucun test de parite n'existe (§2.4).

---

## 4. Livrable cle — verdict rewrite

**Le pipeline dans son ensemble ne survit PAS tel quel a un rewrite complet, mais un noyau substantiel (scoring + import de resultats + coureurs + Cloudflare-bypass) est portable presque sans changement, car il ne parle qu'au schema Postgres via service-role key — pas au client.**

Decoupage par verdict :

| Bloc | Verdict | Cout | Raison |
|---|---|---|---|
| `browser_session.py` (nodriver/Cloudflare) | **GARDER** | S | Zero dependance mode/front ; c'est la brique la plus dure a refaire (contournement Cloudflare empirique, deja stabilise) ; portable tel quel sous n'importe quel schema DB. |
| `sync.py` (init-riders, salaire) hors `LEVEL_POOL_MIN`/`SALARY_COEFFICIENT` | **ADAPTER** | S | Coeur (scraping ranking, upsert riders) garder ; retirer la formule de salaire et le gating par niveau si Manager est jete (roadmap §2.3 : "Tout le systeme de budgets" jete). |
| `sync_race.py` (import resultats, GC, classifications, startlists) | **GARDER** | M | Mode-agnostic, alimente les tables que classic consomme aussi ; le plus gros fichier hors tests (859 lignes) mais sans logique manager-specifique identifiee. |
| `scoring.py` | **GARDER** | M | Explicitement mode-agnostic (GAME_RULES §19), deja aligne sur la direction produit classic-only ; bien pagine, bien teste (2000+ lignes de tests dedies). |
| `enrich.py`, `photo_storage.py`, `backfill_photos.py` | **GARDER** | S | Donnees coureur, aucune notion de mode ou de ligue. |
| `tactics.py`, `dnf_detection.py`, `resolve_gt_rescue.py` (mecanique GT) | **ADAPTER** | S/M | GT roles/tactics/rescue restent en classic (GAME_RULES §19) mais `resolve_gt_rescue.py` suppose un salaire recurrent (remboursement 50%) a redefinir pour l'economie flat-budget ; mutation treasury manuelle a migrer vers RPC (dette §2.2). |
| `sponsor_bonus.py`, `goal_evaluator.py` | **JETER** (comme mecanique financiere) puis **reecrire XP-only** | L | Toute la logique de bonus en euros disparait avec le mode manager (roadmap §2.3 : "bonus financiers... passage a une logique XP"). Le contenu utile a recuperer n'est pas le code (les montants/tresorerie) mais le **catalogue de goals** (`SPONSOR_GOAL_SETS`, structure role/categorie/tier_group) qui peut se retranspposer en recompenses XP — cf. roadmap §2.2 "sponsors, goals... a rapatrier ... recentres autour de l'XP". |
| `underdog.py` | **JETER puis reevaluer** | S | Wrapper RPC pur (16 lignes) ; en classic `underdog_eligible` est toujours false — le mecanisme de catch-up n'a plus de sens dans une economie a budget plat egal pour tous. Roadmap confirme : "Underdog" garde comme *role/strategie de jeu*, pas comme mecanisme d'eligibilite financiere. |
| `validation.py` | **JETER** | — | Deja mort (non cable), hardcode l'economie manager (200k EUR), aucune valeur pour classic. |
| `auction.py` / `resolve_now.py` | **JETER** | — | Deja supplante par la resolution TS (`forceResolveRound`) ; outil de secours dev obsolete, contient du gating par niveau manager-only. |
| `reconcile_bonuses.py`, `backfill_traceability.py`, `scripts/rescore_*`, `scripts/verify_tdf2026_closeout.py` | **JETER** | — | Scripts d'incident ponctuels (Giro cutover, TdF closeout), lies a des evenements passes deja resolus — valeur historique, pas operationnelle. |
| Suite pytest (mock-based, ~6000 lignes hors integration) | **ADAPTER** | M | La structure de test (mocks Supabase fluent-chain, `test_constants_drift_guard.py`) est reutilisable comme methode, mais chaque test doit etre reecrit contre le nouveau schema/les nouvelles regles classic-only. |

### Dettes propres du pipeline, classees par gravite

1. **[Gravite haute]** Mutation manuelle de `treasury_log`/`teams.treasury` hors RPC dans deux chemins vivants (`sponsor_bonus.py` lignes 494-518, `resolve_gt_rescue.py` lignes 93-111), en contradiction directe avec la regle projet "NEVER muter treasury_log directement". Risque de race condition / credit dephase, deja materialise une fois (incident +400k€, 2026-05-21) sur un chemin voisin depuis corrige par RPC — le chemin revert ne l'a pas ete.
2. **[Gravite moyenne]** Duplication non guardee de `SALARY_COEFFICIENT` (sync.py/format.ts) et `LEVEL_POOL_MIN` (sync.py/levels.ts) — meme classe de risque que celle qui a motive la creation de `test_constants_drift_guard.py`, mais non couverte par lui. Le multiplicateur salaire a deja change deux fois en 2026 (2000→2500→2700) et a chaque fois demande une double edition manuelle documentee au lieu d'une garde automatique.
3. **[Gravite moyenne]** Couplage semantique fort et non-code entre `goal_evaluator.py` et `apps/web/lib/gt-goals.ts` (mirroir manuel de 61 definitions de goals) — fonctionnel aujourd'hui grace au test regex-parseur, mais fragile a toute refonte du fichier TS source (renommage de champs, changement de syntaxe) qui casserait le test sans forcement casser la logique metier — ou l'inverse.
4. **[Gravite moyenne]** Contrainte d'execution locale macOS-only (Chrome hardcode, fenetre visible obligatoire, IP residentielle) — voir §5, impact direct sur toute strategie de deploiement serveur/mobile.
5. **[Gravite basse]** Code mort non signale comme tel dans l'arborescence : `validation.py` (jamais appele), `auction.py`/`resolve_now.py` (supplantes par TS mais toujours presents et testes comme s'ils etaient vivants) — cout de comprehension pour quiconque explore le repo, mais aucun risque d'execution puisque non invoques.
6. **[Gravite basse]** `reconcile_bonuses.py` et les scripts de `scripts/` sont des artefacts d'incident historique (Giro cutover, TdF closeout) laisses dans l'arbre de production plutot qu'archives — coherent avec la remarque CLAUDE.md racine sur "Update Living Docs" mais pas applique a ce dossier specifiquement.

---

## 5. Execution locale uniquement — implication pour une app mobile

Contrainte verifiee (ADR-011, `docs/ARCHITECTURE.md` ligne 600-602 ; CLAUDE.md racine, section "Sync PCS") : Cloudflare bloque les IP datacenter, GitHub Actions ete supprime pour cette raison, IP residentielle obligatoire. Confirme au niveau code par `browser_session.py` : navigateur **visible** par defaut (pas de vrai mode headless fiable), chemin Chrome hardcode macOS.

Consequences concretes pour la cible "app mobile iOS/Android, dev solo" (roadmap §2.1) :

- **Qui lance le scraping** : aujourd'hui, une seule personne (le proprietaire), sur sa machine, avec Chrome installe et une session graphique disponible pour la fenetre visible. Une app mobile en production ne change rien a ce besoin cote **donnees** — le scraping reste un processus backend independant du client mobile, mais il reste sur le meme poste/la meme dependance humaine qu'aujourd'hui, avec le meme point de defaillance unique (si le poste est eteint ou indisponible le jour d'une etape, aucune donnee n'est importee).
- **Frequence** : le pipeline `post-race` doit tourner apres chaque etape/course (quotidien pendant un Grand Tour), a la main, avec une fenetre Chrome visible qui bloque l'ordinateur quelques dizaines de secondes a quelques minutes par appel (15s d'attente entre chaque sous-etape observees dans `run_pipeline.py`, ex. lignes 437-438, 527-528, 570-571). Sur un mois de Grand Tour (21 etapes), c'est une astreinte manuelle quotidienne non automatisable en l'etat.
- **Risque operationnel** : aucune redondance (pas de deuxieme IP residentielle de secours documentee), aucune alerte automatisee si le pipeline echoue un jour (pas de monitoring detecte dans le code), et la fenetre Chrome visible interdit une execution "headless server" classique (VPS, conteneur, cron sur une machine distante sans affichage) sauf a louer une IP residentielle proxy fiable — non mis en place aujourd'hui. **Un rewrite mobile n'elimine pas cette dependance** : que le client soit web ou iOS/Android ne change rien au fait que la donnee source (procyclingstats) reste bloquee derriere Cloudflare pour tout ce qui n'est pas une IP residentielle — c'est une contrainte du fournisseur de donnees, pas de l'architecture actuelle. La vraie option d'elimination serait une source de donnees alternative (API payante, licence PCS, ou changement de fournisseur), question hors perimetre technique de cet audit.
- **Incertitude** : je n'ai pas trouve dans le code de plan de bascule vers un scraping serveur (proxy residentiel paye, service tiers de contournement Cloudflare) ; si un tel plan existe, il vit hors du repo Python audite ici.

---

## Recapitulatif chiffre

- 58 fichiers `.py` hors `.venv` ; 27 fichiers de logique (hors `tests/` et `scripts/`) ; 24 fichiers de tests = 7333 lignes.
- 10 commandes CLI reellement cablees dans `run_pipeline.py` ; 2 fichiers de logique (`auction.py`, `validation.py`) orphelins, non invoques.
- 2 fichiers portent une garde explicite `is_classic_league()` (`sponsor_bonus.py`, `goal_evaluator.py`) — le reste du pipeline est mode-agnostic par construction ou par absence de notion de mode.
- `_fetch_all` : 30 usages verifies dans les 4 fichiers a fort volume (scoring/sponsor_bonus/goal_evaluator/sync_race), aucun trou detecte dans ce perimetre.
- 4 familles de constantes dupliquees avec le front TS ; 2 guardees par test automatique (goals, breakaway), 2 non guardees (salaire, pool min).
- 2 chemins vivants de mutation manuelle de tresorerie hors RPC (violation d'une regle projet explicite).
