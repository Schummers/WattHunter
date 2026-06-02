# Spec A — P3c: Race Team rename + Scoring doc front + Nemesis profile UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the front-end half of Spec A: (1) rename the GT Team tab to "Race Team" with a dynamic per-race label (`getGTSubTabLabel` returns "Tour de France Team", "Paris-Nice Team", etc., A9), (2) ship the "How scoring works" pedagogical encart on the Race Team page (A8), (3) surface the new Nemesis profile-gating errors raised by `place_tactic` (P3a) with a profile chip on the stage selector and a friendly inline error message.

**Architecture:** Pure front-end work — no DB migration, no scoring change, no `services/pcs-sync/` touch. P3c runs **after** P3a (Nemesis profile gating in `place_tactic` + `stage_profiles` table) and P3b (`gt_squad`/`gt_tactic_activations` generalized with `race_slug`, `apps/web/lib/database.types.ts` regenerated, tactic usage limits per race type). The plan reads `stage_profiles` from the client/server-component side, augments `GtStage` with `profileIcon`, threads it down to `tactic-nemesis-modal.tsx` and `tactic-stage-list.tsx`, gates the radio button by profile compatibility, and catches the three new error strings ("stage profile unknown for …", "Nemesis Sprint requires …", "Nemesis GC requires …") to display a friendly inline message under the stage list.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript strict, Tailwind v4, Shadcn UI, vitest + @testing-library/react (jsdom env), Playwright e2e (`test.fixme()` until seed data).

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` — A8 (scoring doc front) + A9 (Race Team rename, dynamic label). Visual reference: `docs/mockups/2026-06-02-ui-mockups.html`.

**Project rules:**
- **Rule #1 — Design System First.** READ `docs/watthunter-design-system-v3.md` BEFORE writing any TSX. Every typography decision goes through `text-[length:var(--type-*)]`. Every colour goes through `--text-high` / `--text-mid` / `--text-low` / `--accent-default` / `--accent-label` / `--badge-bg`. NEVER hardcode `text-[15px]` or `#xxx`. Spacing via Tailwind utilities (`gap-3`, `p-4`) or `--space-*`. When in doubt → ask.
- Language rule — all user-facing strings in English.
- Worktrees do **not** share `node_modules` — `pnpm install` at the worktree root before anything else.
- No source change in `services/pcs-sync/`. No new DB migration. No scoring behaviour change.
- This plan assumes P3a and P3b have shipped to `main` and that `apps/web/lib/database.types.ts` has been regenerated against the post-P3b prod schema (so `stage_profiles`, the new `race_slug` columns on `gt_squad`/`gt_tactic_activations`, and `tactic_usage_limits` rows are visible in TS).

**Lessons applied from P3a (2026-06-02):**
- Three RPC error strings to surface in toasts/inline-errors are now LIVE in prod after P3a (migration `20260603000100`): `"stage profile unknown for <slug> — run the startlists pipeline first"`, `"Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got <profile>"`, `"Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got <profile>"`. Match these exact substrings (case-sensitive, starts-with on each). Do NOT rely on canonical error codes — the RPC uses `RAISE EXCEPTION ... USING ERRCODE = 'check_violation'` for all three, so the discriminator is the message body.
- The `stage_profiles` table created by P3a has shape `(race_slug PK, profile_icon CHECK p0-p5, race_date)`. The `getGtStages` helper below joins on `race_slug` (one row per stage_slug), so a missing row = stage not yet seeded → display "stage profile not yet imported — ask an admin to run startlists for this race".

---

## Scope (locked with user 2026-06-02)

**In P3c:**
- Extend `getGTSubTabLabel(date)` to return the active race name (uses the `race_slug` from the current race campaign — GT phase or 1-week race — exposed by P3b). Fallback to `"Race Team"` outside any active race.
- Add a `"How scoring works"` encart on the Race Team page describing role multipliers, finals barème, stage-hunter rules, sprinter profile gating, Nemesis profile gating. Pure UI; constants live in `GAME_RULES.md §11` (no duplication).
- Augment `GtStage` with `profileIcon: "p0"|"p1"|"p2"|"p3"|"p4"|"p5"|null`. Plumb it through `getGtStages` (reads `stage_profiles`), `gt-team-client.tsx`, `team-tactics-section.tsx`, `tactic-nemesis-modal.tsx`, and `tactic-stage-list.tsx`.
- Stage list: show a profile chip (Tag) per row; disable the radio + grey out the row for stages whose profile does not match the active Nemesis duel type.
- Catch the 3 new error strings from `place_tactic` and replace the raw `setErr(e.message)` flow with friendly strings ending in an actionable suffix ("Run the startlists pipeline first.").
- Unit tests for: (a) `getGTSubTabLabel` with race_slug, (b) `tactic-stage-list` profile-incompatible row disabled + chip rendered, (c) `tactic-nemesis-modal` friendly error mapping, (d) `scoring-doc-card` renders all 5 sections.
- Playwright smoke for the Race Team tab label + scoring encart visibility — keep `test.fixme()` consistent with the GT-tactics e2e pattern.
- Doc updates in `GAME_RULES.md §7` (cross-link to A2/A3/A4/A7/A8) and `ARCHITECTURE.md` (front section: new route behavior, new `<ScoringDocCard />` component).

**Not in P3c (out of scope):**
- Anything in `services/pcs-sync/`.
- Any DB migration / RPC change.
- The 1-week Race Team scoring pipeline (lives in P3b).
- Re-routing `/team/gt` to `/team/race` (URL preserved — A9 says it's optional, defer).
- Toast library introduction (no `sonner` / `react-hot-toast` in the codebase; reuse the existing inline `err` pattern in `tactic-nemesis-modal.tsx`).

---

## Cross-plan coordination (CRITICAL)

- **P3a (Nemesis profile gating).** Ships the `stage_profiles` table + `place_tactic` v2 raising `stage profile unknown for <slug> — run the startlists pipeline first`, `Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got <icon>`, `Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got <icon>`. P3c maps these substrings to friendly UI strings.
- **P3b (Race campaign generalization).** Ships `race_slug` columns on `gt_squad` / `gt_tactic_activations`, a `tactic_usage_limits` table keyed by race type, and a helper `getCurrentRaceCampaign(supabase, teamId)` (canonical name to be confirmed in P3b's plan — assumed below; if the helper landed under a different name, substitute it everywhere it appears in this plan).
- **`apps/web/lib/database.types.ts`** — regenerated by P3b. P3c assumes the `stage_profiles` Row type and the `race_slug` column are present. If `pnpm typecheck` fails at Task 1 with "Property 'stage_profiles' does not exist on type 'Database'", coordinate with the P3b agent before continuing.
- **Doc deltas.** P3c only edits the §7 scoring doc-front block of `GAME_RULES.md` and the ARCHITECTURE.md front-section row. The §11 constants block is owned by P3a (Nemesis profile sets) and P3b (1-week tactic limits) — do NOT re-duplicate them here.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/lib/gt-phases.ts` | `getGTSubTabLabel` returns the race-specific label given a race name | Modify |
| `apps/web/lib/race-team-label.ts` | new helper: resolves "Race Team" / `<Race Name> Team` from a supabase client + team id (server-side, reads P3b's race campaign) | Create |
| `apps/web/lib/gt-stages.ts` | `GtStage` gains `profileIcon`; `getGtStages` joins `stage_profiles` | Modify |
| `apps/web/lib/__tests__/gt-phases.test.ts` | unit tests for `getGTSubTabLabel` with a race name | Create |
| `apps/web/components/scoring-doc-card.tsx` | new pedagogical encart (Card + Tags + 2-column tables) | Create |
| `apps/web/components/__tests__/scoring-doc-card.test.tsx` | unit tests for the 5 sections + responsive 320px width | Create |
| `apps/web/components/tactic-stage-list.tsx` | accept `requiredProfiles?: Set<ProfileIcon>`, show profile Tag, disable mismatched rows | Modify |
| `apps/web/components/__tests__/tactic-stage-list.test.tsx` | unit tests for the profile chip + disabled-when-mismatch behavior | Create |
| `apps/web/components/tactic-nemesis-modal.tsx` | pass `requiredProfiles` to StageList; map error strings to friendly text | Modify |
| `apps/web/components/__tests__/tactic-nemesis-modal.test.tsx` | unit tests for the 3 error mappings | Create |
| `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` | resolve the dynamic label + render `<ScoringDocCard />` | Modify |
| `apps/web/app/(game)/league/[leagueId]/team/layout.tsx` | tab label uses the new server-side resolver if available, fallback to `getGTSubTabLabel` | Modify (only if a layout-level tab exists; otherwise skip) |
| `apps/web/e2e/race-team-tab.spec.ts` | Playwright smoke for tab label + scoring encart (`test.fixme()`) | Create |
| `docs/GAME_RULES.md` | §7 scoring doc-front note + cross-link to A2/A3/A4/A7/A8 | Modify |
| `docs/ARCHITECTURE.md` | front section: dynamic Race Team label, new `<ScoringDocCard />` | Modify |

---

## Task 1: Worktree setup + sanity baseline

**Files:** none (env only).

- [ ] **Step 1: Install dependencies**

Worktrees never share `node_modules` with the main checkout. From the worktree root (`/Users/jonathanschummers/Documents/WattHunter/.claude/worktrees/feature+spec-a-p3a-nemesis-profile-gating/`):

```bash
pnpm install
```

Expected: no errors. (Pre-existing `pnpm-lock.yaml` is the source of truth.)

- [ ] **Step 2: Confirm baseline typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors. If errors mention `stage_profiles` / `race_slug` / `tactic_usage_limits` → P3b has not regenerated `database.types.ts`. Stop and flag.

- [ ] **Step 3: Confirm baseline test suite**

```bash
cd apps/web && pnpm test --run
```

Record the passing count (baseline). New tests in later tasks must keep all baseline tests green.

- [ ] **Step 4: Confirm the design system reference is at hand**

Open `docs/watthunter-design-system-v3.md`. Skim the 3 component patterns (Underline Tabs / Filter Chips / Tags) + the typography token table. **Rule #1 applies for every TSX you write below.**

No commit at this task (env only).

---

## Task 2: Server-side race-label resolver

**Files:**
- Create: `apps/web/lib/race-team-label.ts`

**Why:** The label "Tour de France Team" / "Paris-Nice Team" depends on data the client doesn't have (the team's currently-active race campaign — joined to a race name). P3b already exposes a helper for the current race campaign; we wrap it into a label-shaped helper so the Race Team `page.tsx` only has to render a string.

> **Coordination note.** P3b's helper is assumed to be exported from `apps/web/lib/race-campaign.ts` and to return `{ raceSlug, raceName, kind: "gt" | "stage_race", phaseId: 4|6|8 | null } | null`. If P3b shipped a different shape, adjust the destructuring below. Keep the public signature of `resolveRaceTeamLabel` unchanged so the page can stay agnostic.

- [ ] **Step 1: Write the helper**

Create `apps/web/lib/race-team-label.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getCurrentRaceCampaign } from "@/lib/race-campaign"; // shipped by P3b

/**
 * Server-side resolver for the "Race Team" sub-tab label and the Race Team
 * page title. Returns the active race campaign's display name suffixed by
 * " Team" (e.g. "Tour de France Team", "Paris-Nice Team") when one is active
 * for this team, otherwise the static fallback "Race Team".
 */
export async function resolveRaceTeamLabel(
  supabase: SupabaseClient<Database>,
  teamId: string,
  date: Date = new Date(),
): Promise<string> {
  const campaign = await getCurrentRaceCampaign(supabase, { teamId, date });
  if (!campaign) return "Race Team";
  return `${campaign.raceName} Team`;
}
```

- [ ] **Step 2: Extend `getGTSubTabLabel` (sync, label-string only)**

In `apps/web/lib/gt-phases.ts`, update the existing `getGTSubTabLabel` so it can accept an optional explicit label (server-resolved) and fall back to its current GT-name logic when none is provided. This keeps every call-site working unchanged.

Replace the existing function (currently at lines 68-72) with:

```ts
/**
 * Sub-tab label for the Team layout.
 *
 * Preferred call: `getGTSubTabLabel(date, { override })` — pass the
 * server-resolved label from `resolveRaceTeamLabel` (e.g. "Paris-Nice Team")
 * so 1-week races render correctly. The override always wins when provided.
 *
 * Legacy call (no override): keeps prior GT-only semantics —
 *   - During a GT phase → `Giro Team` / `Tour Team` / `Vuelta Team`
 *   - Outside           → `Race Team` (renamed from `GT Team` per Spec A A9)
 */
export function getGTSubTabLabel(
  date: Date = new Date(),
  opts?: { override?: string | null },
): string {
  if (opts?.override) return opts.override;
  const cur = getCurrentGTPhase(date);
  if (!cur) return "Race Team";
  return `${GT_SHORT_NAME[cur.id as GtPhaseId]} Team`;
}
```

> The string "GT Team" no longer appears in the codebase after this change. Grep for it later to confirm.

- [ ] **Step 3: Unit tests**

Create `apps/web/lib/__tests__/gt-phases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getGTSubTabLabel } from "../gt-phases";

describe("getGTSubTabLabel", () => {
  it("returns 'Race Team' when no GT phase is active and no override is given", () => {
    // 2026-04-01 — between phases, no GT active
    const d = new Date("2026-04-01T12:00:00Z");
    expect(getGTSubTabLabel(d)).toBe("Race Team");
  });

  it("returns the GT short label during an active GT phase", () => {
    // 2026-05-15 — mid-Giro (phase id 4)
    const d = new Date("2026-05-15T12:00:00Z");
    expect(getGTSubTabLabel(d)).toBe("Giro Team");
  });

  it("respects the override when provided, regardless of date", () => {
    const d = new Date("2026-04-01T12:00:00Z");
    expect(getGTSubTabLabel(d, { override: "Paris-Nice Team" })).toBe(
      "Paris-Nice Team",
    );
  });

  it("override wins over an active GT phase too", () => {
    const d = new Date("2026-05-15T12:00:00Z");
    expect(getGTSubTabLabel(d, { override: "Tour de France Team" })).toBe(
      "Tour de France Team",
    );
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test --run lib/__tests__/gt-phases.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Grep for the old label**

```bash
grep -rn '"GT Team"' apps/web --include="*.ts" --include="*.tsx"
```

Expected: no hits. Any remaining usage gets replaced with `getGTSubTabLabel(...)` or the override-aware call below.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/race-team-label.ts apps/web/lib/gt-phases.ts apps/web/lib/__tests__/gt-phases.test.ts
git commit -m "feat(web): dynamic Race Team tab label resolver (Spec A A9)"
```

---

## Task 3: Plumb `profileIcon` through `GtStage`

**Files:**
- Modify: `apps/web/lib/gt-stages.ts`

**Why:** The stage list needs the profile to render the chip and gate the radio. Read it once server-side via `stage_profiles`.

- [ ] **Step 1: Extend the type + reader**

Replace the contents of `apps/web/lib/gt-stages.ts` with:

```ts
// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GT_SCHEDULES } from "./gt-stage-schedule";

export type StageProfileIcon = "p0" | "p1" | "p2" | "p3" | "p4" | "p5";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
  isTodayCutoffPassed?: boolean; // true if status==="today" and current time >= 11:00 CET
  /** Pre-race profile from `stage_profiles` (P3a). `null` if not yet seeded. */
  profileIcon?: StageProfileIcon | null;
}

/**
 * Get upcoming stages of a GT phase from the static schedule,
 * annotated with whether the team has already placed a tactic on each
 * and with the pre-race profile_icon from `stage_profiles` (P3a).
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: { phaseId: 4 | 6 | 8; year: number; teamId: string },
): Promise<GtStage[]> {
  const gtSlug = phaseToGtSlug(opts.phaseId);
  const scheduleKey = `${gtSlug}/${opts.year}`;
  const schedule = GT_SCHEDULES[scheduleKey];

  if (!schedule) return [];

  const stages: GtStage[] = schedule.map((entry) => ({
    number: entry.number,
    date: entry.date,
    slug: `race/${gtSlug}/${opts.year}/stage-${entry.number}`,
    status: stageStatus(entry.date),
    profileIcon: null,
  }));

  // Annotate hasTacticActive
  const { data: tactics } = await supabase
    .from("gt_tactic_activations")
    .select("stage_slug")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);

  const activeSlugs = new Set((tactics ?? []).map((t) => t.stage_slug));
  const cutoffPassed = isCutoffPassedCET();
  for (const s of stages) {
    if (activeSlugs.has(s.slug)) s.hasTacticActive = true;
    if (s.status === "today") s.isTodayCutoffPassed = cutoffPassed;
  }

  // Annotate profileIcon — single bulk read of stage_profiles (P3a).
  // Forward-only: stages without a row stay `null` and the UI handles it.
  const slugs = stages.map((s) => s.slug);
  if (slugs.length > 0) {
    const { data: profiles } = await supabase
      .from("stage_profiles")
      .select("race_slug, profile_icon")
      .in("race_slug", slugs);
    const byslug = new Map<string, StageProfileIcon>();
    for (const p of profiles ?? []) {
      const icon = p.profile_icon as StageProfileIcon | null;
      if (icon) byslug.set(p.race_slug, icon);
    }
    for (const s of stages) {
      const found = byslug.get(s.slug);
      if (found) s.profileIcon = found;
    }
  }

  return stages.filter((s) => s.status !== "past");
}

function phaseToGtSlug(phaseId: 4 | 6 | 8): string {
  return { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" }[phaseId];
}

function isCutoffPassedCET(): boolean {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m >= 11 * 60;
}

function stageStatus(dateIso: string): "past" | "today" | "upcoming" {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso < today) return "past";
  if (dateIso === today) return "today";
  return "upcoming";
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: 0 errors. If `stage_profiles` is unknown → coordinate with P3b.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/gt-stages.ts
git commit -m "feat(web): GtStage carries pre-race profile_icon from stage_profiles (Spec A A7)"
```

---

## Task 4: `<ScoringDocCard />` pedagogical encart (A8)

**Files:**
- Create: `apps/web/components/scoring-doc-card.tsx`
- Create: `apps/web/components/__tests__/scoring-doc-card.test.tsx`

**Why:** Players need to see the new scoring rules in-app, not only in `GAME_RULES.md`. The card lives on the Race Team page as a collapsible section ("How scoring works"), uses Card + Tag patterns from the design system, and lays out the rules in 2-column mini tables matching `docs/mockups/2026-06-02-ui-mockups.html`.

### Why a `<details>` element

Native `<details>`/`<summary>` is keyboard-accessible, no JS needed, and collapses cleanly on mobile. Players read it once, then leave it closed. No need for a controlled state — keeps the component pure.

- [ ] **Step 1: Write the component**

Create `apps/web/components/scoring-doc-card.tsx`:

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";

/**
 * "How scoring works" — pedagogical encart on the Race Team page (Spec A A8).
 * Explains role multipliers, finals barème, stage-hunter rules, sprinter
 * profile gating, and Nemesis profile gating. Constants live in
 * `docs/GAME_RULES.md §11` — this component is human-readable text only.
 *
 * Layout follows `docs/mockups/2026-06-02-ui-mockups.html` (Card + Tag +
 * 2-column mini tables). Uses native <details> for keyboard-accessible
 * collapse with no JS.
 */
export function ScoringDocCard() {
  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"
        // Hide the default ::-webkit-details-marker triangle.
        style={{ listStyle: "none" }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            How scoring works
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            Role multipliers, finals, stage hunter, sprinter and Nemesis rules.
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-[var(--text-low)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        {/* Section 1 — Role multipliers on daily classifications */}
        <Section
          title="Daily classifications"
          subtitle="Bonus you earn when your rider sits in the top of a daily classification."
        >
          <Table2Col
            rows={[
              { label: "GC daily (rider in top 10)", chips: ["GC Leader"], multiplier: "×2" },
              { label: "Points daily (top 5)", chips: ["Sprinter"], multiplier: "×2" },
              { label: "KOM daily (top 3)", chips: ["Climber"], multiplier: "×2" },
              { label: "Youth daily (top 5)", chips: ["GC Leader"], multiplier: "×1.5" },
            ]}
            headers={["Classification", "Role multiplier"]}
          />
          <Note>
            Multiplier only applies when your rider's role matches the classification. A non-matched
            rider in the same top still scores, but at ×1.0.
          </Note>
        </Section>

        {/* Section 2 — Final classifications */}
        <Section
          title="Final classifications"
          subtitle="What you earn when the race ends, from each jersey ranking."
        >
          <Table2Col
            rows={[
              { label: "GC final (PCS points 400/290/240…)", chips: ["GC Leader"], multiplier: "×1.0" },
              { label: "Points final (custom 2-tier)", chips: ["Sprinter"], multiplier: "×2" },
              { label: "KOM final (custom 2-tier)", chips: ["Climber"], multiplier: "×2" },
              { label: "Youth final (custom 2-tier)", chips: ["GC Leader"], multiplier: "×1.5" },
            ]}
            headers={["Final", "Role multiplier"]}
          />
          <Note>
            Secondary finals (Points / KOM / Youth) use a flat barème by rank: <b>80 / 20 / 10</b> on
            GTs and Monuments, <b>40 / 10 / 5</b> on 1-week races. The GC final keeps raw PCS points
            and does not get a role multiplier (it pays the windfall already).
          </Note>
        </Section>

        {/* Section 3 — Stage Hunter */}
        <Section
          title="Stage Hunter"
          subtitle="Rewards riders who animate the race from the breakaway."
        >
          <Bullet>
            <b>×1.5 on the stage result</b> if your rider was in the breakaway (≥ 30 km).
          </Bullet>
          <Bullet>
            <b>+1 pt every 10 km</b> spent in the breakaway, added on top (not multiplied).
          </Bullet>
          <Bullet>
            <b>×1.0</b> on every other stage — Stage Hunter is no longer a free ×1.5.
          </Bullet>
        </Section>

        {/* Section 4 — Sprinter profile gating */}
        <Section
          title="Sprinter"
          subtitle="The Sprinter bonus is gated by stage profile."
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              ×1.5 only on profiles
            </span>
            <Tag variant="highlighted">p1</Tag>
            <Tag variant="highlighted">p2</Tag>
            <Tag variant="highlighted">p3</Tag>
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              (flat + hilly). ×1.0 on p4/p5 (mountain) — your sprinter is just a domestique there.
            </span>
          </div>
        </Section>

        {/* Section 5 — Nemesis profile gating */}
        <Section
          title="Nemesis (tactic)"
          subtitle="Nemesis can only be placed where the duel makes sense."
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                Nemesis Sprint
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">→</span>
              <Tag variant="highlighted">p1</Tag>
              <Tag variant="highlighted">p2</Tag>
              <Tag variant="highlighted">p3</Tag>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                Nemesis GC
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">→</span>
              <Tag variant="highlighted">p3</Tag>
              <Tag variant="highlighted">p4</Tag>
              <Tag variant="highlighted">p5</Tag>
            </div>
          </div>
        </Section>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Internal pieces (kept private to this file)
// ---------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">{subtitle}</p>
        )}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Table2Col({
  rows,
  headers,
}: {
  rows: Array<{ label: string; chips: string[]; multiplier: string }>;
  headers: [string, string];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)]">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
        <span className="text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {headers[0]}
        </span>
        <span className="text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {headers[1]}
        </span>
      </div>
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 last:border-b-0"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
              {r.label}
            </span>
            {r.chips.map((c) => (
              <Tag key={c} variant="highlighted">
                {c}
              </Tag>
            ))}
          </div>
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {r.multiplier}
          </span>
        </div>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] border-l-2 border-l-[var(--accent-label)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--type-caption)] text-[var(--text-mid)]">
      {children}
    </p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-[length:var(--type-caption)] text-[var(--text-mid)] before:mt-1.5 before:size-1 before:shrink-0 before:rounded-full before:bg-[var(--text-low)] before:content-['']">
      <span>{children}</span>
    </p>
  );
}
```

- [ ] **Step 2: Write the tests**

Create `apps/web/components/__tests__/scoring-doc-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoringDocCard } from "../scoring-doc-card";

describe("ScoringDocCard", () => {
  it("renders the summary headline and subtitle", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("How scoring works")).toBeInTheDocument();
    expect(
      screen.getByText(/Role multipliers, finals, stage hunter/i),
    ).toBeInTheDocument();
  });

  it("renders all 5 section titles", () => {
    render(<ScoringDocCard />);
    expect(
      screen.getByRole("heading", { name: "Daily classifications", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Final classifications", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Stage Hunter", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sprinter", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nemesis (tactic)", level: 3 }),
    ).toBeInTheDocument();
  });

  it("renders the daily-classification 2-column table rows", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("GC daily (rider in top 10)")).toBeInTheDocument();
    expect(screen.getByText("Points daily (top 5)")).toBeInTheDocument();
    expect(screen.getByText("KOM daily (top 3)")).toBeInTheDocument();
    expect(screen.getByText("Youth daily (top 5)")).toBeInTheDocument();
  });

  it("renders the final-classification multipliers", () => {
    render(<ScoringDocCard />);
    // ×1.0 on GC final + ×2 / ×1.5 on the secondaries
    expect(screen.getAllByText("×2").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("×1.5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("×1.0")).toBeInTheDocument();
  });

  it("renders the Nemesis profile chips", () => {
    render(<ScoringDocCard />);
    // The chips appear in both sprinter and nemesis sections; assert presence.
    expect(screen.getAllByText("p1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("p4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("p5").length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test --run components/__tests__/scoring-doc-card.test.tsx
```

Expected: 5 passed.

- [ ] **Step 4: Visual sanity at 320px (manual, do not skip)**

In the dev server (Task 9) or via the Storybook-less smoke approach below, open Chrome DevTools, set width to 320px, expand the encart and confirm:
- No horizontal scroll on the body.
- Chips wrap onto the second line, the "×N" cell stays right-aligned.
- The 2-column table rows don't overflow.

If something overflows on 320px, narrow it down to the offending row (most likely the long row labels) and add `flex-wrap` / `min-w-0` as needed — but ONLY using DS tokens.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/scoring-doc-card.tsx apps/web/components/__tests__/scoring-doc-card.test.tsx
git commit -m "feat(web): ScoringDocCard explains the post-P2 scoring rules on Race Team (Spec A A8)"
```

---

## Task 5: Stage list — profile chip + profile-mismatch gating

**Files:**
- Modify: `apps/web/components/tactic-stage-list.tsx`
- Create: `apps/web/components/__tests__/tactic-stage-list.test.tsx`

**Why:** Stop the user from picking an invalid stage in the first place. Two visible signals on each row: (a) the profile chip (always shown when known), (b) the row is disabled + dimmed when the active Nemesis duel type doesn't match the profile.

- [ ] **Step 1: Update `tactic-stage-list.tsx`**

Replace the file contents with:

```tsx
"use client";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import type { GtStage, StageProfileIcon } from "@/lib/gt-stages";

interface Props {
  stages: GtStage[];
  value: string;
  onChange: (v: string) => void;
  fillParent?: boolean;
  /**
   * If set, stages whose `profileIcon` is NOT in the set are rendered
   * disabled and dimmed. Used by Nemesis tactic placement:
   * Nemesis Sprint → {p1,p2,p3}, Nemesis GC → {p3,p4,p5}.
   * Stages without a known profile (`profileIcon == null`) are also disabled
   * when `requiredProfiles` is set — the server-side gate would reject them.
   */
  requiredProfiles?: Set<StageProfileIcon>;
}

export function StageList({ stages, value, onChange, fillParent, requiredProfiles }: Props) {
  return (
    <div
      className={cn(
        "overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]",
        fillParent ? "min-h-0 flex-1" : "max-h-[224px]"
      )}
    >
      <div className="flex flex-col">
        {stages.map((s, i) => {
          const isSelected = value === s.slug;
          const isLocked = !!s.hasTacticActive;
          const isCutoffLocked = s.status === "today" && !!s.isTodayCutoffPassed;
          const isProfileMismatch =
            !!requiredProfiles && (!s.profileIcon || !requiredProfiles.has(s.profileIcon));
          const isDisabled = isLocked || isCutoffLocked || isProfileMismatch;
          const isToday = s.status === "today";
          const isFirst = i === 0;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => !isDisabled && onChange(isSelected ? "" : s.slug)}
              disabled={isDisabled}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                !isFirst && "border-t border-[var(--border-subtle)]",
                isSelected && !isDisabled && "bg-[var(--badge-bg)]",
                !isSelected && !isDisabled && "hover:bg-[var(--bg-surface-hover)]",
                isDisabled && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                    : "border-[var(--border-default)] bg-transparent"
                )}
              >
                {isSelected && (
                  <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="font-mono text-[length:var(--type-emphasis)] font-bold tabular-nums text-[var(--text-high)]">
                  Stage {s.number}
                </span>
                <span className="font-mono text-[length:var(--type-caption)] tabular-nums text-[var(--text-low)]">
                  {s.date}
                </span>
              </div>
              {s.profileIcon && (
                <Tag
                  variant="highlighted"
                  className="text-[length:var(--type-micro)]"
                  data-testid={`profile-chip-${s.slug}`}
                  aria-label={`Profile ${s.profileIcon}`}
                >
                  {s.profileIcon}
                </Tag>
              )}
              {isToday && !isLocked && !isCutoffLocked && !isProfileMismatch && (
                <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
                  Today
                </Tag>
              )}
              {isCutoffLocked && !isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Cutoff
                </span>
              )}
              {isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Tactic set
                </span>
              )}
              {isProfileMismatch && !isLocked && !isCutoffLocked && (
                <span
                  className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]"
                  data-testid={`profile-mismatch-${s.slug}`}
                >
                  Wrong profile
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the tests**

Create `apps/web/components/__tests__/tactic-stage-list.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StageList } from "../tactic-stage-list";
import type { GtStage } from "@/lib/gt-stages";

function makeStage(overrides: Partial<GtStage> = {}): GtStage {
  return {
    number: 1,
    date: "2026-07-04",
    slug: "race/tour-de-france/2026/stage-1",
    status: "upcoming",
    profileIcon: "p1",
    ...overrides,
  };
}

describe("StageList", () => {
  it("renders the profile chip when profileIcon is set", () => {
    const onChange = vi.fn();
    render(
      <StageList
        stages={[makeStage({ profileIcon: "p1" })]}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.getByText("p1")).toBeInTheDocument();
  });

  it("omits the profile chip when profileIcon is null and no requiredProfiles", () => {
    const onChange = vi.fn();
    render(
      <StageList
        stages={[makeStage({ profileIcon: null })]}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.queryByText(/^p[0-5]$/)).not.toBeInTheDocument();
  });

  it("disables the radio when profile does not match requiredProfiles", () => {
    const onChange = vi.fn();
    const stage = makeStage({
      slug: "race/tour-de-france/2026/stage-12",
      profileIcon: "p5",
    });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(
      screen.getByTestId(`profile-mismatch-${stage.slug}`),
    ).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the radio when profileIcon is null but requiredProfiles is set", () => {
    const onChange = vi.fn();
    const stage = makeStage({ profileIcon: null });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("keeps the row enabled when profile matches requiredProfiles", () => {
    const onChange = vi.fn();
    const stage = makeStage({ profileIcon: "p2" });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(stage.slug);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test --run components/__tests__/tactic-stage-list.test.tsx
```

Expected: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/tactic-stage-list.tsx apps/web/components/__tests__/tactic-stage-list.test.tsx
git commit -m "feat(web): tactic stage list shows profile chip + gates Nemesis-incompatible stages (Spec A A7)"
```

---

## Task 6: Nemesis modal — pass requiredProfiles + map error strings

**Files:**
- Modify: `apps/web/components/tactic-nemesis-modal.tsx`
- Create: `apps/web/components/__tests__/tactic-nemesis-modal.test.tsx`

**Why:** Even with the stage-list gating, the server can still reject (`stage_profiles` not yet seeded for a race, or a race-condition between fetch and click). Catch the 3 known strings and replace the raw `e.message` with friendly UI.

### The 3 error strings produced by `place_tactic` v2 (P3a)

- `stage profile unknown for <slug> — run the startlists pipeline first`
- `Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got <icon>`
- `Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got <icon>`

We pattern-match by stable substrings (case-insensitive) so wording can drift slightly server-side without breaking the UI.

- [ ] **Step 1: Add the error mapper at the top of the modal file**

In `apps/web/components/tactic-nemesis-modal.tsx`, add this helper function above the `TacticNemesisModal` component (just below the imports):

```tsx
/**
 * Map raw server errors from `place_tactic` (Spec A P3a) to friendly UI strings.
 * Falls back to the raw message if no pattern matches.
 */
export function mapNemesisErrorMessage(
  raw: string,
  tacticId: "nemesis_gc" | "nemesis_sprint",
): string {
  const m = raw.toLowerCase();
  if (m.includes("stage profile unknown")) {
    return "We don't have a profile for that stage yet. Run the startlists pipeline first, then try again.";
  }
  if (
    tacticId === "nemesis_sprint" &&
    m.includes("nemesis sprint requires")
  ) {
    return "Nemesis Sprint only works on flat or hilly stages (p1/p2/p3). Pick a sprinter-friendly stage.";
  }
  if (tacticId === "nemesis_gc" && m.includes("nemesis gc requires")) {
    return "Nemesis GC only works on hilly-uphill or mountain stages (p3/p4/p5). Pick a stage where the GC is decided.";
  }
  return raw;
}
```

- [ ] **Step 2: Pass `requiredProfiles` to the StageList**

Inside `TacticNemesisModal`, just before the `return` of step 2 (where `<StageList .../>` is rendered, around line 230 in the current file), compute the required-profile set:

```tsx
const requiredProfiles: Set<"p0"|"p1"|"p2"|"p3"|"p4"|"p5"> =
  tacticId === "nemesis_sprint"
    ? new Set(["p1", "p2", "p3"])
    : new Set(["p3", "p4", "p5"]);
```

Then update the StageList call inside the step-2 JSX:

```tsx
<StageList
  stages={stages}
  value={selectedStage}
  onChange={setSelectedStage}
  fillParent
  requiredProfiles={requiredProfiles}
/>
```

- [ ] **Step 3: Map the error in the `declare` handler**

Replace the existing `catch` clause in `declare`:

```tsx
} catch (e: unknown) {
  const raw = e instanceof Error ? e.message : "Failed";
  setErr(mapNemesisErrorMessage(raw, tacticId));
}
```

- [ ] **Step 4: Write the tests**

Create `apps/web/components/__tests__/tactic-nemesis-modal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mapNemesisErrorMessage } from "../tactic-nemesis-modal";

describe("mapNemesisErrorMessage", () => {
  it("maps 'stage profile unknown' to the operator-friendly hint", () => {
    const out = mapNemesisErrorMessage(
      "stage profile unknown for race/tour-de-france/2026/stage-3 — run the startlists pipeline first",
      "nemesis_sprint",
    );
    expect(out).toMatch(/profile for that stage yet/i);
    expect(out).toMatch(/startlists pipeline/i);
  });

  it("maps the Nemesis Sprint mismatch to a friendly string", () => {
    const out = mapNemesisErrorMessage(
      "Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got p5",
      "nemesis_sprint",
    );
    expect(out).toMatch(/flat or hilly/i);
    expect(out).toMatch(/p1\/p2\/p3/);
  });

  it("maps the Nemesis GC mismatch to a friendly string", () => {
    const out = mapNemesisErrorMessage(
      "Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got p1",
      "nemesis_gc",
    );
    expect(out).toMatch(/hilly-uphill or mountain/i);
    expect(out).toMatch(/p3\/p4\/p5/);
  });

  it("falls back to the raw message when nothing matches", () => {
    const out = mapNemesisErrorMessage(
      "tactic cutoff has passed for today stage",
      "nemesis_gc",
    );
    expect(out).toBe("tactic cutoff has passed for today stage");
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && pnpm test --run components/__tests__/tactic-nemesis-modal.test.tsx
```

Expected: 4 passed.

- [ ] **Step 6: Confirm no other test broke**

```bash
cd apps/web && pnpm test --run
```

Expected: baseline count + (4 gt-phases + 5 scoring-doc-card + 5 stage-list + 4 nemesis-modal) = baseline + 18.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/tactic-nemesis-modal.tsx apps/web/components/__tests__/tactic-nemesis-modal.test.tsx
git commit -m "feat(web): Nemesis modal gates stage selector by profile + friendly errors (Spec A A7)"
```

---

## Task 7: Wire it into the Race Team page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`

**Why:** Server component resolves the dynamic label, fetches stages (already returns `profileIcon` since Task 3), and renders `<ScoringDocCard />` above the squad.

- [ ] **Step 1: Resolve the page title via `resolveRaceTeamLabel`**

In `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`, replace the `gtFullName` prop forwarded to `<GtTeamClient>` with the override-aware label. Imports + body:

```tsx
import { resolveRaceTeamLabel } from "@/lib/race-team-label";
// ... existing imports ...

// inside GtTeamPage, after `const phaseId = ...`:
const raceTeamLabel = await resolveRaceTeamLabel(supabase, team.id);

// in the JSX, after the existing in-Promise.all block, render the doc card
// right above <GtTeamClient />:
return (
  <>
    <div className="mb-4">
      <ScoringDocCard />
    </div>
    <GtTeamClient
      teamId={team.id}
      phaseId={phaseId}
      year={year}
      gtFullName={raceTeamLabel}
      // ... rest of the existing props unchanged ...
    />
  </>
);
```

Add the import at the top:

```tsx
import { ScoringDocCard } from "@/components/scoring-doc-card";
```

> The prop is still named `gtFullName` in `GtTeamClient` for backwards-compat — fine to leave for P3c. Renaming is a follow-up cleanup.

- [ ] **Step 2: Update the `InactiveView` copy**

In `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`, the `InactiveView` heading currently uses `GT_FULL_NAME[next.id]`. Leave that as is (it's a "next GT" preview, unrelated to the rename). But change the label "NEXT GRAND TOUR" → keep as-is for now (still accurate when the next active race is a GT). Add a small comment noting the 1-week race version is deferred.

- [ ] **Step 3: Typecheck + tests**

```bash
cd apps/web && pnpm typecheck
cd apps/web && pnpm test --run
```

Expected: 0 type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/page.tsx
git commit -m "feat(web): Race Team page uses dynamic label + ScoringDocCard (Spec A A8/A9)"
```

---

## Task 8: Layout-level sub-tab label (if present)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/layout.tsx` (only if a layout-level Team sub-nav exists)

- [ ] **Step 1: Check whether a layout sub-tab exists**

```bash
grep -rn "getGTSubTabLabel" apps/web/app
```

If `getGTSubTabLabel` is called from a layout / nav file:
- Update the call site to take the override into account by calling `resolveRaceTeamLabel(supabase, team.id)` server-side and passing it as `getGTSubTabLabel(new Date(), { override: label })`.

If `getGTSubTabLabel` is only called from `page.tsx` (already handled in Task 7), skip this task entirely.

- [ ] **Step 2 (conditional): Commit**

If a layout change was needed:

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/layout.tsx
git commit -m "feat(web): Team layout sub-tab uses dynamic Race Team label (Spec A A9)"
```

Otherwise note in the chat / handoff that no layout change was required.

---

## Task 9: Playwright smoke (kept `test.fixme()`)

**Files:**
- Create: `apps/web/e2e/race-team-tab.spec.ts`

**Why:** Existing GT-tactics e2e is also `test.fixme()` until seed data is available. We add the smoke now so it lights up when seeds land.

- [ ] **Step 1: Write the spec**

Create `apps/web/e2e/race-team-tab.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// FIXME: enable once a deterministic seed for the demo league exposes:
//   - an active GT phase OR an active 1-week race campaign
//   - one stage_profiles row per upcoming stage of that race
test.fixme("Race Team tab shows dynamic label + scoring encart", async ({ page }) => {
  await page.goto("/league/demo/team/gt");

  // (1) The page or sub-tab shows the dynamic Race Team label.
  // Either "Tour de France Team" / "Giro Team" / etc. or, off-season, "Race Team".
  await expect(
    page.getByRole("heading", { name: /Team$/ }),
  ).toBeVisible();

  // (2) The scoring encart is present and expandable.
  const summary = page.getByText("How scoring works");
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(page.getByText("Daily classifications")).toBeVisible();
  await expect(page.getByText("Final classifications")).toBeVisible();
  await expect(page.getByText("Nemesis (tactic)")).toBeVisible();
});

test.fixme("Nemesis modal disables stages with wrong profile", async ({ page }) => {
  await page.goto("/league/demo/team/gt");
  // Open the Nemesis Sprint modal (Tactics section → Nemesis Sprint card).
  await page.getByRole("button", { name: /Nemesis Sprint/i }).click();
  // ... rival pick ...
  await page.getByRole("button", { name: /Next/i }).click();
  // A mountain stage (p5) should be disabled with the "Wrong profile" tag.
  const wrongRow = page.getByTestId(
    "profile-mismatch-race/tour-de-france/2026/stage-12",
  );
  await expect(wrongRow).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/e2e/race-team-tab.spec.ts
git commit -m "test(e2e): Race Team tab smoke (test.fixme until seed data) (Spec A A8/A9)"
```

---

## Task 10: Docs

**Files:**
- Modify: `docs/GAME_RULES.md` (§7 — add the scoring-doc-front cross-link)
- Modify: `docs/ARCHITECTURE.md` (front section — new component + dynamic label)

> §11 (Game Constants) and §13 (Tactics) are owned by P3a; do not edit them here.

- [ ] **Step 1: `docs/GAME_RULES.md` §7 — add a scoring-doc-front note**

Append to the end of §7 (Scoring):

```markdown
### In-app scoring documentation (Spec A A8)

A summary of the rules above is rendered to players on the Race Team page via
the `<ScoringDocCard />` component (`apps/web/components/scoring-doc-card.tsx`).
It covers:

- Daily multipliers (gc/points/kom ×2 matched, youth ×1.5) — see §7 + A2.
- Finals (GC ×1.0, Points/KOM ×2, Youth ×1.5; barème 80/20/10 GT · 40/10/5 1-sem) — see A2.
- Stage Hunter (×1.5 in breakaway ≥30 km + 1pt/10 km additive, ×1.0 elsewhere) — see A3.
- Sprinter profile gating (×1.5 only on p1/p2/p3) — see A4.
- Nemesis profile gating (Sprint p1-p3, GC p3-p5) — see A7.

The values are not duplicated in the component — constants stay in §11.
```

- [ ] **Step 2: `docs/ARCHITECTURE.md` — front section**

Under the front-section's Components subsection (or create one if missing), add:

```markdown
- **`<ScoringDocCard />`** — `apps/web/components/scoring-doc-card.tsx`. Native
  `<details>` encart on the Race Team page that explains the post-Spec-A scoring rules
  (role multipliers, finals barème, stage-hunter, sprinter & Nemesis profile gating).
  Pure presentational; constants are not duplicated (see `GAME_RULES.md §11`).
- **Dynamic Race Team tab label** — `apps/web/lib/race-team-label.ts` exposes
  `resolveRaceTeamLabel(supabase, teamId)` returning the active race campaign's
  display name suffixed by " Team" (e.g. "Tour de France Team", "Paris-Nice Team")
  or "Race Team" outside any campaign. `getGTSubTabLabel` accepts an override
  argument to render that label in any nav surface.
```

- [ ] **Step 3: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: scoring doc-front + Race Team label resolver (Spec A A8/A9)"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full test suite**

```bash
cd apps/web && pnpm typecheck
cd apps/web && pnpm test --run
cd apps/web && pnpm lint
```

Expected: 0 errors, baseline tests still pass, all P3c tests pass (≈ 18 added).

- [ ] **Step 2: Build**

```bash
cd apps/web && pnpm build
```

Expected: successful build. If a `useClient`/server-component boundary leak appears (e.g. `getCurrentRaceCampaign` imported into a client file), fix at the call site by keeping the resolver in the server component.

- [ ] **Step 3: Manual browser smoke**

In a separate terminal: `pnpm dev` from the worktree root.

Visit `/league/<your-league-id>/team/gt`:
- Confirm the sub-tab label reads "Race Team" (or "<Race Name> Team" if a campaign is active).
- Confirm the "How scoring works" encart is at the top, collapses/expands smoothly.
- Resize to 320px width — no horizontal overflow inside the encart.
- Open a Nemesis modal and step into the stage selector — each stage row shows a profile chip; mountain stages are visibly disabled for Nemesis Sprint and flat stages disabled for Nemesis GC.

- [ ] **Step 4: Hand off**

Per superpowers, complete the branch via `superpowers:finishing-a-development-branch` (PR vs merge decision is the user's).

---

## Open / known limitations

- **Stages without a `stage_profiles` row** (Giro 2026 stages — never backfilled) are disabled in the Nemesis stage selector when `requiredProfiles` is set. This is intentional — forward-only per P3a — but means the Giro is effectively read-only for Nemesis from the UI side. Acceptable: the Giro is over and the spec is forward-only.
- **No toast library.** Errors render inline below the stage list (existing pattern in `tactic-nemesis-modal.tsx`). If a toast library is later introduced, swap the `setErr(...)` calls in this modal for a toast — and update the mapper accordingly.
- **Sub-tab label outside `page.tsx`.** Task 8 is conditional: if a layout-level Team sub-nav surfaces the label, it also needs the override. If `getGTSubTabLabel` is only called from `page.tsx`, Task 8 is a no-op.
- **`gtFullName` prop in `GtTeamClient`** is now passed the Race Team label and isn't renamed in P3c. Cosmetic rename → flag as backlog.
- **Stage-list profile chip can collide with the "Today" or "Tactic set" tag in tight widths.** The 320px smoke check at Task 4 confirms wrap; the row uses `gap-2.5` so chips push to the next visual line if necessary. If complaints arise on phones, swap the right-aligned cluster to `flex-wrap` justifying right.
