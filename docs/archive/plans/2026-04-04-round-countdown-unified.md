# Round Countdown Unified Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace two inconsistent countdown functions with one shared `formatRoundCountdown()` used identically in market and home.

**Architecture:** Upgrade `lib/format.ts` with the new function, remove the local `timeUntil()` in `home-feed.tsx`, update both UI files to use the shared function with consistent label and urgency color.

**Tech Stack:** Next.js App Router, TypeScript strict, Vitest (unit tests), Tailwind CSS v4 design tokens

---

## File Map

| File | Action | Change |
|------|--------|--------|
| `apps/web/lib/format.ts` | Modify | Replace `smartCountdown` with `formatRoundCountdown` |
| `apps/web/lib/format.test.ts` | Create | Unit tests for `formatRoundCountdown` |
| `apps/web/app/(game)/league/[leagueId]/home-feed.tsx` | Modify | Remove local `timeUntil`, use `formatRoundCountdown` |
| `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx` | Modify | Replace `smartCountdown` with `formatRoundCountdown` |

---

## Task 1: Replace `smartCountdown` with `formatRoundCountdown` in `lib/format.ts`

**Files:**
- Modify: `apps/web/lib/format.ts`
- Create: `apps/web/lib/format.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/format.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRoundCountdown } from "./format";

// Pin "now" to a fixed point so tests are deterministic
const NOW = new Date("2026-04-04T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function future(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString();
}

const H = 60 * 60 * 1000;
const D = 24 * H;

describe("formatRoundCountdown — text", () => {
  it("shows days and hours when >= 1 day (open)", () => {
    expect(formatRoundCountdown(future(1 * D + 5 * H), "open").text).toBe(
      "closes in 1d 5h"
    );
  });

  it("shows days and hours when >= 1 day (scheduled)", () => {
    expect(formatRoundCountdown(future(3 * D + 2 * H), "scheduled").text).toBe(
      "opens in 3d 2h"
    );
  });

  it("shows hours only when < 1 day (open)", () => {
    expect(formatRoundCountdown(future(18 * H), "open").text).toBe(
      "closes in 18h"
    );
  });

  it("shows hours only when < 1 day (scheduled)", () => {
    expect(formatRoundCountdown(future(6 * H), "scheduled").text).toBe(
      "opens in 6h"
    );
  });

  it("shows '< 1h' when less than 1 hour remains (open)", () => {
    expect(formatRoundCountdown(future(30 * 60 * 1000), "open").text).toBe(
      "closes in < 1h"
    );
  });

  it("shows '< 1h' when less than 1 hour remains (scheduled)", () => {
    expect(formatRoundCountdown(future(1), "scheduled").text).toBe(
      "opens in < 1h"
    );
  });

  it("returns 'ended' for past dates (defensive fallback)", () => {
    expect(formatRoundCountdown(future(-1), "open").text).toBe("ended");
  });

  it("accepts a Date object as well as a string", () => {
    const target = new Date(NOW.getTime() + 2 * D + 3 * H);
    expect(formatRoundCountdown(target, "open").text).toBe("closes in 2d 3h");
  });
});

describe("formatRoundCountdown — urgent flag", () => {
  it("is false when more than 48h remain", () => {
    expect(formatRoundCountdown(future(3 * D), "open").urgent).toBe(false);
  });

  it("is true when exactly 48h remain", () => {
    expect(formatRoundCountdown(future(2 * D), "open").urgent).toBe(true);
  });

  it("is true when less than 48h remain", () => {
    expect(formatRoundCountdown(future(23 * H), "open").urgent).toBe(true);
  });

  it("is false for ended (defensive fallback)", () => {
    expect(formatRoundCountdown(future(-1), "open").urgent).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm test --run lib/format.test.ts
```

Expected: FAIL — `formatRoundCountdown is not exported from './format'`

- [ ] **Step 3: Replace `smartCountdown` in `lib/format.ts`**

Open `apps/web/lib/format.ts`. Replace lines 46-57 (the `smartCountdown` function) with:

```ts
/** Unified round countdown. Returns display text and urgency flag for color styling.
 *  - text: "closes in 1d 5h" | "opens in 18h" | "closes in < 1h" | "ended"
 *  - urgent: true when ≤ 48h remain (use --warning color)
 */
export function formatRoundCountdown(
  target: Date | string,
  status: "open" | "scheduled"
): { text: string; urgent: boolean } {
  const end = typeof target === "string" ? new Date(target) : target;
  const diffMs = end.getTime() - Date.now();

  if (diffMs <= 0) return { text: "ended", urgent: false };

  const prefix = status === "open" ? "closes in" : "opens in";
  const urgent = diffMs <= 48 * 60 * 60 * 1000;

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (totalHours < 1) return { text: `${prefix} < 1h`, urgent };
  if (days > 0) return { text: `${prefix} ${days}d ${hours}h`, urgent };
  return { text: `${prefix} ${totalHours}h`, urgent };
}
```

- [ ] **Step 4: Run tests — expect all green**

```bash
cd apps/web && pnpm test --run lib/format.test.ts
```

Expected: all 12 tests PASS

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors (note: `smartCountdown` is still imported in market-client — you may see an error there, which we fix in Task 2)

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/format.ts apps/web/lib/format.test.ts
git commit -m "feat: replace smartCountdown with formatRoundCountdown (unified, granular)"
```

---

## Task 2: Update market-client.tsx

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx`

- [ ] **Step 1: Replace import**

Find the import of `smartCountdown` at the top of `market-client.tsx`:

```ts
import { smartCountdown } from "@/lib/format";
```

Replace with:

```ts
import { formatRoundCountdown } from "@/lib/format";
```

- [ ] **Step 2: Update the round header JSX**

Find line ~377 (the active round header):

```tsx
{activeRound.name} &middot; {smartCountdown(activeRound.closes_at)}
```

Replace with:

```tsx
{(() => {
  const { text, urgent } = formatRoundCountdown(activeRound.closes_at, "open");
  return (
    <>
      {activeRound.name}{" "}
      <span
        className={urgent ? "text-[var(--warning)]" : ""}
      >
        &middot; {text}
      </span>
    </>
  );
})()}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx
git commit -m "feat: use formatRoundCountdown in market header"
```

---

## Task 3: Update home-feed.tsx

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/home-feed.tsx`

- [ ] **Step 1: Remove local `timeUntil` and add import**

At the top of `home-feed.tsx`, delete lines 9-19 (the local `timeUntil` function):

```ts
// DELETE THIS BLOCK:
function timeUntil(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
```

Add to the existing imports at the top:

```ts
import { formatRoundCountdown } from "@/lib/format";
```

- [ ] **Step 2: Replace `timeUntil` calls in the JSX**

Find the auction card block (~lines 114-128). Replace both `timeUntil(...)` usages:

```tsx
{auction.status === "open" ? (
  <>
    Closes in{" "}
    <span className="font-semibold text-[var(--warning)]">
      {timeUntil(auction.closes_at)}
    </span>
  </>
) : (
  <>
    Opens in{" "}
    <span className="font-semibold text-[var(--text-high)]">
      {timeUntil(auction.opens_at)}
    </span>
  </>
)}
```

Replace with:

```tsx
{(() => {
  const status = auction.status === "open" ? "open" : "scheduled";
  const target = auction.status === "open" ? auction.closes_at : auction.opens_at;
  const { text, urgent } = formatRoundCountdown(target, status);
  return (
    <span
      className={`font-semibold ${urgent ? "text-[var(--warning)]" : "text-[var(--text-high)]"}`}
    >
      {text}
    </span>
  );
})()}
```

Note: this renders `"closes in 1d 5h"` / `"opens in 3d 2h"` directly — the label is already included in `text`, so remove the surrounding `"Closes in "` / `"Opens in "` literal strings too.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
cd apps/web && pnpm test --run
```

Expected: all tests pass (format.test.ts + existing test files)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/home-feed.tsx
git commit -m "feat: use formatRoundCountdown in home feed, remove local timeUntil"
```

---

## Verification

1. Run dev server: `pnpm dev`
2. Open market page → active round header shows `"Round 1 · closes in Xd Yh"` (orange if ≤ 48h)
3. Open home page → auction card shows `"closes in Xd Yh"` or `"opens in Xd Yh"` (orange if ≤ 48h)
4. Confirm same format, same function in both places
5. Run `pnpm typecheck` — no errors
6. Run `pnpm test --run` — all tests green
