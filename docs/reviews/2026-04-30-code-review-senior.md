# WattHunter — Code Review senior (2026-04-30)

> Audit multi-agents (5 axes en parallèle, contexte frais par agent), suivi d'une vérification directe des claims critiques. Posture : senior dev, evidence-based, file:line à l'appui.

## Synthèse exécutive

État global : **fondations saines mais 4 trous critiques à boucher avant alpha**. La discipline TypeScript est bonne (strict mode propre, plus d'`any` après le cleanup récent), l'architecture App Router/Server Actions est cohérente, le design system v3 a des tokens propres. Mais en dessous :

1. **RLS troué** : un joueur peut s'auto-promouvoir niveau 8 et trésorerie 999M via UPDATE direct (CLAUDE.md "NEVER bypass RLS" violé par construction)
2. **Sécurité solvabilité absente cross-rounds** : un joueur peut placer des bids gagnants au-delà de sa trésorerie en éclatant entre rounds
3. **Service Python cassé à l'import** : `main.py` ne peut pas démarrer ; et `auction.py` paye encore les phases en parallèle de la version TS (`confirmPhaseSetup`) → double source de vérité finance
4. **XP drift DB ↔ code** : la dernière stretch curve (Anti-Runaway Mech 3) n'a pas été appliquée en base, les niveaux 6-8 sont désynchronisés

À côté : middleware Supabase manquant, race conditions sur les bids (pas de transactions), 0 test sur `validateRound` (357 lignes, l'invariant économique central), 19 hardcoded `text-[Xpx]` violant Rule #1, duplication massive `rail-pages/` ↔ server pages.

Rien ici n'est insurmontable. Mais avant d'ouvrir au public, les sections **Sécurité** et **Intégrité données** doivent passer.

---

## 1. Sécurité & RLS — CRITICAL

### 1.1 RLS `teams_update_own` permet l'auto-élévation
`supabase/migrations/20260221000000_initial_schema.sql:297`

```sql
create policy "teams_update_own" on public.teams for update using (auth.uid() = user_id);
```

Pas de WITH CHECK, pas de column-level restriction. Avec son anon JWT, un joueur peut faire :
```js
await supabase.from("teams").update({ level: 8, treasury: 999_999_999, cumulative_xp: 99999 }).eq("id", myTeamId)
```
Tout le level gating, tous les unlock sponsors, toute la solvabilité de bid sont contournés en 1 requête. C'est la plus grosse surface d'exploit du projet.

**Fix** : remplacer par une policy qui n'autorise UPDATE que sur les colonnes safes (`name`), via deux mécanismes possibles :
- BEFORE UPDATE trigger qui rejette tout changement de `level/treasury/cumulative_xp/user_id`
- Révoquer UPDATE général + créer une RPC `update_team_name(team_id, name)` SECURITY DEFINER

Même problème sur `leagues_update_commissioner` (ligne 287) : un commissioner peut transférer la ligue, changer `season_year`, etc.

### 1.2 `leagues.invite_code` lisible par tous les users authentifiés
`supabase/migrations/20260222120000_leagues_select_authenticated.sql:4-6`

```sql
create policy "leagues_select_authenticated" on public.leagues
  for select using (auth.uid() is not null);
```

Le commentaire dit *"the invite_code acts as the access barrier (must know the code to join)"*. C'est faux : tout user peut faire `select * from leagues` et énumérer 100% des codes. Le code n'est plus une barrière.

**Fix** : 2 options
- VIEW `public_leagues` qui exclut `invite_code`, RLS dessus
- Garder la table mais déplacer `invite_code` dans une table jointe `league_invites` SELECT-only pour le commissioner

### 1.3 Solvabilité bids non agrégée cross-rounds
`apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:107-110`

Le check `placeBid` filtre `.eq("round", parsed.data.round)` (L100) avant de sommer. Conséquence : un joueur avec 200K trésorerie + 0 salaires peut placer 200K dans round 1 ET 200K dans round 2 ; chacun valide son test indépendamment ; si les deux gagnent, le contrat se solde négatif. Le draft_bids n'est pas non plus inclus dans le total.

**Fix** : la solvabilité doit sommer `(salaires + bids actifs all rounds + draft_bids)` vs `treasury`. Idéalement déplacer ce calcul côté Postgres dans une fonction `compute_team_commitments(team_id)` réutilisable.

### 1.4 Race conditions sur `placeBid` et `validateRound`
`apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:107` et `auction/actions.ts:300`

Entre le SELECT de vérification trésorerie et l'INSERT, deux requêtes concurrentes passent indépendamment. CLAUDE.md interdit ça par invariant ("NEVER autoriser une enchère si treasury < total des enchères actives"), mais c'est advisory côté app.

**Fix** : déplacer `place_bid` et `validate_round` en RPC Postgres SECURITY DEFINER avec `SELECT ... FOR UPDATE` ou advisory lock keyed sur `team_id`. Une seule transaction → invariant garanti.

### 1.5 Middleware Supabase racine manquant
`apps/web/middleware.ts` **n'existe pas** (vérifié). `lib/supabase/middleware.ts:4` exporte `updateSession()` mais ne tourne nulle part. Conséquences :
- La session n'est jamais rafraîchie sur navigation (cookies stale)
- La défense d'auth est uniquement page-par-page (`getUser()` inline)
- Si une nouvelle page oublie le check, route protégée ouverte

**Fix** : créer `apps/web/middleware.ts` :
```ts
import { updateSession } from "@/lib/supabase/middleware";
export async function middleware(req: NextRequest) { return updateSession(req); }
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

### 1.6 GT Squad RLS sans intégrité métier
`supabase/migrations/20260501000000_grand_tour_mode_v1a.sql:32-34, 66-68`

`gt_squad` et `gt_role_assignments` autorisent `FOR ALL` à tout team owner sans vérifier que le rider du role est bien dans le squad, ni que le squad correspond à une `phase_id`/`year` valide. Toute la cap-enforcement est uniquement côté server action — bypassable via Supabase JS direct.

**Fix** : trigger BEFORE INSERT qui valide la cohérence squad ↔ assignment, ou RPC.

### 1.7 Validation Zod absente sur plusieurs server actions
- `settings/actions.ts:6-34` `updateTeamName`, `updateUserName`, `updateUserEmail`, `updateLeagueName` : checks manuels (length/trim) au lieu de Zod
- `rider/[riderId]/actions.ts:16` `releaseRider` : pas de UUID format check
- `auction/market/actions.ts:58-71` `setRoundDates` : `rounds[]` sans `.max(8)` → DOS possible (10000 UPDATE séquentiels)
- `(auth)/league/create/actions.ts:4` + `join/actions.ts:4` : `import { z } from "zod"` au lieu de `"zod/v4"` (drift silencieux)

CLAUDE.md mandate "NEVER skip Zod validation". À standardiser.

---

## 2. Intégrité données — CRITICAL

### 2.1 XP threshold drift entre DB et code
| Source | L6 | L7 | L8 |
|---|---|---|---|
| `supabase/migrations/20260402000000_level_rework_8_levels.sql:8-17` | 900 | 1500 | 2000 |
| `apps/web/lib/levels.ts:6-9` | **1200** | **1800** | **2400** |
| `services/pcs-sync/scoring.py:28` | 1200 | 1800 | 2400 |

La stretch curve de l'Anti-Runaway System (Mech 3, mémoire `anti_runaway_system.md`) n'a jamais été appliquée en migration suivante. Les équipes en DB avec 950 XP sont marquées L6 par la migration mais affichées L5 par l'UI. Côté Giro 2026-05-08 c'est urgent.

**Fix** : nouvelle migration `20260430_xp_stretched_curve_recompute.sql` qui re-UPDATE les `teams.level` selon la nouvelle table de seuils. Idéalement créer une fonction SQL `compute_level(xp numeric) returns int` une fois pour toutes pour éviter le 4e drift.

### 2.2 `auction.py` Python paye encore les phases en parallèle
Vérifié :
- `services/pcs-sync/auction.py:290` `def run_payday(supabase, league_id)`
- `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts:89` `export async function confirmPhaseSetup(teamId)`

CLAUDE.md affirme "Pipeline D SUPPRIMÉ — remplacé par confirmPhaseSetup". Faux. `auction.py:run_payday` existe toujours et est appelable via FastAPI. Si quelqu'un trigger `/jobs/resolve-auction` (`main.py:92`), `resolve_current_round` peut chaîner sur `run_payday` → double paiement.

**Fix** : trancher. Soit on supprime `run_payday` côté Python (et la ligne d'import correspondante dans `main.py`), soit on retire `confirmPhaseSetup`. Vu que CLAUDE.md a déjà tranché pour la version TS, supprimer le Python.

### 2.3 Service FastAPI Python cassé à l'import
Vérifié :
- `services/pcs-sync/main.py:13` `from sync import sync_all_riders` → fonction n'existe pas dans `sync.py` (seul `sync_top500` existe)
- `services/pcs-sync/run_daily_pipeline.py:23` `from sync import sync_all_riders, sync_race_results, purge_old_history` → 3 fonctions inexistantes

Le service FastAPI ne peut pas démarrer. Tant qu'il n'est pas exécuté c'est invisible, mais le Dockerfile et la config Railway pointent dessus.

**Fix** : décider — le service FastAPI a-t-il un avenir ? Si non, supprimer `main.py`, `run_daily_pipeline.py`, `Dockerfile`, et nettoyer Railway. Si oui, fixer les imports vers `sync_top500`.

### 2.4 Release rider mid-phase appliquée immédiatement
`apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts:60-62`

CLAUDE.md : *"NEVER libérer un coureur hors de la fenêtre d'enchères — le release prend effet au début de la phase suivante"*. Le code set `status='released'` instantanément, sans `effective_phase_id` deferral. La protection `phase_recruited_id` empêche le release dans la même phase mais pas la prise d'effet à phase+N.

**Fix** : ajouter colonne `released_at_phase_id` ; `status` reste `active` jusqu'à transition.

### 2.5 `auction_bids_amount` non multiple de 100 sur les contrats
`supabase/migrations/20260403200000_bid_increment_100.sql` enforce le modulo 100 sur `auction_bids` et `draft_bids`, mais pas sur `contracts.locked_salary` / `monthly_salary`. Aucun bug observé en production, mais une migration de backfill ou un bug futur peut planter une valeur non conforme sans CHECK.

### 2.6 Multiples policies dupliquées sur `auction_bids`
- `20260221000000:358 auction_bids_insert_own` + `20260227000000:33 auction_bids_insert`
- `20260227000000:41 auction_bids_update` + `20260313200000:25 auction_bids_update_own`

Postgres OR-merge → la plus large l'emporte. Pas critique mais c'est de la dette qui peut diverger. Choisir une, droper l'autre.

---

## 3. Architecture & dette technique — HIGH

### 3.1 `rail-pages/*` réimplémente les server pages côté client
`apps/web/components/rail-pages/rider-detail-rail.tsx:49-321` (~270 lignes) refait dans un `useEffect` le travail de `app/(game)/league/[leagueId]/rider/[riderId]/page.tsx` :
- Queries Supabase via le **browser client** (anon key)
- Imports dynamiques inside-effect (`await import("@/lib/phases")` L219)
- Pas de gestion d'abort propre sur les promesses Supabase

Pire : la rail ne calcule pas `currentRound`, `pcsPoints`, `contractId`, `ownerDisplayName` (page-only). Selon le chemin d'entrée (URL directe vs ouverture rail), `RiderDetailClient` reçoit deux shapes de données différentes → bug silencieux côté UI.

**Fix** : passer en parallel routes (`@rail/...`) ou intercepting routes (`(.)rider/[riderId]`) pour réutiliser la même server page.

### 3.2 Pas de génération de types Supabase
~89 occurrences entre `Array.isArray(...) ? [0] : ...` et `as { data: ... }` casts inline. Tous symptomatiques de l'absence de types générés. À chaque changement de schéma, le compilo n'attrape rien.

**Fix** : `pnpm supabase gen types typescript --linked > apps/web/lib/database.types.ts`, puis `createServerClient<Database>(...)` partout. Effort moyen, ROI massif.

### 3.3 Pas de transactions sur les mutations multi-tables
- `settings/actions.ts:78-106` `leaveLeague` : 5 deletes séquentiels, aucun rollback en cas d'échec partiel
- `validateRound` : delete bids round précédent + insert nouveaux bids + update treasury, sans transaction
- Pareil pour `confirmPhaseSetup`

**Fix** : déplacer ces flows en RPC Postgres `SECURITY DEFINER`. Bonus : la solvabilité, le slot check, l'auth check et le write tiennent dans une seule transaction.

### 3.4 Pages trop chargées de data fetching
| Page | Lignes | Round-trips |
|---|---|---|
| `auction/page.tsx` | 338 | ~7 |
| `rider/[riderId]/page.tsx` | 364 | 8+ |
| `team/page.tsx` | 314 | 5 |
| `ranking/team/[teamId]/page.tsx` | 325 | N+1 movement compute |

Les pages font le travail d'une couche d'accès données. Extraire `lib/queries/{auction,rider,team,ranking}.ts` avec fonctions nommées. Pages → coquilles fines.

### 3.5 Pas de rate limiting sur bidding
Une boucle `placeBid` côté client peut spam jusqu'à épuisement trésorerie. Chaque appel passe par 6+ DB round trips. Defense-in-depth manquante.

**Fix** : token bucket Upstash, ou simplement délégation au RPC Postgres (un advisory lock ralentit naturellement les concurrents).

### 3.6 Patterns dupliqués inter-actions
- `getParisOffset` dupliqué entre `auction/rounds/actions.ts:10-19` et `auction/market/actions.ts:11-19`
- Default-sponsor auto-assign dupliqué entre `(auth)/league/create/actions.ts:104-119` et `join/actions.ts:103-116`
- `parseRoundNumber` (regex sur `auction.name`) dans `auction/actions.ts:259` ET `auction/page.tsx:208-211` — fragile, devrait être colonne `round int`
- 5 sites font le même unwrap sponsor income : extraire `getTeamSponsorIncome(supabase, teamId): Promise<number>`

### 3.7 Dual auth helper
`lib/supabase/get-user.ts` fait un `cache(getUser)` propre, mais aucune action ne l'utilise — toutes les actions appellent `supabase.auth.getUser()` inline. Choisir un pattern.

---

## 4. Frontend / React — HIGH

### 4.1 `"use client"` posé à tort
- `apps/web/app/(game)/league/[leagueId]/home-feed.tsx:1` : composant pur de rendu (phases/courses), aucun state ni effet ni handler. ~180 lignes + `lib/calendar` + `lib/phases` envoyés au client pour rien.

### 4.2 Login / Signup en useState ceremony
`apps/web/app/(auth)/login/page.tsx:38-54` et `signup/page.tsx:32-67` :
- `useState` + `await` + `setLoading(true/false)` à la main
- Pas de `useFormStatus`, pas de progressive enhancement
- `setLoading(false)` manquant sur le success path → bouton freezé si la nav échoue
- Window de double-submit : `disabled` mis après `await`, pas avant

**Fix** : Server Actions + `useFormStatus`. Bonus : `searchParams` en props au lieu de `useEffect → window.location.search` (login:20-25).

### 4.3 Images sans pipeline cohérent
- `rider-card.tsx:112` : Radix `AvatarImage` raw `<img>`
- `bid-adjust-card.tsx:93` : `next/image` avec URL externe `https://www.procyclingstats.com/...`
- `transaction-row.tsx:77-93` : `next/image` 32×32

**`next.config.ts` n'a pas de `remotePatterns` whitelisté pour procyclingstats.com.** Si jamais le pipeline switche à `next/image` en prod, la page rider crash. À standardiser maintenant.

### 4.4 `use-scroll-direction` retourne `true` au mount
`apps/web/hooks/use-scroll-direction.ts:14-30` : flash visuel sur BottomNav et StickyBar à chaque navigation. `lastScrollY.current` jamais reset entre routes. Listener attaché à un `document.querySelector("main")` qui peut survivre à un swap.

### 4.5 Composants surchargés
- `game-guide-accordion.tsx` (603 lignes, 540 de JSX statique + accordion shell client) → split content en MDX/server-rendered
- `rider-card.tsx` (209) gère 3 click modes × 2 right-content modes × 4 bid states → 3 sous-composants discriminés
- `draft-bid-card.tsx` (220) jongle `localAmount` + `inputValue` + parent `amount` sans réconciliation propre

### 4.6 Duplication composants "card"
8 composants "card-shaped row" : `info-card`, `brand-card`, `team-level-card`, `sponsor-bonus-card`, `draft-bid-card`, `bid-adjust-card`, `rider-card`, `transaction-row`. Chacun avec ses borders/radius/padding propres. Le primitive shadcn `ui/card.tsx` n'est utilisé par personne.

### 4.7 Accessibilité — violations basiques
- `back-header.tsx:14-23` : `<button>` sans `type="button"` ni `aria-label`
- `detail-rail.tsx:14-20` : pas de focus trap ni restoration sur le drawer desktop
- `segmented-control.tsx` : pas de `aria-pressed`/role radio
- Aucun `not-found.tsx` du projet → pages affichent `<p>not found.</p>` inline

---

## 5. Design system v3 — HIGH (Rule #1)

### 5.1 19 hardcoded `text-[Xpx]` (Rule #1 breach explicite)
Concentration : **`components/sponsor-bonus-card.tsx`** = **15 occurrences** (lignes 40, 44, 45, 56, 60, 61, 77, 81, 82, 110, 147, 157, 167, 181, 191) avec `text-[10px]`, `text-[11px]`, `text-[13px]`. 11 et 13 ne sont **pas** dans la scale (qui n'autorise que 10/12/14/16/18/20/32).

Autres : `team/page.tsx:255` `text-[14px]`, `bid-adjust-card.tsx:101,120` `text-[11px]`/`[14px]`, **`filter-chips.tsx:22` `text-[13px]`** (la canonical pattern viole sa propre règle).

### 5.2 Hex et rgba en dur
- `budget-summary.tsx:54` `text-[#4ade80]` au lieu de `var(--success)`
- `app/layout.tsx:15` `themeColor: "#111113"` (ne match aucun token)
- `round-blocks.tsx:46` `bg-[rgba(6,182,212,0.05)]`
- `levels-timeline.tsx:83,85` `style={{backgroundColor: "rgba(...)"}}`

### 5.3 Couleurs Tailwind nommées partout
~25 occurrences de `bg-emerald-500/10`, `bg-red-500/30`, `text-red-400`, `border-amber-500/X` à la place de tokens sémantiques. Cause racine : **les tokens `--success-bg`, `--danger-bg`, `--warning-bg` n'existent pas** dans `globals.css`. La règle DS "pas de background coloré sur sémantique" est en pratique impossible à respecter sans bg tokens.

**Fix prio 1** : créer ces 3 tokens (+ `--success-border`, `--scrim`, `--surface-overlay` pour `bg-white/5` / `bg-black/X`) dans `globals.css`, puis migrer les ~30 sites.

### 5.4 Pattern reinvention
La DS dit "3 patterns canoniques". En pratique :
- `segmented-control.tsx` ↔ `filter-chips.tsx` : 2 composants pour le même usage
- `sub-tabs.tsx` ↔ `ui/tabs.tsx` line variant : 2 composants pour le même usage
- `pill.tsx` exporte `Pill` marqué `@deprecated` mais toujours utilisé

**Fix** : trancher, supprimer le perdant à chaque fois.

### 5.5 Radius hors scale (4/6/8/20)
`rounded-xl` (12px) utilisé 6 fois (`team-level-card:31`, `metric-box:12`, `info-card:12`, `(auth)/league/choose:28,45`, `auctions-client:427`). Soit on l'aligne sur `rounded-lg` (8px) per Card spec, soit on formalise un `--radius-soft` 12px dans la DS.

### 5.6 Geist Mono manquant sur du numérique
- `team-level-card.tsx:56,79` : niveaux "1", "2" avec `font-bold` mais sans `font-mono`
- `budget-summary.tsx:99` : signe `−` en Geist Sans, casse `tabular-nums`
- Autres `Lv.X` displays dans lobby/ranking

### 5.7 Gradient hardcodé alors que `.cta-gradient` existe
`auction/rounds/rounds-client.tsx:131,144` : `bg-gradient-to-r from-cyan-500 to-cyan-400`. Le commentaire dans `globals.css` dit explicitement "use instead of inline from-cyan-500 to-cyan-400". Quick fix littéral.

### 5.8 Phosphor Icons : 0 import
La DS liste Phosphor pour la gamification. **Aucun import dans `apps/web`**. Soit on l'utilise vraiment, soit on retire de la DS.

---

## 6. Tests — HIGH

### 6.1 Coverage matrix critique
| Surface | Tested | Total | Critical untested |
|---|---|---|---|
| Server actions | 4 | 12 | `auction/actions.ts` (357 L, **`validateRound`**), `budget/actions.ts`, `team/strategies/actions.ts`, `settings/actions.ts` (`leaveLeague` cascade), `(game).../actions.ts` (`launchFirstAuction`), `(auth)/league/{create,join}/actions.ts`, `auction/rounds/actions.ts` |
| Lib | 3 | 12 | `budget.ts` (`computeAvailableBudget` !), `strategies.ts`, `phases.ts` (boundary math), `boost.ts`, `co-unlock.ts` (server side), `gt-goals.ts`, `remontada.ts` |

`validateRound` est l'invariant économique central → **0 test**.

### 6.2 Qualité tests existants
- `auction/[auctionId]/actions.test.ts` : 5/19 tests sont tautologiques (auth post-Zod, prouve rien)
- 4 copies divergentes de `makeChain` à travers les fichiers test (un est un Proxy, qui shorts-circuit le branch `Array.isArray ? [0] : ...` dans `releaseRider` → ce branch n'est jamais testé)
- `installSequence` dans `team/gt/actions.test.ts:73-97` est un meilleur pattern → à extraire dans `apps/web/test-utils/`

### 6.3 Patterns absents
- Aucun test E2E (Playwright)
- Aucun test d'intégration contre Supabase test instance
- Aucun seuil de coverage Vitest
- Le cross-stack regex test (`levels-sync-check.test.ts`) est un excellent pattern mais limité à LEVELS — devrait couvrir aussi `LEVEL_POOL_MIN` (sync.py:24), `SALARY_FLOOR`, `SALARY_COEFFICIENT`

---

## 7. Service Python pcs-sync — MIXED

### 7.1 Service FastAPI cassé (déjà détaillé en 2.3)

### 7.2 Cloudflare error handling silencieux
`sync.py:127`, `sync_race.py:296` : `break` sur détection sans retry, sans backoff, sans status retournée. Une seule réponse Cloudflare tue la sync top-600 mid-page → state partiel en DB.

### 7.3 `datetime.utcnow()` deprecated
`sync.py:157`, `sync_race.py:333`, `enrich.py:301`, `auction.py:83/209/305/445`. `Dockerfile` pin Python 3.12 → `DeprecationWarning` à terme.

### 7.4 Logging incohérent
Mix `print()` + `logger.info/warning/error` selon le fichier. Log level défaut WARNING dans la plupart des entrypoints → `logger.info` est silencieux.

### 7.5 Pacing rate limit hardcodé en 5+ endroits
- `sync.py:180=15s`, `enrich.py:34=60s`, `run_pipeline.py:432/502/551=15s`, `sync_race.py:385=11s`
- `RATE_LIMIT_MS` env var lu mais **jamais utilisé** (sync.py:19 dead code)

### 7.6 Pas de progress checkpoint sur enrich
Crash à rider 87/600 → recommence à 1. `--retry-missing` ne couvre que `photo_url` et `specialty`, pas teams_history.

### 7.7 Tests Python — `test_auction.py` trompeur
`test_nominal_resolution` mock seulement 5 réponses pour 8+ calls réels. Le `make_chain` fallback masque le fait que 3+ calls testent rien. Le test passe pour la mauvaise raison.

### 7.8 Aucun fixture HTML PCS commit
Si procyclingstats change un sélecteur (`enrich.py:160-218`), aucun test ne pète. Recommandation : commit 2-3 sample HTML dans `tests/fixtures/`.

### 7.9 Code mort confirmé
- `run_daily_pipeline.py` ne peut pas s'exécuter (3 imports inexistants)
- `auction.py:36` `rank_max_for_level = rank_min_for_level` (alias vestigial)
- `run_pipeline.py:440` `if True:` leftover

---

## 8. Migrations SQL — MEDIUM

### 8.1 Pas de policy sur `riders`, `race_results`, `treasury_log`, etc. en INSERT/UPDATE
Par design (writes via service_role). Mais **aucun commentaire** dans les migrations qui le documente → un futur dev peut ajouter une INSERT policy qui ouvre une faille. Documenter.

### 8.2 Inconsistance SELECT public
- `race_results`, `rider_season_rankings`, `race_startlists`, `gt_daily_classifications`, `sponsor_bonuses`, `rider_teams` : `using (true)` (anonymes peuvent lire)
- `rider_pcs_history` : `using (auth.uid() is not null)` (authentifiés)

Trancher : pourquoi `rider_pcs_history` est plus protégé que `race_results` ?

### 8.3 `policies` → `strategies` rename incomplet
Migration `20260406000000` renomme la table mais pas les RLS policies (`team_policies_select_own` etc.). Fonctionnel, confusing.

### 8.4 Indexes manquants sur queries chaudes
Pas de composite sur `(ever_in_pool, pcs_rank)` → la query "riders ever_in_pool=true AND pcs_rank>=N ORDER BY pcs_rank" full-scan.

### 8.5 Naming convention RLS pas appliquée
Mix `treasury_log_select_own` (snake_case) et `"Anyone can read race_results"` (sentence). Trancher.

---

## 9. Top 12 actions priorisées (ROI)

| # | Action | Effort | Impact | Catégorie |
|---|---|---|---|---|
| 1 | Lock down `teams_update_own` (column-level ou trigger BEFORE UPDATE) | M | 🔴 Critique | Sécu |
| 2 | Migration XP stretched curve (re-UPDATE teams.level) avant Giro 2026-05-08 | S | 🔴 Critique | Data |
| 3 | Solvabilité bids agrégée cross-rounds + draft_bids | M | 🔴 Critique | Sécu |
| 4 | Créer `apps/web/middleware.ts` (Supabase session refresh) | S | 🔴 Critique | Sécu |
| 5 | Trancher `auction.py run_payday` vs TS `confirmPhaseSetup` | S | 🔴 Critique | Data |
| 6 | Fixer ou supprimer `services/pcs-sync/main.py` + `run_daily_pipeline.py` | S | 🔴 Critique | Infra |
| 7 | Restreindre `leagues` SELECT (cacher `invite_code`) | M | 🟠 Haut | Sécu |
| 8 | Ajouter tests sur `validateRound` + `lib/budget.ts` + `lib/strategies.ts` | M | 🟠 Haut | Tests |
| 9 | Générer types Supabase + remplacer ~89 casts inline | M | 🟠 Haut | DX |
| 10 | Migrer `placeBid`/`validateRound`/`releaseRider`/`confirmPhaseSetup` en RPC Postgres SECURITY DEFINER | L | 🟠 Haut | Architecture |
| 11 | Créer tokens `--success-bg`/`--danger-bg`/`--warning-bg`/`--scrim` + migrer 25 violations | S | 🟡 Moyen | DS |
| 12 | Refactor `rail-pages/*` en parallel routes (suppr. ~600 L dupliquées) | L | 🟡 Moyen | Architecture |

---

## 10. Quick wins (S effort, gros retour)

1. **Fix 15 `text-[Xpx]` dans `sponsor-bonus-card.tsx`** — édition mécanique, élimine 80% des breaches Rule #1 d'un coup
2. **Remplacer `from-cyan-500 to-cyan-400` par `.cta-gradient`** dans `rounds-client.tsx:131,144` — le commentaire de globals.css le demande déjà littéralement
3. **Supprimer `revalidatePath` doublon** dans `auction/actions.ts:354-355`
4. **Aligner `zod/v4`** dans `(auth)/league/{create,join}/actions.ts:4`
5. **Supprimer `console.error`** dans `(auth)/league/{create,join}/actions.ts` ou les router via un logger
6. **Ajouter `.max(8)`** sur `setRoundDates.rounds` schema
7. **Remplacer `revalidatePath` doublon** dans `auction/actions.ts:354-355`
8. **Drop migrations RLS dupliquées** (`auction_bids_insert` × 2, `auction_bids_update` × 2)
9. **Standardiser image pipeline** : décider `next/image` partout ou `<img>` partout, configurer `remotePatterns` pour PCS si choix `next/image`
10. **Hoister `buildNavItems` hors de `Sidebar`** (`sidebar.tsx:32-60`)

---

## 11. Observations transverses (positives)

À noter pour ne pas tout peindre en noir :
- TypeScript strict propre, plus d'`any` après le cleanup récent (commit `2c1d752`)
- Pattern Server Actions cohérent (pas de `/api` route)
- Route groups `(auth)/(game)/(legal)` bien bornés
- Le cross-stack regex test (`levels-sync-check.test.ts`) est un pattern excellent et rare
- `levels.ts`, `gt-goals.ts`, `co-unlock.ts` sont bien factorisés (source unique de vérité côté code)
- Le design system v3 a une vraie scale et de vrais tokens (le problème est l'application, pas la conception)
- 22 tests Python pour 2520 lignes — distribution honnête sur scoring/sponsor_bonus/sync_race/enrich/remontada

---

## Annexe A — Méthodologie

5 agents general-purpose dispatched en parallèle, contexte frais par agent :
1. Architecture & server actions
2. Frontend React components
3. Design system v3 compliance
4. Backend / Supabase / RLS / sécurité
5. Tests + Python pcs-sync

Vérification directe par lecture des fichiers sur 6 claims les plus critiques avant report (RLS, middleware, XP drift, Python imports, double payday).

Aucun fix appliqué dans cet audit. Audit only.
