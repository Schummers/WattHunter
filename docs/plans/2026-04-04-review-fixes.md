# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 critical issues identified in the technical review: C1 (join league starting_level), C2 (auction cross-league contracts), C3/C5 (bankruptcy dead code cleanup), C6/C7 (CI + ESLint).

**Architecture:** Targeted fixes in 4 independent files/areas. No new features — only bug fixes and dead code removal. CI setup adds a new GitHub Actions workflow + ESLint config.

**Tech Stack:** Next.js 16 App Router, Supabase, Python, GitHub Actions

---

### Task 1: Fix Join League starting_level (C1)

**Files:**
- Modify: `apps/web/app/(auth)/league/join/actions.ts`

The current `joinLeague` action creates a team with default `level` and `cumulative_xp` (both 0/1), and always assigns Lotto T1 sponsor. It should instead read the league's `starting_level` and mirror the `createLeague` logic.

- [ ] **Step 1: Read league's starting_level in the query**

In `apps/web/app/(auth)/league/join/actions.ts`, change line 39 from:
```ts
    .select("id, name, status, max_players")
```
to:
```ts
    .select("id, name, status, max_players, starting_level")
```

- [ ] **Step 2: Import getLevelByNumber**

Add import at line 4:
```ts
import { getLevelByNumber } from "@/lib/levels";
```

- [ ] **Step 3: Set team level and XP on creation**

Change the team insert (lines 82-88) from:
```ts
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: displayName,
    })
    .select("id")
    .single();
```
to:
```ts
  const startLevel = league.starting_level ?? 1;
  const levelData = getLevelByNumber(startLevel);

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: displayName,
      level: startLevel,
      cumulative_xp: levelData.xp,
    })
    .select("id")
    .single();
```

- [ ] **Step 4: Assign correct default sponsor based on starting_level**

Replace the sponsor assignment block (lines 96-107) from:
```ts
  // Auto-assign Lotto (T1) as default sponsor (single sponsor per team)
  const { data: lotto } = await supabase
    .from("sponsors")
    .select("id")
    .eq("slug", "lotto")
    .single();

  if (lotto) {
    await supabase
      .from("team_sponsors")
      .insert({ team_id: team.id, sponsor_id: lotto.id, activated_at: new Date().toISOString() });
  }
```
with:
```ts
  // Auto-assign default sponsor based on starting level (mirrors createLeague logic)
  const defaultSlug = startLevel <= 1 ? "lotto" : startLevel === 2 ? "astana" : null;
  if (defaultSlug) {
    const { data: defaultSponsor } = await supabase
      .from("sponsors")
      .select("id")
      .eq("slug", defaultSlug)
      .single();

    if (defaultSponsor) {
      await supabase
        .from("team_sponsors")
        .insert({ team_id: team.id, sponsor_id: defaultSponsor.id, activated_at: new Date().toISOString() });
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(auth\)/league/join/actions.ts
git commit -m "fix: join league inherits starting_level, XP, and sponsor from league"
```

---

### Task 2: Fix Auction Detail cross-league contracts (C2)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx`

Line 52 fetches ALL active contracts without league scope. Since `contracts` has a `league_id` column (added in migration `20260313000000`), we can filter directly.

- [ ] **Step 1: Scope contracts query by league_id**

In `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx`, change line 52 from:
```ts
    supabase.from("contracts").select("rider_id").eq("status", "active"),
```
to:
```ts
    supabase.from("contracts").select("rider_id").eq("status", "active").eq("league_id", leagueId),
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/page.tsx
git commit -m "fix: scope auction contracts query to current league"
```

---

### Task 3: Remove bankruptcy dead code (C3/C5)

**Files:**
- Modify: `services/pcs-sync/auction.py`

The bankruptcy cascade (lines 379-430 of `run_payday`) is dead code — the `CHECK (treasury >= 0)` constraint prevents treasury from going negative, and the spec says "zéro faillite". Remove only the bankruptcy block inside `run_payday`, keeping the rest of the payday logic intact.

- [ ] **Step 1: Remove BANKRUPTCY_THRESHOLD constant and bankruptcy block**

In `services/pcs-sync/auction.py`, in function `run_payday`:

Remove line 275:
```python
    BANKRUPTCY_THRESHOLD = -10_000
```

Remove lines 379-430 (the entire bankruptcy cascade block):
```python
            # --- Step 6: Bankruptcy cascade ---
            released_riders: list[str] = []

            if treasury < BANKRUPTCY_THRESHOLD and contracts:
                logger.warning(f"[Payday] Team {team_id} — BANKRUPTCY triggered (treasury={treasury})")

                # Fetch cumulative XP per rider
                xp_resp = supabase.table("rider_xp_daily").select(
                    "rider_id, xp_gained"
                ).eq("team_id", team_id).execute()

                rider_xp: dict[str, int] = {}
                for row in (xp_resp.data or []):
                    rid = row["rider_id"]
                    rider_xp[rid] = rider_xp.get(rid, 0) + int(row.get("xp_gained") or 0)

                # Sort by highest cumulative XP first
                sorted_contracts = sorted(
                    contracts,
                    key=lambda c: rider_xp.get(c["rider_id"], 0),
                    reverse=True,
                )

                for contract in sorted_contracts:
                    if treasury >= BANKRUPTCY_THRESHOLD:
                        break

                    contract_salary = int(contract.get("locked_salary") or 0)

                    supabase.table("contracts").update({
                        "status": "released",
                        "released_at": now_iso,
                    }).eq("id", contract["id"]).execute()

                    treasury += contract_salary

                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "bankruptcy_release",
                        "amount": contract_salary,
                        "description": f"Bankruptcy salary refund — rider {contract['rider_id']}",
                        "rider_id": contract["rider_id"],
                    }).execute()

                    released_riders.append(contract["rider_id"])
                    logger.info(
                        f"[Payday] Team {team_id} — released rider {contract['rider_id']} "
                        f"(refund +{contract_salary}, treasury now {treasury})"
                    )

                # Update treasury after bankruptcy releases
                supabase.table("teams").update({"treasury": treasury}).eq("id", team_id).execute()
```

- [ ] **Step 2: Update docstring and logging**

Update the `run_payday` docstring (line 262-273) — remove step 6 reference. Change from:
```python
    """
    Run the monthly payday for ALL teams in a league.

    Called after Round 1 auction resolution. Mirrors the confirmPhaseSetup
    server action (apps/web/app/(game)/league/[leagueId]/team/market/actions.ts).

    For each team:
      1. Apply pending sponsor change
      2. Apply pending policy changes
      3. Credit sponsor income
      4. Deduct active contract salaries
      5. Update treasury
      6. Bankruptcy cascade (if treasury < -10_000)
      7. Mark phase as confirmed
    """
```
to:
```python
    """
    Run the monthly payday for ALL teams in a league.

    Called after Round 1 auction resolution. Mirrors the confirmPhaseSetup
    server action (apps/web/app/(game)/league/[leagueId]/team/market/actions.ts).

    For each team:
      1. Apply pending sponsor change
      2. Apply pending policy changes
      3. Credit sponsor income
      4. Deduct active contract salaries
      5. Update treasury
      6. Mark phase as confirmed
    """
```

- [ ] **Step 3: Update the log and result to remove released_riders**

Change the log line (around line 438 after removal) from:
```python
            logger.info(
                f"[Payday] Team {team_id} — DONE. treasury_after={treasury}, "
                f"released={released_riders}, phase_confirmed={phase_id}"
            )

            payday_results.append({
                "team_id": team_id,
                "treasury_after": treasury,
                "sponsor_budget": sponsor_budget,
                "total_salary": total_salary,
                "released": released_riders,
                "phase_id": phase_id,
            })
```
to:
```python
            logger.info(
                f"[Payday] Team {team_id} — DONE. treasury_after={treasury}, "
                f"phase_confirmed={phase_id}"
            )

            payday_results.append({
                "team_id": team_id,
                "treasury_after": treasury,
                "sponsor_budget": sponsor_budget,
                "total_salary": total_salary,
                "phase_id": phase_id,
            })
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

```bash
cd services/pcs-sync && python -m pytest tests/test_auction.py -v
```
Expected: All tests pass. If any test references `bankruptcy_release` or `BANKRUPTCY_THRESHOLD`, update it to remove those assertions.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/auction.py
git commit -m "refactor: remove bankruptcy dead code from payday (zero-faillite spec)"
```

---

### Task 4: Setup CI workflow + ESLint (C6/C7)

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `apps/web/package.json` (add eslint devDependencies + lint script)

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: TypeScript check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Tests
        run: pnpm test
```

- [ ] **Step 2: Add ESLint to apps/web**

Run:
```bash
cd apps/web && pnpm add -D eslint eslint-config-next @eslint/eslintrc
```

- [ ] **Step 3: Create ESLint config**

Create `apps/web/eslint.config.mjs`:
```js
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [...compat.extends("next/core-web-vitals")];
```

- [ ] **Step 4: Add lint script to apps/web/package.json**

In `apps/web/package.json`, add to `"scripts"`:
```json
"lint": "next lint"
```

- [ ] **Step 5: Run lint locally to verify it works**

```bash
cd apps/web && pnpm lint
```
Expected: runs without crashing. May produce warnings — that's OK for now.

- [ ] **Step 6: Run typecheck locally**

```bash
pnpm typecheck
```
Expected: passes (the build already works on Vercel).

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml apps/web/eslint.config.mjs apps/web/package.json pnpm-lock.yaml
git commit -m "ci: add PR quality gate (typecheck, lint, test)"
```

---

## Verification

After all 4 tasks:

1. **C1**: Create a test league at Level 4, then join with another account → verify new team has level 4, correct XP, correct sponsor
2. **C2**: Open auction detail page → verify only riders contracted in THIS league show as taken
3. **C3/C5**: Run `python -m pytest tests/test_auction.py -v` → all pass, no bankruptcy references in auction.py
4. **C6/C7**: Push a branch, open a PR → verify GitHub Actions CI runs typecheck + lint + test
