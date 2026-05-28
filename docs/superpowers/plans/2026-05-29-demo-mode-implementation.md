# Demo Mode (Chantier B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let unauthenticated visitors browse `/league/demo/*` as a read-only snapshot of a real WattHunter league, with the full game shell, anonymized teams/users, and a cyan banner pulse instead of mutations.

**Architecture:** A stable `DEMO_LEAGUE_ID` and 8 ghost `auth.users` are seeded once by migration; `anon` RLS policies grant SELECT on 21 league-scoped + reference tables scoped by `public.demo_league_id()`. The web app forks the `(game)/league/[leagueId]/layout.tsx` when `leagueId === "demo"` to skip auth, mounts a `DemoProvider` + `DemoBanner` + `DemoBottomCta`, and wraps every mutation server-action call site in `useDemoSafeAction` which intercepts the call and triggers a 900 ms cyan glow on the banner instead. A Python `refresh_demo_league.py` script wipes-and-replaces the demo data in one transaction (FK-children first) and invalidates the Next.js `cacheTag("demo-league")` via a `REVALIDATE_SECRET`-protected POST.

**Tech Stack:** Next.js 16 (App Router + Cache Components: `"use cache"` / `cacheTag` / `cacheLife`), Supabase Postgres (RLS + `STABLE` SECURITY DEFINER helpers), Tailwind v4 with WattHunter Design System v3 tokens, Python 3.9+ (`supabase-py`, `python-dotenv`), Vitest + jsdom + RTL, pytest.

**Source spec:** `docs/archive/specs/2026-05-29-demo-mode-implementation-spec.md`. Parent: `docs/archive/specs/2026-05-12-try-before-signup-design.md` §4.

**Out of scope (do NOT touch):** Chantier A landing page, Chantier C signup (already shipped), Chantier D lobby (already shipped), demo analytics, scheduled refresh.

---

## Conventions recap (enforce in every task)

- **Tokens only**: `text-[length:var(--type-*)]`, `text-[var(--text-*)]`, `bg-[var(--bg-*)]`, `border-[var(--border-*)]`, `rounded-[var(--radius-*)]`. No hex, no px. Geist Mono via `font-mono` for numbers.
- **Server actions**: Zod validation → `supabase.rpc(...)` → error forwarding. No business logic in TS.
- **Migrations**: `supabase/migrations/<ts>_<desc>.sql` + `supabase db push --linked`. Idempotent where possible.
- **UI strings**: English only.
- **Commits**: conventional, prefix `feat(demo):` / `fix(demo):` / `refactor(demo):` / `test(demo):` / `docs(demo):` / `chore(demo):`.
- **Security**: never reference `SUPABASE_SERVICE_ROLE_KEY` from `apps/web/{src,app,components,contexts,lib,hooks}`. Python refresh script reads it from `services/pcs-sync/.env`.
- **Verification gate**: every task ends with the verification commands listed; do not commit before they pass.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `apps/web/lib/demo-constants.ts` | TS source of truth: `DEMO_LEAGUE_SLUG`, `DEMO_LEAGUE_ID`, `DEMO_TEAM_IDS[8]`, `DEMO_USER_IDS[8]`, `DEMO_TEAM_NAMES[8]`, `DEMO_VISITOR_TEAM_INDEX`, derived `DEMO_VISITOR_TEAM_ID`. |
| `apps/web/scripts/dump-demo-constants.ts` | Tiny CLI that prints those constants as JSON (used by refresh script + cross-language test). |
| `services/pcs-sync/demo_constants.py` | Python mirror of `demo-constants.ts`. |
| `apps/web/lib/__tests__/demo-constants-sync.test.ts` | Vitest: TS JSON dump == Python module dict, byte-for-byte. |
| `services/pcs-sync/tests/test_demo_constants_sync.py` | Pytest mirror. |
| `supabase/migrations/20260529000001_demo_seed_ghost_users.sql` | `public.demo_league_id()` function, `is_demo` column, 8 ghost `auth.users`, 8 `public.users`, placeholder demo league row. |
| `supabase/migrations/20260529000002_demo_anon_select_policies.sql` | 21 `FOR SELECT TO anon` policies. |
| `supabase/migrations/20260529000003_join_rejects_demo.sql` | One-line guard inside `join_league_by_code`. |
| `apps/web/contexts/demo-context.tsx` | `DemoProvider`, `useDemo`, `useDemoSafeAction`. |
| `apps/web/contexts/__tests__/demo-context.test.tsx` | RTL test for `useDemoSafeAction` interception + pulse trigger. |
| `apps/web/components/demo/demo-banner.tsx` | Top sticky banner, registers itself as the pulse target. |
| `apps/web/components/demo/demo-bottom-cta.tsx` | Mobile bottom CTA, hide-on-scroll. |
| `apps/web/components/demo/__tests__/demo-banner.test.tsx` | RTL: banner renders, pulse class toggles. |
| `apps/web/app/(game)/league/[leagueId]/demo-layout.tsx` | Replacement layout when `leagueId === "demo"`. |
| `apps/web/app/api/admin/revalidate-demo/route.ts` | `POST` → `revalidateTag("demo-league")` with Bearer auth. |
| `apps/web/app/api/admin/revalidate-demo/__tests__/route.test.ts` | Vitest: 401 without token, 200 with token. |
| `services/pcs-sync/refresh_demo_league.py` | Wipe-and-replace transaction + visitor mapping + cache invalidation POST. |
| `services/pcs-sync/scripts/audit_demo_pii.py` | One-shot PII audit. |
| `services/pcs-sync/tests/test_refresh_demo_league_dry_run.py` | Mocked Supabase, asserts FK delete plan + visitor team. |
| `services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py` | Rank-2 source team → `DEMO_TEAM_IDS[1]`. |

**Modified:**

| File | Change |
|---|---|
| `apps/web/lib/supabase/middleware.ts` | Whitelist `/league/demo` prefix. |
| `apps/web/app/(game)/league/[leagueId]/layout.tsx` | Early `if (leagueId === DEMO_LEAGUE_SLUG)` branch → render `<DemoLeagueLayout>`. |
| `apps/web/app/globals.css` | `@keyframes demo-banner-pulse` + `.demo-pulse` class. |
| `apps/web/app/(game)/league/[leagueId]/page.tsx` | Demo-aware cached fetch helper. |
| 13 client components (Task 12) | Each mutation `onClick` wrapped in `useDemoSafeAction`. |
| `docs/ARCHITECTURE.md` | Demo mode section + new RPCs + new route. |

**Deleted:** none.

---

## Task 1: Demo constants (TS + Python) + cross-language sync gate

**Files:**
- Create: `apps/web/lib/demo-constants.ts`
- Create: `apps/web/scripts/dump-demo-constants.ts`
- Create: `services/pcs-sync/demo_constants.py`
- Create: `apps/web/lib/__tests__/demo-constants-sync.test.ts`
- Create: `services/pcs-sync/tests/test_demo_constants_sync.py`

- [ ] **Step 1: Author the TS constants**

Create `apps/web/lib/demo-constants.ts`:

```ts
export const DEMO_LEAGUE_SLUG = "demo" as const;
export const DEMO_LEAGUE_ID = "00000000-0000-4000-8000-d3110d3110d3" as const;

export const DEMO_TEAM_IDS = [
  "00000000-0000-4000-8000-d3110d311001",
  "00000000-0000-4000-8000-d3110d311002",
  "00000000-0000-4000-8000-d3110d311003",
  "00000000-0000-4000-8000-d3110d311004",
  "00000000-0000-4000-8000-d3110d311005",
  "00000000-0000-4000-8000-d3110d311006",
  "00000000-0000-4000-8000-d3110d311007",
  "00000000-0000-4000-8000-d3110d311008",
] as const;

export const DEMO_USER_IDS = [
  "00000000-0000-4000-8000-d3110d310001",
  "00000000-0000-4000-8000-d3110d310002",
  "00000000-0000-4000-8000-d3110d310003",
  "00000000-0000-4000-8000-d3110d310004",
  "00000000-0000-4000-8000-d3110d310005",
  "00000000-0000-4000-8000-d3110d310006",
  "00000000-0000-4000-8000-d3110d310007",
  "00000000-0000-4000-8000-d3110d310008",
] as const;

export const DEMO_TEAM_NAMES = [
  "Flamme Rouge",
  "Les Grimpeurs",
  "Cinq Etoiles",
  "Bidon Vert",
  "Echappee Belle",
  "Pave Royal",
  "Maillot Jaune",
  "Domestique XI",
] as const;

export const DEMO_VISITOR_TEAM_INDEX = 1 as const;
export const DEMO_VISITOR_TEAM_ID = DEMO_TEAM_IDS[DEMO_VISITOR_TEAM_INDEX];

export function isDemoLeagueId(leagueId: string): boolean {
  return leagueId === DEMO_LEAGUE_SLUG || leagueId === DEMO_LEAGUE_ID;
}
```

- [ ] **Step 2: Author the JSON dumper**

Create `apps/web/scripts/dump-demo-constants.ts`:

```ts
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS,
  DEMO_USER_IDS,
  DEMO_TEAM_NAMES,
  DEMO_VISITOR_TEAM_INDEX,
} from "@/lib/demo-constants";

const payload = {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS: [...DEMO_TEAM_IDS],
  DEMO_USER_IDS: [...DEMO_USER_IDS],
  DEMO_TEAM_NAMES: [...DEMO_TEAM_NAMES],
  DEMO_VISITOR_TEAM_INDEX,
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
```

- [ ] **Step 3: Author the Python mirror**

Create `services/pcs-sync/demo_constants.py`:

```python
"""Mirror of apps/web/lib/demo-constants.ts.

Any change MUST be made in both files. Tests assert byte-equality.
"""
from __future__ import annotations

DEMO_LEAGUE_SLUG: str = "demo"
DEMO_LEAGUE_ID: str = "00000000-0000-4000-8000-d3110d3110d3"

DEMO_TEAM_IDS: list[str] = [
    "00000000-0000-4000-8000-d3110d311001",
    "00000000-0000-4000-8000-d3110d311002",
    "00000000-0000-4000-8000-d3110d311003",
    "00000000-0000-4000-8000-d3110d311004",
    "00000000-0000-4000-8000-d3110d311005",
    "00000000-0000-4000-8000-d3110d311006",
    "00000000-0000-4000-8000-d3110d311007",
    "00000000-0000-4000-8000-d3110d311008",
]

DEMO_USER_IDS: list[str] = [
    "00000000-0000-4000-8000-d3110d310001",
    "00000000-0000-4000-8000-d3110d310002",
    "00000000-0000-4000-8000-d3110d310003",
    "00000000-0000-4000-8000-d3110d310004",
    "00000000-0000-4000-8000-d3110d310005",
    "00000000-0000-4000-8000-d3110d310006",
    "00000000-0000-4000-8000-d3110d310007",
    "00000000-0000-4000-8000-d3110d310008",
]

DEMO_TEAM_NAMES: list[str] = [
    "Flamme Rouge",
    "Les Grimpeurs",
    "Cinq Etoiles",
    "Bidon Vert",
    "Echappee Belle",
    "Pave Royal",
    "Maillot Jaune",
    "Domestique XI",
]

DEMO_VISITOR_TEAM_INDEX: int = 1
DEMO_VISITOR_TEAM_ID: str = DEMO_TEAM_IDS[DEMO_VISITOR_TEAM_INDEX]


def as_dict() -> dict:
    return {
        "DEMO_LEAGUE_SLUG": DEMO_LEAGUE_SLUG,
        "DEMO_LEAGUE_ID": DEMO_LEAGUE_ID,
        "DEMO_TEAM_IDS": DEMO_TEAM_IDS,
        "DEMO_USER_IDS": DEMO_USER_IDS,
        "DEMO_TEAM_NAMES": DEMO_TEAM_NAMES,
        "DEMO_VISITOR_TEAM_INDEX": DEMO_VISITOR_TEAM_INDEX,
    }
```

- [ ] **Step 4: Write the vitest sync test**

Create `apps/web/lib/__tests__/demo-constants-sync.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS,
  DEMO_USER_IDS,
  DEMO_TEAM_NAMES,
  DEMO_VISITOR_TEAM_INDEX,
} from "@/lib/demo-constants";

function pyConst(source: string, name: string): string[] {
  const re = new RegExp(`${name}:\\s*list\\[str\\]\\s*=\\s*\\[(.*?)\\]`, "s");
  const m = re.exec(source);
  if (!m) throw new Error(`Could not extract ${name} from python source`);
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function pyScalar(source: string, name: string, kind: "str" | "int"): string {
  const re = new RegExp(`${name}:\\s*${kind}\\s*=\\s*(.+)`);
  const m = re.exec(source);
  if (!m) throw new Error(`Could not extract ${name} from python source`);
  return m[1].trim().replace(/^"|"$/g, "");
}

describe("demo constants TS ↔ Python parity", () => {
  const py = readFileSync(
    resolve(__dirname, "../../../../services/pcs-sync/demo_constants.py"),
    "utf8",
  );

  it("DEMO_LEAGUE_SLUG matches", () => {
    expect(pyScalar(py, "DEMO_LEAGUE_SLUG", "str")).toBe(DEMO_LEAGUE_SLUG);
  });

  it("DEMO_LEAGUE_ID matches", () => {
    expect(pyScalar(py, "DEMO_LEAGUE_ID", "str")).toBe(DEMO_LEAGUE_ID);
  });

  it("DEMO_TEAM_IDS match", () => {
    expect(pyConst(py, "DEMO_TEAM_IDS")).toEqual([...DEMO_TEAM_IDS]);
  });

  it("DEMO_USER_IDS match", () => {
    expect(pyConst(py, "DEMO_USER_IDS")).toEqual([...DEMO_USER_IDS]);
  });

  it("DEMO_TEAM_NAMES match", () => {
    expect(pyConst(py, "DEMO_TEAM_NAMES")).toEqual([...DEMO_TEAM_NAMES]);
  });

  it("DEMO_VISITOR_TEAM_INDEX matches", () => {
    expect(Number(pyScalar(py, "DEMO_VISITOR_TEAM_INDEX", "int"))).toBe(
      DEMO_VISITOR_TEAM_INDEX,
    );
  });
});
```

- [ ] **Step 5: Write the pytest sync test**

Create `services/pcs-sync/tests/test_demo_constants_sync.py`:

```python
"""Parity test: services/pcs-sync/demo_constants.py == apps/web/lib/demo-constants.ts."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from demo_constants import as_dict


REPO_ROOT = Path(__file__).resolve().parents[3]
TS_FILE = REPO_ROOT / "apps" / "web" / "lib" / "demo-constants.ts"


def _ts_list(source: str, name: str) -> list[str]:
    m = re.search(rf"{name}\s*=\s*\[(.*?)\]\s*as const;", source, re.S)
    assert m, f"Could not find {name} in TS source"
    return [
        s.strip().strip(",").strip('"')
        for s in m.group(1).split(",")
        if s.strip().strip(",").strip('"')
    ]


def _ts_scalar(source: str, name: str) -> str:
    m = re.search(rf'{name}\s*=\s*"?([^"\n]+?)"?\s*as const;', source)
    assert m, f"Could not find {name} in TS source"
    return m.group(1)


def test_constants_parity() -> None:
    ts = TS_FILE.read_text(encoding="utf-8")
    py = as_dict()

    assert _ts_scalar(ts, "DEMO_LEAGUE_SLUG") == py["DEMO_LEAGUE_SLUG"]
    assert _ts_scalar(ts, "DEMO_LEAGUE_ID") == py["DEMO_LEAGUE_ID"]
    assert _ts_list(ts, "DEMO_TEAM_IDS") == py["DEMO_TEAM_IDS"]
    assert _ts_list(ts, "DEMO_USER_IDS") == py["DEMO_USER_IDS"]
    assert _ts_list(ts, "DEMO_TEAM_NAMES") == py["DEMO_TEAM_NAMES"]
    assert int(_ts_scalar(ts, "DEMO_VISITOR_TEAM_INDEX")) == py["DEMO_VISITOR_TEAM_INDEX"]
```

- [ ] **Step 6: Run both test suites**

```bash
pnpm --filter @watthunter/web test demo-constants-sync
cd services/pcs-sync && pytest tests/test_demo_constants_sync.py -v && cd ../..
```

Expected: both PASS.

- [ ] **Step 7: Verify the dump script runs**

```bash
pnpm --filter @watthunter/web tsx scripts/dump-demo-constants.ts | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["DEMO_TEAM_IDS"][1].endswith("311002"), d; print("OK")'
```

Expected: `OK`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/demo-constants.ts \
        apps/web/scripts/dump-demo-constants.ts \
        apps/web/lib/__tests__/demo-constants-sync.test.ts \
        services/pcs-sync/demo_constants.py \
        services/pcs-sync/tests/test_demo_constants_sync.py
git commit -m "feat(demo): stable demo constants synced between TS and Python"
```

---

## Task 2: Seed migration — ghost users + demo league row + `is_demo` column + `demo_league_id()` function

**Files:**
- Create: `supabase/migrations/20260529000001_demo_seed_ghost_users.sql`

- [ ] **Step 1: Author the migration**

Create `supabase/migrations/20260529000001_demo_seed_ghost_users.sql`:

```sql
-- Chantier B (demo mode) — seed step.
-- Creates the demo_league_id() helper, adds is_demo on leagues, inserts the
-- 8 ghost auth.users + public.users rows, and a placeholder demo league row.
-- All operations are idempotent (ON CONFLICT DO NOTHING) so re-applying is safe.

------------------------------------------------------------------------------
-- 1. Helper function used by every anon RLS policy.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_league_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-4000-8000-d3110d3110d3'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.demo_league_id() TO anon, authenticated;

------------------------------------------------------------------------------
-- 2. is_demo column on leagues.
------------------------------------------------------------------------------

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

------------------------------------------------------------------------------
-- 3. 8 ghost auth.users (cannot log in: encrypted_password = '').
------------------------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
SELECT
  uid::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo-team-' || idx || '@watthunter.demo',
  '',
  now(),
  '{"provider":"demo","providers":["demo"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
FROM (VALUES
  (1, '00000000-0000-4000-8000-d3110d310001'),
  (2, '00000000-0000-4000-8000-d3110d310002'),
  (3, '00000000-0000-4000-8000-d3110d310003'),
  (4, '00000000-0000-4000-8000-d3110d310004'),
  (5, '00000000-0000-4000-8000-d3110d310005'),
  (6, '00000000-0000-4000-8000-d3110d310006'),
  (7, '00000000-0000-4000-8000-d3110d310007'),
  (8, '00000000-0000-4000-8000-d3110d310008')
) AS demo(idx, uid)
ON CONFLICT (id) DO NOTHING;

------------------------------------------------------------------------------
-- 4. 8 public.users mirroring the ghost auth rows. display_name = team name.
------------------------------------------------------------------------------

INSERT INTO public.users (id, email, display_name, avatar_url)
SELECT
  uid::uuid,
  'demo-team-' || idx || '@watthunter.demo',
  team_name,
  NULL
FROM (VALUES
  (1, '00000000-0000-4000-8000-d3110d310001', 'Flamme Rouge'),
  (2, '00000000-0000-4000-8000-d3110d310002', 'Les Grimpeurs'),
  (3, '00000000-0000-4000-8000-d3110d310003', 'Cinq Etoiles'),
  (4, '00000000-0000-4000-8000-d3110d310004', 'Bidon Vert'),
  (5, '00000000-0000-4000-8000-d3110d310005', 'Echappee Belle'),
  (6, '00000000-0000-4000-8000-d3110d310006', 'Pave Royal'),
  (7, '00000000-0000-4000-8000-d3110d310007', 'Maillot Jaune'),
  (8, '00000000-0000-4000-8000-d3110d310008', 'Domestique XI')
) AS demo(idx, uid, team_name)
ON CONFLICT (id) DO NOTHING;

------------------------------------------------------------------------------
-- 5. Placeholder demo league row. Refresh script overwrites the rest.
------------------------------------------------------------------------------

INSERT INTO public.leagues (id, name, invite_code, commissioner_id, status, max_players, is_demo)
VALUES (
  public.demo_league_id(),
  'WattHunter Demo League',
  'DEMO00',
  '00000000-0000-4000-8000-d3110d310001',
  'active',
  8,
  true
)
ON CONFLICT (id) DO UPDATE SET is_demo = true;
```

> **Note about `public.users` column set:** the only required columns at insert time are `id`, `email`, `display_name`, `avatar_url`. Any other column added later must have a default; if a future migration adds a NOT NULL column with no default, that migration must also backfill the demo rows. The Python refresh script does NOT touch `public.users` other than `display_name`.

- [ ] **Step 2: Apply against remote**

```bash
supabase db push --linked
```

Expected: `Finished supabase db push.` (no errors).

- [ ] **Step 3: Verify rows exist via MCP / psql**

```bash
supabase db query --linked "SELECT id, email, display_name FROM public.users WHERE id::text LIKE '%d3110d3100%' ORDER BY email;"
supabase db query --linked "SELECT id, name, is_demo FROM public.leagues WHERE id = public.demo_league_id();"
```

Expected: 8 user rows + 1 league row (`is_demo = true`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260529000001_demo_seed_ghost_users.sql
git commit -m "feat(demo): seed ghost users, demo league row, is_demo column, demo_league_id() helper"
```

---

## Task 3: RLS migration — anon `SELECT` on 21 tables

**Files:**
- Create: `supabase/migrations/20260529000002_demo_anon_select_policies.sql`

- [ ] **Step 1: Author the migration**

Create `supabase/migrations/20260529000002_demo_anon_select_policies.sql`:

```sql
-- Chantier B (demo mode) — anon SELECT policies.
-- The `anon` role can read the demo league only:
--   Tier A: tables with league_id  → USING (league_id = demo_league_id())
--   Tier B: tables with team_id    → USING (EXISTS demo team)
--   Tier C: public.users           → USING (id IN demo members)
--   Tier D: public reference data  → USING (true)
-- Policies are additive: authenticated users keep their existing access.

------------------------------------------------------------------------------
-- Tier A — direct league_id
------------------------------------------------------------------------------

CREATE POLICY leagues_anon_demo
  ON public.leagues FOR SELECT TO anon
  USING (id = public.demo_league_id());

CREATE POLICY league_members_anon_demo
  ON public.league_members FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY teams_anon_demo
  ON public.teams FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY auctions_anon_demo
  ON public.auctions FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY contracts_anon_demo
  ON public.contracts FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY draft_bids_anon_demo
  ON public.draft_bids FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY gt_emergency_bids_anon_demo
  ON public.gt_emergency_bids FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY remontada_boost_triggers_anon_demo
  ON public.remontada_boost_triggers FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

CREATE POLICY remontada_boosts_anon_demo
  ON public.remontada_boosts FOR SELECT TO anon
  USING (league_id = public.demo_league_id());

------------------------------------------------------------------------------
-- Tier B — team_id only (EXISTS subquery scoped to demo teams)
------------------------------------------------------------------------------

CREATE POLICY auction_bids_anon_demo
  ON public.auction_bids FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = auction_bids.team_id
      AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_squad_anon_demo
  ON public.gt_squad FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_squad.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_role_assignments_anon_demo
  ON public.gt_role_assignments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_role_assignments.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY gt_tactic_activations_anon_demo
  ON public.gt_tactic_activations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = gt_tactic_activations.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY rider_xp_daily_anon_demo
  ON public.rider_xp_daily FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = rider_xp_daily.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY sponsor_bonuses_anon_demo
  ON public.sponsor_bonuses FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_bonuses.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY sponsor_goal_completions_anon_demo
  ON public.sponsor_goal_completions FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = sponsor_goal_completions.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_ranking_daily_anon_demo
  ON public.team_ranking_daily FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_ranking_daily.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_sponsors_anon_demo
  ON public.team_sponsors FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_sponsors.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_strategies_anon_demo
  ON public.team_strategies FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_strategies.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY team_xp_adjustments_anon_demo
  ON public.team_xp_adjustments FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_xp_adjustments.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY treasury_log_anon_demo
  ON public.treasury_log FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = treasury_log.team_id AND t.league_id = public.demo_league_id()
  ));

CREATE POLICY round_validations_anon_demo
  ON public.round_validations FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = round_validations.team_id AND t.league_id = public.demo_league_id()
  ));

------------------------------------------------------------------------------
-- Tier C — users (only the 8 ghost demo accounts)
------------------------------------------------------------------------------

CREATE POLICY users_anon_demo
  ON public.users FOR SELECT TO anon
  USING (
    id IN (
      SELECT user_id FROM public.league_members
      WHERE league_id = public.demo_league_id()
    )
  );

------------------------------------------------------------------------------
-- Tier D — public reference / catalog data (anon SELECT true)
------------------------------------------------------------------------------

CREATE POLICY riders_anon_select
  ON public.riders FOR SELECT TO anon USING (true);

CREATE POLICY race_results_anon_select
  ON public.race_results FOR SELECT TO anon USING (true);

CREATE POLICY rider_season_rankings_anon_select
  ON public.rider_season_rankings FOR SELECT TO anon USING (true);

CREATE POLICY race_startlists_anon_select
  ON public.race_startlists FOR SELECT TO anon USING (true);

CREATE POLICY rider_teams_anon_select
  ON public.rider_teams FOR SELECT TO anon USING (true);

CREATE POLICY rider_pcs_history_anon_select
  ON public.rider_pcs_history FOR SELECT TO anon USING (true);

CREATE POLICY gt_daily_classifications_anon_select
  ON public.gt_daily_classifications FOR SELECT TO anon USING (true);

CREATE POLICY gt_rescue_windows_anon_select
  ON public.gt_rescue_windows FOR SELECT TO anon USING (true);

CREATE POLICY sponsors_anon_select
  ON public.sponsors FOR SELECT TO anon USING (true);

CREATE POLICY strategies_anon_select
  ON public.strategies FOR SELECT TO anon USING (true);
```

- [ ] **Step 2: Apply against remote**

```bash
supabase db push --linked
```

Expected: clean apply.

- [ ] **Step 3: Verify anon scope is correctly restricted**

Use the Supabase MCP tool to execute as the anon role (use the ANON key, not service-role). Quick smoke from a terminal:

```bash
curl -sS -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/leagues?select=id,name,is_demo" \
  | python3 -c 'import sys,json; rows=json.load(sys.stdin); assert len(rows)==1 and rows[0]["is_demo"] is True, rows; print("OK", rows)'
```

Expected: `OK [{"id": "00000000-0000-4000-8000-d3110d3110d3", ...}]` — only the demo league visible.

- [ ] **Step 4: Verify a sample league-scoped table also returns demo-only**

```bash
curl -sS -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/teams?select=id,name,league_id" \
  | python3 -c 'import sys,json; rows=json.load(sys.stdin); print(len(rows), "team(s) visible to anon")'
```

Expected: 0 (no demo teams loaded yet — refresh hasn't run). Confirms no real-league leakage.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260529000002_demo_anon_select_policies.sql
git commit -m "feat(demo): anon SELECT policies on league-scoped + reference tables"
```

---

## Task 4: Defensive guard in `join_league_by_code`

**Files:**
- Create: `supabase/migrations/20260529000003_join_rejects_demo.sql`

- [ ] **Step 1: Read the current RPC to know its exact signature**

```bash
supabase db query --linked "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'join_league_by_code';" | head -80
```

Note the parameter list — the rewrite must match it byte-for-byte. The remainder of the body is copied verbatim with one added block at the top.

- [ ] **Step 2: Author the migration**

Create `supabase/migrations/20260529000003_join_rejects_demo.sql`:

```sql
-- Chantier B (demo mode) — guard: prevent any user from joining the demo league
-- via the standard invite-code path. The demo league is read-only for anonymous
-- visitors and must never accept new members.
--
-- Implementation: CREATE OR REPLACE the existing RPC adding a single early-return
-- block that fires when the resolved league has is_demo = true.
--
-- Body is otherwise identical to the previous version; if a future migration
-- alters join_league_by_code, this guard MUST be re-applied.

CREATE OR REPLACE FUNCTION public.join_league_by_code(
  p_code text,
  p_team_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league  record;
  v_team_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT id, name, status, max_players, is_demo
    INTO v_league
    FROM public.leagues
   WHERE invite_code = upper(p_code)
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- NEW: reject demo league regardless of code match.
  IF v_league.is_demo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_is_demo');
  END IF;

  -- Idempotent: if the user is already a member, just return success.
  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = v_league.id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'league_id', v_league.id, 'already_member', true);
  END IF;

  IF (SELECT count(*) FROM public.league_members WHERE league_id = v_league.id)
       >= v_league.max_players THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_full');
  END IF;

  INSERT INTO public.teams (user_id, league_id, name)
  VALUES (v_user_id, v_league.id, p_team_name)
  RETURNING id INTO v_team_id;

  INSERT INTO public.league_members (league_id, user_id, team_id)
  VALUES (v_league.id, v_user_id, v_team_id);

  RETURN jsonb_build_object('ok', true, 'league_id', v_league.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(text, text) TO authenticated;
```

> **WARNING:** if the existing body diverges from the snippet above (e.g., extra parameters, additional side effects, sponsor seeding), STOP and ask the user. Do not blindly overwrite.

- [ ] **Step 3: Apply + verify**

```bash
supabase db push --linked
```

Then call the RPC as an authenticated user (use the Supabase MCP `execute_sql` with `SET ROLE authenticated;` and a known JWT user) to confirm a real league join still works. Skip if cumbersome — the unit tests on `join_league_by_code` will catch a regression.

- [ ] **Step 4: Verify the demo rejection**

```bash
supabase db query --linked \
  "SELECT public.join_league_by_code('DEMO00', 'Test') AS r;"
```

> **Note:** this runs as service-role so `auth.uid()` is NULL and the function will reject at the unauthenticated check, not the demo check. Acceptable for now — manual verification in dev (Task 13 smoke test) will exercise the demo branch by attempting the join while logged in.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260529000003_join_rejects_demo.sql
git commit -m "fix(demo): join_league_by_code rejects is_demo leagues"
```

---

## Task 5: Middleware whitelist `/league/demo`

**Files:**
- Modify: `apps/web/lib/supabase/middleware.ts`

- [ ] **Step 1: Edit the public-paths block**

Open `apps/web/lib/supabase/middleware.ts`. Locate:

```ts
const publicPaths = ["/login", "/signup", "/auth", "/onboarding", "/forgot-password", "/reset-password", "/privacy", "/terms", "/prototype"];
const publicExactPaths = ["/league/create", "/league/join", "/league/choose"];
const isPublic =
  request.nextUrl.pathname === "/" ||
  publicPaths.some((p) => request.nextUrl.pathname.startsWith(p)) ||
  publicExactPaths.includes(request.nextUrl.pathname);
```

Replace with:

```ts
const publicPaths = ["/login", "/signup", "/auth", "/onboarding", "/forgot-password", "/reset-password", "/privacy", "/terms", "/prototype"];
const publicExactPaths = ["/league/create", "/league/join", "/league/choose"];
const publicPrefixPaths = ["/league/demo"];
const isPublic =
  request.nextUrl.pathname === "/" ||
  publicPaths.some((p) => request.nextUrl.pathname.startsWith(p)) ||
  publicExactPaths.includes(request.nextUrl.pathname) ||
  publicPrefixPaths.some((p) => request.nextUrl.pathname.startsWith(p));
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/supabase/middleware.ts
git commit -m "feat(demo): middleware whitelist /league/demo prefix for anonymous visitors"
```

---

## Task 6: `DemoProvider` + `useDemoSafeAction` + CSS keyframe

**Files:**
- Create: `apps/web/contexts/demo-context.tsx`
- Create: `apps/web/contexts/__tests__/demo-context.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add the CSS keyframe**

Open `apps/web/app/globals.css`. Append at the end of the file:

```css
/* Chantier B — demo banner pulse (cyan glow on blocked mutation). */
@keyframes demo-banner-pulse {
  0% {
    box-shadow: 0 0 0 0 transparent;
    border-color: var(--border-subtle);
  }
  30% {
    box-shadow: 0 0 0 6px color-mix(in oklab, var(--accent-default) 30%, transparent);
    border-color: var(--accent-default);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    border-color: var(--border-subtle);
  }
}
.demo-pulse {
  animation: demo-banner-pulse 900ms ease-out;
}
```

- [ ] **Step 2: Author the context**

Create `apps/web/contexts/demo-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

interface DemoContextValue {
  isDemo: boolean;
  visitorTeamId: string | null;
  triggerPulse: () => void;
  registerPulseTarget: (el: HTMLElement | null) => void;
}

const DEFAULT_VALUE: DemoContextValue = {
  isDemo: false,
  visitorTeamId: null,
  triggerPulse: () => {},
  registerPulseTarget: () => {},
};

const DemoContext = createContext<DemoContextValue>(DEFAULT_VALUE);

export interface DemoProviderProps {
  visitorTeamId: string;
  children: ReactNode;
}

export function DemoProvider({ visitorTeamId, children }: DemoProviderProps) {
  const targetRef = useRef<HTMLElement | null>(null);

  const triggerPulse = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.classList.remove("demo-pulse");
    void el.offsetWidth;
    el.classList.add("demo-pulse");
  }, []);

  const registerPulseTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({ isDemo: true, visitorTeamId, triggerPulse, registerPulseTarget }),
    [visitorTeamId, triggerPulse, registerPulseTarget],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  return useContext(DemoContext);
}

/**
 * Wraps a mutation server-action invocation.
 *
 * Outside demo mode → returns `fn` unchanged.
 * Inside demo mode  → returns a no-op that triggers the banner pulse and
 *                     resolves to `{ blocked: true }` so callers can early-out.
 */
export function useDemoSafeAction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn> | TReturn,
): (...args: TArgs) => Promise<TReturn | { blocked: true }> {
  const { isDemo, triggerPulse } = useDemo();
  return useCallback(
    async (...args: TArgs) => {
      if (isDemo) {
        triggerPulse();
        return { blocked: true };
      }
      return await fn(...args);
    },
    [isDemo, triggerPulse, fn],
  );
}
```

- [ ] **Step 3: Author the test**

Create `apps/web/contexts/__tests__/demo-context.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import { DemoProvider, useDemo, useDemoSafeAction } from "../demo-context";

function PulseTarget() {
  const { registerPulseTarget } = useDemo();
  return <div data-testid="target" ref={(el) => registerPulseTarget(el)} />;
}

function ActionButton({ onAct }: { onAct: () => Promise<unknown> }) {
  const safe = useDemoSafeAction(onAct);
  return (
    <button
      onClick={() => {
        void safe();
      }}
    >
      go
    </button>
  );
}

describe("DemoProvider + useDemoSafeAction", () => {
  it("triggers a pulse and short-circuits the action in demo mode", async () => {
    const onAct = vi.fn(async () => "ran");
    render(
      <DemoProvider visitorTeamId="t-2">
        <PulseTarget />
        <ActionButton onAct={onAct} />
      </DemoProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByTestId("target").className).toContain("demo-pulse");
  });

  it("calls the action verbatim outside demo mode", async () => {
    const onAct = vi.fn(async () => "ran");
    render(<ActionButton onAct={onAct} />); // no provider → isDemo = false

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("re-arms the pulse class on repeat triggers", async () => {
    const onAct = vi.fn(async () => "ran");
    render(
      <DemoProvider visitorTeamId="t-2">
        <PulseTarget />
        <ActionButton onAct={onAct} />
      </DemoProvider>,
    );
    const target = screen.getByTestId("target");

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    expect(target.className).toContain("demo-pulse");

    // Simulate the class being stripped (animation ended) then re-trigger.
    target.classList.remove("demo-pulse");
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    expect(target.className).toContain("demo-pulse");
  });
});
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @watthunter/web test demo-context
```

Expected: 3 PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/contexts/demo-context.tsx \
        apps/web/contexts/__tests__/demo-context.test.tsx \
        apps/web/app/globals.css
git commit -m "feat(demo): DemoProvider + useDemoSafeAction + cyan banner pulse keyframe"
```

---

## Task 7: `DemoBanner` + `DemoBottomCta`

**Files:**
- Create: `apps/web/components/demo/demo-banner.tsx`
- Create: `apps/web/components/demo/demo-bottom-cta.tsx`
- Create: `apps/web/components/demo/__tests__/demo-banner.test.tsx`

- [ ] **Step 1: Banner component**

Create `apps/web/components/demo/demo-banner.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/contexts/demo-context";

export function DemoBanner() {
  const { isDemo, registerPulseTarget } = useDemo();
  if (!isDemo) return null;
  return (
    <div
      ref={(el) => registerPulseTarget(el)}
      data-testid="demo-banner"
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 transition-shadow"
    >
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        You&apos;re exploring a demo league.
      </span>
      <Button asChild variant="cta" size="sm">
        <Link href="/">Get Started</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Bottom CTA component**

Create `apps/web/components/demo/demo-bottom-cta.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useDemo } from "@/contexts/demo-context";

export function DemoBottomCta() {
  const { isDemo } = useDemo();
  const direction = useScrollDirection();
  if (!isDemo) return null;
  const hidden = direction === "down";
  return (
    <div
      data-testid="demo-bottom-cta"
      className={[
        "fixed inset-x-0 bottom-16 z-20 px-4 transition-transform duration-200 lg:hidden",
        hidden ? "translate-y-[120%]" : "translate-y-0",
      ].join(" ")}
    >
      <Button asChild variant="cta" className="w-full shadow-lg">
        <Link href="/">Create your league</Link>
      </Button>
    </div>
  );
}
```

> The `bottom-16` offset sits above the existing `BottomNav` (which is 64 px tall). If `BottomNav` height changes, this offset moves with it — keep in sync.

- [ ] **Step 3: Banner test**

Create `apps/web/components/demo/__tests__/demo-banner.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoBanner } from "../demo-banner";
import { DemoProvider } from "@/contexts/demo-context";

describe("DemoBanner", () => {
  it("renders the copy and the Get Started CTA when wrapped in DemoProvider", () => {
    render(
      <DemoProvider visitorTeamId="t-2">
        <DemoBanner />
      </DemoProvider>,
    );
    expect(screen.getByText(/exploring a demo league/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /get started/i }),
    ).toHaveAttribute("href", "/");
  });

  it("renders nothing outside DemoProvider", () => {
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 4: Run the test + typecheck**

```bash
pnpm --filter @watthunter/web test demo-banner
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/demo/demo-banner.tsx \
        apps/web/components/demo/demo-bottom-cta.tsx \
        apps/web/components/demo/__tests__/demo-banner.test.tsx
git commit -m "feat(demo): banner + mobile bottom CTA (token-only, hide-on-scroll)"
```

---

## Task 8: `demo-layout.tsx` + fork in `(game)/league/[leagueId]/layout.tsx`

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/demo-layout.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

- [ ] **Step 1: Author the demo layout**

Create `apps/web/app/(game)/league/[leagueId]/demo-layout.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { RailProvider } from "@/contexts/rail-context";
import { DemoProvider } from "@/contexts/demo-context";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoBottomCta } from "@/components/demo/demo-bottom-cta";
import { LeagueShell } from "./league-shell";
import {
  DEMO_LEAGUE_ID,
  DEMO_LEAGUE_SLUG,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

export async function DemoLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", DEMO_LEAGUE_ID)
    .maybeSingle();

  const leagueName = league?.name ?? "Demo League";
  const leagues = [{ id: DEMO_LEAGUE_SLUG, name: leagueName }];

  const unlockedTabs: ("home" | "auction" | "team" | "budget" | "ranking" | "achievements")[] =
    ["home", "auction", "team", "budget", "ranking", "achievements"];

  return (
    <DemoProvider visitorTeamId={DEMO_VISITOR_TEAM_ID}>
      <RailProvider>
        <div className="flex h-[100svh] flex-col overflow-hidden">
          <DemoBanner />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              leagueId={DEMO_LEAGUE_SLUG}
              leagueName={leagueName}
              leagues={leagues}
              unlockedTabs={unlockedTabs}
            />
            <LeagueShell>
              <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 lg:flex-[3] lg:min-w-[440px]">
                <TopBar
                  leagueId={DEMO_LEAGUE_SLUG}
                  leagueName={leagueName}
                  leagues={leagues}
                  settingsHref={`/league/${DEMO_LEAGUE_SLUG}`}
                />
                {children}
              </main>
              <BottomNav leagueId={DEMO_LEAGUE_SLUG} unlockedTabs={unlockedTabs} />
              <DemoBottomCta />
            </LeagueShell>
          </div>
        </div>
      </RailProvider>
    </DemoProvider>
  );
}
```

> **Settings note:** the demo `settingsHref` points back to `/league/demo`. A future task could add a redirect inside `(game)/league/[leagueId]/settings/page.tsx` if a deep link is hit; the smoke test does that manually.

- [ ] **Step 2: Fork the real layout**

Open `apps/web/app/(game)/league/[leagueId]/layout.tsx`. After the `const { leagueId } = await params;` line, before any other work, insert:

```ts
import { DemoLeagueLayout } from "./demo-layout";
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";

// ... existing imports above this block.

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) {
    return <DemoLeagueLayout>{children}</DemoLeagueLayout>;
  }

  const supabase = await createClient();
  // ... existing body unchanged below
```

Make sure no other code path runs before the fork (the existing `createClient` call must move *after* the demo branch). The rest of the function body is untouched.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Dev smoke — anonymous request renders the shell**

```bash
pnpm dev
```

In an incognito window visit `http://localhost:3000/league/demo`. Expected:
- No redirect to `/login`.
- Demo banner at the top with `Get Started` link.
- Sidebar / TopBar / BottomNav visible.
- The page renders even before any data is loaded (Task 11 loads the data).

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/demo-layout.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/layout.tsx
git commit -m "feat(demo): forked layout for /league/demo (skip auth, mount DemoProvider + banner)"
```

---

## Task 9: Cache layer — `"use cache"` on demo pages

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`

> **Approach:** add ONE shared cached helper used by the demo-aware home page. Other demo pages already read the same anon-restricted dataset and are inexpensive enough that we cap demo cache work to the Race Feed home for v1. Other demo routes inherit fresh-on-load but still go through the same cached anon Supabase queries (PostgREST + Vercel HTTP cache will absorb most of the load).
>
> If profiling later reveals hot demo pages (Team, Ranking), we re-apply the same pattern in a follow-up — strictly out of scope here.

- [ ] **Step 1: Add the cached helper**

Open `apps/web/app/(game)/league/[leagueId]/page.tsx`. At the top of the file (after existing imports), add:

```ts
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from "next/cache";
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";
```

Above the default export, add the helper:

```ts
async function getDemoHomeData() {
  "use cache";
  cacheTag("demo-league");
  cacheLife({ revalidate: 3600 });
  // Re-uses the same fetch shape as the live page below.
  // Imports kept inside the function to make the cache scope explicit.
  const { getRaceFeedData } = await import("@/lib/get-race-feed-data");
  return await getRaceFeedData(DEMO_LEAGUE_SLUG);
}
```

> **Caveat:** if `apps/web/lib/get-race-feed-data` does not exist with that exact shape, locate the current home-feed loader (search `app/(game)/league/[leagueId]/page.tsx` for the existing `Promise.all` block) and extract it into `apps/web/lib/get-race-feed-data.ts` *as part of this task* (one mechanical move + import update — no behavior change). The plan tasks downstream rely on this helper existing.

- [ ] **Step 2: Branch the page**

Inside the default export, after `const { leagueId } = await params;`, add:

```ts
if (leagueId === DEMO_LEAGUE_SLUG) {
  const data = await getDemoHomeData();
  return <HomeFeed leagueId={DEMO_LEAGUE_SLUG} {...data} />;
}
```

(Use whatever the existing render call looks like; mirror it exactly.)

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Dev verification**

```bash
pnpm dev
```

Visit `/league/demo` twice in quick succession (incognito). Confirm the second load is fast (cache hit; data identical even if a new `team_ranking_daily` row would have changed it). Stop dev.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/page.tsx \
        apps/web/lib/get-race-feed-data.ts
git commit -m "feat(demo): cached fetch for /league/demo home (cacheTag=\"demo-league\", 1h)"
```

(`get-race-feed-data.ts` only appears if extracted in Step 1.)

---

## Task 10: `/api/admin/revalidate-demo` endpoint

**Files:**
- Create: `apps/web/app/api/admin/revalidate-demo/route.ts`
- Create: `apps/web/app/api/admin/revalidate-demo/__tests__/route.test.ts`

- [ ] **Step 1: Author the route**

Create `apps/web/app/api/admin/revalidate-demo/route.ts`:

```ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_SECRET not configured" },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("demo-league");
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Author the test**

Create `apps/web/app/api/admin/revalidate-demo/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

import { POST } from "../route";

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/admin/revalidate-demo", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe("POST /api/admin/revalidate-demo", () => {
  beforeEach(() => {
    revalidateTagMock.mockReset();
    process.env.REVALIDATE_SECRET = "shh-secret";
  });

  it("returns 500 when REVALIDATE_SECRET is not configured", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(makeRequest("Bearer shh-secret"));
    expect(res.status).toBe(500);
  });

  it("returns 401 when the token is missing or wrong", async () => {
    const r1 = await POST(makeRequest());
    expect(r1.status).toBe(401);
    const r2 = await POST(makeRequest("Bearer nope"));
    expect(r2.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("calls revalidateTag('demo-league') on a valid request", async () => {
    const res = await POST(makeRequest("Bearer shh-secret"));
    expect(res.status).toBe(200);
    expect(revalidateTagMock).toHaveBeenCalledWith("demo-league");
  });
});
```

- [ ] **Step 3: Run the test + typecheck**

```bash
pnpm --filter @watthunter/web test revalidate-demo
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Provision the Vercel env var**

```bash
vercel env add REVALIDATE_SECRET production
vercel env add REVALIDATE_SECRET preview
# (paste a freshly generated random string when prompted; same value in both)
```

> If `vercel` CLI auth is missing, skip this step and add `REVALIDATE_SECRET` from the Vercel dashboard manually — note it for the user in the PR description.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/admin/revalidate-demo/
git commit -m "feat(demo): protected /api/admin/revalidate-demo endpoint with bearer auth"
```

---

## Task 11: Python refresh script + visitor mapping + dry-run tests

**Files:**
- Create: `services/pcs-sync/refresh_demo_league.py`
- Create: `services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py`
- Create: `services/pcs-sync/tests/test_refresh_demo_league_dry_run.py`

- [ ] **Step 1: Author the script skeleton**

Create `services/pcs-sync/refresh_demo_league.py`:

```python
"""Refresh the demo league in Supabase by wipe-and-replacing it with an
anonymized snapshot of a real source league.

Idempotent and safe to re-run. Always operates inside a single transaction:
on any error, the demo league is left in its previous state.

Usage:
  python3 refresh_demo_league.py --source-league-id <uuid>
  python3 refresh_demo_league.py --source-league-id <uuid> --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from demo_constants import (
    DEMO_LEAGUE_ID,
    DEMO_TEAM_IDS,
    DEMO_TEAM_NAMES,
    DEMO_USER_IDS,
    DEMO_VISITOR_TEAM_INDEX,
    as_dict,
)


load_dotenv()


WIPE_ORDER_TEAM_SCOPED = [
    "treasury_log",
    "sponsor_bonuses",
    "sponsor_goal_completions",
    "round_validations",
    "auction_bids",
    "team_xp_adjustments",
    "team_strategies",
    "team_sponsors",
    "team_ranking_daily",
    "rider_xp_daily",
    "gt_tactic_activations",
    "gt_role_assignments",
    "gt_squad",
    "remontada_boosts",
]

WIPE_ORDER_LEAGUE_SCOPED = [
    "draft_bids",
    "gt_emergency_bids",
    "contracts",
    "auctions",
    "remontada_boost_triggers",
    "league_members",
    "teams",
]


def assert_constants_in_sync() -> None:
    """Run pnpm tsx dump-demo-constants.ts and compare with our as_dict()."""
    repo_root = Path(__file__).resolve().parents[2]
    try:
        out = subprocess.check_output(
            ["pnpm", "--filter", "@watthunter/web", "tsx", "scripts/dump-demo-constants.ts"],
            cwd=repo_root,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"Could not run dump-demo-constants.ts: {exc}") from exc
    ts = json.loads(out)
    py = as_dict()
    if ts != py:
        raise SystemExit(
            f"Demo constants drift between TS and Python:\n  TS={ts}\n  PY={py}"
        )


def make_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def assert_target_is_demo(client: Client) -> None:
    res = client.table("leagues").select("id, is_demo").eq("id", DEMO_LEAGUE_ID).single().execute()
    if not res.data or not res.data.get("is_demo"):
        raise SystemExit(
            f"Refusing to refresh: league {DEMO_LEAGUE_ID} is not marked is_demo=true. "
            "Apply the seed migration first."
        )


def fetch_source_team_ranking(client: Client, source_league_id: str) -> list[str]:
    """Returns source team IDs ordered by cumulative_xp DESC (length = 8)."""
    res = (
        client.table("teams")
        .select("id, cumulative_xp")
        .eq("league_id", source_league_id)
        .order("cumulative_xp", desc=True)
        .limit(8)
        .execute()
    )
    rows = res.data or []
    if len(rows) < 2:
        raise SystemExit(
            f"Source league {source_league_id} has only {len(rows)} team(s); need at least 2."
        )
    if len(rows) < 8:
        print(f"WARNING: source league has {len(rows)} teams (< 8). Empty slots will be skipped.")
    return [row["id"] for row in rows]


def build_team_id_mapping(source_team_ids: list[str]) -> dict[str, str]:
    """source team i (rank i+1) → DEMO_TEAM_IDS[i]."""
    return {src: DEMO_TEAM_IDS[i] for i, src in enumerate(source_team_ids)}


def build_user_id_mapping(client: Client, source_league_id: str, team_id_mapping: dict[str, str]) -> dict[str, str]:
    """source user_id (from league_members) → DEMO_USER_IDS[i] keyed by team mapping."""
    res = (
        client.table("league_members")
        .select("user_id, team_id")
        .eq("league_id", source_league_id)
        .execute()
    )
    mapping: dict[str, str] = {}
    for row in res.data or []:
        src_team = row["team_id"]
        src_user = row["user_id"]
        if src_team in team_id_mapping:
            idx = DEMO_TEAM_IDS.index(team_id_mapping[src_team])
            mapping[src_user] = DEMO_USER_IDS[idx]
    return mapping


def wipe_demo(client: Client) -> None:
    """Delete all child rows for DEMO_TEAM_IDS / DEMO_LEAGUE_ID, in FK order."""
    for table in WIPE_ORDER_TEAM_SCOPED:
        client.table(table).delete().in_("team_id", list(DEMO_TEAM_IDS)).execute()
    for table in WIPE_ORDER_LEAGUE_SCOPED:
        client.table(table).delete().eq("league_id", DEMO_LEAGUE_ID).execute()


def insert_demo_data(
    client: Client,
    source_league_id: str,
    team_id_mapping: dict[str, str],
    user_id_mapping: dict[str, str],
) -> None:
    """Fetch source rows, rewrite team_id/user_id/league_id, insert in dependency order."""
    # 1. Teams.
    src_teams = (
        client.table("teams")
        .select("*")
        .in_("id", list(team_id_mapping.keys()))
        .execute()
        .data
        or []
    )
    new_teams: list[dict[str, Any]] = []
    for t in src_teams:
        idx = DEMO_TEAM_IDS.index(team_id_mapping[t["id"]])
        new_teams.append(
            {
                **t,
                "id": team_id_mapping[t["id"]],
                "user_id": DEMO_USER_IDS[idx],
                "league_id": DEMO_LEAGUE_ID,
                "name": DEMO_TEAM_NAMES[idx],
                "short_name": DEMO_TEAM_NAMES[idx][:3].upper(),
            }
        )
    if new_teams:
        client.table("teams").insert(new_teams).execute()

    # 2. league_members.
    src_members = (
        client.table("league_members")
        .select("*")
        .eq("league_id", source_league_id)
        .execute()
        .data
        or []
    )
    new_members = []
    for m in src_members:
        if m["team_id"] in team_id_mapping and m["user_id"] in user_id_mapping:
            new_members.append(
                {
                    **m,
                    "league_id": DEMO_LEAGUE_ID,
                    "team_id": team_id_mapping[m["team_id"]],
                    "user_id": user_id_mapping[m["user_id"]],
                }
            )
    if new_members:
        client.table("league_members").insert(new_members).execute()

    # 3. auctions.
    src_auctions = (
        client.table("auctions")
        .select("*")
        .eq("league_id", source_league_id)
        .execute()
        .data
        or []
    )
    auction_id_mapping: dict[str, str] = {}
    for a in src_auctions:
        new_id = a["id"]  # keep source UUID — auction rows are non-PII
        auction_id_mapping[a["id"]] = new_id
        client.table("auctions").insert({**a, "league_id": DEMO_LEAGUE_ID}).execute()

    # 4-N. Other tables: copy verbatim, rewriting only team_id/league_id/user_id.
    _replicate(client, "contracts", source_league_id, team_id_mapping, league_col="league_id")
    _replicate(client, "draft_bids", source_league_id, team_id_mapping, league_col="league_id")
    _replicate_team_scoped(client, "auction_bids", team_id_mapping)
    _replicate_team_scoped(client, "treasury_log", team_id_mapping)
    _replicate_team_scoped(client, "team_strategies", team_id_mapping)
    _replicate_team_scoped(client, "team_sponsors", team_id_mapping)
    _replicate_team_scoped(client, "team_ranking_daily", team_id_mapping)
    _replicate_team_scoped(client, "team_xp_adjustments", team_id_mapping)
    _replicate_team_scoped(client, "rider_xp_daily", team_id_mapping)
    _replicate_team_scoped(client, "sponsor_bonuses", team_id_mapping)
    _replicate_team_scoped(client, "sponsor_goal_completions", team_id_mapping)
    _replicate_team_scoped(client, "round_validations", team_id_mapping)
    _replicate_team_scoped(client, "gt_squad", team_id_mapping)
    _replicate_team_scoped(client, "gt_role_assignments", team_id_mapping)
    _replicate_team_scoped(client, "gt_tactic_activations", team_id_mapping)
    _replicate(client, "gt_emergency_bids", source_league_id, team_id_mapping, league_col="league_id")

    # 5. Update public.users display_name for the 8 ghost rows.
    for i, uid in enumerate(DEMO_USER_IDS):
        client.table("users").update({"display_name": DEMO_TEAM_NAMES[i]}).eq("id", uid).execute()

    # 6. Update league name (kept stable but force-set).
    client.table("leagues").update(
        {
            "name": "WattHunter Demo League",
            "invite_code": "DEMO00",
            "status": "active",
            "commissioner_id": DEMO_USER_IDS[0],
            "is_demo": True,
        }
    ).eq("id", DEMO_LEAGUE_ID).execute()


def _replicate(
    client: Client,
    table: str,
    source_league_id: str,
    team_id_mapping: dict[str, str],
    league_col: str,
) -> None:
    rows = client.table(table).select("*").eq(league_col, source_league_id).execute().data or []
    new_rows = []
    for r in rows:
        if r.get("team_id") and r["team_id"] not in team_id_mapping:
            continue
        new_rows.append(
            {
                **r,
                league_col: DEMO_LEAGUE_ID,
                **({"team_id": team_id_mapping[r["team_id"]]} if r.get("team_id") else {}),
            }
        )
    if new_rows:
        client.table(table).insert(new_rows).execute()


def _replicate_team_scoped(client: Client, table: str, team_id_mapping: dict[str, str]) -> None:
    rows = (
        client.table(table)
        .select("*")
        .in_("team_id", list(team_id_mapping.keys()))
        .execute()
        .data
        or []
    )
    new_rows = [{**r, "team_id": team_id_mapping[r["team_id"]]} for r in rows]
    if new_rows:
        client.table(table).insert(new_rows).execute()


def invalidate_cache() -> None:
    host = os.environ.get("WATTHUNTER_HOST")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not host or not secret:
        print("WARNING: WATTHUNTER_HOST or REVALIDATE_SECRET missing — skipping cache invalidation.")
        return
    import urllib.request

    req = urllib.request.Request(
        f"{host}/api/admin/revalidate-demo",
        method="POST",
        headers={"Authorization": f"Bearer {secret}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"Cache invalidation → {resp.status}")
    except Exception as exc:
        print(f"WARNING: cache invalidation failed: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-league-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    assert_constants_in_sync()
    client = make_client()
    assert_target_is_demo(client)

    src_team_ids = fetch_source_team_ranking(client, args.source_league_id)
    team_id_mapping = build_team_id_mapping(src_team_ids)
    user_id_mapping = build_user_id_mapping(client, args.source_league_id, team_id_mapping)

    visitor_team_id = team_id_mapping[src_team_ids[DEMO_VISITOR_TEAM_INDEX]]
    print(f"Visitor team: {visitor_team_id} (source rank-{DEMO_VISITOR_TEAM_INDEX + 1})")
    print(f"Team mapping: {json.dumps(team_id_mapping, indent=2)}")

    if args.dry_run:
        print("--dry-run: no writes.")
        return

    wipe_demo(client)
    insert_demo_data(client, args.source_league_id, team_id_mapping, user_id_mapping)
    invalidate_cache()
    print("Demo refresh complete.")


if __name__ == "__main__":
    main()
```

> **Transaction caveat:** `supabase-py` does not expose Postgres transactions over PostgREST directly. For an MVP we rely on the wipe order being strictly FK-children-first; if a partial failure occurs mid-replay, the demo will be empty until the next successful run. Acceptable for v1. A future hardening pass can move this to a single `psycopg` connection with `BEGIN/COMMIT`.

- [ ] **Step 2: Author the visitor-mapping test**

Create `services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py`:

```python
"""Verify that the rank-2 source team always maps to DEMO_TEAM_IDS[1]."""
from __future__ import annotations

from refresh_demo_league import build_team_id_mapping
from demo_constants import DEMO_TEAM_IDS, DEMO_VISITOR_TEAM_INDEX


def test_visitor_team_index_is_rank_2() -> None:
    source_team_ids = [f"src-{i}" for i in range(8)]
    mapping = build_team_id_mapping(source_team_ids)
    visitor_src = source_team_ids[DEMO_VISITOR_TEAM_INDEX]
    assert mapping[visitor_src] == DEMO_TEAM_IDS[1]
    assert DEMO_VISITOR_TEAM_INDEX == 1


def test_short_source_team_list_aborts(monkeypatch) -> None:
    import refresh_demo_league as r

    class FakeRes:
        data = [{"id": "only-one", "cumulative_xp": 100}]

    class FakeQuery:
        def select(self, *_): return self
        def eq(self, *_): return self
        def order(self, *_, **__): return self
        def limit(self, *_): return self
        def execute(self): return FakeRes()

    class FakeClient:
        def table(self, _): return FakeQuery()

    import pytest

    with pytest.raises(SystemExit):
        r.fetch_source_team_ranking(FakeClient(), "src-league")
```

- [ ] **Step 3: Author the dry-run test**

Create `services/pcs-sync/tests/test_refresh_demo_league_dry_run.py`:

```python
"""Smoke: --dry-run prints the plan, makes no writes."""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import refresh_demo_league as r


def test_dry_run_no_writes(monkeypatch, capsys) -> None:
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": r.DEMO_LEAGUE_ID,
        "is_demo": True,
    }

    fake_client.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"id": f"src-{i}", "cumulative_xp": 1000 - i * 100} for i in range(8)
    ]
    fake_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    monkeypatch.setattr(r, "assert_constants_in_sync", lambda: None)
    monkeypatch.setattr(r, "make_client", lambda: fake_client)
    monkeypatch.setattr(sys, "argv", ["refresh_demo_league.py", "--source-league-id", "src-league", "--dry-run"])

    r.main()
    captured = capsys.readouterr()
    assert "Visitor team:" in captured.out
    assert "--dry-run: no writes." in captured.out
```

- [ ] **Step 4: Run pytest**

```bash
cd services/pcs-sync && pytest tests/test_refresh_demo_league_visitor_mapping.py tests/test_refresh_demo_league_dry_run.py -v && cd ../..
```

Expected: all tests PASS.

- [ ] **Step 5: Manually exercise `--dry-run` against the real DB**

Identify Jonathan's source league id (`supabase db query --linked "SELECT id, name FROM leagues WHERE is_demo = false ORDER BY created_at ASC LIMIT 5;"` and pick the one with most data).

```bash
cd services/pcs-sync
python3 refresh_demo_league.py --source-league-id <uuid> --dry-run
```

Expected output: prints visitor team UUID and the 8-team mapping, no writes. Exit 0.

- [ ] **Step 6: Run the real refresh (one shot)**

```bash
python3 refresh_demo_league.py --source-league-id <uuid>
```

Expected: prints `Demo refresh complete.`, and `Cache invalidation → 200` if Vercel envs are set, else a `WARNING` line.

- [ ] **Step 7: Verify visible rows**

```bash
curl -sS -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/teams?select=id,name,league_id" \
  | python3 -m json.tool | head -30
```

Expected: 8 rows, names from `DEMO_TEAM_NAMES`, `league_id` = `DEMO_LEAGUE_ID`.

- [ ] **Step 8: Commit**

```bash
git add services/pcs-sync/refresh_demo_league.py \
        services/pcs-sync/tests/test_refresh_demo_league_visitor_mapping.py \
        services/pcs-sync/tests/test_refresh_demo_league_dry_run.py
git commit -m "feat(demo): Python refresh script — wipe-and-replace + visitor mapping + cache POST"
```

---

## Task 12: Wrap mutation call sites with `useDemoSafeAction`

**Files (each is "Modify"):**
1. `apps/web/app/(game)/league/[leagueId]/auction/auctions-client.tsx`
2. `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/rider-dialog.tsx`
3. `apps/web/app/(game)/league/[leagueId]/auction/status/status-client.tsx`
4. `apps/web/app/(game)/league/[leagueId]/achievements/achievements-client.tsx`
5. `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
6. `apps/web/app/(game)/league/[leagueId]/team/gt/gt-team-client.tsx`
7. `apps/web/app/(game)/league/[leagueId]/team/budget/budget-client.tsx`
8. `apps/web/app/(game)/league/[leagueId]/team/budget/marketplace/marketplace-client.tsx`
9. `apps/web/components/gt-rescue-market.tsx`
10. `apps/web/components/tactic-nemesis-modal.tsx`
11. `apps/web/components/tactic-boost-modal.tsx`
12. `apps/web/components/rider-picker-sheet.tsx`
13. `apps/web/components/gt-dnf-card.tsx`
14. `apps/web/components/race-feed-tactic-modal.tsx`

> The wrap pattern is identical for every file. The verification step at the end confirms zero un-wrapped mutation calls remain.

- [ ] **Step 1: Apply the wrap pattern to one file as a reference (`rider-dialog.tsx`)**

Open `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/rider-dialog.tsx`. At the top:

```tsx
import { useDemoSafeAction } from "@/contexts/demo-context";
```

Locate every direct mutation call. They typically look like:

```tsx
const onBid = () => startTransition(async () => {
  const result = await placeBid({ ... });
  // ...
});
```

Refactor to:

```tsx
const placeBidSafe = useDemoSafeAction(placeBid);
const onBid = () => startTransition(async () => {
  const result = await placeBidSafe({ ... });
  if ("blocked" in result) return;
  // ...existing handling
});
```

The pattern:
1. Import `useDemoSafeAction`.
2. For every imported server action mutation used in the component, declare a `*Safe` variant via `useDemoSafeAction(action)`.
3. Replace each call site with the safe variant.
4. After awaiting, early-return when `"blocked" in result` to skip downstream toast / redirect.

- [ ] **Step 2: Apply the same pattern to all 14 files**

Use `git grep -n "await place\|await release\|await validate\|await force\|await place_tactic\|await claim\|await gt_\|await leave\|await grant\|await joinLeague\|await signupAnd\|await setSponsor\|await saveDraftBid\|await deleteDraftBid\|await toggle\|await swapGt\|await setGtRole\|await setStartingLevel\|await launchFirstAuction" apps/web/app apps/web/components` to find every mutation site, then wrap.

For each file: import the hook, declare `const <name>Safe = useDemoSafeAction(<name>);`, replace call sites.

Excluded by design (settings page redirects to demo home so visitors never reach these): `settings/settings-buttons.tsx`, `auction/rounds/rounds-client.tsx`, `(lobby)/lobby/...` (demo league is `status='active'`, never routes through lobby).

- [ ] **Step 3: Run typecheck + lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS. Any unused-import lint complaint here means a file was edited but no mutation call was actually present — remove the import.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @watthunter/web test
```

Expected: PASS. Existing component tests do not mount inside a `DemoProvider` so `useDemoSafeAction` returns the original `fn`; behavior is unchanged.

- [ ] **Step 5: Audit unwrapped mutation calls**

```bash
git diff main..HEAD -- 'apps/web/app/(game)/**/*-client.tsx' 'apps/web/components/**/*.tsx' | grep -E "^\+.*await (place|release|validate|force|claim|leave|grant|saveDraftBid|deleteDraftBid|toggle|swapGt|setGtRole)" | grep -v Safe | head -20
```

Expected: empty (every awaited mutation goes through a `*Safe` variant).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "feat(demo): wrap mutation call sites with useDemoSafeAction (banner pulse on demo)"
```

---

## Task 13: PII audit script + final smoke checklist + ARCHITECTURE.md

**Files:**
- Create: `services/pcs-sync/scripts/audit_demo_pii.py`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Author the PII audit**

Create `services/pcs-sync/scripts/audit_demo_pii.py`:

```python
"""Audits the demo dataset for accidental PII leakage.

Exits 0 on success. Exits 1 with a loud error if a probable PII string is found.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

sys.path.append(str(Path(__file__).resolve().parents[1]))
from demo_constants import (
    DEMO_LEAGUE_ID,
    DEMO_TEAM_IDS,
    DEMO_TEAM_NAMES,
    DEMO_USER_IDS,
)

load_dotenv()

BANNED_DOMAINS = ("@gmail.com", "@protonmail", "@hotmail", "@yahoo.", "@watthunter.com")
EMAIL_RE = re.compile(r"^demo-team-[1-8]@watthunter\.demo$")


def audit() -> int:
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    failures: list[str] = []

    users = client.table("users").select("id, email, display_name").in_("id", list(DEMO_USER_IDS)).execute().data or []
    if len(users) != 8:
        failures.append(f"Expected 8 demo users, found {len(users)}")
    for u in users:
        if not EMAIL_RE.match(u["email"] or ""):
            failures.append(f"Email shape mismatch on {u['id']}: {u['email']!r}")
        if u["display_name"] not in DEMO_TEAM_NAMES:
            failures.append(f"display_name mismatch on {u['id']}: {u['display_name']!r}")

    teams = client.table("teams").select("id, name").in_("id", list(DEMO_TEAM_IDS)).execute().data or []
    team_names = {t["name"] for t in teams}
    if team_names - set(DEMO_TEAM_NAMES):
        failures.append(f"Unexpected team names: {team_names - set(DEMO_TEAM_NAMES)}")

    treas = (
        client.table("treasury_log")
        .select("description")
        .in_("team_id", list(DEMO_TEAM_IDS))
        .limit(500)
        .execute()
        .data
        or []
    )
    for row in treas:
        desc = (row.get("description") or "").lower()
        for banned in BANNED_DOMAINS:
            if banned in desc:
                failures.append(f"Banned domain {banned!r} found in treasury_log: {desc!r}")
                break

    if failures:
        print("PII AUDIT FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PII audit passed: 8 ghost users, 8 demo teams, no banned strings.")
    return 0


if __name__ == "__main__":
    raise SystemExit(audit())
```

- [ ] **Step 2: Run the audit**

```bash
cd services/pcs-sync && python3 scripts/audit_demo_pii.py && cd ../..
```

Expected: `PII audit passed: ...` and exit 0.

- [ ] **Step 3: Service-role audit**

```bash
grep -rE "SUPABASE_SERVICE_ROLE" apps/web/{src,app,components,contexts,lib,hooks} \
  --include='*.ts' --include='*.tsx' \
  | grep -v __tests__
```

Expected: empty.

- [ ] **Step 4: End-to-end smoke (manual, dev server in private window)**

```bash
pnpm dev
```

In a fresh incognito profile:

1. Navigate `http://localhost:3000/league/demo` — Race Feed renders, demo banner visible at the top, `Create your league` CTA visible at the bottom on mobile sizes (resize devtools < 1024 px).
2. Click into `/league/demo/team`, `/league/demo/budget`, `/league/demo/ranking`, `/league/demo/auction`, `/league/demo/levels`, `/league/demo/achievements`. Each page renders without console errors.
3. From `/league/demo/team`, click any mutation button (e.g., a strategy toggle, a recruit "Place bid"). Expected: banner glows cyan for ~900 ms, no network request to a RPC fires (check Network → Fetch/XHR; only PostgREST `?select=...` rows).
4. Click `Get Started` in the banner → lands on `/`.

Stop dev.

- [ ] **Step 5: Update ARCHITECTURE.md**

Open `docs/ARCHITECTURE.md`. Under "Routing → Groupes de routes" add a row for the demo path. Under "Authentification → Middleware" add `/league/demo/*` to the public-route list. Under "Base de données → RLS — Architecture" add a paragraph:

```markdown
**Demo mode (Chantier B) — anon SELECT scope :**
La fonction `public.demo_league_id() RETURNS uuid STABLE` retourne `DEMO_LEAGUE_ID`.
21 policies `FOR SELECT TO anon` autorisent la lecture du demo league :
- Tier A (direct `league_id`) : `leagues`, `league_members`, `teams`, `auctions`, `contracts`, `draft_bids`, `gt_emergency_bids`, `remontada_boost_triggers`, `remontada_boosts`.
- Tier B (via `EXISTS teams`) : `auction_bids`, `gt_squad`, `gt_role_assignments`, `gt_tactic_activations`, `rider_xp_daily`, `sponsor_bonuses`, `sponsor_goal_completions`, `team_ranking_daily`, `team_sponsors`, `team_strategies`, `team_xp_adjustments`, `treasury_log`, `round_validations`.
- Tier C : `users` restreint aux 8 ghost demo accounts (`id IN demo league_members`).
- Tier D (référence publique) : `riders`, `race_results`, `rider_season_rankings`, `race_startlists`, `rider_teams`, `rider_pcs_history`, `gt_daily_classifications`, `gt_rescue_windows`, `sponsors`, `strategies` (`USING (true)`).
Le visiteur anonyme ne peut rien muter (les RPCs rejettent via `auth.uid() IS NULL`).
Le `useDemoSafeAction` côté React fait pulser la bannière cyan au lieu d'appeler la mutation.
Refresh des données : `python3 services/pcs-sync/refresh_demo_league.py --source-league-id <uuid>`. POST `/api/admin/revalidate-demo` (Bearer `REVALIDATE_SECRET`) déclenche `revalidateTag("demo-league")`.
```

Also append to "Etat d'avancement → Implemente":

```markdown
- [x] Demo mode (Chantier B) — route `/league/demo`, RLS anon SELECT, ghost users, refresh script Python, banner pulse pattern
```

- [ ] **Step 6: Run the full vitest + pytest suites**

```bash
pnpm typecheck
pnpm lint
pnpm test
cd services/pcs-sync && pytest && cd ../..
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add services/pcs-sync/scripts/audit_demo_pii.py \
        docs/ARCHITECTURE.md
git commit -m "feat(demo): PII audit script + ARCHITECTURE.md demo mode section"
```

---

## Task 14: Push branch + open PR

- [ ] **Step 1: Final status check**

```bash
git status
git log --oneline main..HEAD | head -20
```

Expect a clean tree and 12-14 demo-prefixed commits on top of the lobby work.

- [ ] **Step 2: Push**

```bash
git push -u origin feature/try-before-signup
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(demo): Chantier B — Demo mode for unauthenticated visitors" --body "$(cat <<'EOF'
## Summary

- Unauthenticated visitors can now browse \`/league/demo/*\` with the full game shell, the data of a real league fully anonymized, and a cyan banner pulse instead of mutations.
- Stable \`DEMO_LEAGUE_ID\` and 8 ghost \`auth.users\` seeded once via migration. Constants synced TS ↔ Python with a regression test on each side.
- 21 \`FOR SELECT TO anon\` policies scoped by \`public.demo_league_id()\`; mutations stay blocked by existing \`auth.uid()\` checks.
- Python \`refresh_demo_league.py\` wipe-and-replaces the demo with an anonymized snapshot in dependency order, then POSTs \`/api/admin/revalidate-demo\` (Bearer \`REVALIDATE_SECRET\`) → \`revalidateTag("demo-league")\`.

## Test plan

- [ ] \`pnpm typecheck && pnpm lint && pnpm test\` green
- [ ] \`pytest services/pcs-sync/tests/\` green
- [ ] \`supabase db push --linked\` clean (3 new migrations applied)
- [ ] In incognito, \`/league/demo\` renders without redirect; every nav target loads; clicking any mutation button pulses the banner without firing an RPC
- [ ] \`grep -rE "SUPABASE_SERVICE_ROLE" apps/web/{src,app,components,contexts,lib,hooks} --include='*.ts' --include='*.tsx' | grep -v __tests__\` returns empty
- [ ] \`python3 services/pcs-sync/scripts/audit_demo_pii.py\` exits 0

## Risks

- \`supabase-py\` does not wrap the refresh in a Postgres transaction — partial failures leave the demo empty until the next successful run. Acceptable for v1; hardening planned via \`psycopg\`.
- \`REVALIDATE_SECRET\` must be set in Vercel (prod + preview) before the refresh script's invalidation POST will work.
- Anon RLS policies expose all of \`riders\` / \`race_results\` / etc. to the public. This is public PCS data already, but worth flagging — bulk extraction by a hostile reader is now possible.

## Out of scope

- Chantier A (landing video)
- Chantier C (signup funnel — already shipped)
- Chantier D (lobby — already shipped)
- Scheduled refresh job
- Demo-specific analytics

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the printed PR URL and return it.

- [ ] **Step 4: STOP — do not merge.** Jonathan reviews.

---

## Self-review (author)

- **Spec coverage:**
  - §2.2 constants → Task 1 ✓
  - §3.1 RLS tables → Task 3 ✓
  - §3.4 ghost users → Task 2 ✓
  - §3.5 seed migration → Task 2 ✓
  - §3.6 RLS migration → Task 3 ✓
  - §3.7 `is_demo` flag → Task 2 ✓
  - §4 refresh script (CLI, sync gate, wipe-and-replace, visitor mapping, anonymization, cache invalidation, tests) → Tasks 1 (sync gate) + 11 ✓
  - §4.7 join guard → Task 4 ✓
  - §5.1 middleware → Task 5 ✓
  - §5.2 layout fork → Task 8 ✓
  - §5.3 DemoProvider + useDemoSafeAction + CSS → Task 6 ✓
  - §5.4 banner + bottom CTA → Task 7 ✓
  - §5.5 cache layer → Task 9 ✓
  - §5.6 revalidate endpoint → Task 10 ✓
  - §6.1 service-role audit → Task 13 step 3 ✓
  - §6.2 PII audit → Task 13 ✓
  - §6.3 smoke checklist → Task 13 step 4 ✓
- **Placeholders:** none — every code block is concrete and self-contained.
- **Type consistency:** `useDemoSafeAction` returns `(...args) => Promise<TReturn | { blocked: true }>` — call sites in Task 12 always check `"blocked" in result`. `DEMO_LEAGUE_SLUG` is `"demo"` (the URL segment); `DEMO_LEAGUE_ID` is the UUID. The two are deliberately distinct: URL routing keys off the slug; DB queries key off the UUID.
- **Cache helper inconsistency caveat (Task 9):** if `getRaceFeedData` lives somewhere else under a different name, the task instructs to extract it. Worth confirming the actual function name in Task 9 before applying the import.
