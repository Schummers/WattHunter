# WattHunter — Audit Context (injected into every reviewer)

## Stack & hard conventions
- Next.js 16 App Router, TypeScript strict, Tailwind v4 + shadcn, Turborepo, pnpm.
- Supabase Postgres. **Web app uses the anon key only — RLS must protect every table.**
- `service_role` key MUST NEVER reach the browser/client.
- Server actions pattern is MANDATORY: Zod validation → `supabase.rpc(...)` → error forwarding. No business logic in TS server actions.
- DB changes go through migrations only (`supabase/migrations/`). 159 migrations exist.
- Money is granular to 1000€; salaries = pts_PCS × 2000 / 12 (no cap).
- Design System v3: typography via `text-[length:var(--type-*)]`, colors via semantic tokens, never hardcode px/hex.
- Python pipelines in `services/pcs-sync/` run locally; Zod v4 (`zod/v4`).
- All user-facing app text is English.

## Known failure modes (recurring bug classes — look for MORE of these)
- **Idempotency in pipelines**: `credit_sponsor_bonuses` once re-credited treasury ×6 (+400k€ phantom) on reruns. Any pipeline that writes treasury/XP must be idempotent on reruns.
- **PostgREST 1000-row cap**: unpaginated `.select()` silently truncates at 1000 rows. `goal_evaluator.py` missed an ITT payout this way. Any GT-wide fetch must paginate (`_fetch_all`).
- **Rescore drift**: re-running scoring on an old stage drifts OTHER teams' XP (code drift). Snapshot/diff all teams before/after.
- **Temporal squad checks**: sponsor/goal bonuses must check squad membership AT race time (cutoff 11:00 CET), not at run time.
- **No-cumul rule**: a rider triggering a one-time goal loses the base bonus on the same race (GAME_RULES §18).
- **RLS scoping**: `rider_xp_daily`/`sponsor_bonuses` are team-grained; a `rider_id`-only query leaks demo data as duplicates. Scope via `teams!inner(league_id)`.

## Reporting rules for every finding
- Cite real `file:line`. Never invent. If unsure a thing is load-bearing, mark it UNSURE, do not assert.
- Assign Lane: **A** = provable & low-risk (a failing test can be written) ; **B** = correctness/scoring/treasury/RLS or anything where a test can't prove the fix.
- Output language: English.
