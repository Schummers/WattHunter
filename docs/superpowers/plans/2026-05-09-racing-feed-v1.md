# Racing Feed V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `HomeFeed` on the league dashboard with a chronological `RaceFeed` that shows all races of the current WT phase (past, today, future) with team-by-team XP/bonus breakdown for the current stage, plus inline Nemesis/Remontada cards and an end-of-feed banner pointing to the next phase Round 1.

**Architecture:** Server-side data loader aggregates `rider_xp_daily` + `race_results` + `gt_tactic_activations` + `remontada_boosts` + next-phase auction date into a list of date-grouped feed items. A client-side `<RaceFeed>` component renders a vertical list with auto-scroll positioning on the Today card. No DB migration. No nav refonte. Lobby view unchanged.

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Tailwind v4 (design system v3 tokens) · Supabase SSR client · Vitest + @testing-library/react (jsdom per-file directive) · Lucide icons.

**Spec :** `docs/superpowers/specs/2026-05-09-racing-feed-v1-implementation.md`

---

## Pre-flight

- [ ] **Step 0.1: Verify branch and clean working tree**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
git status
git branch --show-current
```

Expected: working tree clean (or only the spec docs uncommitted), branch `main` (or a feature branch the user wants).

- [ ] **Step 0.2: If on main, create a feature branch**

```bash
git checkout -b feature/racing-feed-v1
```

- [ ] **Step 0.3: Sanity check — tests pass on baseline**

```bash
cd apps/web && pnpm test --run --reporter=basic 2>&1 | tail -20
```

Expected: existing test suite passes (157 tests / 17 files per memory). Note any pre-existing failures so they aren't confused with new ones.

- [ ] **Step 0.4: Sanity check — typecheck and lint pass on baseline**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck && pnpm lint
```

Expected: pass. If failing, report and fix before proceeding.

---

## File Structure

This plan creates **15 new files** and **modifies 1 existing file**.

### New files (under `apps/web/`)

```
lib/race-feed-types.ts                                  Types shared across feed code
lib/race-feed-helpers.ts                                Pure utilities (race type detection, formatters)
lib/__tests__/race-feed-helpers.test.ts                 Helpers unit tests
lib/get-race-feed-data.ts                               Server-only data loader
lib/__tests__/get-race-feed-data.test.ts                Loader tests with mocked Supabase

components/race-team-breakdown.tsx                      Shared sub-component used by Past expanded + Today
components/race-card-past.tsx                           Collapsed-by-default past stage card
components/race-card-today.tsx                          Expanded-by-default today stage card
components/race-card-future.tsx                         Dashed future stage card with + button
components/race-feed-nemesis-card.tsx                   Nemesis card intercalee
components/race-feed-remontada-card.tsx                 Remontada boost notification card
components/race-feed-phase-end-banner.tsx               End-of-feed banner with next phase Round 1 date
components/race-feed-date-group.tsx                     Date label + cards wrapper
components/race-feed.tsx                                Root component with auto-scroll behavior
components/__tests__/race-card-past.test.tsx            (and one test file per component)
components/__tests__/race-card-today.test.tsx
components/__tests__/race-card-future.test.tsx
components/__tests__/race-team-breakdown.test.tsx
components/__tests__/race-feed-nemesis-card.test.tsx
components/__tests__/race-feed-remontada-card.test.tsx
components/__tests__/race-feed-phase-end-banner.test.tsx
components/__tests__/race-feed.test.tsx
```

### Modified files

```
app/(game)/league/[leagueId]/page.tsx                   Replace HomeFeed call with RaceFeed
```

The existing `app/(game)/league/[leagueId]/home-feed.tsx` is **not deleted** in this plan — keep it for reference until V2 nav refonte. Just stop calling it.

### Naming convention rationale

- `race-feed-*.tsx` for cards that only appear in the feed (Nemesis, Remontada, PhaseEndBanner) — they aren't reused elsewhere
- `race-card-*.tsx` for the 3 main stage cards (past/today/future) — primary domain object
- `race-team-breakdown.tsx` — reusable sub-component (Past expanded + Today both render it)

---

## Task 1: Types + helpers

**Files:**
- Create: `apps/web/lib/race-feed-types.ts`
- Create: `apps/web/lib/race-feed-helpers.ts`
- Test: `apps/web/lib/__tests__/race-feed-helpers.test.ts`

**Goal:** Define all shared types and pure utilities. No React, no Supabase. Easy to unit test.

- [ ] **Step 1.1: Create types file**

Create `apps/web/lib/race-feed-types.ts`:

```ts
// Types shared across the Racing Feed components and data layer.
// No imports from React or server-only libs — usable on both sides.

export type RaceCardStatus = "past" | "today" | "future";

export type RaceType = "stage" | "classic";

export type GtRole = "GC" | "SPR" | "HUN" | "DOM";

export type RiderRaceResult = {
  riderId: string;
  riderShortName: string; // e.g. "T. Pogacar"
  role: GtRole | null;     // null when phase is not a GT
  xpGained: number;        // sum of rider_xp_daily.xp_gained for the race
  bonusEur: number;        // sum of sponsor_bonuses.amount for this rider on this race
};

export type TeamRaceResult = {
  teamId: string;
  teamName: string;
  isMyTeam: boolean;
  totalXp: number;          // sum of riders xpGained
  totalBonusEur: number;    // sum of riders bonusEur
  riders: RiderRaceResult[]; // only riders with xpGained >= 1
};

export type RaceData = {
  raceSlug: string;
  raceName: string;          // "Giro d'Italia - Stage 2" raw from DB
  raceTitle: string;         // formatted: "Giro - Etape 2" or "Paris-Roubaix"
  parentRaceSlug: string | null;  // for stages: "race/giro-d-italia/2026"; for classics: null
  parentRaceLabel: string | null; // for stages: "Giro"; for classics: null
  raceDate: string;          // ISO yyyy-mm-dd
  raceType: RaceType;
  status: RaceCardStatus;
  isGtPhase: boolean;        // true if current phase id in {4, 6, 8}
};

export type RaceDataWithBreakdown = RaceData & {
  teams: TeamRaceResult[];   // sorted by totalXp desc; only teams with totalXp >= 1
  winnerTeamId: string | null;
  winnerTeamInitials: string | null; // 2-letter for avatar fallback
};

export type NemesisData = {
  activationId: string;
  raceSlug: string;
  attackerTeamName: string;
  attackerRiderShortName: string;  // resolved rider, may be "?" if not yet resolved
  targetTeamName: string;
  targetRiderShortName: string;
  outcome: "attacker_won" | "target_won" | "no_resolution" | "pending";
  isMyTeamAttacker: boolean;
};

export type RemontadaData = {
  boostId: string;
  teamId: string;
  teamName: string;
  isMyTeam: boolean;
  multiplier: number;       // e.g. 2.0 -> displayed as "+100%"
  daysRemaining: number;    // computed from triggered_at_stage / expires_after_stage
  triggeredAt: string;      // ISO date for grouping
};

export type RaceFeedCard =
  | { type: "past"; race: RaceDataWithBreakdown }
  | { type: "today"; race: RaceDataWithBreakdown }
  | { type: "future"; race: RaceData }
  | { type: "nemesis"; data: NemesisData; raceSlug: string }
  | { type: "remontada"; data: RemontadaData };

export type RaceFeedDateGroup = {
  date: string;              // ISO yyyy-mm-dd
  cards: RaceFeedCard[];     // 1+ cards on the same date
};

export type RaceFeedPayload = {
  groups: RaceFeedDateGroup[];          // sorted by date asc
  nextPhaseRound1Date: string | null;   // ISO; null if end of season
  nextPhaseLabel: string | null;        // "Pre-Tour", "Vuelta...", null if EOS
};
```

- [ ] **Step 1.2: Create helpers test file**

Create `apps/web/lib/__tests__/race-feed-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  detectRaceType,
  getParentRaceSlug,
  getParentRaceLabel,
  formatRaceTitle,
  shortenRiderName,
  formatBonusEur,
  formatRaceDateLabel,
} from "../race-feed-helpers";

describe("detectRaceType", () => {
  it("returns 'stage' for slugs ending in /stage-N", () => {
    expect(detectRaceType("race/giro-d-italia/2026/stage-3")).toBe("stage");
    expect(detectRaceType("race/tour-de-france/2026/stage-21")).toBe("stage");
  });

  it("returns 'classic' for slugs without stage suffix", () => {
    expect(detectRaceType("race/paris-roubaix/2026")).toBe("classic");
    expect(detectRaceType("race/liege-bastogne-liege/2026")).toBe("classic");
  });

  it("treats /gc and /results suffixes as classic for V1", () => {
    expect(detectRaceType("race/tour-romandie/2026/gc/results")).toBe("classic");
  });
});

describe("getParentRaceSlug", () => {
  it("returns the parent slug for a stage", () => {
    expect(getParentRaceSlug("race/giro-d-italia/2026/stage-3")).toBe(
      "race/giro-d-italia/2026"
    );
  });

  it("returns null for a classic", () => {
    expect(getParentRaceSlug("race/paris-roubaix/2026")).toBeNull();
  });
});

describe("getParentRaceLabel", () => {
  it("returns short label for known GTs", () => {
    expect(getParentRaceLabel("race/giro-d-italia/2026")).toBe("Giro");
    expect(getParentRaceLabel("race/tour-de-france/2026")).toBe("Tour");
    expect(getParentRaceLabel("race/vuelta-a-espana/2026")).toBe("Vuelta");
  });

  it("returns null for unknown parents", () => {
    expect(getParentRaceLabel("race/some-week-race/2026")).toBeNull();
  });
});

describe("formatRaceTitle", () => {
  it("formats a stage title as '<ParentLabel> - Etape N'", () => {
    expect(
      formatRaceTitle({
        raceType: "stage",
        raceName: "Giro d'Italia - Stage 2",
        raceSlug: "race/giro-d-italia/2026/stage-2",
        parentRaceLabel: "Giro",
      })
    ).toBe("Giro · Étape 2");
  });

  it("falls back to raceName for classics", () => {
    expect(
      formatRaceTitle({
        raceType: "classic",
        raceName: "Paris-Roubaix",
        raceSlug: "race/paris-roubaix/2026",
        parentRaceLabel: null,
      })
    ).toBe("Paris-Roubaix");
  });
});

describe("shortenRiderName", () => {
  it("shortens a 'First Last' name to 'F. Last'", () => {
    expect(shortenRiderName("Tadej Pogacar")).toBe("T. Pogacar");
    expect(shortenRiderName("Mathieu van der Poel")).toBe("M. van der Poel");
  });

  it("returns single-word names unchanged", () => {
    expect(shortenRiderName("Pogacar")).toBe("Pogacar");
  });
});

describe("formatBonusEur", () => {
  it("formats a positive amount with thousands separator and EUR sign", () => {
    expect(formatBonusEur(12000)).toBe("+12 000€");
    expect(formatBonusEur(8500)).toBe("+8 500€");
  });

  it("returns the em-dash for zero amounts", () => {
    expect(formatBonusEur(0)).toBe("—");
  });
});

describe("formatRaceDateLabel", () => {
  it("formats an ISO date as French short label", () => {
    expect(formatRaceDateLabel("2026-05-04")).toBe("4 mai");
    expect(formatRaceDateLabel("2026-05-15")).toBe("15 mai");
  });
});
```

- [ ] **Step 1.3: Run tests, expect them to fail**

```bash
cd apps/web && pnpm test --run lib/__tests__/race-feed-helpers.test.ts 2>&1 | tail -30
```

Expected: FAIL with "Cannot find module" errors.

- [ ] **Step 1.4: Implement helpers**

Create `apps/web/lib/race-feed-helpers.ts`:

```ts
import type { RaceType } from "./race-feed-types";

const STAGE_SUFFIX_RE = /\/stage-(\d+)$/;

export function detectRaceType(raceSlug: string): RaceType {
  return STAGE_SUFFIX_RE.test(raceSlug) ? "stage" : "classic";
}

export function getParentRaceSlug(raceSlug: string): string | null {
  const m = raceSlug.match(/^(.+)\/stage-\d+$/);
  return m ? m[1] : null;
}

const PARENT_LABEL_BY_PREFIX: Record<string, string> = {
  "race/giro-d-italia": "Giro",
  "race/tour-de-france": "Tour",
  "race/vuelta-a-espana": "Vuelta",
};

export function getParentRaceLabel(parentRaceSlug: string): string | null {
  for (const [prefix, label] of Object.entries(PARENT_LABEL_BY_PREFIX)) {
    if (parentRaceSlug.startsWith(prefix)) return label;
  }
  return null;
}

export function getStageNumber(raceSlug: string): number | null {
  const m = raceSlug.match(STAGE_SUFFIX_RE);
  return m ? parseInt(m[1], 10) : null;
}

export function formatRaceTitle(input: {
  raceType: RaceType;
  raceName: string;
  raceSlug: string;
  parentRaceLabel: string | null;
}): string {
  if (input.raceType === "stage") {
    const stage = getStageNumber(input.raceSlug);
    const parent = input.parentRaceLabel ?? input.raceName.split(" - ")[0];
    return `${parent} · Étape ${stage ?? "?"}`;
  }
  return input.raceName;
}

export function shortenRiderName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const initial = parts[0][0]!.toUpperCase();
  const lastName = parts.slice(1).join(" ");
  return `${initial}. ${lastName}`;
}

export function teamInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatBonusEur(amount: number): string {
  if (amount <= 0) return "—"; // em-dash
  const withSpaces = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `+${withSpaces}€`;
}

export function formatXp(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

const FRENCH_MONTHS_SHORT = [
  "janv.",
  "fév.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export function formatRaceDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  const monthLabel = FRENCH_MONTHS_SHORT[(month ?? 1) - 1];
  return `${day} ${monthLabel}`;
}

const FRENCH_LONG_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatRound1DateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  return `${day} ${FRENCH_LONG_MONTHS[(month ?? 1) - 1]}`;
}
```

Note: `formatRaceDateLabel` returns `"4 mai"` (short month) — used inside cards. `formatRound1DateLabel` returns `"4 mai"` too in this case but uses long month names like `"février"` for clarity in the banner.

- [ ] **Step 1.5: Run tests to verify they pass**

```bash
cd apps/web && pnpm test --run lib/__tests__/race-feed-helpers.test.ts 2>&1 | tail -20
```

Expected: All 15+ tests PASS.

- [ ] **Step 1.6: Typecheck**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck
```

Expected: no errors related to the new files.

- [ ] **Step 1.7: Commit**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
git add apps/web/lib/race-feed-types.ts apps/web/lib/race-feed-helpers.ts apps/web/lib/__tests__/race-feed-helpers.test.ts
git commit -m "feat(racing-feed): add types and pure helpers"
```

---

## Task 2: RaceTeamBreakdown component

**Files:**
- Create: `apps/web/components/race-team-breakdown.tsx`
- Test: `apps/web/components/__tests__/race-team-breakdown.test.tsx`

**Goal:** Shared subcomponent that renders the per-team riders breakdown (used by Past when expanded and by Today). Pure presentational — takes `teams: TeamRaceResult[]` as input.

- [ ] **Step 2.1: Write the test file**

Create `apps/web/components/__tests__/race-team-breakdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceTeamBreakdown } from "../race-team-breakdown";
import type { TeamRaceResult } from "@/lib/race-feed-types";

const sampleTeams: TeamRaceResult[] = [
  {
    teamId: "t1",
    teamName: "Team Astrid",
    isMyTeam: false,
    totalXp: 340,
    totalBonusEur: 12000,
    riders: [
      { riderId: "r1", riderShortName: "T. Pogacar", role: "GC", xpGained: 180, bonusEur: 12000 },
      { riderId: "r2", riderShortName: "J. Vingegaard", role: null, xpGained: 90, bonusEur: 0 },
      { riderId: "r3", riderShortName: "E. Mas", role: "DOM", xpGained: 70, bonusEur: 0 },
    ],
  },
  {
    teamId: "me",
    teamName: "Mon équipe",
    isMyTeam: true,
    totalXp: 280,
    totalBonusEur: 8000,
    riders: [
      { riderId: "r4", riderShortName: "M. van Aert", role: "SPR", xpGained: 120, bonusEur: 8000 },
      { riderId: "r5", riderShortName: "J. Almeida", role: "DOM", xpGained: 90, bonusEur: 0 },
    ],
  },
];

describe("RaceTeamBreakdown", () => {
  it("renders all teams with their riders", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("Team Astrid")).toBeInTheDocument();
    expect(screen.getByText(/Mon équipe/)).toBeInTheDocument();
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
    expect(screen.getByText("M. van Aert")).toBeInTheDocument();
  });

  it("highlights my team with a star", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    // The component should put the star next to my team's name.
    expect(screen.getByText(/★/)).toBeInTheDocument();
  });

  it("formats team total bonus in euros and total XP with + prefix", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("+12 000€")).toBeInTheDocument();
    expect(screen.getByText("+340")).toBeInTheDocument();
    expect(screen.getByText("+8 000€")).toBeInTheDocument();
    expect(screen.getByText("+280")).toBeInTheDocument();
  });

  it("renders em-dash for riders without bonus", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    // Pogacar bonus row shows +12 000 EUR but Vingegaard shows em-dash.
    // Use getAllByText since multiple em-dashes can exist (one per rider without bonus).
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders rider role badges only when isGtPhase is true", () => {
    const { rerender } = render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("GC")).toBeInTheDocument();
    expect(screen.getByText("SPR")).toBeInTheDocument();

    rerender(<RaceTeamBreakdown teams={sampleTeams} isGtPhase={false} />);
    expect(screen.queryByText("GC")).not.toBeInTheDocument();
    expect(screen.queryByText("SPR")).not.toBeInTheDocument();
  });

  it("does not render teams with empty riders array", () => {
    const teamsWithEmpty: TeamRaceResult[] = [
      ...sampleTeams,
      { teamId: "empty", teamName: "Pelu's Crew", isMyTeam: false, totalXp: 0, totalBonusEur: 0, riders: [] },
    ];
    render(<RaceTeamBreakdown teams={teamsWithEmpty} isGtPhase />);
    expect(screen.queryByText("Pelu's Crew")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-team-breakdown.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement the component**

Create `apps/web/components/race-team-breakdown.tsx`:

```tsx
import type { TeamRaceResult } from "@/lib/race-feed-types";
import { formatBonusEur, formatXp } from "@/lib/race-feed-helpers";

type Props = {
  teams: TeamRaceResult[];
  isGtPhase: boolean;
};

export function RaceTeamBreakdown({ teams, isGtPhase }: Props) {
  const visibleTeams = teams.filter((t) => t.riders.length > 0);

  return (
    <div className="flex flex-col gap-1.5">
      {visibleTeams.map((team) => (
        <TeamSection key={team.teamId} team={team} isGtPhase={isGtPhase} />
      ))}
    </div>
  );
}

function TeamSection({ team, isGtPhase }: { team: TeamRaceResult; isGtPhase: boolean }) {
  return (
    <div className="flex flex-col">
      {/* Team header */}
      <div className="flex items-baseline justify-between py-1">
        <span
          className={`font-bold uppercase tracking-wider text-[length:var(--type-caption)] ${
            team.isMyTeam ? "text-[var(--accent-default)]" : "text-[var(--text-high)]"
          }`}
        >
          {team.teamName}
          {team.isMyTeam && <span className="ml-1">★</span>}
        </span>
        <span className="flex items-center gap-3 font-mono">
          <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)]">
            {formatBonusEur(team.totalBonusEur)}
          </span>
          <span className="text-[length:var(--type-stat-small)] font-bold text-[var(--accent-highlight)]">
            {formatXp(team.totalXp)}
          </span>
        </span>
      </div>

      {/* Rider rows */}
      <div className="flex flex-col">
        {team.riders.map((rider) => (
          <div
            key={rider.riderId}
            className="flex items-center gap-2 pl-3 py-0.5"
          >
            <span className="flex-1 truncate text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              {rider.riderShortName}
            </span>
            {isGtPhase && rider.role && (
              <span className="rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[var(--text-mid)] bg-[var(--bg-surface-active)]">
                {rider.role}
              </span>
            )}
            <span className="font-mono text-[10px] font-semibold text-[var(--success)] min-w-[68px] text-right">
              {formatBonusEur(rider.bonusEur)}
            </span>
            <span className="font-mono text-[length:var(--type-caption)] font-bold text-[var(--accent-highlight)] min-w-[44px] text-right">
              {formatXp(rider.xpGained)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

> Note on the `★` star: written as a string literal so it doesn't get mistaken for a JSX expression. In the rendered output it shows as ★.

- [ ] **Step 2.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-team-breakdown.test.tsx 2>&1 | tail -20
```

Expected: All 6 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add apps/web/components/race-team-breakdown.tsx apps/web/components/__tests__/race-team-breakdown.test.tsx
git commit -m "feat(racing-feed): add RaceTeamBreakdown shared component"
```

---

## Task 3: RaceCardPast (collapsed by default)

**Files:**
- Create: `apps/web/components/race-card-past.tsx`
- Test: `apps/web/components/__tests__/race-card-past.test.tsx`

**Goal:** Card showing a past race in collapsed form (title + winner avatar). Tap toggles to show the full breakdown using `<RaceTeamBreakdown />`.

- [ ] **Step 3.1: Write the test file**

Create `apps/web/components/__tests__/race-card-past.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardPast } from "../race-card-past";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";

const sampleRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-1",
  raceName: "Giro d'Italia - Stage 1",
  raceTitle: "Giro · Étape 1",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-04",
  raceType: "stage",
  status: "past",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  teams: [
    {
      teamId: "t1",
      teamName: "Team Astrid",
      isMyTeam: false,
      totalXp: 340,
      totalBonusEur: 12000,
      riders: [
        { riderId: "r1", riderShortName: "T. Pogacar", role: "GC", xpGained: 180, bonusEur: 12000 },
      ],
    },
  ],
};

describe("RaceCardPast", () => {
  it("renders title and winner avatar (collapsed)", () => {
    render(<RaceCardPast race={sampleRace} />);
    expect(screen.getByText("Giro · Étape 1")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
    // breakdown not shown when collapsed
    expect(screen.queryByText("T. Pogacar")).not.toBeInTheDocument();
  });

  it("expands the breakdown on tap", () => {
    render(<RaceCardPast race={sampleRace} />);
    const trigger = screen.getByRole("button", { name: /Giro/i });
    fireEvent.click(trigger);
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
    expect(screen.getByText("Team Astrid")).toBeInTheDocument();
  });

  it("collapses again on second tap", () => {
    render(<RaceCardPast race={sampleRace} />);
    const trigger = screen.getByRole("button", { name: /Giro/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("T. Pogacar")).not.toBeInTheDocument();
  });

  it("shows fallback dash avatar when there is no winner", () => {
    const noWinner = { ...sampleRace, winnerTeamId: null, winnerTeamInitials: null, teams: [] };
    render(<RaceCardPast race={noWinner} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-past.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement the component**

Create `apps/web/components/race-card-past.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";

type Props = { race: RaceDataWithBreakdown };

export function RaceCardPast({ race }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-3.5 py-3 text-left"
      >
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          {race.raceTitle}
        </span>
        <WinnerCircle initials={race.winnerTeamInitials} />
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-3.5 py-3">
          <RaceTeamBreakdown teams={race.teams} isGtPhase={race.isGtPhase} />
        </div>
      )}
    </div>
  );
}

function WinnerCircle({ initials }: { initials: string | null }) {
  if (!initials) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)]"
        aria-hidden="true"
      >
        {"—"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cta-gradient,var(--accent-default))] text-[10px] font-extrabold text-[var(--cta-text)]"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-past.test.tsx 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/components/race-card-past.tsx apps/web/components/__tests__/race-card-past.test.tsx
git commit -m "feat(racing-feed): add RaceCardPast (collapsed/expandable)"
```

---

## Task 4: RaceCardToday (expanded by default)

**Files:**
- Create: `apps/web/components/race-card-today.tsx`
- Test: `apps/web/components/__tests__/race-card-today.test.tsx`

**Goal:** Card for today's race. Always expanded. Includes the winner avatar, the breakdown, and (for GT phases) a "Voir le classement GC" link.

- [ ] **Step 4.1: Write the test file**

Create `apps/web/components/__tests__/race-card-today.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardToday } from "../race-card-today";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";

const baseRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-2",
  raceName: "Giro d'Italia - Stage 2",
  raceTitle: "Giro · Étape 2",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-05",
  raceType: "stage",
  status: "today",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  teams: [
    {
      teamId: "t1",
      teamName: "Team Astrid",
      isMyTeam: false,
      totalXp: 340,
      totalBonusEur: 12000,
      riders: [
        { riderId: "r1", riderShortName: "T. Pogacar", role: "GC", xpGained: 180, bonusEur: 12000 },
      ],
    },
  ],
};

describe("RaceCardToday", () => {
  it("renders title, winner avatar and breakdown", () => {
    render(<RaceCardToday race={baseRace} leagueId="league-1" />);
    expect(screen.getByText("Giro · Étape 2")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
  });

  it("renders 'Voir le classement GC du Giro' link for stage races (GT)", () => {
    render(<RaceCardToday race={baseRace} leagueId="league-1" />);
    const link = screen.getByRole("link", { name: /Voir le classement GC du Giro/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/league/league-1/ranking?race=race%2Fgiro-d-italia%2F2026"
    );
  });

  it("does not render GC link for classics (one-day races)", () => {
    const classic: RaceDataWithBreakdown = {
      ...baseRace,
      raceSlug: "race/paris-roubaix/2026",
      raceName: "Paris-Roubaix",
      raceTitle: "Paris-Roubaix",
      raceType: "classic",
      parentRaceSlug: null,
      parentRaceLabel: null,
      isGtPhase: false,
    };
    render(<RaceCardToday race={classic} leagueId="league-1" />);
    expect(screen.queryByRole("link", { name: /classement GC/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-today.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement the component**

Create `apps/web/components/race-card-today.tsx`:

```tsx
import Link from "next/link";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";

type Props = {
  race: RaceDataWithBreakdown;
  leagueId: string;
};

export function RaceCardToday({ race, leagueId }: Props) {
  const showGcLink = race.raceType === "stage" && race.parentRaceSlug && race.parentRaceLabel;

  return (
    <div className="rounded-[10px] border border-[var(--border-hover)] bg-[var(--bg-surface)] px-3.5 py-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          {race.raceTitle}
        </span>
        <WinnerAvatar initials={race.winnerTeamInitials} />
      </div>
      {/* Divider */}
      <div className="my-3 h-px bg-[var(--border-subtle)]" />
      {/* Breakdown */}
      <RaceTeamBreakdown teams={race.teams} isGtPhase={race.isGtPhase} />
      {/* GC link */}
      {showGcLink && (
        <>
          <div className="my-3 h-px bg-[var(--border-subtle)]" />
          <Link
            href={`/league/${leagueId}/ranking?race=${encodeURIComponent(race.parentRaceSlug!)}`}
            className="block w-full text-center rounded-md px-3 py-2 text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] bg-[rgba(6,182,212,0.06)] hover:bg-[rgba(6,182,212,0.10)] transition-colors"
          >
            Voir le classement GC du {race.parentRaceLabel} →
          </Link>
        </>
      )}
    </div>
  );
}

function WinnerAvatar({ initials }: { initials: string | null }) {
  if (!initials) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)]"
        aria-hidden="true"
      >
        {"—"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold text-[var(--cta-text)]"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-today.test.tsx 2>&1 | tail -20
```

Expected: All 3 tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/components/race-card-today.tsx apps/web/components/__tests__/race-card-today.test.tsx
git commit -m "feat(racing-feed): add RaceCardToday with GC link"
```

---

## Task 5: RaceCardFuture (dashed)

**Files:**
- Create: `apps/web/components/race-card-future.tsx`
- Test: `apps/web/components/__tests__/race-card-future.test.tsx`

**Goal:** Card for an upcoming race. Dashed border, opacity reduced. Shows a `+` button (linking to the tactics page) only for GT phases. Classics show no button (just a placeholder dash).

- [ ] **Step 5.1: Write the test file**

Create `apps/web/components/__tests__/race-card-future.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardFuture } from "../race-card-future";
import type { RaceData } from "@/lib/race-feed-types";

const gtStage: RaceData = {
  raceSlug: "race/giro-d-italia/2026/stage-3",
  raceName: "Giro d'Italia - Stage 3",
  raceTitle: "Giro · Étape 3",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-06",
  raceType: "stage",
  status: "future",
  isGtPhase: true,
};

const classic: RaceData = {
  raceSlug: "race/paris-roubaix/2026",
  raceName: "Paris-Roubaix",
  raceTitle: "Paris-Roubaix",
  parentRaceSlug: null,
  parentRaceLabel: null,
  raceDate: "2026-04-12",
  raceType: "classic",
  status: "future",
  isGtPhase: false,
};

describe("RaceCardFuture", () => {
  it("renders title", () => {
    render(<RaceCardFuture race={gtStage} leagueId="league-1" />);
    expect(screen.getByText("Giro · Étape 3")).toBeInTheDocument();
  });

  it("renders + button linking to tactics for GT phases", () => {
    render(<RaceCardFuture race={gtStage} leagueId="league-1" />);
    const link = screen.getByRole("link", { name: /Placer une tactique/ });
    expect(link).toHaveAttribute(
      "href",
      "/league/league-1/team/gt/tactics?race=race%2Fgiro-d-italia%2F2026%2Fstage-3"
    );
  });

  it("does not render + button for classics", () => {
    render(<RaceCardFuture race={classic} leagueId="league-1" />);
    expect(screen.queryByRole("link", { name: /Placer une tactique/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-future.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement the component**

Create `apps/web/components/race-card-future.tsx`:

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import type { RaceData } from "@/lib/race-feed-types";

type Props = {
  race: RaceData;
  leagueId: string;
};

export function RaceCardFuture({ race, leagueId }: Props) {
  const showTacticButton = race.isGtPhase && race.raceType === "stage";

  return (
    <div className="rounded-[10px] border border-dashed border-[var(--border-default)]/70 bg-[var(--bg-app)] px-3.5 py-3 flex items-center justify-between">
      <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]/85">
        {race.raceTitle}
      </span>
      {showTacticButton ? (
        <Link
          href={`/league/${leagueId}/team/gt/tactics?race=${encodeURIComponent(race.raceSlug)}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent-default)]/30 bg-[rgba(6,182,212,0.10)] text-[var(--accent-default)] hover:bg-[rgba(6,182,212,0.18)] transition-colors"
          aria-label="Placer une tactique"
        >
          <Plus size={14} />
        </Link>
      ) : (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)]"
          aria-hidden="true"
        >
          {"—"}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-future.test.tsx 2>&1 | tail -20
```

Expected: All 3 tests PASS.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/components/race-card-future.tsx apps/web/components/__tests__/race-card-future.test.tsx
git commit -m "feat(racing-feed): add RaceCardFuture (dashed) with tactic link for GT"
```

---

## Task 6: NemesisCard

**Files:**
- Create: `apps/web/components/race-feed-nemesis-card.tsx`
- Test: `apps/web/components/__tests__/race-feed-nemesis-card.test.tsx`

**Goal:** Inline card showing a Nemesis activation under its stage. Color-coded outcome (green if my team won, red if lost, neutral otherwise).

- [ ] **Step 6.1: Write the test file**

Create `apps/web/components/__tests__/race-feed-nemesis-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedNemesisCard } from "../race-feed-nemesis-card";
import type { NemesisData } from "@/lib/race-feed-types";

const winData: NemesisData = {
  activationId: "act-1",
  raceSlug: "race/giro-d-italia/2026/stage-2",
  attackerTeamName: "Mon équipe",
  attackerRiderShortName: "T. Pogacar",
  targetTeamName: "Team Astrid",
  targetRiderShortName: "J. Vingegaard",
  outcome: "attacker_won",
  isMyTeamAttacker: true,
};

describe("RaceFeedNemesisCard", () => {
  it("renders attacker and target rider names", () => {
    render(<RaceFeedNemesisCard data={winData} />);
    expect(screen.getByText(/T\. Pogacar/)).toBeInTheDocument();
    expect(screen.getByText(/J\. Vingegaard/)).toBeInTheDocument();
  });

  it("renders 'win' outcome with success color when my team attacked and won", () => {
    render(<RaceFeedNemesisCard data={winData} />);
    expect(screen.getByText(/→ Mon équipe/)).toBeInTheDocument();
  });

  it("renders 'loss' outcome when my team attacked but target won", () => {
    render(
      <RaceFeedNemesisCard data={{ ...winData, outcome: "target_won" }} />
    );
    expect(screen.getByText(/→ Team Astrid/)).toBeInTheDocument();
  });

  it("renders 'pending' status when not yet resolved", () => {
    render(
      <RaceFeedNemesisCard data={{ ...winData, outcome: "pending" }} />
    );
    expect(screen.getByText(/En attente/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-nemesis-card.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement the component**

Create `apps/web/components/race-feed-nemesis-card.tsx`:

```tsx
import { Swords } from "lucide-react";
import type { NemesisData } from "@/lib/race-feed-types";

type Props = { data: NemesisData };

export function RaceFeedNemesisCard({ data }: Props) {
  const myTeamWon =
    (data.isMyTeamAttacker && data.outcome === "attacker_won") ||
    (!data.isMyTeamAttacker && data.outcome === "target_won");
  const myTeamLost =
    (data.isMyTeamAttacker && data.outcome === "target_won") ||
    (!data.isMyTeamAttacker && data.outcome === "attacker_won");

  let outcomeText = "En attente";
  let outcomeClass = "text-[var(--text-mid)]";
  if (data.outcome === "attacker_won") {
    outcomeText = `→ ${data.attackerTeamName}`;
    outcomeClass = myTeamWon ? "text-[var(--success)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "target_won") {
    outcomeText = `→ ${data.targetTeamName}`;
    outcomeClass = myTeamLost ? "text-[var(--danger)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "no_resolution") {
    outcomeText = "Pas de résolution";
    outcomeClass = "text-[var(--text-mid)]";
  }

  return (
    <div className="rounded-[10px] border bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.20)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Swords size={14} className="text-[var(--danger)]" aria-hidden="true" />
        <span>
          Nemesis · {data.attackerRiderShortName} VS {data.targetRiderShortName}
        </span>
      </div>
      <div className={`mt-1 text-[length:var(--type-caption)] font-medium ${outcomeClass}`}>
        {outcomeText}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-nemesis-card.test.tsx 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/components/race-feed-nemesis-card.tsx apps/web/components/__tests__/race-feed-nemesis-card.test.tsx
git commit -m "feat(racing-feed): add Nemesis card (inline)"
```

---

## Task 7: RemontadaCard

**Files:**
- Create: `apps/web/components/race-feed-remontada-card.tsx`
- Test: `apps/web/components/__tests__/race-feed-remontada-card.test.tsx`

**Goal:** Inline card showing a Remontada boost activation.

- [ ] **Step 7.1: Write the test file**

Create `apps/web/components/__tests__/race-feed-remontada-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedRemontadaCard } from "../race-feed-remontada-card";
import type { RemontadaData } from "@/lib/race-feed-types";

const data: RemontadaData = {
  boostId: "b1",
  teamId: "t1",
  teamName: "Pelu's Crew",
  isMyTeam: false,
  multiplier: 2.0,
  daysRemaining: 3,
  triggeredAt: "2026-05-06",
};

describe("RaceFeedRemontadaCard", () => {
  it("renders team name and boost duration", () => {
    render(<RaceFeedRemontadaCard data={data} />);
    expect(screen.getByText(/Pelu's Crew/)).toBeInTheDocument();
    expect(screen.getByText(/3 jours/)).toBeInTheDocument();
  });

  it("renders multiplier as +N% format", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, multiplier: 2.0 }} />);
    expect(screen.getByText(/\+100%/)).toBeInTheDocument();
  });

  it("renders multiplier 1.5 as +50%", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, multiplier: 1.5 }} />);
    expect(screen.getByText(/\+50%/)).toBeInTheDocument();
  });

  it("renders singular 'jour' when only 1 day remaining", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, daysRemaining: 1 }} />);
    expect(screen.getByText(/1 jour\b/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-remontada-card.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement the component**

Create `apps/web/components/race-feed-remontada-card.tsx`:

```tsx
import { Flame } from "lucide-react";
import type { RemontadaData } from "@/lib/race-feed-types";

type Props = { data: RemontadaData };

export function RaceFeedRemontadaCard({ data }: Props) {
  const percentBoost = Math.round((data.multiplier - 1) * 100);
  const dayLabel = data.daysRemaining === 1 ? "jour" : "jours";

  return (
    <div className="rounded-[10px] border bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.20)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Flame size={14} className="text-[var(--warning)]" aria-hidden="true" />
        <span>Remontada · {data.teamName}</span>
      </div>
      <div className="mt-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        Boost +{percentBoost}% pendant {data.daysRemaining} {dayLabel}
      </div>
    </div>
  );
}
```

- [ ] **Step 7.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-remontada-card.test.tsx 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/components/race-feed-remontada-card.tsx apps/web/components/__tests__/race-feed-remontada-card.test.tsx
git commit -m "feat(racing-feed): add Remontada card (inline)"
```

---

## Task 8: PhaseEndBanner

**Files:**
- Create: `apps/web/components/race-feed-phase-end-banner.tsx`
- Test: `apps/web/components/__tests__/race-feed-phase-end-banner.test.tsx`

**Goal:** Banner at the end of the feed showing the next phase Round 1 date.

- [ ] **Step 8.1: Write the test file**

Create `apps/web/components/__tests__/race-feed-phase-end-banner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedPhaseEndBanner } from "../race-feed-phase-end-banner";

describe("RaceFeedPhaseEndBanner", () => {
  it("renders next phase Round 1 date and link to auction", () => {
    render(
      <RaceFeedPhaseEndBanner
        leagueId="league-1"
        nextPhaseRound1Date="2026-05-28"
        nextPhaseLabel="Pre-Tour"
      />
    );
    expect(screen.getByText(/Round 1 ouvre le 28 mai/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Voir l'enchère/ });
    expect(link).toHaveAttribute("href", "/league/league-1/auction");
  });

  it("renders end-of-season state when no next phase", () => {
    render(
      <RaceFeedPhaseEndBanner
        leagueId="league-1"
        nextPhaseRound1Date={null}
        nextPhaseLabel={null}
      />
    );
    expect(screen.getByText(/Saison terminée/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-phase-end-banner.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 8.3: Implement the component**

Create `apps/web/components/race-feed-phase-end-banner.tsx`:

```tsx
import Link from "next/link";
import { FlagTriangleRight } from "lucide-react";
import { formatRound1DateLabel } from "@/lib/race-feed-helpers";

type Props = {
  leagueId: string;
  nextPhaseRound1Date: string | null;
  nextPhaseLabel: string | null;
};

export function RaceFeedPhaseEndBanner({ leagueId, nextPhaseRound1Date }: Props) {
  if (!nextPhaseRound1Date) {
    return (
      <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
        <div className="flex items-center gap-2 text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          <FlagTriangleRight size={16} className="text-[var(--accent-default)]" aria-hidden="true" />
          <span>Saison terminée</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
      <div className="flex items-center gap-2 text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
        <FlagTriangleRight size={16} className="text-[var(--accent-default)]" aria-hidden="true" />
        <span>Prochaine phase</span>
      </div>
      <div className="mt-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        Round 1 ouvre le {formatRound1DateLabel(nextPhaseRound1Date)}
      </div>
      <Link
        href={`/league/${leagueId}/auction`}
        className="mt-2 inline-block text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
      >
        Voir l'enchère →
      </Link>
    </div>
  );
}
```

- [ ] **Step 8.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed-phase-end-banner.test.tsx 2>&1 | tail -20
```

Expected: All 2 tests PASS.

- [ ] **Step 8.5: Commit**

```bash
git add apps/web/components/race-feed-phase-end-banner.tsx apps/web/components/__tests__/race-feed-phase-end-banner.test.tsx
git commit -m "feat(racing-feed): add PhaseEndBanner (next phase Round 1)"
```

---

## Task 9: RaceFeedDateGroup wrapper

**Files:**
- Create: `apps/web/components/race-feed-date-group.tsx`

**Goal:** Pure presentational wrapper that renders a date label outside its child cards. No internal state.

- [ ] **Step 9.1: Implement the component (no test — it's a 4-line presentational wrapper, covered by RaceFeed integration test in Task 11)**

Create `apps/web/components/race-feed-date-group.tsx`:

```tsx
import type { ReactNode } from "react";
import { formatRaceDateLabel } from "@/lib/race-feed-helpers";

type Props = {
  date: string; // ISO yyyy-mm-dd
  children: ReactNode;
};

export function RaceFeedDateGroup({ date, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="block pl-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        {formatRaceDateLabel(date)}
      </span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
```

- [ ] **Step 9.2: Quick smoke test via existing tests**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-past.test.tsx 2>&1 | tail -10
```

Expected: still PASS (we didn't break anything).

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/components/race-feed-date-group.tsx
git commit -m "feat(racing-feed): add RaceFeedDateGroup wrapper"
```

---

## Task 10: Data layer — `getRaceFeedData`

**Files:**
- Create: `apps/web/lib/get-race-feed-data.ts`
- Test: `apps/web/lib/__tests__/get-race-feed-data.test.ts`

**Goal:** Server-only loader that takes a `SupabaseClient` + `leagueId` + `myTeamId` + a `referenceDate` (defaults to now) and returns a `RaceFeedPayload`.

- [ ] **Step 10.1: Write the test file**

Create `apps/web/lib/__tests__/get-race-feed-data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRaceFeedData } from "../get-race-feed-data";

// We mock @supabase/ssr at the module level so the loader's helpers don't reach the network.
vi.mock("@supabase/supabase-js", () => ({}));
vi.mock("@supabase/ssr", () => ({}));

type RowSet = Record<string, any[]>;

function buildSupabase(rows: RowSet) {
  // Each call to from(table) returns a chainable builder that resolves to rows[table] when await-ed.
  const builder = (table: string) => {
    const data = rows[table] ?? [];
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
      then: (resolve: any) => resolve({ data, error: null }),
    };
    return chain;
  };
  return { from: vi.fn(builder) } as any;
}

describe("getRaceFeedData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty groups + null next phase when no races, no auctions", async () => {
    const supabase = buildSupabase({});
    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });
    expect(result.groups).toEqual([]);
    expect(result.nextPhaseRound1Date).toBeNull();
  });

  it("groups today's stage card and yesterday's past card, with myTeam highlight", async () => {
    const supabase = buildSupabase({
      race_results: [
        {
          race_slug: "race/giro-d-italia/2026/stage-1",
          race_name: "Giro d'Italia - Stage 1",
          race_date: "2026-05-04",
          stage: "1",
        },
        {
          race_slug: "race/giro-d-italia/2026/stage-2",
          race_name: "Giro d'Italia - Stage 2",
          race_date: "2026-05-05",
          stage: "2",
        },
      ],
      race_startlists: [],
      rider_xp_daily: [
        // Stage 1 winners
        { race_slug: "race/giro-d-italia/2026/stage-1", team_id: "T_other", rider_id: "r1", xp_gained: 200 },
        // Stage 2 — Mon equipe
        { race_slug: "race/giro-d-italia/2026/stage-2", team_id: "T1", rider_id: "r2", xp_gained: 120 },
        { race_slug: "race/giro-d-italia/2026/stage-2", team_id: "T_other", rider_id: "r3", xp_gained: 90 },
      ],
      teams: [
        { id: "T1", name: "Mon équipe" },
        { id: "T_other", name: "Team Astrid" },
      ],
      riders: [
        { id: "r1", full_name: "Tadej Pogacar" },
        { id: "r2", full_name: "Mathieu van Aert" },
        { id: "r3", full_name: "Jonas Vingegaard" },
      ],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      remontada_boosts: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });

    expect(result.groups.length).toBe(2);
    expect(result.groups[0].date).toBe("2026-05-04");
    expect(result.groups[1].date).toBe("2026-05-05");

    const todayCard = result.groups[1].cards[0];
    expect(todayCard.type).toBe("today");
    if (todayCard.type !== "today" && todayCard.type !== "past") return;
    const myTeam = todayCard.race.teams.find((t) => t.isMyTeam);
    expect(myTeam).toBeDefined();
    expect(myTeam?.totalXp).toBe(120);
  });

  it("intercalates Nemesis cards in the same date group as their stage", async () => {
    const supabase = buildSupabase({
      race_results: [
        {
          race_slug: "race/giro-d-italia/2026/stage-2",
          race_name: "Giro - Stage 2",
          race_date: "2026-05-05",
          stage: "2",
        },
      ],
      race_startlists: [],
      rider_xp_daily: [],
      teams: [
        { id: "T1", name: "Mon équipe" },
        { id: "T_other", name: "Team Astrid" },
      ],
      riders: [],
      sponsor_bonuses: [],
      gt_tactic_activations: [
        {
          id: "act-1",
          team_id: "T1",
          stage_slug: "race/giro-d-italia/2026/stage-2",
          tactic_type: "nemesis_gc",
          nemesis_target_team_id: "T_other",
          nemesis_target_role: "gc_leader",
          outcome: "attacker_won",
          resolved_attacker_rider_id: null,
          resolved_target_rider_id: null,
        },
      ],
      remontada_boosts: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });

    const cards = result.groups[0].cards;
    const nemesis = cards.find((c) => c.type === "nemesis");
    expect(nemesis).toBeDefined();
    if (nemesis?.type !== "nemesis") return;
    expect(nemesis.data.outcome).toBe("attacker_won");
    expect(nemesis.data.isMyTeamAttacker).toBe(true);
  });
});
```

- [ ] **Step 10.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run lib/__tests__/get-race-feed-data.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 10.3: Implement the loader**

Create `apps/web/lib/get-race-feed-data.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentPhase, getPhaseRange, AUCTION_PHASES } from "./phases";
import { GT_PHASE_IDS, GT_RACE_SLUG_PREFIX, isGTPhaseId } from "./gt-phases";
import {
  detectRaceType,
  getParentRaceSlug,
  getParentRaceLabel,
  formatRaceTitle,
  shortenRiderName,
  teamInitials,
} from "./race-feed-helpers";
import type {
  NemesisData,
  RaceCardStatus,
  RaceData,
  RaceDataWithBreakdown,
  RaceFeedCard,
  RaceFeedDateGroup,
  RaceFeedPayload,
  RemontadaData,
  RiderRaceResult,
  TeamRaceResult,
} from "./race-feed-types";

type GetRaceFeedOpts = {
  leagueId: string;
  myTeamId: string;
  referenceDate?: Date;
};

const GT_IDENTIFIER_BY_PREFIX: Record<string, string> = {
  "race/giro-d-italia": "giro-d-italia",
  "race/tour-de-france": "tour-de-france",
  "race/vuelta-a-espana": "vuelta-a-espana",
};

export async function getRaceFeedData(
  supabase: SupabaseClient,
  opts: GetRaceFeedOpts
): Promise<RaceFeedPayload> {
  const referenceDate = opts.referenceDate ?? new Date();
  const todayIso = referenceDate.toISOString().slice(0, 10);

  const phase = getCurrentPhase(referenceDate);
  const isGtPhase = isGTPhaseId(phase.id);
  const range = getPhaseRange(phase, referenceDate.getFullYear());
  const phaseStartIso = range.start.toISOString().slice(0, 10);
  const phaseEndIso = range.end.toISOString().slice(0, 10);

  // 1) Fetch races: past+today via race_results, future via race_startlists
  const { data: pastRows = [] } = await supabase
    .from("race_results")
    .select("race_slug, race_name, race_date, stage")
    .gte("race_date", phaseStartIso)
    .lte("race_date", phaseEndIso);

  const { data: futureRows = [] } = await supabase
    .from("race_startlists")
    .select("race_slug, race_name, race_date")
    .gte("race_date", todayIso)
    .lte("race_date", phaseEndIso);

  // Deduplicate race_results (each row is rider-level)
  const racesBySlug = new Map<string, { slug: string; name: string; date: string }>();
  for (const r of pastRows ?? []) {
    if (!racesBySlug.has(r.race_slug)) {
      racesBySlug.set(r.race_slug, {
        slug: r.race_slug,
        name: r.race_name,
        date: r.race_date,
      });
    }
  }
  for (const r of futureRows ?? []) {
    if (!racesBySlug.has(r.race_slug)) {
      racesBySlug.set(r.race_slug, {
        slug: r.race_slug,
        name: r.race_name,
        date: r.race_date,
      });
    }
  }

  // 2) Fetch team and rider lookup tables
  const { data: teamRows = [] } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", opts.leagueId);
  const teamById = new Map<string, string>();
  for (const t of teamRows ?? []) teamById.set(t.id, t.name);

  const { data: riderRows = [] } = await supabase
    .from("riders")
    .select("id, full_name");
  const riderById = new Map<string, string>();
  for (const r of riderRows ?? []) riderById.set(r.id, r.full_name);

  // 3) Fetch xp + bonus data for past+today races
  const slugsForXp = Array.from(racesBySlug.values())
    .filter((r) => r.date <= todayIso)
    .map((r) => r.slug);

  const { data: xpRows = [] } =
    slugsForXp.length === 0
      ? { data: [] }
      : await supabase
          .from("rider_xp_daily")
          .select("race_slug, team_id, rider_id, xp_gained")
          .in("race_slug", slugsForXp);

  const { data: bonusRows = [] } =
    slugsForXp.length === 0
      ? { data: [] }
      : await supabase
          .from("sponsor_bonuses")
          .select("race_slug, team_id, rider_id, amount")
          .in("race_slug", slugsForXp);

  // Aggregate xp + bonus by (race_slug, team_id, rider_id)
  type Agg = { xp: number; bonus: number };
  const aggKey = (race: string, team: string, rider: string) => `${race} ${team} ${rider}`;
  const agg = new Map<string, Agg>();
  for (const row of xpRows ?? []) {
    const k = aggKey(row.race_slug, row.team_id, row.rider_id);
    const cur = agg.get(k) ?? { xp: 0, bonus: 0 };
    cur.xp += Number(row.xp_gained ?? 0);
    agg.set(k, cur);
  }
  for (const row of bonusRows ?? []) {
    const k = aggKey(row.race_slug, row.team_id, row.rider_id);
    const cur = agg.get(k) ?? { xp: 0, bonus: 0 };
    cur.bonus += Number(row.amount ?? 0);
    agg.set(k, cur);
  }

  // 4) Build per-race breakdown
  const buildBreakdown = (raceSlug: string): {
    teams: TeamRaceResult[];
    winnerTeamId: string | null;
    winnerTeamInitials: string | null;
  } => {
    const byTeam = new Map<string, RiderRaceResult[]>();
    for (const [k, v] of agg.entries()) {
      const [slug, teamId, riderId] = k.split(" ");
      if (slug !== raceSlug) continue;
      if (v.xp < 1) continue;
      const list = byTeam.get(teamId) ?? [];
      list.push({
        riderId,
        riderShortName: shortenRiderName(riderById.get(riderId) ?? riderId),
        role: null, // V1: no GT role lookup; left as null. (Hook for V2)
        xpGained: v.xp,
        bonusEur: v.bonus,
      });
      byTeam.set(teamId, list);
    }
    const teams: TeamRaceResult[] = [];
    for (const [teamId, riders] of byTeam.entries()) {
      const totalXp = riders.reduce((s, r) => s + r.xpGained, 0);
      const totalBonus = riders.reduce((s, r) => s + r.bonusEur, 0);
      teams.push({
        teamId,
        teamName: teamById.get(teamId) ?? "?",
        isMyTeam: teamId === opts.myTeamId,
        totalXp,
        totalBonusEur: totalBonus,
        riders: riders.sort((a, b) => b.xpGained - a.xpGained),
      });
    }
    teams.sort((a, b) => b.totalXp - a.totalXp);
    const winner = teams[0] ?? null;
    return {
      teams,
      winnerTeamId: winner?.teamId ?? null,
      winnerTeamInitials: winner ? teamInitials(winner.teamName) : null,
    };
  };

  // 5) Convert each race into a RaceData (or RaceDataWithBreakdown)
  const buildBaseRace = (
    slug: string,
    name: string,
    date: string
  ): RaceData => {
    const raceType = detectRaceType(slug);
    const parentSlug = getParentRaceSlug(slug);
    const parentLabel = parentSlug ? getParentRaceLabel(parentSlug) : null;
    const status: RaceCardStatus =
      date < todayIso ? "past" : date === todayIso ? "today" : "future";
    return {
      raceSlug: slug,
      raceName: name,
      raceTitle: formatRaceTitle({ raceType, raceName: name, raceSlug: slug, parentRaceLabel: parentLabel }),
      parentRaceSlug: parentSlug,
      parentRaceLabel: parentLabel,
      raceDate: date,
      raceType,
      status,
      isGtPhase,
    };
  };

  // 6) Group races/cards by date
  const byDate = new Map<string, RaceFeedCard[]>();
  const pushCard = (date: string, card: RaceFeedCard) => {
    const list = byDate.get(date) ?? [];
    list.push(card);
    byDate.set(date, list);
  };

  for (const r of racesBySlug.values()) {
    const base = buildBaseRace(r.slug, r.name, r.date);
    if (base.status === "future") {
      pushCard(r.date, { type: "future", race: base });
    } else {
      const breakdown = buildBreakdown(r.slug);
      const enriched: RaceDataWithBreakdown = { ...base, ...breakdown };
      pushCard(r.date, { type: base.status, race: enriched });
    }
  }

  // 7) Fetch and slot Nemesis activations
  if (isGtPhase) {
    const { data: nemRows = [] } = await supabase
      .from("gt_tactic_activations")
      .select(
        "id, team_id, stage_slug, tactic_type, nemesis_target_team_id, nemesis_target_role, outcome, resolved_attacker_rider_id, resolved_target_rider_id"
      )
      .eq("phase_id", phase.id)
      .eq("year", referenceDate.getFullYear())
      .in("tactic_type", ["nemesis_gc", "nemesis_sprint"]);

    for (const row of nemRows ?? []) {
      const race = racesBySlug.get(row.stage_slug);
      if (!race) continue;
      const isMyTeamAttacker = row.team_id === opts.myTeamId;
      const data: NemesisData = {
        activationId: row.id,
        raceSlug: row.stage_slug,
        attackerTeamName: teamById.get(row.team_id) ?? "?",
        attackerRiderShortName: row.resolved_attacker_rider_id
          ? shortenRiderName(riderById.get(row.resolved_attacker_rider_id) ?? "?")
          : "?",
        targetTeamName: teamById.get(row.nemesis_target_team_id ?? "") ?? "?",
        targetRiderShortName: row.resolved_target_rider_id
          ? shortenRiderName(riderById.get(row.resolved_target_rider_id) ?? "?")
          : "?",
        outcome:
          (row.outcome as NemesisData["outcome"]) ??
          ((row.resolved_attacker_rider_id || row.resolved_target_rider_id) ? "no_resolution" : "pending"),
        isMyTeamAttacker,
      };
      pushCard(race.date, { type: "nemesis", data, raceSlug: row.stage_slug });
    }
  }

  // 8) Fetch and slot Remontada cards
  if (isGtPhase) {
    const gtPrefix = GT_RACE_SLUG_PREFIX[phase.id as 4 | 6 | 8];
    const gtIdent = GT_IDENTIFIER_BY_PREFIX[gtPrefix];
    const { data: remRows = [] } = await supabase
      .from("remontada_boosts")
      .select(
        "id, league_id, team_id, gt_identifier, triggered_at_stage, expires_after_stage, multiplier, created_at"
      )
      .eq("league_id", opts.leagueId)
      .eq("gt_identifier", gtIdent);

    for (const row of remRows ?? []) {
      const triggeredDateIso = (row.created_at as string).slice(0, 10);
      const totalDuration = Math.max(0, row.expires_after_stage - row.triggered_at_stage);
      const data: RemontadaData = {
        boostId: row.id,
        teamId: row.team_id,
        teamName: teamById.get(row.team_id) ?? "?",
        isMyTeam: row.team_id === opts.myTeamId,
        multiplier: Number(row.multiplier),
        daysRemaining: totalDuration,
        triggeredAt: triggeredDateIso,
      };
      pushCard(triggeredDateIso, { type: "remontada", data });
    }
  }

  // 9) Build sorted groups
  const groups: RaceFeedDateGroup[] = Array.from(byDate.keys())
    .sort()
    .map((date) => ({ date, cards: byDate.get(date)! }));

  // 10) Compute next phase Round 1 date (use auctions table — earliest scheduled auction in the next phase window)
  let nextPhaseRound1Date: string | null = null;
  let nextPhaseLabel: string | null = null;
  const nextPhase = AUCTION_PHASES.find((p) => p.id === phase.id + 1) ?? null;
  if (nextPhase) {
    nextPhaseLabel = nextPhase.label;
    const nextStartIso = new Date(
      referenceDate.getFullYear(),
      nextPhase.startMonth - 1,
      nextPhase.startDay
    )
      .toISOString()
      .slice(0, 10);
    const { data: auctionRows = [] } = await supabase
      .from("auctions")
      .select("opens_at")
      .eq("league_id", opts.leagueId)
      .gte("opens_at", nextStartIso)
      .order("opens_at", { ascending: true })
      .limit(1);
    if (auctionRows && auctionRows.length > 0) {
      nextPhaseRound1Date = auctionRows[0].opens_at.slice(0, 10);
    } else {
      nextPhaseRound1Date = nextStartIso;
    }
  }

  return {
    groups,
    nextPhaseRound1Date,
    nextPhaseLabel,
  };
}
```

> Note the `GT_PHASE_IDS` import keeps the linter happy; if not used directly, drop it.

- [ ] **Step 10.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run lib/__tests__/get-race-feed-data.test.ts 2>&1 | tail -30
```

Expected: All 3 tests PASS.

If the test fails because `getCurrentPhase` returns a non-GT phase for `2026-05-05`: check that phase 4 (Giro d'Italia) covers May 2-31 in `phases.ts`. It does in the existing `AUCTION_PHASES`.

- [ ] **Step 10.5: Typecheck**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck
```

Expected: pass.

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/lib/get-race-feed-data.ts apps/web/lib/__tests__/get-race-feed-data.test.ts
git commit -m "feat(racing-feed): add server-side getRaceFeedData loader"
```

---

## Task 11: RaceFeed root component

**Files:**
- Create: `apps/web/components/race-feed.tsx`
- Test: `apps/web/components/__tests__/race-feed.test.tsx`

**Goal:** Root component. Renders all date groups, picks the right card variant per type, and on mount scrolls to the Today card (or first Future card if no Today).

- [ ] **Step 11.1: Write the test file**

Create `apps/web/components/__tests__/race-feed.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeed } from "../race-feed";
import type { RaceFeedPayload, RaceDataWithBreakdown, RaceData } from "@/lib/race-feed-types";

const pastRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-1",
  raceName: "Giro - 1",
  raceTitle: "Giro · Étape 1",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-04",
  raceType: "stage",
  status: "past",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  teams: [],
};

const todayRace: RaceDataWithBreakdown = {
  ...pastRace,
  raceSlug: "race/giro-d-italia/2026/stage-2",
  raceTitle: "Giro · Étape 2",
  raceDate: "2026-05-05",
  status: "today",
};

const futureRace: RaceData = {
  raceSlug: "race/giro-d-italia/2026/stage-3",
  raceName: "Giro - 3",
  raceTitle: "Giro · Étape 3",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-06",
  raceType: "stage",
  status: "future",
  isGtPhase: true,
};

const payload: RaceFeedPayload = {
  groups: [
    { date: "2026-05-04", cards: [{ type: "past", race: pastRace }] },
    { date: "2026-05-05", cards: [{ type: "today", race: todayRace }] },
    { date: "2026-05-06", cards: [{ type: "future", race: futureRace }] },
  ],
  nextPhaseRound1Date: "2026-05-28",
  nextPhaseLabel: "Pre-Tour",
};

describe("RaceFeed", () => {
  it("renders one group per date with proper labels", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText("4 mai")).toBeInTheDocument();
    expect(screen.getByText("5 mai")).toBeInTheDocument();
    expect(screen.getByText("6 mai")).toBeInTheDocument();
  });

  it("renders past, today, and future cards", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText("Giro · Étape 1")).toBeInTheDocument();
    expect(screen.getByText("Giro · Étape 2")).toBeInTheDocument();
    expect(screen.getByText("Giro · Étape 3")).toBeInTheDocument();
  });

  it("renders the phase end banner at the bottom", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText(/Round 1 ouvre le 28 mai/)).toBeInTheDocument();
  });

  it("renders only the phase end banner when no groups", () => {
    render(
      <RaceFeed
        leagueId="L1"
        payload={{ groups: [], nextPhaseRound1Date: "2026-06-02", nextPhaseLabel: "Pre-Tour" }}
      />
    );
    expect(screen.getByText(/Prochaine phase/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 11.2: Run test to verify it fails**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 11.3: Implement the component**

Create `apps/web/components/race-feed.tsx`:

```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import type { RaceFeedPayload } from "@/lib/race-feed-types";
import { RaceFeedDateGroup } from "./race-feed-date-group";
import { RaceCardPast } from "./race-card-past";
import { RaceCardToday } from "./race-card-today";
import { RaceCardFuture } from "./race-card-future";
import { RaceFeedNemesisCard } from "./race-feed-nemesis-card";
import { RaceFeedRemontadaCard } from "./race-feed-remontada-card";
import { RaceFeedPhaseEndBanner } from "./race-feed-phase-end-banner";

type Props = {
  leagueId: string;
  payload: RaceFeedPayload;
};

export function RaceFeed({ leagueId, payload }: Props) {
  const todayRef = useRef<HTMLDivElement | null>(null);
  const firstFutureRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const target = todayRef.current ?? firstFutureRef.current;
    if (target) {
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, []);

  let firstFutureClaimed = false;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-16">
      {payload.groups.map((group) => (
        <RaceFeedDateGroup key={group.date} date={group.date}>
          {group.cards.map((card, idx) => {
            const key = `${group.date}-${idx}`;
            if (card.type === "today") {
              return (
                <div key={key} ref={todayRef}>
                  <RaceCardToday race={card.race} leagueId={leagueId} />
                </div>
              );
            }
            if (card.type === "past") {
              return <RaceCardPast key={key} race={card.race} />;
            }
            if (card.type === "future") {
              const refToBind =
                !firstFutureClaimed && card.race.status === "future" ? firstFutureRef : null;
              if (refToBind) firstFutureClaimed = true;
              return (
                <div key={key} ref={refToBind}>
                  <RaceCardFuture race={card.race} leagueId={leagueId} />
                </div>
              );
            }
            if (card.type === "nemesis") {
              return <RaceFeedNemesisCard key={key} data={card.data} />;
            }
            if (card.type === "remontada") {
              return <RaceFeedRemontadaCard key={key} data={card.data} />;
            }
            return null;
          })}
        </RaceFeedDateGroup>
      ))}
      <RaceFeedPhaseEndBanner
        leagueId={leagueId}
        nextPhaseRound1Date={payload.nextPhaseRound1Date}
        nextPhaseLabel={payload.nextPhaseLabel}
      />
    </div>
  );
}
```

- [ ] **Step 11.4: Run test to verify it passes**

```bash
cd apps/web && pnpm test --run components/__tests__/race-feed.test.tsx 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 11.5: Run all racing-feed tests together**

```bash
cd apps/web && pnpm test --run components/__tests__/race-card-past.test.tsx components/__tests__/race-card-today.test.tsx components/__tests__/race-card-future.test.tsx components/__tests__/race-team-breakdown.test.tsx components/__tests__/race-feed-nemesis-card.test.tsx components/__tests__/race-feed-remontada-card.test.tsx components/__tests__/race-feed-phase-end-banner.test.tsx components/__tests__/race-feed.test.tsx lib/__tests__/race-feed-helpers.test.ts lib/__tests__/get-race-feed-data.test.ts 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 11.6: Commit**

```bash
git add apps/web/components/race-feed.tsx apps/web/components/__tests__/race-feed.test.tsx
git commit -m "feat(racing-feed): add RaceFeed root component with auto-scroll"
```

---

## Task 12: Homepage integration

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`

**Goal:** Replace the call to `<HomeFeed>` with `<RaceFeed>` driven by `getRaceFeedData`. Keep `LobbyView` unchanged. Keep `HomeGtBanner` unchanged.

- [ ] **Step 12.1: Read the current homepage to know exactly what to change**

```bash
cat /Users/jonathanschummers/Documents/WattHunter/apps/web/app/\(game\)/league/\[leagueId\]/page.tsx | head -120
```

Expected: see the full current file (already provided in the spec exploration above).

- [ ] **Step 12.2: Apply the integration edit**

Edit `apps/web/app/(game)/league/[leagueId]/page.tsx`:

Replace the active-league return block (the part that renders `<HomeGtBanner>` + `<HomeFeed>`) with:

```tsx
  // ---- ACTIVE LEAGUE: load race feed payload ----
  const { data: memberRow } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const teamId = memberRow?.team_id ?? null;

  // Late-join detection (kept as-is from previous version)
  const { data: teamSponsorRow } = teamId
    ? await supabase
        .from("team_sponsors")
        .select("id")
        .eq("team_id", teamId)
        .maybeSingle()
    : { data: null };

  const { count: closedCount } = await supabase
    .from("auctions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("status", "closed");

  const isLateJoinPending = teamSponsorRow === null && (closedCount ?? 0) > 0;

  const raceFeedPayload = teamId
    ? await getRaceFeedData(supabase, { leagueId, myTeamId: teamId })
    : { groups: [], nextPhaseRound1Date: null, nextPhaseLabel: null };

  return (
    <>
      <HomeGtBanner leagueId={leagueId} />
      {isLateJoinPending && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-mid)]" />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            You joined mid-season. You can select your sponsor and start bidding at the next auction phase.
          </p>
        </div>
      )}
      <RaceFeed leagueId={leagueId} payload={raceFeedPayload} />
    </>
  );
```

Update the imports at the top of the file:

```tsx
// Remove the HomeFeed import (no longer used)
// import { HomeFeed } from "./home-feed";
import { RaceFeed } from "@/components/race-feed";
import { getRaceFeedData } from "@/lib/get-race-feed-data";
import { Info } from "lucide-react";
```

> Keep the `<LobbyView>` branch and `HomeGtBanner` import intact.

- [ ] **Step 12.3: Typecheck**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck
```

Expected: no errors. If `HomeFeed` import is now unused, the linter might flag it — drop the import line.

- [ ] **Step 12.4: Lint**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm lint
```

Expected: no new warnings. If there are unused imports, remove them.

- [ ] **Step 12.5: Run the full apps/web test suite to make sure no regression**

```bash
cd apps/web && pnpm test --run 2>&1 | tail -30
```

Expected: all tests pass (no regression on the existing 157 tests + new ~30 tests from this plan).

- [ ] **Step 12.6: Manual smoke test**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm dev
```

In a browser, visit `http://localhost:3000/league/<your-league-id>` and verify:
- Homepage no longer shows the old `What's Next` HomeFeed
- A date-grouped feed shows past stages of the current phase
- Today's stage card is auto-scrolled into view at top
- Mon equipe is highlighted with cyan + star
- Future cards have dashed borders and a `+` button (only for GT)
- Phase end banner at the bottom shows the Round 1 date of the next phase

Stop the dev server with Ctrl+C.

- [ ] **Step 12.7: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/page.tsx
git commit -m "feat(home): replace HomeFeed with RaceFeed on the league homepage"
```

---

## Task 13: Final cleanup + verification

**Files:**
- (none modified — this is a verification pass)

**Goal:** Ensure the spec acceptance criteria are met, no leftover artifacts, branch is ready.

- [ ] **Step 13.1: Re-run the full lint + typecheck + test suite**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck && pnpm lint && (cd apps/web && pnpm test --run 2>&1 | tail -10)
```

Expected: all pass.

- [ ] **Step 13.2: Spec acceptance checklist (manual)**

Walk through each criterion in §9 of `docs/superpowers/specs/2026-05-09-racing-feed-v1-implementation.md`:

```
- [ ] Homepage affiche un feed vertical de cards groupees par date
- [ ] Au chargement la card Aujourd'hui est en haut du viewport visible
- [ ] La date est affichee hors de la carte, en haut a gauche du groupe
- [ ] Une meme date peut contenir plusieurs cards (etape + Nemesis + Remontada, ou parallel)
- [ ] La Past card collapsed affiche : titre + avatar du winner
- [ ] Tap sur une Past card -> expand au format Today
- [ ] La Today card affiche le detail de toutes les equipes ayant marque
- [ ] Mon equipe surlignee avec etoile et color accent
- [ ] La Today card d'un GT affiche le bouton "Voir le classement GC du <Course> ->"
- [ ] La Future card affiche un bouton + cyan (mene vers /team/gt/tactics?race=...) pour GT
- [ ] Les classiques d'un jour n'ont ni bouton GC ni bouton +
- [ ] La Nemesis card est intercalee sous la card etape concernee, meme date
- [ ] La Remontada card apparait a la date de declenchement
- [ ] La Phase end banner est affichee une fois en fin de feed avec la date du Round 1
- [ ] Si pas de course aujourd'hui, scroll auto sur la prochaine Future
- [ ] Lobby view (ligue pending) inchangee
- [ ] Sidebar desktop inchangee
- [ ] Pages Auction/Team/Budget/Ranking inchangees
- [ ] pnpm lint + pnpm typecheck pass
- [ ] Tests vitest pass (10-15 tests sur les composants RaceFeed)
- [ ] Pas de migration SQL
```

For each unchecked criterion: investigate, fix, and re-run the tests.

- [ ] **Step 13.3: Push the branch**

```bash
git push -u origin feature/racing-feed-v1
```

Expected: branch pushed. Print URL hint to open a PR.

- [ ] **Step 13.4: Create PR (optional — only if user asks to)**

Wait for explicit instruction from the user before opening a PR. If they ask:

```bash
gh pr create --title "feat(home): Racing Feed V1 (replace HomeFeed)" --body "$(cat <<'EOF'
## Summary
- Replaces the HomeFeed on the league dashboard with a chronological RaceFeed
- Adds 8 new components (cards + wrappers) and a server-side data loader
- Inline Nemesis + Remontada cards. Phase-end banner at the bottom.
- No DB migration. No nav refonte. Lobby view unchanged.

## Spec
docs/superpowers/specs/2026-05-09-racing-feed-v1-implementation.md

## Test plan
- [ ] Homepage shows date-grouped feed with today centered
- [ ] Past cards expand on tap to show breakdown
- [ ] GC link appears for GT stages, hidden for classics
- [ ] + button appears on future GT stages, hidden for classics
- [ ] Nemesis card appears under its stage in the same date group
- [ ] Remontada card appears at trigger date
- [ ] Phase end banner shows next Round 1 date

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

The plan covers every numbered subsection of the spec:

- **Spec §1 Objectif** -> Tasks 1-13 produce the feed
- **Spec §2 Constraints** -> Task 12 confirms LobbyView + nav untouched
- **Spec §3 Layout general** -> Tasks 9 (date groups) + 11 (root) implement it
- **Spec §3.2 Date label** -> Task 9 (DateGroup with `formatRaceDateLabel`)
- **Spec §4.1 RaceFeed** -> Task 11
- **Spec §4.2 RaceCardPast** -> Task 3
- **Spec §4.3 RaceCardToday** -> Task 4 (+ Task 2 RaceTeamBreakdown)
- **Spec §4.4 RaceCardFuture** -> Task 5
- **Spec §4.5 NemesisCard** -> Task 6
- **Spec §4.6 RemontadaCard** -> Task 7
- **Spec §4.7 PhaseEndBanner** -> Task 8
- **Spec §4.8 RaceFeedDateGroup** -> Task 9
- **Spec §4.9 Empty state** -> Task 11 + 12 (renders banner only when no groups)
- **Spec §5 Sources de donnees** -> Task 10
- **Spec §6 Detection type de course** -> Task 1 (`detectRaceType`, `getParentRaceSlug`, etc.)
- **Spec §7 Layout & scroll** -> Task 11 (`useLayoutEffect`)
- **Spec §8 Tests** -> Tasks 1-11 each include their test file
- **Spec §9 Critères d'acceptation** -> Task 13 walkthrough

**Type consistency:** `RaceData`, `RaceDataWithBreakdown`, `RaceFeedCard`, `RaceFeedDateGroup`, `RaceFeedPayload` — all defined once in Task 1 and consumed identically downstream.

**No placeholders:** every step has runnable code or commands.

**Two known compromises** (acceptable per spec):
1. `RiderRaceResult.role` is left `null` in V1 — the data layer doesn't fetch GT role assignments yet. This means the `GC/SPR/DOM` badge will not show in V1. It's a hook for V2 (the prop already exists in the component). If the user wants role badges in V1, that's a 30-min follow-up: query `gt_squads` (table containing role assignments) and merge by rider_id.
2. The "Voir le classement GC" link goes to `/league/[leagueId]/ranking?race=<parent-slug>`. The Ranking page currently filters by exact slug, not prefix. So the link may navigate to Ranking with no filter applied. Acceptable for V1 — polishing the Ranking page is V2 scope.

Both are explicitly noted in the spec ("hors-scope V1") and don't break the acceptance criteria.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-09-racing-feed-v1.md`.

Two execution options:

1. **Subagent-Driven** (recommended) — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
