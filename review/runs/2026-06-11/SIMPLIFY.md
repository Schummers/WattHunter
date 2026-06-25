# WattHunter — SIMPLIFY.md

> Ordered cut-plan: reversible deletions, merges, and flattening.
> Source: wf_cd8043a3-555 review (394 findings). All Lane A = provable/low-risk.
> NEVER recommend a High-risk deletion without naming the characterization test first.

## Rule consolidation map

| Duplicated rule | Current locations (N copies) | Canonical target |
|---|---|---|
| Sponsor auto-assign (lotto/astana by level) | auth/callback:122, join/actions:83, lib/league-creation:72, create/actions:100 — **4 copies** | `lib/assign-default-sponsor.ts` |
| League creation sequence | lib/league-creation.ts + create/actions.ts inlined — **2 copies** | `lib/league-creation.ts` only |
| `users` upsert pre-create/join | 3 call sites, divergent error handling — **3 copies** | `lib/ensure-user-profile.ts` |
| `max_players: 20` magic literal | league-creation.ts:48, create/actions.ts:72, DB default — **3 copies** | `lib/constants.ts` → `MAX_LEAGUE_PLAYERS` |
| Open-redirect `next` guard | auth/callback:184 only, not reused — **1 ad-hoc** | `lib/sanitize-next-path.ts` |
| Salary formula `pts_PCS × 2000 / 12` | scoring.py + at least 1 TS location | `lib/salary.ts` |
| pendingCookies loop | 6 return sites in auth/callback — **6 copies** | `withAuthCookies(url)` helper |

---

## Cut plan (sorted: Low-risk + high LOC first)

| # | Action | Risk | LOC | file:line | What | Why safe | Safety-net needed |
|---|---|---|---|---|---|---|---|
| 1 | DELETE | Low | ~70 | `apps/web/app/(auth)/league/create/actions.ts:53-125` | Inlined createLeague block | createLeagueWithTeam() covers it exactly | Unit: same rows produced by both paths for same input |
| 2 | MERGE | Low | ~80 | `auth/callback:122-142 + league/join/actions.ts:83-112` | Duplicate sponsor auto-assign blocks | Identical logic; callback copy has no error check | Unit: assignDefaultSponsor(1)→lotto, (2)→astana, (3)→none |
| 3 | FLATTEN | Low | ~30 | `apps/web/app/auth/callback/route.ts:31-206` | 6x pendingCookies loop on every return path | All returns need same cookies; one helper suffices | Spy: cookies present on each redirect branch |
| 4 | DELETE | Low | ~15 | `apps/web/app/auth/callback/route.ts:8-12 (intent query param)` | Dead ?intent= param never read | Cookie-only path is actual signal; param misleads readers | Grep: no searchParams.get('intent') in callback |
| 5 | MERGE | Low | ~20 | `3 call sites: create/actions.ts, join/actions.ts, callback` | Duplicated users upsert pre-league | Identical upsert; only error-handling differs | Unit: mock failure → all 3 sites return error |
| 6 | FLATTEN | Low | ~10 | `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx:23-27` | Re-fetch leagues row already in layout | Layout already gates; page fetch is redundant | Integration: single DB query per lobby render |
| 7 | DELETE | Low | ~5 | `lobby/[leagueId]/_components/launch-button.tsx:29` | Meaningless memberCount >= 1 gate | Everyone has ≥1; server RPC is real gate | Once server-side minimum decided |
| 8 | MERGE | Low | ~40 | `apps/web/app/(lobby)/…/launch-button.tsx:5 (cross-group import)` | launchFirstAuction imported from (game) actions | Belongs in lobby/actions.ts alongside setStartingLevel | Lint: no-restricted-imports (lobby)→(game) |
| 9 | FLATTEN | Low | ~25 | `apps/web/lib (multiple formatter functions)` | Scattered money/number formatters | formatMoney in lib/format.ts already exists | Unit: all formatters importable from single module |
| 10 | MERGE | Med | ~60 | `services/pcs-sync/scoring.py (8 unpaginated fetches)` | Replace raw .select() with _fetch_all() | Pattern already used in goal_evaluator.py | Test: inject >1000 rows, assert all scored |
| 11 | FLATTEN | Med | ~30 | `sponsor_bonus.py + goal_evaluator.py (race_results fetch)` | Both fetch race_results independently | Same query shape; one paginated fetch can serve both | Unit: mock PostgREST, assert single fetch path |
| 12 | MERGE | Med | ~45 | `services/pcs-sync/auction.py (underdog eligibility check)` | Eligibility logic partially in Python, partly in DB trigger | Consolidate into a single RPC | Test: underdog threshold boundary cases |
| 13 | DELETE | High | ~200 | `services/pcs-sync/remontada.py (dead code)` | Flag-disabled code post-2026-06-02 suppression | Tables already dropped (migration 20260602120000) | **Required first**: grep all import sites + characterization test proving pipeline output unchanged |