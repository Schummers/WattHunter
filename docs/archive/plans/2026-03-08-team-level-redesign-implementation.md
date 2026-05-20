# Team Level Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Team Level section and Levels page with a mesh-gradient card component and a clean divider-based list page.

**Architecture:** Extract level data + helpers into a shared module. Create a `TeamLevelCard` client component with mesh gradient background, reusable on My Team and Home. Rewrite the Levels page with a gradient hero (reusing the card internals) + flat divider list. Fix bid card background as a quick side change.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, Radix Progress, existing CSS mesh gradient animation.

**Design doc:** `docs/plans/2026-03-08-team-level-redesign-design.md`

---

### Task 1: Extract shared level data + helpers

**Files:**
- Create: `apps/web/lib/levels.ts`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/page.tsx` (remove duplicated LEVEL_THRESHOLDS + helpers)
- Modify: `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx` (remove duplicated LEVELS + helpers)

**Step 1: Create the shared module**

Create `apps/web/lib/levels.ts` with ALL level data including new fields (pool, policy, maxActive, sponsor):

```typescript
export const LEVELS = [
  { level: 1, xp: 0, slots: 6, pool: "#351-500", poolMin: 351, policy: "Speciality", maxActive: 1, sponsor: "Sponsor T1 · 40k€" },
  { level: 2, xp: 50, slots: 7, pool: "#251-500", poolMin: 251, policy: null, maxActive: 1, sponsor: null },
  { level: 3, xp: 150, slots: 7, pool: "#176-500", poolMin: 176, policy: "Nationality", maxActive: 1, sponsor: "Sponsor T2 · 60k€" },
  { level: 4, xp: 350, slots: 8, pool: "#101-500", poolMin: 101, policy: null, maxActive: 1, sponsor: null },
  { level: 5, xp: 700, slots: 9, pool: "#76-500", poolMin: 76, policy: "Teams", maxActive: 2, sponsor: "Sponsor T3 · 125k€" },
  { level: 6, xp: 1200, slots: 9, pool: "#51-500", poolMin: 51, policy: null, maxActive: 2, sponsor: null },
  { level: 7, xp: 1900, slots: 10, pool: "#26-500", poolMin: 26, policy: "Age", maxActive: 2, sponsor: "Sponsor T4 · 200k€" },
  { level: 8, xp: 2900, slots: 11, pool: "#11-500", poolMin: 11, policy: null, maxActive: 2, sponsor: "Sponsor T5 · 400k€" },
  { level: 9, xp: 4400, slots: 11, pool: "#4-500", poolMin: 4, policy: null, maxActive: 2, sponsor: null },
  { level: 10, xp: 6400, slots: 12, pool: "#1-500", poolMin: 1, policy: null, maxActive: 2, sponsor: null },
] as const;

export type LevelData = (typeof LEVELS)[number];

export function getLevelByNumber(level: number): LevelData {
  return LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))];
}

export function getNextLevel(level: number): LevelData | null {
  const idx = level - 1;
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getProgressPct(xp: number, currentLevel: number): number {
  const current = getLevelByNumber(currentLevel);
  const next = getNextLevel(currentLevel);
  if (!next) return 100;
  const range = next.xp - current.xp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((xp - current.xp) / range) * 100));
}

export function getMaxSlots(level: number): number {
  return getLevelByNumber(level).slots;
}

/**
 * Returns pills describing what's NEW at a given level (not cumulative).
 * Each pill is a short string for display.
 */
export function getNewUnlocks(level: number): string[] {
  const current = getLevelByNumber(level);
  const prev = level > 1 ? getLevelByNumber(level - 1) : null;
  const pills: string[] = [];

  // New slots
  if (!prev || current.slots !== prev.slots) {
    pills.push(`${current.slots} slots`);
  }

  // New pool range
  if (!prev || current.pool !== prev.pool) {
    pills.push(`Pool ${current.pool}`);
  }

  // New policy type
  if (current.policy) {
    pills.push(`Policy: ${current.policy}`);
  }

  // New max active policies
  if (prev && current.maxActive !== prev.maxActive) {
    pills.push(`${current.maxActive} max policies`);
  }

  // Sponsor unlock
  if (current.sponsor) {
    pills.push(current.sponsor);
  }

  return pills;
}
```

**Step 2: Update `team/page.tsx` imports**

In `apps/web/app/(game)/league/[leagueId]/team/page.tsx`:
- Remove `LEVEL_THRESHOLDS`, `getLevelInfo`, `getProgressPct`, `getMaxSlots` (lines 6-43)
- Add: `import { getMaxSlots, getProgressPct, getNextLevel } from "@/lib/levels";`
- Replace `const { next } = getLevelInfo(level);` with `const next = getNextLevel(level);`
- The rest of the page still works — `next?.xp`, `progressPct`, `maxSlots` are unchanged.

**Step 3: Update `levels/page.tsx` imports**

In `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx`:
- Remove `LEVELS` array and `getProgressPct` function (lines 6-28)
- Add: `import { LEVELS, getProgressPct } from "@/lib/levels";`

**Step 4: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add apps/web/lib/levels.ts apps/web/app/\(game\)/league/\[leagueId\]/team/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/team/levels/page.tsx
git commit -m "refactor: extract shared level data + helpers into lib/levels.ts"
```

---

### Task 2: Create TeamLevelCard component

**Files:**
- Create: `apps/web/components/team-level-card.tsx`

**Step 1: Create the component**

Create `apps/web/components/team-level-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { getNextLevel, getProgressPct, getNewUnlocks } from "@/lib/levels";

interface TeamLevelCardProps {
  leagueId: string;
  currentLevel: number;
  currentXp: number;
  /** If true, hide "Team level" title and "All levels →" link (used in hero) */
  hideHeader?: boolean;
}

export function TeamLevelCard({
  leagueId,
  currentLevel,
  currentXp,
  hideHeader = false,
}: TeamLevelCardProps) {
  const next = getNextLevel(currentLevel);
  const nextLevelNum = next ? currentLevel + 1 : null;
  const progressPct = getProgressPct(currentXp, currentLevel);
  const nextUnlocks = next ? getNewUnlocks(currentLevel + 1) : [];

  const content = (
    <div
      className={`relative overflow-hidden rounded-xl p-4 transition-transform ${
        !hideHeader ? "hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]" : ""
      }`}
    >
      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 animate-mesh-slow"
        style={{
          backgroundColor: "#020617",
          backgroundImage: [
            "radial-gradient(circle at 20% 20%, #0b1120 0%, transparent 55%)",
            "radial-gradient(circle at 70% 25%, #1e293b 0%, transparent 50%)",
            "radial-gradient(circle at 30% 75%, rgba(6, 182, 212, 0.25) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 70%, rgba(34, 211, 238, 0.18) 0%, transparent 45%)",
          ].join(", "),
        }}
      />

      {/* Content */}
      <div className="relative z-10 space-y-3">
        {/* Header row: title + CTA */}
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-mid)]">
              Team level
            </span>
            <span className="text-xs text-[var(--text-low)]">
              All levels &rarr;
            </span>
          </div>
        )}

        {/* XP text */}
        <p className="text-xs text-[var(--text-mid)]">
          <span className="font-mono">
            {currentXp.toLocaleString()} / {next ? next.xp.toLocaleString() : currentXp.toLocaleString()}
          </span>{" "}
          XP
        </p>

        {/* Level badges + progress bar */}
        <div className="flex items-center gap-3">
          {/* Current level badge */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
            <span className="text-sm font-bold text-[var(--text-high)]">
              {currentLevel}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <Progress value={progressPct} />
          </div>

          {/* Next level badge */}
          {nextLevelNum && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
              <span className="text-sm font-bold text-[var(--text-ghost)]">
                {nextLevelNum}
              </span>
            </div>
          )}
        </div>

        {/* Unlock pills */}
        {nextUnlocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {nextUnlocks.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-[11px] text-[var(--text-mid)]"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        {/* Max level state */}
        {!next && (
          <p className="text-xs text-[var(--accent-default)]">
            Max level reached
          </p>
        )}
      </div>
    </div>
  );

  if (hideHeader) {
    return content;
  }

  return (
    <Link href={`/league/${leagueId}/team/levels`}>
      {content}
    </Link>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds (component not yet used, just compiles).

**Step 3: Commit**

```bash
git add apps/web/components/team-level-card.tsx
git commit -m "feat: create TeamLevelCard component with mesh gradient"
```

---

### Task 3: Replace Team Level section in My Team page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`

**Step 1: Update the Team Level section**

In `apps/web/app/(game)/league/[leagueId]/team/page.tsx`:

Add import at top:
```tsx
import { TeamLevelCard } from "@/components/team-level-card";
```

Replace the entire `{/* Team Level */}` section (lines 223-251) with:

```tsx
      {/* Team Level */}
      <div className="px-4">
        <TeamLevelCard
          leagueId={leagueId}
          currentLevel={level}
          currentXp={xp}
        />
      </div>
```

Remove the now-unused `Progress` import if no longer used elsewhere in this file. Check: `Progress` is not used anywhere else in `team/page.tsx` after this change — remove it.

Also remove the unused `next` variable (`const { next } = getLevelInfo(level)` → was replaced earlier, now also the `next?.xp` usage in the template is gone). Clean up: remove `getNextLevel` import if only used for `next` which is no longer needed.

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 3: Visual check**

Run: `pnpm dev` — navigate to `/league/{id}/team`. Verify:
- Mesh gradient card appears at the bottom
- "Team level" title and "All levels →" visible
- Level badges, progress bar, unlock pills render correctly
- Card is clickable and navigates to `/league/{id}/team/levels`
- Hover state: slight scale + cyan glow

**Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/page.tsx
git commit -m "feat: replace Team Level section with TeamLevelCard on My Team"
```

---

### Task 4: Rewrite Levels page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx`

**Step 1: Full rewrite**

Replace the entire file `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx` with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { TeamLevelCard } from "@/components/team-level-card";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getProgressPct, getNewUnlocks } from "@/lib/levels";

export default async function LevelsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">
          Please sign in to view levels.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(level, cumulative_xp)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;
  const currentLevel = team?.level ?? 1;
  const currentXp = team?.cumulative_xp ?? 0;

  return (
    <div className="min-h-screen">
      <BackHeader label="My Team" />

      {/* Hero — reuses TeamLevelCard without header */}
      <div className="px-4 pt-4">
        <TeamLevelCard
          leagueId={leagueId}
          currentLevel={currentLevel}
          currentXp={currentXp}
          hideHeader
        />
      </div>

      {/* All levels list */}
      <div className="px-4 pt-6">
        {LEVELS.map((lvl) => {
          const isDone = lvl.level < currentLevel;
          const isCurrent = lvl.level === currentLevel;
          const isFuture = lvl.level > currentLevel;
          const progressPct = isCurrent ? getProgressPct(currentXp, currentLevel) : 0;
          const nextLevel = lvl.level < LEVELS.length ? LEVELS[lvl.level] : null;
          const unlocks = getNewUnlocks(lvl.level);

          return (
            <div
              key={lvl.level}
              className={`py-4 ${
                lvl.level < LEVELS.length
                  ? "border-b border-[var(--border-subtle)]"
                  : ""
              }`}
            >
              {/* Level title + XP */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[15px] ${
                    isCurrent
                      ? "font-bold text-[var(--text-high)]"
                      : isFuture
                      ? "font-semibold text-[var(--text-low)]"
                      : "font-semibold text-[var(--text-high)]"
                  }`}
                >
                  Level {lvl.level}
                </span>
                <span
                  className={`text-xs font-mono ${
                    isCurrent
                      ? "text-[var(--accent-default)]"
                      : isFuture
                      ? "text-[var(--text-ghost)]"
                      : "text-[var(--text-low)]"
                  }`}
                >
                  {isCurrent
                    ? `${currentXp.toLocaleString()} / ${nextLevel ? nextLevel.xp.toLocaleString() : currentXp.toLocaleString()} XP`
                    : `${lvl.xp.toLocaleString()} XP`}
                </span>
              </div>

              {/* Progress bar for current level */}
              {isCurrent && (
                <div className="mt-2">
                  <Progress value={progressPct} />
                </div>
              )}

              {/* Unlock pills */}
              {unlocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unlocks.map((pill) => (
                    <span
                      key={pill}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                        isFuture
                          ? "border-[var(--border-subtle)] text-[var(--text-ghost)]"
                          : "border-[var(--border-default)] text-[var(--text-mid)]"
                      }`}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 3: Visual check**

Run: `pnpm dev` — navigate to `/league/{id}/team/levels`. Verify:
- Back header "← My Team" (no sub-tabs)
- Hero with mesh gradient, badges, progress bar, pills
- List of 10 levels with dividers
- Past levels: normal text, XP on right
- Current level: bold, accent color XP, progress bar
- Future levels: dimmed text + dimmed pills
- No padlocks, no checkmarks, no left border bar, no level names

**Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/levels/page.tsx
git commit -m "feat: rewrite Levels page with gradient hero + divider list"
```

---

### Task 5: Fix bid card background (MT-15)

**Files:**
- Modify: `apps/web/components/rider-card.tsx:80-83`

**Step 1: Change bid active background**

In `apps/web/components/rider-card.tsx`, replace lines 80-83:

```tsx
  const bgClass =
    bidState === "active"
      ? "bg-[var(--bid-active-bg)]"
      : "";
```

With:

```tsx
  const bgClass =
    bidState === "active"
      ? "bg-[var(--bg-surface-hover)]"
      : "";
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 3: Visual check**

Run: `pnpm dev` — navigate to My Team with active bids. Verify:
- Bid cards use the same background as hover state (subtle dark surface)
- No cyan-tinted background
- Cyan input field is still visible as the bid indicator

**Step 4: Commit**

```bash
git add apps/web/components/rider-card.tsx
git commit -m "fix: use surface-hover bg for bid cards instead of cyan tint"
```

---

### Task 6: Final build verification + cleanup

**Step 1: Full build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with no errors.

**Step 2: Lint**

Run: `pnpm lint`
Expected: No new lint errors.

**Step 3: Check for dead code**

Verify these are removed:
- `Check` and `Lock` imports from `lucide-react` in levels/page.tsx (should be gone after Task 4 rewrite)
- Old `LEVEL_THRESHOLDS` in team/page.tsx (should be gone after Task 1)
- Old `LEVELS` + `getProgressPct` in levels/page.tsx (should be gone after Task 4)

**Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: clean up dead imports after team level redesign"
```
