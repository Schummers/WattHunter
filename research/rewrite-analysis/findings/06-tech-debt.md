# Axe 6 — Dette transverse et REX, si on recommençait

Périmètre : historique et transversal. Sources lues : `docs/ARCHITECTURE.md`, `docs/ROADMAP_ET_REX.md`, `docs/TECHNICAL_AUDIT.md` (2026-05-15), `docs/runbooks/giro-cutover-postmortem-2026-06-03.md`, `review/runs/2026-06-11/REPORT.md` (394 findings), `docs/archive/TODO_BACKLOG.md`, `docs/adr/`, `MEMORY.md` et ses notes de session, `git log` (185 migrations, ~250 commits visibles).

---

## 1. Classes de bugs récurrentes

### 1.1 Troncature silencieuse PostgREST à 1000 lignes — **défaut d'architecture, éliminable par construction**

Ce n'est pas arrivé deux fois, c'est arrivé en continu pendant trois mois, dans trois couches différentes :

- `goal_evaluator.py` : bug original, corrigé le premier (source du pattern `_fetch_all` dans `services/pcs-sync/db_utils.py`).
- `sponsor_bonus.py` : re-frappé 2026-06-04, commit `9eef3fe`, message du commit : « same class of bug already fixed in goal_evaluator » — la fonction `process_race_bonuses` n'avait pas été migrée vers `_fetch_all` malgré le précédent.
- Front Next.js : re-frappé 2026-07-26, commit `be8cd85`, **14 lectures affectées** (`rider_xp_daily` 1380 lignes/ligue, `race_results` 2929 lignes sur la phase Tour), Pogačar disparu du feed étapes 13-20.
- L'audit du 2026-06-11 (`review/runs/2026-06-11/REPORT.md`) liste encore, à cette date, entre 15 et 20 fetches non paginés distincts rien que dans `scoring.py`/`goal_evaluator.py`/`sync_race.py`/`dnf_detection.py` (ex. lignes 377-383, 426-431, 434-437, 499-501, 512-516, 529-531, 548-550, 569-574 de `scoring.py`), classés P0/P1.

**Verdict : défaut d'architecture.** Le problème n'est pas qu'un développeur ait oublié `.range()` une fois, c'est qu'il n'existe **aucune barrière structurelle** empêchant un appel Supabase brut de retourner un résultat tronqué sans erreur. Un rewrite l'élimine par construction de deux façons possibles : (a) une couche d'accès aux données unique où le fetch générique pagine toujours par défaut (le safe path est le seul path), ou (b) des agrégations calculées côté DB (vues/fonctions retournant un scalaire) plutôt que des fetches de lignes brutes rapatriées côté client pour sommation. Un refactor sur la base actuelle ne peut que courir après chaque nouveau call site — ce qui est exactement ce qui s'est passé trois fois.

### 1.2 Non-idempotence des crédits treasury — **mixte : le pattern racine est un défaut d'archi, sa persistance dans un troisième fichier est un bug d'implémentation**

Chronologie :
- Migration `20260521120100` (mentionnée dans `MEMORY.md`) : +400k€ de trop sur 6 reruns de `sponsor_bonus.py`.
- `goal_key_idempotency_fix.md` (2026-06-03) : bascule `goal_index` → `goal_key` incomplète, backfill ambigu, deux verrous concurrents (`idx_goal_completions_dedup` jamais droppé + nouveau `idx_goal_completions_key`).
- Audit 2026-06-11 (`B2-01`, `DATA-1`, `TD-02`, P0/P1) : `goal_evaluator.py:674-724` fait un SELECT treasury puis un UPDATE absolu, non atomique, avec insert de completion et crédit treasury dans deux `try/except` séparés — une panne partielle peut perdre de l'argent silencieusement.
- **Fix effectivement livré** (vérifié dans le code actuel) : `goal_evaluator.py` route désormais tout par la RPC `credit_goal_reward` (ligne 703-711, commentaire : « ONE transaction inside credit_goal_reward. A rerun is a no-op (ON CONFLICT) »), et `sponsor_bonus.py` route par `credit_sponsor_bonuses` (ligne 466). Les deux familles P0 identifiées par l'audit ont bien été corrigées par migration vers une RPC atomique.
- **Ce qui n'a PAS été corrigé** : `services/pcs-sync/resolve_gt_rescue.py` lignes 102-111, vérifié dans le code au 2026-08-27, fait encore exactement le pattern dénoncé par l'audit (findings `B4-DATA-02`, `B4-01`, `B4-02`, `TD-B4-01`) :
  ```python
  team_resp = supabase_admin.from_("teams").select("treasury").eq("id", team_id).single().execute()
  new_treasury = team_resp.data["treasury"] - amount
  supabase_admin.from_("teams").update({"treasury": new_treasury}).eq("id", team_id).execute()
  ```
  Read-modify-write non atomique, en Python, avec un commentaire dans le code lui-même (« Direct treasury update (service_role — bypasses trigger protection) ») qui documente le contournement du garde-fou plutôt que de le respecter. `audit_2026-06-25` (MEMORY.md) confirme : « resolve_gt_rescue TOCTOU » reste dans les 5 familles Voie B restantes, non closes à cette date.

**Verdict : le pattern racine (mutation de treasury en dehors d'une RPC SECURITY DEFINER unique) est un défaut d'architecture** — la règle CLAUDE.md « NEVER muter treasury_log directement » existe précisément parce que ce pattern se répète, et l'ARCH-02 du `TECHNICAL_AUDIT.md` notait déjà en mai que le service Python est « exempt par convention only ». Deux occurrences sur trois ont été corrigées ; la troisième prouve que la discipline manuelle ne suffit pas à empêcher la récidive tant qu'il reste des chemins d'écriture directs. Un rewrite qui interdit *techniquement* (pas seulement par convention documentée) toute écriture sur une colonne financière hors d'une primitive `credit_treasury(...)` unique élimine la classe entière. Coût du fix ponctuel sur l'existant : **S** (même pattern RPC que les deux autres, quelques heures).

### 1.3 Calendriers de course divergents — **défaut d'architecture, source unique aurait empêché le bug**

`tdf2026_rest_days_calendar_bug.md` (mémoire 2026-07-26, commit `e82f6da`) : `services/pcs-sync/wt_calendar_2026.json` (Python) n'avait pas de clé `rest_days` pour le Tour 2026, contrairement à `apps/web/lib/gt-stage-schedule.ts` (`GT_SCHEDULES`/`GT_REST_DAYS`, front) qui était juste. Conséquence : étapes 10-15 datées 1 jour trop tôt, étapes 16-21 2 jours trop tôt côté scoring. Le cutoff de rôle GT (`race_date` à 11h Europe/Paris, `scoring.py:645-697`) a **silencieusement exclu 113 assignations de rôles** avant correction (Klimax +65 XP, GoudalEnergies +39, etc.). Les deux fichiers existent toujours aujourd'hui (`services/pcs-sync/wt_calendar_2026.json` et `apps/web/lib/gt-stage-schedule.ts`), c'est une divergence structurelle permanente, pas un incident clos.

**Verdict : défaut d'architecture.** Deux sources de vérité pour la même donnée métier (dates de course), une en JSON consommé par Python, une en TypeScript consommée par le front, sans mécanisme de synchronisation ni de test croisé. Un rewrite qui centralise le calendrier dans une seule table DB (lue par les deux runtimes via la même RPC/API) élimine la classe entière par construction. Le fix a coûté une session complète de rescoring avec diff manuel équipe par équipe — pas un simple patch.

### 1.4 Dérive de l'XP des autres équipes lors d'un rescore rétroactif — **défaut d'architecture (absence d'idempotence du pipeline de scoring), pas juste un bug**

`giro_xp_backfill_rescore_drift.md` : relancer `calculate_daily_scores()` sur d'anciennes étapes avec le code de scoring *actuel* recalcule **tous les coureurs de toutes les équipes** de ces courses, pas seulement la cible du backfill. Six équipes ont vu leur `cumulative_xp` dériver lors d'un backfill ciblé sur 2 coureurs, parce que les finales avaient été scorées avec une version de code légèrement différente entre-temps.

**Leçon consignée par l'utilisateur lui-même** (même note) : une vérification de cohérence interne de la formule (`(raw × mult + bonus) × nemesis == xp_gained` sur 135 lignes, « 0 erreur ») **n'a pas détecté** le vrai bug (dates de calendrier fausses en amont) — faux négatif classique, la vérification testait la formule, pas ses entrées.

**Verdict : défaut d'architecture.** Le scoring n'est pas conçu pour être rejouable de façon isolée (pas de scope explicite « ne recalculer que ce coureur, cette course, sans toucher au reste »), et il n'existe pas de test de non-régression qui diffe automatiquement le `cumulative_xp` de toutes les équipes avant/après un rescore. Le contournement actuel est une discipline manuelle (« toujours diff cumulative_xp de TOUTES les équipes avant/après »} documentée en mémoire projet, pas un garde-fou dans le code. Un rewrite avec un scoring pipeline pur (fonction de calcul séparée de l'écriture, recalcul déterministe et scope explicite par clé `(team, rider, race_slug)`) éliminerait la classe ; a minima, un test d'intégration qui échoue si un rescore modifie une ligne hors du scope demandé serait un filet peu coûteux à ajouter même sans rewrite.

### 1.5 Gotchas RLS / policies trop ouvertes — **défaut d'architecture (pas de trigger de protection générique par colonne sensible)**

L'audit du 2026-06-11 recense, en un seul passage, six failles RLS notées P0 :
- `D1-01` : la policy d'INSERT directe sur `auction_bids` (migration initiale `20260221000000` lignes 358-362) n'a **jamais été droppée** après l'introduction de la RPC `place_bid` — un joueur peut toujours insérer un bid en contournant tous les contrôles de la RPC.
- `D1-RLS-01` : `contracts_update_own` (migration `20260403300000`) laisse un propriétaire d'équipe modifier N'IMPORTE QUELLE colonne de ses propres contrats, y compris `status` et `bid_amount`.
- `D1-RLS-02` : `grant_xp` SECURITY DEFINER, callable par n'importe quel utilisateur authentifié malgré un commentaire d'en-tête affirmant « Service-role only ».
- `D1-RLS-03` : `teams.underdog_eligible` ajoutée sans mettre à jour `block_team_field_updates` — n'importe qui peut se rendre éligible Underdog lui-même.
- `BR-D1-01` / `D1-04` : `team_sponsors` a une policy `FOR ALL TO authenticated` sans vérification de propriété d'équipe.
- `SEC-09`/`TD-004` (déjà dans `TECHNICAL_AUDIT.md` de mai, confirmé encore présent en juin) : `forceResolveRound` n'a pas de vérification de rôle commissaire.

Le point commun de tous ces cas : **une table ou une colonne sensible ajoutée par une migration ultérieure sans que la protection générique (trigger `block_team_field_updates`, policy `FOR ALL`) soit étendue en même temps.** Ce n'est pas un oubli isolé, c'est reproduit à chaque ajout de fonctionnalité touchant `teams`, `contracts` ou `auction_bids` — parce que la protection vit dans un trigger séparé du DDL qui crée la colonne, avec aucun lien mécanique entre les deux.

**Verdict : défaut d'architecture.** Le pattern « colonne sensible protégée par une allowlist dans un trigger à part » demande une discipline manuelle à chaque migration ultérieure. Un rewrite avec une DB déclarative (schéma versionné, pas 185 migrations incrémentales) où les colonnes protégées sont marquées explicitement (ex. contrainte au niveau colonne, ou génération du trigger depuis la liste des colonnes non protégées plutôt que l'inverse) éliminerait la classe. `forceResolveRound` en particulier (git actuel, `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:413-462`, vérifié) n'a **toujours pas** de vérification `commissioner_id === user.id` : après la RLS check de membership, le code bascule directement sur le client admin (ligne 440) sans re-vérifier l'autorité. Ce fix précis (SEC-09) était déjà connu en mai 2026, confirmé encore ouvert en juin, et reste ouvert au moment de cet audit — effort **S**, non fait depuis trois mois.

### 1.6 Constantes dupliquées Python/TS — **défaut d'architecture (deux runtimes, aucune source de vérité partagée)**

`apps/web/lib/format.ts:57` : `export const SALARY_COEFFICIENT = 2700;`
`services/pcs-sync/sync.py:57` (docstring) : `"""Salary = pcs_points × 2700 / 12, floored to nearest 1000. No upper cap."""`

Confirmé dans `MEMORY.md` (`vuelta2026_phase_setup.md`) : « Multiplicateur salaire dupliqué front (`format.ts`) + Python (`sync.py`) » lors du changement 2500→2700 du 2026-08-19. Le même problème existait déjà pour le passage 2000→2500 (commit `5235a28`, 2026-06-30) : deux fichiers à modifier en synchronisation manuelle, sans test qui casse si l'un des deux diverge. C'est le même mécanisme racine que 1.3 (deux runtimes, une source de vérité par langage) appliqué aux constantes de jeu au lieu du calendrier.

**Verdict : défaut d'architecture.** GAME_RULES.md §11 est documenté comme source unique de la *valeur*, mais rien ne garantit que le code des deux runtimes la lit depuis un seul endroit — chacun a sa propre constante en dur. Un rewrite avec une seule couche API (voir §2) qui calcule le salaire côté serveur unique élimine la duplication à la racine plutôt que d'espérer que la doc GAME_RULES.md soit relue à chaque changement.

### 1.7 Cutoffs de rôle ratés par les joueurs — **défaut de design produit, pas seulement technique**

`MEMORY.md` (`vuelta2026_stage1_itt_scoring.md`, 2026-08-23) : deux équipes classic (bigdaddy, GoudalEnergies) ont scoré **0 XP** sur l'étape 1 de la Vuelta parce que leur squad était verrouillé après le role_cutoff (11h CET) au moment où elles auraient dû l'ajuster. Le CLAUDE.md liste explicitement une « action à envisager : alerter les joueurs avant le cutoff » — jamais implémentée. Ce n'est pas un bug de code (le cutoff fonctionne comme prévu), c'est un défaut d'UX/notification : le jeu n'avertit jamais un joueur qu'une fenêtre se ferme. Directement lié au blocker ouvert du CLAUDE.md : « Définir la stratégie de notifications in-app » — jamais résolu depuis la décision « pas d'emails » (voir §1.8 du REX). Un rewrite n'élimine rien ici par construction : c'est un choix produit encore à trancher, indépendant de la stack.

### 1.8 Autres classes trouvées, non listées dans la commande

- **RPC redéfinies sans source canonique** (`DB-11` du `TECHNICAL_AUDIT.md`, toujours vrai) : `place_bid` a été (re)créée dans **10 fichiers de migration distincts** (`20260503000000`, `20260506210000`/`20260506220000`, `20260508000000`, `20260512000000`, `20260518000002`, `20260602000000`, `20260602110100`, `20260625000200`, `20260630130000` — vérifié par grep sur `supabase/migrations/`), chacun recopiant le corps complet de la fonction. **Aucun** `supabase/functions/sql/` canonique n'existe (le dossier `supabase/functions/` lui-même n'existe pas — vérifié). 76 fonctions `SECURITY DEFINER` recensées aujourd'hui (contre 22 en mai), sans registre de version. Ajouter une validation demande de copier ~200 lignes en espérant ne pas régresser une correction antérieure — exactement le mécanisme qui explique pourquoi le bug 1.5 (`auction_bids_insert_own` jamais droppée) a survécu six mois.
- **Business logic dans des server actions TS**, en violation de la règle CLAUDE.md « pattern obligatoire : Zod → `rpc()` → error forwarding » : l'audit du 2026-06-11 relève `saveSponsor` (`team/budget/actions.ts:63-110`), `saveStrategies` (`team/strategies/actions.ts:44-211`), `createLeague`/`league-creation.ts` comme contenant des règles métier (montants, plafonds, séquences d'inserts) directement en TypeScript plutôt que déléguées à une RPC. La règle existe et est documentée depuis le début (PR #13, mai), mais continue d'être violée sur les nouveaux chantiers.
- **Duplication de logique applicative** : `isCutoffPassedCET` dupliquée à l'identique entre deux fichiers (`F7-01`), deux fonctions `formatXp` distinctes avec des sémantiques différentes (`F7-02`), requête `contracts + riders(*)` réécrite dans 5+ pages (`ARCH-03` du `TECHNICAL_AUDIT.md`, toujours vrai au 2026-06-11 sous une autre étiquette F5-ARCH).

---

## 2. Jugement sur les choix structurants

### 2.1 Logique métier en RPC SQL SECURITY DEFINER vs services applicatifs

**Le choix RPC-first est globalement sain pour un jeu à transactions financières** (verrouillage `FOR UPDATE`, atomicité native, pas de race condition côté application quand c'est respecté — l'audit de mai confirme un locking correct sur `place_bid`). Le problème n'est pas le choix RPC en soi, c'est son **exécution sans tooling** : pas de fichier source canonique par fonction (voir 1.8), 185 migrations qui sont à la fois le schéma ET l'historique complet des versions de chaque fonction, ce qui rend la lecture du "état actuel" d'une RPC dépendante de savoir laquelle des 10 migrations `place_bid_*` est la dernière appliquée.

**Verdict : GARDER le principe RPC SECURITY DEFINER pour les mutations financières et de squad. JETER la pratique actuelle de redéfinition complète sans source canonique.** Un rewrite garderait la logique en base (`pgTAP` ou équivalent testable), mais avec des fichiers source par fonction versionnés hors migrations (générés/injectés dans les migrations à la CI), ou en migrant vers un schéma déclaratif Supabase (`supabase db diff` / declarative schema, disponible depuis les versions récentes de la CLI — non utilisé ici).

### 2.2 186 migrations sans schéma déclaratif — le `db reset` est-il encore fiable ?

Compté au 2026-08-27 : **185 fichiers** dans `supabase/migrations/` (CLAUDE.md/MEMORY.md indiquaient 186 en référence à une date antérieure — cohérent, la trajectoire est à la hausse continue). Le CLAUDE.md du projet affirme la garantie « un `supabase db reset` doit pouvoir reconstruire la DB à l'identique » comme règle absolue (Rule #2).

Preuves que cette garantie a été **cassée concrètement au moins deux fois**, puis réparée :
- `goal_key_idempotency_fix.md` : un fichier de rollback mal placé (au top-level de `supabase/migrations/` au lieu de `_rollback/`) a fait échouer `db reset` par collision de version (`schema_migrations_pkey duplicate`) — corrigé, mais la cause (convention de nommage non imposée par un tooling, seulement par une note de mémoire projet) reste identique pour tout futur rollback.
- `6b7efa7 fix(seed): guard classic V2 seed so supabase db reset works locally` — le seed de la ligue playtest V2 cassait le reset local, corrigé par un garde de portabilité (skip si users prod absents).
- `b377bbb fix(migrations): make Giro data-correction migrations reset-safe` — des migrations de correction de données Giro (patchs ponctuels appliqués en prod hors séquence normale) ne rejouaient pas proprement depuis zéro.

**Verdict : la garantie tient aujourd'hui (le reset fonctionne, d'après CLAUDE.md « Local Supabase »), mais elle est fragile et a été cassée à répétition par la nature même de l'approche** (des migrations de correction ponctuelle de données de production mélangées au même flux que les migrations de schéma). 185 fichiers séquentiels, sans regroupement thématique ni schéma déclaratif consultable en un coup d'œil, rendent l'audit humain du schéma courant pratiquement impossible sans outillage (`supabase db diff` généré, ou lecture exhaustive). Un rewrite bénéficierait d'un schéma déclaratif Supabase (fichiers `schema.sql` par domaine, diffés automatiquement en migrations) — élimine la classe de bug « migration de donnée mélangée à migration de schéma cassant le reset ».

### 2.3 Scraping local-only comme unique source de données

Contrainte externe (Cloudflare bloque les IP datacenter), documentée et acceptée, pas un choix arbitraire. Le postmortem Giro (`giro-cutover-postmortem-2026-06-03.md` §2) montre le coût réel : quand même le scraping local a échoué (nodriver + playwright bloqués), l'ingestion de secours a été **manuelle depuis des captures d'écran fournies par l'utilisateur**, validées ligne par ligne avant écriture. C'est un unique point de défaillance non redondé : si l'IP résidentielle change, si Cloudflare durcit encore son fingerprinting, il n'existe aucun plan B automatisé, seulement la saisie manuelle.

**Verdict : GARDER par nécessité (pas d'alternative crédible identifiée pour un solo dev sans budget proxy résidentiel), mais documenter explicitement le fallback manuel comme un runbook de premier ordre**, pas un backlog secondaire (« Cloudflare PCS scrape — Required before Tour 2026 » traîne dans le backlog du postmortem Giro). Un rewrite n'élimine pas cette dépendance : elle est externe au code.

### 2.4 Monorepo Turborepo pour une app web + un service Python

Le monorepo Turborepo/pnpm sert essentiellement `apps/web` ; `services/pcs-sync` est un service Python autonome (venv séparé, invoqué en CLI manuel), pas un package du monorepo Node au sens Turborepo (pas de build/test orchestré par `turbo` pour lui — vérification à faire mais aucune référence Python trouvée dans une config `turbo.json` type pipeline). Pour un dev solo avec une seule app web (pas de packages partagés visibles entre plusieurs apps front), Turborepo n'apporte a priori aucun bénéfice de cache de build multi-app qu'un simple `pnpm workspace` sans Turbo n'apporterait pas déjà.

**Verdict : incertain sans lire `turbo.json` en détail — signalé comme point à vérifier, pas affirmé.** Si confirmé qu'il n'y a qu'une seule app Next.js consommant le monorepo, Turborepo est un outil surdimensionné pour la structure actuelle ; coût de simplification faible (S) si un rewrite part d'un simple pnpm workspace sans Turbo, ou même d'un repo unique non-monorepo pour l'app mobile-first envisagée.

### 2.5 Absence de couche API dédiée entre client et Supabase

Le client Next.js parle directement à Supabase (anon key + RLS) depuis les Server Components et Server Actions, sans couche API intermédiaire. C'est cohérent avec l'approche Supabase-native et permet le pattern RPC (2.1). Le revers : `docs/TECHNICAL_AUDIT.md` note **zéro caching** (`PERF-08`, aucun `unstable_cache`/`revalidate` trouvé dans `apps/web/app/`), et des pages qui répètent 7 à 16 requêtes Supabase par chargement (ex. `league/[leagueId]/page.tsx`). Sans couche API, chaque page réinvente sa propre composition de requêtes — d'où la duplication `contracts + riders(*)` sur 5+ pages (1.8) et l'absence de vues DB (`DB-08`, zéro `CREATE VIEW` sur 133 migrations en mai, toujours vrai).

**Verdict : ADAPTER, pas JETER.** Le modèle "Server Components + Supabase direct" est raisonnable pour la taille actuelle du produit et le mobile visé pourrait continuer à en bénéficier (Supabase a un SDK mobile natif). Ce qui manque n'est pas une couche API HTTP supplémentaire, mais une couche de requêtes DB centralisée côté serveur (vues SQL ou fonctions `get_*` réutilisées par toutes les pages) — moins cher qu'une vraie API, élimine la duplication et le zéro-caching à la racine.

### 2.6 Tests : répartition et angles morts

Chiffres vérifiés au 2026-08-27 :
- Python (`services/pcs-sync/tests/`) : **30 fichiers de test**, ~7 333 lignes.
- Vitest (`apps/web`) : **57 fichiers** `*.test.ts*`.
- Playwright e2e : **4 fichiers** `*.spec.ts` seulement.

L'audit de mai détaillait déjà les trous : `run_pipeline.py` (971 lignes, orchestrateur CLI incluant le calcul des dates GT, source des deux derniers bug-fix commits de calendrier — voir 1.3) et `goal_evaluator.py` (581 lignes, opération financière) avaient **zéro test** à l'époque ; 7 des 15 fichiers de server actions n'avaient aucun test, dont `leaveLeague` (irréversible) et la création de ligue. Le rewrite n'a pas eu lieu depuis, ces fichiers restent les plus gros et les moins couverts du projet.

**Verdict : GARDER le double socle pytest/vitest (proportionné, la couverture est réelle sur les chemins critiques scoring/auction), mais le trou sur `run_pipeline.py`/`goal_evaluator.py`/`resolve_gt_rescue.py` (financier, zéro test, non-atomique — voir 1.2) est précisément là où les incidents réels se sont produits.** Playwright à 4 specs est cosmétique face à la surface produit (confirmé `test.fixme until seed data` dans MEMORY.md sur au moins un test GT tactics) — un rewrite ne doit pas reproduire ce déséquilibre : les 4 flows financiers (bid, payday, sponsor bonus, GT rescue) mériteraient un test d'intégration Postgres réel (le projet en a déjà, `418fb54 test(rpc): integration tests against local Supabase Postgres` — pattern à généraliser plutôt qu'à réinventer).

---

## 3. La documentation elle-même : actif ou passif ?

Le projet impose une règle explicite (`CLAUDE.md` Rule #4) : mettre à jour `GAME_RULES.md`, `ARCHITECTURE.md` et `MEMORY.md` dans la même session que chaque feature.

**Verdict global : la discipline de mise à jour est réelle et largement respectée — c'est un actif net, pas un passif — avec un drift limité et localisé.**

Preuves à l'appui :
- `docs/ARCHITECTURE.md` affiche un en-tête « Derniere mise a jour : 2026-05-28 » mais contient du contenu daté jusqu'au **2026-07-26** (ligne 552, section pagination) et documente la Classic League Mode du **2026-06-25** (lignes 413-419) — l'en-tête n'a simplement pas été rebumpé, alors que le corps du document a continué d'être maintenu. C'est un défaut cosmétique, pas un vrai mensonge de contenu.
- **Drift réel identifié** : les 4 derniers PRs mergés (`#69` Vuelta 2026 phase prep, `#70` fix commissioner-only round opening, `#71` classic squad cap enforcement, `#72` exactly-10-riders validation — tous datés fin août 2026) **n'apparaissent nulle part dans `ARCHITECTURE.md`**, qui s'arrête à l'état post-clôture Tour de France (26 juillet). La ligne 419 dit encore explicitement « Vuelta encore absente » du calendrier front, alors que `vuelta2026_phase_setup.md` (mémoire, 2026-08-19) documente une phase Vuelta entièrement configurée en production. Ce sont **un mois de changements produit non reflétés** dans le document d'architecture censé être la source de vérité — exactement le scénario que Rule #4 est censée empêcher, sur la fenêtre la plus récente du projet.
- Le `docs/TECHNICAL_AUDIT.md` (2026-05-15) est un instantané figé, jamais mis à jour depuis — c'est normal pour un rapport d'audit daté, mais aucun document ne fait le point sur lequel de ses 33 findings reste ouvert aujourd'hui ; il faut croiser manuellement avec `review/runs/2026-06-11/` et `MEMORY.md` pour le savoir (ce que cet audit a dû faire à la main, voir §1.2 et §1.5).
- Un seul fichier existe dans `docs/adr/` (`2026-07-rank-based-gt-barème.md`) malgré des dizaines de décisions structurantes tracées ailleurs (postmortems, REX, migrations) — l'ADR comme format n'a pas pris, la trace de décision vit presque entièrement dans `MEMORY.md` (mémoire d'agent, pas un artefact versionné consulté par un humain naturellement) et dans les messages de commit.

**Un rewrite hériterait d'une doc globalement fiable pour comprendre l'histoire (REX très honnête, postmortems détaillés avec chiffres), mais PAS d'un `ARCHITECTURE.md` à jour au jour J** — il faudrait le regénérer depuis le code + les 4 derniers PRs avant de s'y fier. `GAME_RULES.md` (805 lignes, non audité ligne à ligne ici mais cité comme source unique des constantes et visiblement maintenu à chaque changement de règle d'après le git log) est probablement le document le plus fiable du corpus.

---

## 4. Ce qu'on changerait vraiment (5 à 8 décisions), avec preuve

1. **Éliminer les deux sources de vérité par runtime (calendrier, constantes de jeu).** Preuve : bug calendrier Tour (1.3, 113 rôles perdus, commit `e82f6da`) + duplication `SALARY_COEFFICIENT` Python/TS (1.6, `format.ts:57` vs `sync.py:57`) répétée à chaque changement de multiplicateur (2000→2500→2700, trois occasions de diverger). Un rewrite centralise calendrier et constantes de jeu dans des tables DB lues par les deux runtimes via la même RPC, ou au minimum génère le fichier Python depuis la même source que le TS en CI.

2. **Interdire techniquement toute mutation de solde financier hors d'une primitive `credit_treasury`/`debit_treasury` RPC unique — pas seulement par convention documentée.** Preuve : 2 des 3 occurrences du read-modify-write non atomique ont été corrigées (`goal_evaluator.py`, `sponsor_bonus.py`), la troisième (`resolve_gt_rescue.py:102-111`) persiste encore aujourd'hui malgré que la règle CLAUDE.md l'interdise explicitement depuis le début. La convention seule ne suffit pas.

3. **Remplacer les fetches Supabase bruts par une couche qui pagine par défaut (ou par des vues/fonctions DB qui retournent des agrégats, pas des lignes à sommer côté client).** Preuve : le bug de troncature à 1000 lignes a frappé trois fois dans trois couches différentes sur trois mois (1.1), et l'audit du 2026-06-11 en recensait encore 15-20 occurrences non corrigées à cette date rien que dans le service Python.

4. **Un schéma déclaratif (ou au moins des fichiers source canoniques par RPC) au lieu de 185 migrations incrémentales comme unique représentation du schéma.** Preuve : `place_bid` redéfinie intégralement dans 10 fichiers de migration distincts, aucune source canonique, `db reset` cassé au moins 3 fois par des migrations de correction de données mélangées au flux de schéma (1.8, 2.2).

5. **Lier structurellement la protection des colonnes sensibles à leur création**, pas via un trigger séparé maintenu à la main. Preuve : 6 failles RLS P0 dans un seul audit (1.5), toutes du même mécanisme — colonne/table sensible ajoutée sans étendre la protection existante — et `forceResolveRound` reste sans vérification de rôle commissaire aujourd'hui malgré un fix connu et documenté depuis mai (effort S, jamais appliqué).

6. **Un test d'intégration qui diffe automatiquement `cumulative_xp` de toutes les équipes avant/après tout rescore**, au lieu d'une discipline manuelle documentée dans une note de mémoire d'agent. Preuve : la dérive XP du backfill Giro (1.4) a touché 6 équipes non ciblées ; la vérification de cohérence de formule utilisée n'aurait jamais détecté ni ce bug ni le bug calendrier (1.3), qui sont tous deux des bugs d'entrée, pas de calcul.

7. **Un seul mode de jeu dès le départ** (déjà tranché par le REX lui-même, `ROADMAP_ET_REX.md` §1.4 — confirmation externe, pas une découverte de cet audit) : la coexistence classic/manager a doublé la surface de test et de maintenance pendant six mois avant d'être condamnée. Preuve indirecte dans le code : les branchements mode-conditionnels (`isClassic ? ... : ...`) traversent au moins 8 fichiers front listés dans `ARCHITECTURE.md` ligne 419, pour un mode qu'on savait vouloir jeter dès juillet.

### Ce qu'on garderait tel quel

- **Le principe RPC SECURITY DEFINER pour les mutations financières et de squad** (2.1) — le locking `FOR UPDATE` fonctionne, l'audit de mai ne relève aucun problème de concurrence sur `place_bid` lui-même, seulement sur son nombre de requêtes.
- **Le socle de tests pytest + vitest** et le pattern d'intégration Postgres réel introduit par `418fb54` — à généraliser, pas à jeter.
- **La discipline de documentation (REX honnête, postmortems chiffrés, MEMORY.md détaillé)** — rare pour un projet solo, c'est ce qui a permis de reconstruire cette chronologie sans ambiguïté.
- **Le scraping local-only** — contrainte externe non contournable, pas un choix d'architecture à remettre en cause (2.3).
- **La séparation Server Components + Supabase direct sans couche API HTTP** (2.5) — adaptée à la taille du projet et au futur mobile ; le vrai manque est une couche de requêtes centralisée côté DB (vues), pas une API REST/GraphQL en plus.

---

## Incertitudes signalées

- Le contenu exact de `turbo.json` (pipeline Python inclus ou non dans l'orchestration Turborepo) n'a pas été lu ligne à ligne — jugement 2.4 à confirmer avant de le citer comme fait établi.
- L'état de correction exact de chacun des 394 findings de l'audit 2026-06-11 au-delà des familles citées ici (RLS, pagination, treasury) n'a pas été vérifié un par un dans le code actuel — seuls les cas cités en 1.2/1.5 ont été re-vérifiés ligne à ligne contre le code du 2026-08-27.
- `GAME_RULES.md` (805 lignes) n'a pas été audité pour drift ligne à ligne contre le code, seulement cité comme probablement fiable d'après le pattern de commits observé.
