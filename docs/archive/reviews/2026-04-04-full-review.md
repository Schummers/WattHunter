# WattHunter — Revue Technique & Fonctionnelle Complète

> Date : 2026-04-04
> Agents : A1 (Security), A2 (Design System), A3 (Python), CR-1 (DB & Backend), CR-2 (Auth + Game), CR-3 (Budget/Ranking/CI)
> Scope : Tout le repo — 45 migrations, 14 fichiers Python, 34 pages Next.js, 46 composants

---

## CRITIQUE — Bloquants alpha (7)

### C1. Join League ne respecte pas le starting_level de la ligue
**Fichier** : `apps/web/app/(auth)/league/join/actions.ts` (lignes 81-89)
**Problème** : Quand un joueur rejoint une ligue créée au Level 4, son équipe est créée au Level 1 avec 0 XP. Il a accès au pool #300-600 et 6 slots, tandis que le commissioner a pool #30-600 et 9 slots. Le sponsor par défaut (Lotto T1) est aussi assigné au lieu du sponsor correspondant au niveau.
**Fix** : Copier la logique de `createLeague` — assigner `starting_level`, XP correspondant, et sponsor adapté.

### C2. Auction Detail query contracts sans scope league
**Fichier** : `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx` (ligne 53)
**Problème** : `supabase.from("contracts").select("rider_id").eq("status", "active")` récupère TOUS les contrats actifs de TOUTES les ligues. Les riders marqués "pris" le sont même s'ils sont contractés dans une autre ligue.
**Fix** : Joindre via `teams` pour filtrer par `league_id`.

### C3. Treasury CHECK >= 0 bloque le flow bankruptcy
**Fichier** : `supabase/migrations/20260313200000_prelaunch_audit.sql`
**Problème** : Contrainte `teams_treasury_non_negative CHECK (treasury >= 0)` empêche le treasury de passer en négatif. Or `auction.py` a un seuil bankruptcy à -10K. Contradiction avec spec 2026-04-03 "zéro faillite".
**Fix** : Décider spec authoritative. Si "zéro faillite" → garder la contrainte, supprimer le code bankruptcy. Si bankruptcy → changer à `CHECK (treasury >= -10000)`.

### C4. Treasury default = 0 sans mécanisme de crédit initial
**Fichier** : `supabase/migrations/20260402400000_phase_economy.sql`
**Problème** : Le default treasury est 0, mais aucun mécanisme ne crédite les fonds initiaux. Un nouveau joueur ne peut pas enchérir car treasury = 0.
**Fix** : Soit revenir à `DEFAULT 200000`, soit auto-trigger le premier sponsor payment à la création d'équipe.

### C5. Specs bankruptcy contradictoires — code implémente -10K, spec dit "supprimé"
**Fichiers** : `services/pcs-sync/auction.py` (lignes 379-430), `docs/plans/2026-04-03-market-auctions-redesign-spec.md`
**Problème** : Le code contient la logique complète de faillite cascade (-10K threshold, auto-release). La spec 2026-04-03 dit explicitement "Faillite → supprimée". Le CHECK >= 0 rend le code mort de toute façon.
**Fix** : Nettoyer — supprimer le code bankruptcy de `auction.py`, le type `bankruptcy_release` de treasury_log, la colonne `is_bankrupt`, et les références UI.

### C6. Pas de CI pour PRs (lint/typecheck/test)
**Fichier** : `.github/workflows/` — seul `resolve-auctions.yml` existe (cron pausé)
**Problème** : Pas de quality gate sur les PRs. Les erreurs de type, tests cassés et lint violations passent silencieusement.
**Fix** : Créer `.github/workflows/ci.yml` avec `pnpm typecheck` et `pnpm test`.

### C7. Pas de config ESLint
**Fichiers** : Aucun `.eslintrc` ou `eslint.config.js` dans le repo
**Problème** : `pnpm lint` ne fait rien. Pas d'`eslint` dans les devDependencies.
**Fix** : Ajouter `eslint` + `eslint-config-next` + config.

---

## IMPORTANT — À fixer avant alpha (14)

### I1. treasury_log vide entre les runs pipeline
**Fichiers** : `budget/page.tsx`, `team/market/actions.ts`, `auction.py`
**Problème** : `treasury_log` n'est alimenté que par le pipeline Python (payday + sponsor_bonus). Entre les runs, le Budget affiche "No transactions this phase". `confirmPhaseSetup` côté TS ne crée pas d'entrées.
**Impact** : Budget P&L montre 0/0 pour income/outgoing jusqu'au prochain run pipeline.

### I2. 9 phases vs 8 niveaux — mismatch
**Fichiers** : `services/pcs-sync/auction.py` (9 phases), `apps/web/lib/phases.ts` (9 phases), `lib/levels.ts` (8 niveaux)
**Problème** : Phase 9 "End of Season" n'a pas de niveau correspondant. `getCurrentPhase()` peut retourner 9, hors range des levels.

### I3. Labels sponsors dans levels.ts désalignés avec CLAUDE.md
**Fichier** : `apps/web/lib/levels.ts`
**Problème** : Les montants affichés (350K, 450K, 650K) ne correspondent pas aux specs (400K, 550K, 750K).

### I4. Seed files obsolètes
**Fichiers** : `supabase/seed/01_policies.sql` (descriptions en français, ages incorrects), `02_sponsors.sql` (ancien modèle 10 sponsors)
**Fix** : Supprimer `02_sponsors.sql`, mettre à jour `01_policies.sql` en anglais.

### I5. `setRoundDates` guard bloque l'édition pendant la phase active
**Fichier** : `apps/web/app/(game)/league/[leagueId]/team/market/actions.ts` (lignes 50-55)
**Problème** : Le guard `if (new Date() >= phaseStart)` empêche d'éditer les dates dès que la phase commence, même si les enchères n'ont pas encore ouvert.

### I6. History page search bar non fonctionnelle
**Fichier** : `apps/web/app/(game)/league/[leagueId]/team/market/history/page.tsx` (lignes 87-95)
**Problème** : Input de recherche sans handler, sans state, sans filtrage.

### I7. `leaveLeague` ne nettoie pas `draft_bids`
**Fichier** : `apps/web/app/(game)/league/[leagueId]/settings/actions.ts`
**Problème** : La suppression d'équipe ne supprime pas les draft_bids → FK violation possible ou rows orphelins.

### I8. validation.py hardcode 200K initial treasury
**Fichier** : `services/pcs-sync/validation.py` (ligne 45)
**Problème** : Assume 200K initial alors que le default est maintenant 0.

### I9. Références "notice" status dans Python
**Fichiers** : `auction.py` (ligne 187), `scoring.py` (ligne 145)
**Problème** : Filtrent `IN ("active", "notice")` mais "notice" a été supprimé de la contrainte contracts. Code mort.

### I10. `is_bankrupt` colonne jamais utilisée
**Fichier** : `supabase/migrations/20260221000000_initial_schema.sql` (ligne 45)

### I11. Budget projective formula double-compte sponsor income
**Fichier** : `apps/web/lib/budget.ts` (lignes 5-12)
**Problème** : `treasury + sponsorIncome - salaries - drafts` ajoute le sponsor income au treasury même s'il a déjà été crédité par payday.

### I12. Dual source of truth pour maxActive policies
**Fichier** : `apps/web/lib/policies.ts` (lignes 42-44) — hardcode au lieu de lire `LEVELS[].maxActive`

### I13. Waterfall 3 étapes dans ranking/team/[teamId]
**Fichier** : `apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx`
**Problème** : 3 rounds séquentiels de queries, fetch données de TOUTES les équipes pour calculer un ranking.

### I14. Dead treasury_log types
**Problème** : `release_fee`, `transfer_bonus`, `starting_fund` — types dans la contrainte CHECK mais jamais insérés.

---

## WARNING — Mineurs (10)

### W1. filter-chips.tsx — 4 px hardcodés
`rounded-[6px]`, `px-[14px]`, `py-[6px]`, `text-[13px]` → devraient utiliser tokens DS

### W2. bid-adjust-card.tsx — 1 px hardcodé
`text-[14px]` → devrait être `text-[length:var(--type-emphasis)]`

### W3. 2 routes sans loading.tsx
`team/auctions/` et `team/auctions/rounds/`

### W4. budget/actions.ts error shape incohérente
`{success: false, error}` au lieu de `{error}` comme les autres

### W5. `addDraft` ne vérifie pas treasury au moment du draft
By design (drafts = wishlist), mais pas de feedback budget à l'utilisateur

### W6. Pas de retry Cloudflare mid-sync
Si blocked, pipeline s'arrête sans retry. Données partielles sauvegardées.

### W7. Read-then-write sans transaction dans auction.py
Treasury debit sans transaction Postgres. Race condition peu probable (CLI single-threaded).

### W8. `road_warriors` policy non documentée dans CLAUDE.md
5ème policy type dans le code, 4 dans la spec.

### W9. `formatEuro` utilise locale `fr-FR` dans une app anglaise
Produit "155 000 €" au lieu de "155,000 €". Incohérent avec CLAUDE.md "English-only".

### W10. `SUPABASE_SERVICE_ROLE_KEY` dans turbo.json build env
Invalide le cache Turbo inutilement — pas nécessaire au build.

---

## SUGGESTIONS (8)

| # | Description | Fichier |
|---|-------------|---------|
| S1 | Ajouter `vercel.ts` config (root dir, framework) | Projet root |
| S2 | `next.config.ts` vide — ajouter `images.remotePatterns` pour PCS | `apps/web/next.config.ts` |
| S3 | Indexes manquants : `draft_bids.rider_id`, `sponsor_bonuses.rider_id` | Migrations |
| S4 | Tables avec `USING (true)` SELECT — au moins exiger auth | Migrations |
| S5 | `datetime.utcnow()` deprecated Python 3.12+ | `auction.py` |
| S6 | `"use client"` inutile sur `league/choose/page.tsx` | Auth pages |
| S7 | Supabase client créé à chaque render dans login/signup | Auth pages |
| S8 | Vérifier multiplicateur x2 sur stages GT pour sponsor bonus | `sponsor_bonus.py` |

---

## Résumé positif

**Ce qui marche bien :**
- ✅ Toutes les server actions ont `"use server"` et auth check
- ✅ Zod validation sur les actions critiques (bids, drafts, sponsors)
- ✅ Anon key + RLS partout, jamais de service_role côté client
- ✅ Design system v3 bien respecté (tokens couleurs, typographie, radius)
- ✅ Ranking page pleinement fonctionnelle (pas un stub)
- ✅ `Promise.all` pour parallel data fetching
- ✅ Formules métier correctes (salaire, XP, sponsor bonus, auction tiebreak)
- ✅ Commissioner gating correct (rounds, league name)
- ✅ Auth callback robuste (open redirect prevention, recovery flow)
- ✅ Empty states gérés sur la majorité des pages

---

## Matrice Page × Connexion Data

| Page | Tables requêtées | Status |
|------|-----------------|--------|
| Login/Signup | auth.users | ✅ OK |
| Onboarding | users | ✅ OK |
| League Create | leagues, teams, team_sponsors, league_members | ✅ OK |
| League Join | leagues, teams, team_sponsors, league_members | ⚠️ C1 (level mismatch) |
| Home | teams, contracts→riders, rider_xp_daily, races calendar | ✅ OK |
| My Team | contracts→riders, draft_bids, policies | ✅ OK |
| Market | riders (pool gated), draft_bids, contracts | ✅ OK |
| Market History | draft_bids→riders | ⚠️ I6 (search non fonctionnel) |
| Draft Bids | draft_bids→riders, auctions | ✅ OK |
| Round Dates | auctions | ⚠️ I5 (guard bloque édition) |
| Policies | team_policies, policies | ✅ OK |
| Auction Calendar | auctions | ✅ OK |
| Auction Detail | auctions, auction_bids, contracts, riders | ⚠️ C2 (cross-league contracts) |
| Auction Results | auction_bids→riders→teams | ✅ OK |
| Rider Detail | riders, contracts, auction_bids, race_results | ✅ OK (3 contextes) |
| Budget P&L | treasury_log, contracts→riders, team_sponsors→sponsors | ⚠️ I1 (treasury_log vide) |
| Transactions | treasury_log | ⚠️ I1 (treasury_log vide) |
| Marketplace | sponsors, team_sponsors | ✅ OK |
| Ranking | teams, contracts, rider_xp_daily, team_ranking_daily | ✅ OK |
| Team Detail | teams, contracts→riders, rider_xp_daily | ⚠️ I13 (waterfall) |
| Levels | lib/levels.ts (static) | ⚠️ I3 (labels stale) |
| Settings | teams, leagues, league_members | ⚠️ I7 (draft_bids cleanup) |

---

## Actions prioritaires (ordre recommandé)

1. **Décider spec faillite** → C3/C5 (nettoyer bankruptcy OU fixer constraint)
2. **Fix treasury initial** → C4 (revenir à 200K ou auto-credit)
3. **Fix join league level** → C1
4. **Fix auction detail cross-league** → C2
5. **Setup CI** → C6/C7 (workflow + ESLint)
6. **Aligner levels.ts labels** → I3
7. **Nettoyer dead code** → I9/I10/I14 (notice, is_bankrupt, dead types)
8. **Fix setRoundDates guard** → I5
9. **Fix search bar history** → I6
10. **Fix leaveLeague draft_bids** → I7
