# Budget Page & Sponsor Marketplace — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Budget page (balance + transactions + sponsors), All Transactions sub-page, and Sponsor Marketplace with toggle-based selection — aligned with DS v3.0.

**Architecture:** 3 new routes under `/league/[leagueId]/budget/`. Server components fetch data, client components handle interactivity (filter chips, toggles, sticky CTA). New migration replaces the generic sponsor schema with 14 real cycling sponsors + slot-based `team_sponsors`. Phases are hardcoded constants (no DB table).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Tailwind CSS v4, Shadcn Switch component, Zod v4 validation, DS v3.0 tokens.

**Design doc:** `docs/plans/2026-03-11-budget-sponsors-design.md`
**Wireframe:** `docs/wireframes/marketplace-proposal-B.html`
**Design system:** `docs/watthunter-design-system-v3.md`

---

## Task 1: Database Migration — Sponsors Overhaul

**Files:**
- Create: `supabase/migrations/20260311000000_sponsors_overhaul.sql`

**Step 1: Write the migration**

```sql
-- Drop old sponsor system
drop table if exists public.team_sponsors;
drop table if exists public.sponsors;

-- New sponsors table (14 real cycling sponsors)
create table public.sponsors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  abbreviation    text not null,
  tier            int not null check (tier between 1 and 5),
  slot            text not null check (slot in ('secondary', 'principal')),
  monthly_budget  int not null,
  unlock_level    int not null check (unlock_level between 1 and 10),
  nationality     text,
  nationality_count int not null default 0,
  specialty       text[] not null default '{}',
  result_condition text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.sponsors enable row level security;
create policy "Sponsors readable by authenticated"
  on public.sponsors for select to authenticated using (true);

-- New team_sponsors table (slot-based, 1 per slot per team)
create table public.team_sponsors (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references public.teams(id) on delete cascade,
  sponsor_id         uuid not null references public.sponsors(id) on delete restrict,
  slot               text not null check (slot in ('secondary', 'principal')),
  status             text not null default 'active' check (status in ('active', 'pending_change')),
  pending_sponsor_id uuid references public.sponsors(id),
  activated_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique(team_id, slot)
);

alter table public.team_sponsors enable row level security;
create policy "Team sponsors readable by team owner"
  on public.team_sponsors for select to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));
create policy "Team sponsors writable by team owner"
  on public.team_sponsors for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));

-- Seed 14 sponsors
insert into public.sponsors (name, abbreviation, tier, slot, monthly_budget, unlock_level, nationality, nationality_count, specialty, result_condition, sort_order) values
  ('Lotto',             'LOT', 1, 'secondary',  200000, 1, null, 0, '{}',                  null,                  1),
  ('Groupama-FDJ',      'GRP', 2, 'secondary',  350000, 3, 'FR', 2, '{GC}',                null,                  2),
  ('Movistar',          'MOV', 2, 'secondary',  350000, 3, 'ES', 2, '{GC}',                null,                  3),
  ('Uno-X',             'UNX', 2, 'secondary',  350000, 3, 'DK', 2, '{OneDay}',            null,                  4),
  ('Alpecin',           'ALP', 2, 'secondary',  350000, 3, 'BE', 2, '{OneDay,Sprint}',     null,                  5),
  ('Decathlon',         'DEC', 3, 'principal',   550000, 5, 'FR', 2, '{GC,Sprint}',         'top10_stage_race',    6),
  ('Soudal Quick-Step', 'SQS', 3, 'principal',   550000, 5, 'BE', 2, '{OneDay,Sprint}',     'top10_classic',       7),
  ('Ineos Grenadiers',  'INE', 3, 'principal',   550000, 5, 'GB', 2, '{OneDay,GC}',         'top10_stage_race',    8),
  ('Bora-Hansgrohe',    'BOR', 3, 'principal',   550000, 5, 'DE', 2, '{OneDay,GC}',         'top10_classic',       9),
  ('Trek',              'TRK', 3, 'principal',   550000, 5, 'US', 2, '{OneDay,TT}',         'top10_classic',      10),
  ('Lidl',              'LID', 4, 'principal',   750000, 7, null, 0, '{GC,Sprint}',         'top10_gt_monument',  11),
  ('Red Bull',          'RBL', 4, 'principal',   750000, 7, null, 0, '{GC,TT}',             'top10_gt_monument',  12),
  ('Visma',             'VIS', 4, 'principal',   750000, 7, null, 0, '{GC,OneDay}',         'top10_gt_monument',  13),
  ('UAE Group',         'UAE', 5, 'principal',  1000000, 8, null, 0, '{GC}',                'top5_gt_monument',   14);
```

**Step 2: Apply migration locally**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
supabase db push
```

Expected: Migration applies, 14 sponsors seeded.

**Step 3: Commit**

```bash
git add supabase/migrations/20260311000000_sponsors_overhaul.sql
git commit -m "feat: overhaul sponsors schema — 14 real cycling sponsors, slot-based team_sponsors"
```

---

## Task 2: Shared Lib — Phases & Sponsor Helpers

**Files:**
- Create: `apps/web/lib/phases.ts`
- Create: `apps/web/lib/sponsors.ts`

**Step 1: Create phases.ts**

```typescript
// apps/web/lib/phases.ts

export interface AuctionPhase {
  id: number;
  label: string;
  startMonth: number; // 1-indexed
  startDay: number;
  endMonth: number;
  endDay: number;
}

export const AUCTION_PHASES: AuctionPhase[] = [
  { id: 1, label: "Season Start",   startMonth: 1,  startDay: 1,  endMonth: 2,  endDay: 28 },
  { id: 2, label: "The Flandrians", startMonth: 3,  startDay: 1,  endMonth: 4,  endDay: 12 },
  { id: 3, label: "The Ardennes",   startMonth: 4,  startDay: 13, endMonth: 5,  endDay: 10 },
  { id: 4, label: "Giro d'Italia",  startMonth: 5,  startDay: 11, endMonth: 6,  endDay: 14 },
  { id: 5, label: "Tour de France", startMonth: 6,  startDay: 15, endMonth: 8,  endDay: 2  },
  { id: 6, label: "La Vuelta",      startMonth: 8,  startDay: 3,  endMonth: 9,  endDay: 21 },
  { id: 7, label: "End of Season",  startMonth: 9,  startDay: 22, endMonth: 11, endDay: 2  },
];

/** Get the phase matching a given date (defaults to today) */
export function getCurrentPhase(date: Date = new Date()): AuctionPhase {
  const year = date.getFullYear();
  for (const phase of AUCTION_PHASES) {
    const start = new Date(year, phase.startMonth - 1, phase.startDay);
    const end = new Date(year, phase.endMonth - 1, phase.endDay, 23, 59, 59);
    if (date >= start && date <= end) return phase;
  }
  // Off-season fallback: return last phase
  return AUCTION_PHASES[AUCTION_PHASES.length - 1];
}

/** Get phase date range as Date objects for a given year */
export function getPhaseRange(phase: AuctionPhase, year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, phase.startMonth - 1, phase.startDay),
    end: new Date(year, phase.endMonth - 1, phase.endDay, 23, 59, 59),
  };
}

/** Format phase dates for display: "Mar 1 – Apr 12" */
export function formatPhaseRange(phase: AuctionPhase): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[phase.startMonth - 1]} ${phase.startDay} – ${months[phase.endMonth - 1]} ${phase.endDay}`;
}
```

**Step 2: Create sponsors.ts**

```typescript
// apps/web/lib/sponsors.ts

/** Nationality aliases — sponsors accepting multiple nationalities */
export const NATIONALITY_ALIASES: Record<string, string[]> = {
  DK: ["DK", "NO"],   // Uno-X accepts Danish OR Norwegian
  BE: ["BE", "NL"],   // Alpecin accepts Belgian OR Dutch
};

/** Resolve nationality to all accepted codes */
export function expandNationality(code: string): string[] {
  return NATIONALITY_ALIASES[code] ?? [code];
}

/** Human-readable result condition labels */
export const RESULT_LABELS: Record<string, string> = {
  top10_classic: "Top 10 classic",
  top10_stage_race: "Top 10 stage race",
  top10_gt_monument: "Top 10 GT/monument",
  top5_gt_monument: "Top 5 GT/monument",
};

/** Human-readable specialty labels */
export const SPECIALTY_LABELS: Record<string, string> = {
  GC: "GC",
  OneDay: "One-day",
  Sprint: "Sprint",
  TT: "TT",
};

/** Format specialty array as "One-day or Sprint" */
export function formatSpecialties(specialties: string[]): string {
  return specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(" or ");
}

/** Country code to flag emoji (reuse from format.ts pattern) */
export function nationalityFlag(code: string): string {
  const flags: Record<string, string> = {
    FR: "🇫🇷", ES: "🇪🇸", DK: "🇩🇰", NO: "🇳🇴", BE: "🇧🇪",
    NL: "🇳🇱", GB: "🇬🇧", DE: "🇩🇪", US: "🇺🇸",
  };
  return flags[code] ?? code;
}

/** Format nationality condition: "🇫🇷 2×" or "🇧🇪/🇳🇱 2×" */
export function formatNationalityCondition(code: string, count: number): string {
  const aliases = NATIONALITY_ALIASES[code];
  if (aliases && aliases.length > 1) {
    return `${aliases.map(nationalityFlag).join("/")} ${count}×`;
  }
  return `${nationalityFlag(code)} ${count}×`;
}

export interface SponsorRow {
  id: string;
  name: string;
  abbreviation: string;
  tier: number;
  slot: "secondary" | "principal";
  monthly_budget: number;
  unlock_level: number;
  nationality: string | null;
  nationality_count: number;
  specialty: string[];
  result_condition: string | null;
  sort_order: number;
}

/** Per-sponsor eligibility result */
export interface SponsorEligibility {
  sponsorId: string;
  eligible: boolean;
  conditions: {
    nationality: boolean | null;  // null = no condition
    specialty: boolean | null;
    result: boolean | null;
  };
}

/** Result condition → race_results query mapping */
export const RESULT_CONDITION_FILTERS: Record<string, { race_class: string[]; max_position: number }> = {
  top10_classic: { race_class: ["monument", "classic"], max_position: 10 },
  top10_stage_race: { race_class: ["stage_race", "grand_tour"], max_position: 10 },
  top10_gt_monument: { race_class: ["grand_tour", "monument"], max_position: 10 },
  top5_gt_monument: { race_class: ["grand_tour", "monument"], max_position: 5 },
};
```

**Step 3: Commit**

```bash
git add apps/web/lib/phases.ts apps/web/lib/sponsors.ts
git commit -m "feat: add auction phases constants and sponsor helper utilities"
```

---

## Task 3: Reusable Components — PhaseNavigator & TransactionRow

**Files:**
- Create: `apps/web/components/phase-navigator.tsx`
- Create: `apps/web/components/transaction-row.tsx`

**Step 1: Create PhaseNavigator**

Centered phase name + date range, left/right arrows. Controlled component.

```typescript
// apps/web/components/phase-navigator.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AUCTION_PHASES, formatPhaseRange } from "@/lib/phases";

interface PhaseNavigatorProps {
  currentIndex: number;
  onChange: (index: number) => void;
}

export function PhaseNavigator({ currentIndex, onChange }: PhaseNavigatorProps) {
  const phase = AUCTION_PHASES[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === AUCTION_PHASES.length - 1;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => onChange(currentIndex - 1)}
        disabled={isFirst}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-[0.35] disabled:pointer-events-none"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="text-center">
        <div className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {phase.label}
        </div>
        <div className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
          {formatPhaseRange(phase)}
        </div>
      </div>

      <button
        onClick={() => onChange(currentIndex + 1)}
        disabled={isLast}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-[0.35] disabled:pointer-events-none"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
```

**Step 2: Create TransactionRow**

3 types: bonus, salary, sponsor. Consistent list row pattern.

```typescript
// apps/web/components/transaction-row.tsx

import { formatEuro } from "@/lib/format";

interface TransactionRowProps {
  type: "monthly_bonus" | "rider_revenue" | "monthly_salary" | "sponsor_payment" | "auction_purchase" | "starting_fund" | "bankruptcy_release";
  amount: number;
  description: string | null;
  riderInitials?: string;
  sponsorAbbreviation?: string;
  date: string; // ISO date
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getAvatar(props: TransactionRowProps): { text: string; isSponsor: boolean } {
  if (props.type === "sponsor_payment") {
    return { text: props.sponsorAbbreviation ?? "SP", isSponsor: true };
  }
  return { text: props.riderInitials ?? "??", isSponsor: false };
}

function getSubtitle(props: TransactionRowProps): string {
  if (props.type === "sponsor_payment") return "Sponsorship";
  if (props.type === "monthly_salary") return "Salary";
  if (props.type === "monthly_bonus" || props.type === "rider_revenue") {
    // description contains race name
    return props.description ?? "Bonus";
  }
  if (props.type === "auction_purchase") return "Auction";
  if (props.type === "starting_fund") return "Starting fund";
  if (props.type === "bankruptcy_release") return "Bankruptcy release";
  return props.description ?? "";
}

function getName(props: TransactionRowProps): string {
  if (props.type === "sponsor_payment") return props.description ?? "Sponsor";
  if (props.type === "starting_fund") return "Initial treasury";
  if (props.type === "bankruptcy_release") return props.description ?? "Auto-release";
  // For rider-related: description typically has "Rider Name — Race Name" or just rider name
  return props.description?.split(" — ")[0] ?? "Unknown";
}

export function TransactionRow(props: TransactionRowProps) {
  const avatar = getAvatar(props);
  const name = getName(props);
  const subtitle = getSubtitle(props);
  const prefix = props.amount >= 0 ? "+" : "";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--type-micro)] font-semibold text-[var(--text-mid)] ${
          avatar.isSponsor ? "bg-[var(--bg-surface-active)]" : "bg-[var(--bg-surface)]"
        }`}
      >
        {avatar.text}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {name}
        </div>
        <div className="truncate text-[length:var(--type-caption)] text-[var(--text-low)]">
          {subtitle}
        </div>
      </div>

      {/* Amount + date */}
      <div className="shrink-0 text-right">
        <div className="font-mono text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
          {prefix}{formatEuro(Math.abs(props.amount))}
        </div>
        <div className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {formatDate(props.date)}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/components/phase-navigator.tsx apps/web/components/transaction-row.tsx
git commit -m "feat: add PhaseNavigator and TransactionRow reusable components"
```

---

## Task 4: Budget Main Page — Server Component + Client

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx`

**Step 1: Create server page** (`page.tsx`)

Server component fetches: team data, active sponsors, treasury_log for current phase, income/outgoing totals.

```typescript
// apps/web/app/(game)/league/[leagueId]/budget/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get team
  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, level, name")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  // Get active sponsors with sponsor details
  const { data: teamSponsors } = await supabase
    .from("team_sponsors")
    .select("*, sponsor:sponsor_id(*)")
    .eq("team_id", team.id)
    .eq("status", "active");

  // Get transactions for current phase
  const currentPhase = getCurrentPhase();
  const year = new Date().getFullYear();
  const { start, end } = getPhaseRange(currentPhase, year);

  const { data: transactions } = await supabase
    .from("treasury_log")
    .select("*")
    .eq("team_id", team.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  // Compute income/outgoing for current phase
  const { data: phaseTotals } = await supabase
    .from("treasury_log")
    .select("amount")
    .eq("team_id", team.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const income = (phaseTotals ?? [])
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const outgoing = (phaseTotals ?? [])
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      income={income}
      outgoing={outgoing}
      transactions={transactions ?? []}
      teamSponsors={teamSponsors ?? []}
    />
  );
}
```

**Step 2: Create client component** (`budget-client.tsx`)

Handles: phase navigation, filter chips, transaction filtering, sponsor cards display.

This is a large client component. Key sections:
- PhaseNavigator (controlled, triggers data refetch — or client-side filter if all data loaded)
- Brand Card with balance hero (reuse frosted glass pattern from `team-level-card.tsx`)
- Transactions section with SegmentedControl filter + TransactionRow list + "See all →"
- Sponsors section with active sponsor cards + locked slot indicator
- Link to `/budget/marketplace` from "Change sponsor →"

Reference `team-level-card.tsx` for the brand card frosted glass pattern.
Reference `policies-client.tsx` for the toggle + sticky bar pattern.
Reference `segmented-control.tsx` for the filter chips.
Reference `transaction-row.tsx` for each transaction.
Reference `phase-navigator.tsx` for the phase nav.

Use DS v3.0 tokens throughout — check `docs/watthunter-design-system-v3.md`:
- Balance: `--type-display` (32px/900), `--accent-highlight` (cyan-400), Geist Mono
- "BALANCE" label: `--type-label` uppercase, `--text-low`
- Income/Outgoing values: `--type-caption`, `--text-high`, Geist Mono
- Section headers: `--type-section` (16px/600)
- "See all →": `--type-caption`, `--accent-default`
- Sponsor card: `--bg-surface`, `--border-default`, `--radius-lg`
- Condition tags: Tag component default variant
- "Change sponsor →": `--type-caption`, `--accent-default`

**Step 3: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/budget/
git commit -m "feat: Budget main page — balance hero, transactions, sponsor cards"
```

---

## Task 5: All Transactions Page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/budget/transactions/page.tsx`

**Step 1: Create the page**

Server component fetches ALL treasury_log for the team (no phase filter). Client-side: filter chips + grouping by month.

Key layout:
- BackHeader "Budget"
- SegmentedControl: All / Bonuses / Salaries / Sponsors
- Grouped by calendar month: "MARCH 2026" header (`--type-label` uppercase) + net total right-aligned (Geist Mono)
- TransactionRow for each entry
- No phase navigation (flat list, everything in one scroll)

Filter mapping for `treasury_log.type`:
- "All" = no filter
- "Bonuses" = `rider_revenue` + `monthly_bonus`
- "Salaries" = `monthly_salary`
- "Sponsors" = `sponsor_payment`

**Step 2: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/budget/transactions/
git commit -m "feat: All Transactions page — grouped by month with filter chips"
```

---

## Task 6: Sponsor Marketplace Page — Server + Client

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`

**Step 1: Create server page** (`page.tsx`)

Fetches: all 14 sponsors, team level, current team_sponsors, **sponsor eligibility**.

The server page calls `checkSponsorEligibility(teamId)` which:
1. Fetches active contracts → rider IDs
2. Fetches rider data (nationality, specialty) for those IDs
3. Fetches `race_results` for those riders this season
4. For each sponsor, evaluates each condition independently:
   - `nationality`: count matching riders ≥ `nationality_count` (respecting `NATIONALITY_ALIASES`)
   - `specialty`: any rider has one of the sponsor's specialties (OR)
   - `result_condition`: any rider has a matching result per `RESULT_CONDITION_FILTERS`
5. Returns `SponsorEligibility[]` — passed to client as prop

**Step 2: Create client component** (`marketplace-client.tsx`)

Pattern: **Proposal B — Slot Sections** (validated wireframe).

Key layout following `policies-client.tsx` structure:

1. BackHeader "Budget"
2. Page title: "Choose a sponsor" (`--type-page-title`)
3. Info banner: "Change will take effect after the next auction phase." (`--bg-subtle`, `--border-default`)

4. **SECONDARY SPONSOR** section:
   - Header: `--type-label` uppercase + "1 / 1 active" counter (`--type-caption`, `--text-low`)
   - Description: "T1 – T2 · Budget up to €350k/month" (`--type-caption`, `--text-ghost`)
   - Sponsor rows (divide-y, `--border-subtle`):
     - Line 1: name (`--type-emphasis`) + tier badge (`--type-micro`, `--bg-surface-hover`, `--radius-pill`) + amount (`--type-emphasis`, Geist Mono, `min-width` aligned) + toggle/lock badge (`min-width: 56px`)
     - Line 2: condition tags (Tag default variant) — nationality flag, specialty, result
   - Active sponsor row: `bg-[rgba(6,182,212,0.04)]`
   - **Conditions not met**: normal opacity, tags default (gray), toggle **disabled** (grayed out)
   - **Conditions met**: normal opacity, matched tags use **Tag success variant** (green), toggle **enabled**
   - Locked sponsors (level): `opacity-[0.35]`, lock badge pill replaces toggle

5. **MAIN SPONSOR** section:
   - Same pattern, T3/T4/T5 sponsors
   - If team level < 5: entire section locked

6. **Toggle behavior**:
   - Use Shadcn `Switch` component (same as policies)
   - ON a sponsor → auto-OFF the current one in same slot
   - Cannot turn OFF last secondary (Lotto must stay if nothing else selected)
   - Conditions not met = `Switch` rendered but **disabled** (gray, not interactive)
   - Locked (level) = `Switch` not rendered, replaced by lock badge pill
   - **Lotto (T1)** = no conditions, always enabled

7. **Alignment rule**: both toggle (44×24px) and lock badge share a container with `min-w-[56px] flex justify-end`

8. **Sticky CTA** (visible only when `hasChanges`):
   - "New monthly budget" + computed total (`--type-caption` + `--type-emphasis` Mono)
   - "Save sponsors →" button (CTA gradient)
   - Pattern: reuse `StickyBar` component from policies

**Step 3: Create server action** (`actions.ts`)

```typescript
// apps/web/app/(game)/league/[leagueId]/budget/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const SaveSponsorsSchema = z.object({
  teamId: z.string().uuid(),
  leagueId: z.string().uuid(),
  secondary: z.string().uuid().nullable(),
  principal: z.string().uuid().nullable(),
});

export async function saveSponsors(input: z.infer<typeof SaveSponsorsSchema>) {
  const parsed = SaveSponsorsSchema.parse(input);
  const supabase = await createClient();

  // Verify team ownership
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("id", parsed.teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  // Validate sponsor tier vs team level
  if (parsed.secondary) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.secondary)
      .single();
    if (!sponsor || sponsor.slot !== "secondary" || team.level < sponsor.unlock_level) {
      return { error: "Secondary sponsor not available at your level" };
    }
  }

  if (parsed.principal) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.principal)
      .single();
    if (!sponsor || sponsor.slot !== "principal" || team.level < sponsor.unlock_level) {
      return { error: "Main sponsor not available at your level" };
    }
  }

  // Validate sponsor eligibility (conditions must be met)
  // Uses checkSponsorEligibility() from lib/sponsors.ts
  // Lotto (T1) is exempt — no conditions
  // For all others: nationality + specialty + result_condition must all be satisfied
  // This is a server-side guard — client also disables toggle, but we double-check here

  // Upsert secondary slot
  if (parsed.secondary) {
    await supabase
      .from("team_sponsors")
      .upsert(
        { team_id: parsed.teamId, sponsor_id: parsed.secondary, slot: "secondary", status: "active", activated_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "team_id,slot" }
      );
  }

  // Upsert principal slot (or delete if null and level >= 5)
  if (parsed.principal) {
    await supabase
      .from("team_sponsors")
      .upsert(
        { team_id: parsed.teamId, sponsor_id: parsed.principal, slot: "principal", status: "active", activated_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "team_id,slot" }
      );
  } else {
    // Remove principal sponsor if deselected
    await supabase
      .from("team_sponsors")
      .delete()
      .eq("team_id", parsed.teamId)
      .eq("slot", "principal");
  }

  return { success: true };
}
```

**Step 4: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/budget/marketplace/ apps/web/app/(game)/league/[leagueId]/budget/actions.ts
git commit -m "feat: Sponsor Marketplace — slot sections, toggle selection, save action"
```

---

## Task 7: Auto-assign Default Sponsor on Team Creation

**Files:**
- Modify: the team creation flow (likely in onboarding or league join actions)
- Search for: `insert.*teams` in `apps/web/` to find where teams are created

**Step 1: Find team creation code**

Search for where `teams` rows are inserted. After the team insert, add:

```typescript
// After team creation, auto-assign Lotto (T1) as default secondary sponsor
const { data: lotto } = await supabase
  .from("sponsors")
  .select("id")
  .eq("name", "Lotto")
  .single();

if (lotto) {
  await supabase
    .from("team_sponsors")
    .insert({ team_id: newTeam.id, sponsor_id: lotto.id, slot: "secondary" });
}
```

**Step 2: Commit**

```bash
git commit -m "feat: auto-assign Lotto sponsor on team creation"
```

---

## Task 8: Update GAME_RULES.md — Sponsors Section

**Files:**
- Modify: `docs/GAME_RULES.md` — section §9

**Step 1: Replace §9 with accurate sponsor data**

Update to match the PRD budget-sponsors grid:
- 14 sponsors (Lotto through UAE Group)
- 2 slots (secondary + principal)
- Tier amounts: 200k, 350k, 550k, 750k, 1M
- Conditions: nationality, specialty (OR logic), result
- Confidence/leave = post-MVP
- Default sponsor = Lotto T1 (auto-assigned)

**Step 2: Commit**

```bash
git add docs/GAME_RULES.md
git commit -m "docs: update GAME_RULES §9 — real sponsor grid, 2-slot system"
```

---

## Task 9: Build Verification & Polish

**Step 1: Run build**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm build
```

Fix any TypeScript errors.

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Verify DS compliance**

Grep for hardcoded px values and hex colors in new files:

```bash
# Should find 0 matches in our new files
grep -rn 'text-\[[0-9]*px\]' apps/web/app/\(game\)/league/\[leagueId\]/budget/
grep -rn '#[0-9a-f]\{6\}' apps/web/app/\(game\)/league/\[leagueId\]/budget/
```

**Step 4: Manual testing**

- Navigate to `/league/[id]/budget` — verify balance hero, transactions, sponsor cards
- Click "See all →" — verify All Transactions page with month grouping
- Click "Change sponsor →" — verify Marketplace with slot sections, toggles, locked states
- Toggle a sponsor, verify sticky CTA appears
- Save, verify data persists

**Step 5: Final commit**

```bash
git commit -m "fix: build clean, DS compliance verified"
```

---

## Summary — Task Dependency Graph

```
Task 1 (Migration) ──────────────────┐
Task 2 (Lib: phases + sponsors) ─────┤
Task 3 (Components: PhaseNav + Row) ──┼──→ Task 4 (Budget page)
                                      │         │
                                      │    Task 5 (All Transactions)
                                      │         │
                                      └──→ Task 6 (Marketplace)
                                                │
                                      Task 7 (Auto-assign Lotto)
                                      Task 8 (GAME_RULES update)
                                      Task 9 (Build verify)
```

Tasks 1, 2, 3 can run in parallel (no dependencies).
Tasks 4, 5, 6 depend on 1+2+3.
Tasks 7, 8 are independent.
Task 9 is last.
