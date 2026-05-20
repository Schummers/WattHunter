# Market & Auctions Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2-state Market with a 3 sub-tab system (My Team / Market / Auctions), simplify economics (free release, forced balance, no bankruptcy), and add a draft bid workflow.

**Architecture:** New `draft_bids` DB table stores uncommitted bids. Market page becomes browse-only with "Add to Draft". New Auctions sub-tab centralizes all round validation, sponsor/policy changes, and budget management. Sticky bar shows real-time budget state.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Tailwind CSS v4, Shadcn UI, Zod v4, TypeScript strict.

**Spec:** `docs/plans/2026-04-03-market-auctions-redesign-spec.md`

**Wireframes:** `.superpowers/brainstorm/1316-1775198695/content/auctions-v7.html` (normal state), `auctions-v4.html` (deficit state, mockup B)

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260403000000_draft_bids_and_economy.sql` | Draft bids table, remove release_fee/transfer_bonus treasury types |
| `apps/web/app/(game)/league/[leagueId]/team/auctions/page.tsx` | Auctions sub-tab server page |
| `apps/web/app/(game)/league/[leagueId]/team/auctions/auctions-client.tsx` | Auctions client component (main UI) |
| `apps/web/app/(game)/league/[leagueId]/team/auctions/actions.ts` | Server actions: addDraft, removeDraft, updateDraft, validateRound |
| `apps/web/components/round-blocks.tsx` | Rounds display (3 blocks with dates/times) |
| `apps/web/components/draft-bid-card.tsx` | Draft bid row (name + bid input + trash) |
| `apps/web/components/budget-summary.tsx` | Summary box (income, salaries, drafts, remaining) |
| `apps/web/components/config-cards.tsx` | Sponsor + Policy 2-column cards |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/app/(game)/league/[leagueId]/team/layout.tsx` | Add "Auctions" sub-tab |
| `apps/web/app/(game)/league/[leagueId]/team/market/page.tsx` | Remove phase-setup gating, always show market |
| `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx` | Replace "Save" with "Add to Draft", remove MyBids tab, remove country filter |
| `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` | Action bar: Add to Draft / Cancel Draft / Release |
| `apps/web/components/sticky-bar.tsx` | Add deficit state (red text, disabled button) |
| `apps/web/lib/format.ts` | Remove `RELEASE_FEE`, `calcTransferBonus` |
| `apps/web/components/rider-card.tsx` | Add chevron after name, ensure boost tag + spec display |

### Deleted Files
| File | Reason |
|------|--------|
| `apps/web/app/(game)/league/[leagueId]/team/market/phase-setup.tsx` | Replaced by Auctions sub-tab |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260403000000_draft_bids_and_economy.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Draft bids table
CREATE TABLE draft_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount >= 5000 AND amount % 500 = 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, rider_id)
);

-- RLS: team members can manage their own drafts
ALTER TABLE draft_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read their drafts"
  ON draft_bids FOR SELECT
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert their drafts"
  ON draft_bids FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their drafts"
  ON draft_bids FOR UPDATE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete their drafts"
  ON draft_bids FOR DELETE
  USING (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN league_members lm ON lm.team_id = t.id
      WHERE lm.user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_draft_bids_team ON draft_bids(team_id);
CREATE INDEX idx_draft_bids_league ON draft_bids(league_id);
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
supabase db push
```

Expected: Migration applied, `draft_bids` table created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260403000000_draft_bids_and_economy.sql
git commit -m "feat(db): add draft_bids table for auction redesign"
```

---

## Task 2: Lib Changes — Remove Release Fee, Add Draft Helpers

**Files:**
- Modify: `apps/web/lib/format.ts`

- [ ] **Step 1: Read format.ts to identify release_fee and transfer_bonus code**

```bash
grep -n "RELEASE_FEE\|calcTransferBonus\|transfer_bonus\|release_fee" apps/web/lib/format.ts
```

- [ ] **Step 2: Remove RELEASE_FEE constant and calcTransferBonus function**

Remove the `RELEASE_FEE` constant (should be `5000`) and the `calcTransferBonus` function. Keep `calcMinSalary`, `formatEuro`, `formatThousands`, `smartCountdown`, `countryCodeToFlag`.

- [ ] **Step 3: Search for all usages of RELEASE_FEE and calcTransferBonus in the codebase**

```bash
grep -rn "RELEASE_FEE\|calcTransferBonus" apps/web/
```

Remove or update all references. Key locations:
- `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` (releaseRider action)
- Any component showing release fee to the user

- [ ] **Step 4: Update releaseRider action — remove fee deduction and transfer bonus**

In the `releaseRider` server action, remove:
- Treasury deduction of `RELEASE_FEE`
- Treasury credit of transfer bonus
- Keep: contract status update to `released`, deletion of active bids for that rider

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove release fee and transfer bonus from economy"
```

---

## Task 3: Sub-tabs Layout — Add Auctions Tab

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/layout.tsx`

- [ ] **Step 1: Add Auctions tab to SubTabs**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;
  const hideTabs = pathname.includes("/policies");

  return (
    <>
      {!hideTabs && (
        <SubTabs
          tabs={[
            { label: "My Team", href: `/league/${leagueId}/team` },
            { label: "Market", href: `/league/${leagueId}/team/market` },
            { label: "Auctions", href: `/league/${leagueId}/team/auctions` },
          ]}
        />
      )}
      {children}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/layout.tsx
git commit -m "feat(nav): add Auctions sub-tab to team layout"
```

---

## Task 4: Draft Bid Server Actions

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/auctions/actions.ts`

- [ ] **Step 1: Write draft bid CRUD actions**

```ts
"use server";

import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { revalidatePath } from "next/cache";
import { calcMinSalary } from "@/lib/format";

const DraftBidSchema = z.object({
  leagueId: z.uuid(),
  riderId: z.uuid(),
  amount: z.number().int().min(5000).refine((n) => n % 500 === 0, "Must be multiple of 500"),
});

export async function addDraft(input: z.infer<typeof DraftBidSchema>) {
  const parsed = DraftBidSchema.parse(input);
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();

  // Get team
  const { data: member } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", parsed.leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) throw new Error("Not a league member");

  // Check rider exists and get min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("id, pcs_points_1yr")
    .eq("id", parsed.riderId)
    .single();

  if (!rider) throw new Error("Rider not found");

  const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);
  if (parsed.amount < minSalary) throw new Error(`Amount must be >= ${minSalary}`);

  // Check not already in roster
  const { count: contractCount } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("team_id", member.team_id)
    .eq("rider_id", parsed.riderId)
    .eq("status", "active");

  if ((contractCount ?? 0) > 0) throw new Error("Rider already in roster");

  // Upsert draft bid
  const { error } = await supabase
    .from("draft_bids")
    .upsert(
      {
        team_id: member.team_id,
        rider_id: parsed.riderId,
        league_id: parsed.leagueId,
        amount: parsed.amount,
      },
      { onConflict: "team_id,rider_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath(`/league/${parsed.leagueId}/team/auctions`);
  revalidatePath(`/league/${parsed.leagueId}/team/market`);
  return { success: true };
}

export async function removeDraft(input: { leagueId: string; riderId: string }) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", input.leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) throw new Error("Not a league member");

  await supabase
    .from("draft_bids")
    .delete()
    .eq("team_id", member.team_id)
    .eq("rider_id", input.riderId);

  revalidatePath(`/league/${input.leagueId}/team/auctions`);
  revalidatePath(`/league/${input.leagueId}/team/market`);
  return { success: true };
}

export async function updateDraftAmount(input: {
  leagueId: string;
  riderId: string;
  amount: number;
}) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  if (input.amount % 500 !== 0) throw new Error("Must be multiple of 500");

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", input.leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) throw new Error("Not a league member");

  // Get rider min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("pcs_points_1yr")
    .eq("id", input.riderId)
    .single();

  const minSalary = calcMinSalary(rider?.pcs_points_1yr ?? 0);
  if (input.amount < minSalary) throw new Error(`Amount must be >= ${minSalary}`);

  await supabase
    .from("draft_bids")
    .update({ amount: input.amount })
    .eq("team_id", member.team_id)
    .eq("rider_id", input.riderId);

  revalidatePath(`/league/${input.leagueId}/team/auctions`);
  return { success: true };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/actions.ts
git commit -m "feat(auctions): add draft bid CRUD server actions"
```

---

## Task 5: Validate Round Server Action

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/auctions/actions.ts`

- [ ] **Step 1: Add validateRound action to the existing actions file**

This action:
1. Checks an auction round is open
2. Verifies budget ≥ 0 (sponsor income − roster salaries − draft bids)
3. Verifies total slots (roster + drafts) ≤ maxSlots
4. Converts all draft_bids → auction_bids with status "active"
5. If Round 1: applies pending sponsor/policy changes, debits salaries, credits sponsor income
6. Clears draft_bids for this team

```ts
export async function validateRound(input: { leagueId: string }) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createClient();

  // Get team + member
  const { data: member } = await supabase
    .from("league_members")
    .select("team_id, teams:team_id(id, level, cumulative_xp, sponsor_id, treasury)")
    .eq("league_id", input.leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) throw new Error("Not a league member");
  const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
  if (!team) throw new Error("Team not found");

  // Get open auction round
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, round, status")
    .eq("league_id", input.leagueId)
    .eq("status", "open")
    .order("round", { ascending: true })
    .limit(1)
    .single();

  if (!auction) throw new Error("No open auction round");

  // Get draft bids
  const { data: drafts } = await supabase
    .from("draft_bids")
    .select("rider_id, amount")
    .eq("team_id", team.id)
    .eq("league_id", input.leagueId);

  // Get current roster contracts
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, rider_id, locked_salary")
    .eq("team_id", team.id)
    .eq("status", "active");

  const rosterSalaries = (contracts ?? []).reduce((sum, c) => sum + c.locked_salary, 0);
  const draftTotal = (drafts ?? []).reduce((sum, d) => sum + d.amount, 0);
  const rosterCount = contracts?.length ?? 0;
  const draftCount = drafts?.length ?? 0;

  // Get sponsor budget
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("monthly_budget")
    .eq("id", team.sponsor_id)
    .single();

  const sponsorIncome = sponsor?.monthly_budget ?? 0;

  // Budget check
  const remaining = sponsorIncome - rosterSalaries - draftTotal;
  if (remaining < 0) throw new Error(`Budget deficit: ${remaining}. Remove riders or lower bids.`);

  // Slot check — read maxSlots from lib
  // Note: import getMaxSlots and getLevelForXp from @/lib/levels at top of file
  const maxSlots = (await import("@/lib/levels")).getMaxSlots(team.level);
  if (rosterCount + draftCount > maxSlots) {
    throw new Error(`Too many riders: ${rosterCount + draftCount}/${maxSlots}`);
  }

  // Convert drafts → auction_bids
  if (drafts && drafts.length > 0) {
    const bids = drafts.map((d) => ({
      auction_id: auction.id,
      team_id: team.id,
      rider_id: d.rider_id,
      amount: d.amount,
      round: auction.round,
      status: "active" as const,
    }));

    const { error: bidError } = await supabase.from("auction_bids").insert(bids);
    if (bidError) throw new Error(bidError.message);

    // Clear drafts
    await supabase
      .from("draft_bids")
      .delete()
      .eq("team_id", team.id)
      .eq("league_id", input.leagueId);
  }

  // If Round 1: debit salaries + credit sponsor (payday)
  if (auction.round === 1) {
    const totalDebit = rosterSalaries + draftTotal;
    const newTreasury = (team.treasury ?? 0) + sponsorIncome - totalDebit;

    await supabase
      .from("teams")
      .update({ treasury: newTreasury })
      .eq("id", team.id);

    // Log treasury movements
    await supabase.from("treasury_log").insert([
      {
        team_id: team.id,
        type: "sponsor_income",
        amount: sponsorIncome,
        description: `Phase sponsor income`,
      },
      {
        team_id: team.id,
        type: "salary_deduction",
        amount: -totalDebit,
        description: `Phase salaries (${rosterCount} roster + ${draftCount} bids)`,
      },
    ]);
  }

  revalidatePath(`/league/${input.leagueId}/team/auctions`);
  revalidatePath(`/league/${input.leagueId}/team`);
  return { success: true };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/actions.ts
git commit -m "feat(auctions): add validateRound server action with budget enforcement"
```

---

## Task 6: Shared UI Components

**Files:**
- Create: `apps/web/components/round-blocks.tsx`
- Create: `apps/web/components/config-cards.tsx`
- Create: `apps/web/components/budget-summary.tsx`
- Create: `apps/web/components/draft-bid-card.tsx`

- [ ] **Step 1: Create RoundBlocks component**

```tsx
// apps/web/components/round-blocks.tsx
"use client";

interface Round {
  id: string;
  round: number;
  opens_at: string;
  closes_at: string;
  status: string;
}

interface RoundBlocksProps {
  rounds: Round[];
  activeRound: number | null;
}

export function RoundBlocks({ rounds, activeRound }: RoundBlocksProps) {
  return (
    <div className="flex gap-2 px-4 mt-2">
      {rounds.map((r) => {
        const isActive = r.round === activeRound;
        const date = new Date(r.opens_at);
        return (
          <div
            key={r.id}
            className={`flex-1 rounded-lg p-2 text-center border ${
              isActive
                ? "border-[var(--accent-default)] bg-[rgba(6,182,212,0.05)]"
                : "border-[var(--border-default)] bg-[var(--bg-surface)]"
            }`}
          >
            <div
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                isActive ? "text-[var(--accent-default)]" : "text-[var(--text-low)]"
              }`}
            >
              Round {r.round}
            </div>
            <div className={`text-[length:var(--type-body)] font-mono mt-0.5 ${
              isActive ? "text-[var(--text-high)]" : "text-[var(--text-mid)]"
            }`}>
              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-low)]">
              {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create ConfigCards component**

```tsx
// apps/web/components/config-cards.tsx
"use client";

import Link from "next/link";

interface ConfigCardsProps {
  leagueId: string;
  sponsorName: string;
  sponsorBudget: number;
  policies: Array<{ name: string; value: string; boostPct: number }>;
  maxPolicies: number;
  isEditable: boolean;
}

export function ConfigCards({
  leagueId,
  sponsorName,
  sponsorBudget,
  policies,
  maxPolicies,
  isEditable,
}: ConfigCardsProps) {
  const formatBudget = (n: number) =>
    n >= 1000000 ? `€${(n / 1000000).toFixed(1)}M` : `€${Math.round(n / 1000)}k`;

  return (
    <div className="flex gap-2 px-4 mt-2">
      {/* Sponsor card */}
      <div className="flex-1 bg-[var(--bg-surface)] rounded-lg p-2.5 border border-[var(--border-default)] relative">
        {isEditable && (
          <Link
            href={`/league/${leagueId}/team/auctions?changeMode=sponsor`}
            className="absolute top-2.5 right-2.5 text-[10px] text-[var(--accent-default)]"
          >
            Change →
          </Link>
        )}
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
          Sponsor
        </div>
        <div className="text-[12px] font-medium text-[var(--text-high)] mt-1">
          {sponsorName}
        </div>
        <div className="text-[11px] font-mono text-[var(--text-mid)] mt-0.5">
          {formatBudget(sponsorBudget)}/phase
        </div>
      </div>

      {/* Policies card */}
      <div className="flex-1 bg-[var(--bg-surface)] rounded-lg p-2.5 border border-[var(--border-default)] relative">
        {isEditable && (
          <Link
            href={`/league/${leagueId}/team/policies`}
            className="absolute top-2.5 right-2.5 text-[10px] text-[var(--accent-default)]"
          >
            Change →
          </Link>
        )}
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
          Policies{" "}
          <span className="font-mono text-[var(--text-mid)]">
            {policies.length}/{maxPolicies}
          </span>
        </div>
        {policies.map((p) => (
          <div key={p.name} className="flex items-center gap-1 mt-1">
            <span className="text-[12px] font-medium text-[var(--text-high)]">
              {p.name}: {p.value}
            </span>
            {p.boostPct > 0 && (
              <span className="text-[9px] text-[var(--accent-highlight)] bg-[rgba(6,182,212,0.08)] px-1.5 py-px rounded-[var(--radius-pill)]">
                +{p.boostPct}%
              </span>
            )}
          </div>
        ))}
        {policies.length === 0 && (
          <div className="text-[12px] text-[var(--text-low)] mt-1">No active policy</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create BudgetSummary component**

```tsx
// apps/web/components/budget-summary.tsx
"use client";

import { formatThousands } from "@/lib/format";

interface BudgetSummaryProps {
  sponsorIncome: number;
  rosterSalaries: number;
  rosterCount: number;
  draftBidsTotal: number;
  draftCount: number;
}

export function BudgetSummary({
  sponsorIncome,
  rosterSalaries,
  rosterCount,
  draftBidsTotal,
  draftCount,
}: BudgetSummaryProps) {
  const remaining = sponsorIncome - rosterSalaries - draftBidsTotal;
  const isDeficit = remaining < 0;

  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-lg p-3 border ${
        isDeficit ? "border-red-500/30" : "border-[var(--border-default)]"
      }`}
    >
      <div className="flex justify-between py-0.5">
        <span className="text-[12px] text-[var(--text-low)]">Sponsor income</span>
        <span className="text-[12px] font-mono text-[var(--accent-highlight)]">
          +€{formatThousands(sponsorIncome)}
        </span>
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-[12px] text-[var(--text-low)]">
          Roster salaries ({rosterCount})
        </span>
        <span className="text-[12px] font-mono text-red-400">
          −€{formatThousands(rosterSalaries)}
        </span>
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-[12px] text-[var(--text-low)]">
          Draft bids ({draftCount})
        </span>
        <span className="text-[12px] font-mono text-red-400">
          −€{formatThousands(draftBidsTotal)}
        </span>
      </div>
      <div className="h-px bg-[var(--border-default)] my-1" />
      <div className="flex justify-between pt-1">
        <span className="text-[13px] font-semibold text-[var(--text-high)]">
          {isDeficit ? "Deficit" : "Remaining"}
        </span>
        <span
          className={`text-[15px] font-bold font-mono ${
            isDeficit ? "text-red-400" : "text-[var(--accent-highlight)]"
          }`}
        >
          {isDeficit ? "−" : ""}€{formatThousands(Math.abs(remaining))}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create DraftBidCard component**

```tsx
// apps/web/components/draft-bid-card.tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatThousands, countryCodeToFlag } from "@/lib/format";

interface DraftBidCardProps {
  rider: {
    id: string;
    name: string;
    nationality?: string;
    team_name?: string;
    pcs_rank?: number;
    pcs_rank_prev?: number;
    specialty?: string;
    photo_url?: string | null;
  };
  amount: number;
  minSalary: number;
  boostPct?: number;
  onRemove: () => void;
  onAmountChange: (newAmount: number) => void;
  onNavigate: () => void;
}

export function DraftBidCard({
  rider,
  amount,
  minSalary,
  boostPct,
  onRemove,
  onAmountChange,
  onNavigate,
}: DraftBidCardProps) {
  const [localAmount, setLocalAmount] = useState(amount);
  const [isPending, startTransition] = useTransition();

  const handleIncrement = () => {
    const next = localAmount + 500;
    setLocalAmount(next);
    startTransition(() => onAmountChange(next));
  };

  const handleDecrement = () => {
    const next = Math.max(minSalary, localAmount - 500);
    if (next !== localAmount) {
      setLocalAmount(next);
      startTransition(() => onAmountChange(next));
    }
  };

  const rankDiff =
    rider.pcs_rank && rider.pcs_rank_prev
      ? rider.pcs_rank_prev - rider.pcs_rank
      : 0;

  return (
    <div className="px-4 py-4 relative">
      {/* Top row: avatar + name + trash */}
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className="relative w-10 h-10 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-content text-[10px] text-[var(--text-low)] overflow-hidden">
            {rider.photo_url ? (
              <img src={rider.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="m-auto">
                {rider.name.split(". ")[0]?.[0]}
                {rider.name.split(". ")[1]?.[0]}
              </span>
            )}
          </div>
          {rider.pcs_rank && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[8px] font-mono text-[var(--text-mid)] px-1 leading-tight">
              #{rider.pcs_rank}
            </div>
          )}
        </div>

        {/* Name + team */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[13px] flex-wrap">
            <button onClick={onNavigate} className="font-medium text-[var(--text-high)] hover:text-[var(--accent-default)]">
              {rider.name}
            </button>
            <span className="text-[11px] text-[var(--text-ghost)]">›</span>
            {rider.nationality && (
              <span className="text-[12px]">{countryCodeToFlag(rider.nationality)}</span>
            )}
            {rankDiff !== 0 && (
              <span
                className={`text-[9px] px-1.5 py-px rounded-[var(--radius-pill)] ${
                  rankDiff > 0
                    ? "bg-green-500/12 text-green-400"
                    : "bg-red-500/12 text-red-400"
                }`}
              >
                {rankDiff > 0 ? "▲" : "▼"} {Math.abs(rankDiff)}
              </span>
            )}
            {boostPct && boostPct > 0 && (
              <span className="text-[9px] text-[var(--accent-highlight)] bg-[rgba(6,182,212,0.08)] px-1.5 py-px rounded-[var(--radius-pill)]">
                +{boostPct}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-low)] mt-px">
            <span>{rider.team_name}</span>
            {rider.specialty && (
              <>
                <span className="text-[var(--text-ghost)]">·</span>
                <span className="text-[var(--text-mid)]">{rider.specialty}</span>
              </>
            )}
          </div>
        </div>

        {/* Trash button */}
        <button
          onClick={onRemove}
          disabled={isPending}
          className="w-10 h-10 shrink-0 rounded-md bg-red-500/12 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Bid row: [−] [input] [+] */}
      <div className="flex items-start gap-3 mt-3">
        <button
          onClick={handleDecrement}
          disabled={isPending || localAmount <= minSalary}
          className="w-10 h-10 shrink-0 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-mid)] flex items-center justify-center text-lg disabled:opacity-40"
        >
          −
        </button>
        <div className="flex-1">
          <div className="w-full h-10 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md flex items-center justify-center font-mono text-[14px] text-[var(--text-high)]">
            €{formatThousands(localAmount)}
          </div>
          <div className="text-[10px] text-[var(--text-low)] text-center mt-1">
            Min: <span className="font-mono">€{formatThousands(minSalary)}</span>
          </div>
        </div>
        <button
          onClick={handleIncrement}
          disabled={isPending}
          className="w-10 h-10 shrink-0 rounded-md bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-mid)] flex items-center justify-center text-lg disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/round-blocks.tsx apps/web/components/config-cards.tsx apps/web/components/budget-summary.tsx apps/web/components/draft-bid-card.tsx
git commit -m "feat(ui): add auction components (rounds, config, summary, draft card)"
```

---

## Task 7: Auctions Page — Server + Client

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/auctions/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/team/auctions/auctions-client.tsx`

- [ ] **Step 1: Create the server page**

The server page fetches all data needed:
- Active/scheduled auction rounds for this league
- Team roster (contracts)
- Draft bids
- Sponsor info
- Active policies
- XP data per rider

Reference the data-fetching pattern from `apps/web/app/(game)/league/[leagueId]/team/page.tsx` (My Team page) — it uses the same parallel query pattern with `Promise.all`.

Key queries:
```ts
// Fetch in parallel:
// 1. Auction rounds for this league (ordered by round)
// 2. Active contracts for this team (with rider info)
// 3. Draft bids for this team (with rider info)
// 4. Team sponsor
// 5. Active policies
// 6. Rider XP data
```

Pass all data as props to `<AuctionsClient />`.

- [ ] **Step 2: Create the client component**

The client component renders the wireframe V7 layout. Reference: `.superpowers/brainstorm/1316-1775198695/content/auctions-v7.html`

Structure:
```
<div className="py-4 space-y-6">
  {/* Rounds section */}
  <section> Title "Rounds" + "History →" link + <RoundBlocks /> </section>

  {/* Sponsor & Policies */}
  <section> Title "Sponsor & Policies" + <ConfigCards /> + rule text </section>

  {/* Roster */}
  <section> Title "Roster" + "X/Y slots" + RiderCard list with Release buttons </section>

  {/* Draft Bids */}
  <section> Title "Draft Bids" + "X/Y slots" + DraftBidCard list </section>

  {/* Summary */}
  <section> Title "Summary" + <BudgetSummary /> </section>
</div>

{/* Sticky bar — always visible */}
<StickyBar>
  slots info + remaining/deficit + Validate button
</StickyBar>
```

Use the existing `RiderCard` component for roster riders (with `rightContent` for salary/XP and a Release button).

Use the new `DraftBidCard` for each draft bid.

The Validate button calls `validateRound` action, disabled when budget < 0 or slots > max.

- [ ] **Step 3: Verify build compiles**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/auctions/
git commit -m "feat(auctions): create auctions sub-tab page with full wireframe V7 layout"
```

---

## Task 8: Market Page Refactor

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/market/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx`
- Delete: `apps/web/app/(game)/league/[leagueId]/team/market/phase-setup.tsx`

- [ ] **Step 1: Remove phase-setup gating from market page**

In `page.tsx`, remove the conditional that shows `<PhaseSetup>` when the phase hasn't been confirmed. Always render `<MarketClient>`. Remove the `phase-setup.tsx` import.

- [ ] **Step 2: Refactor MarketClient**

Key changes to `market-client.tsx`:
1. **Remove "My Bids" filter tab** — drafts are now in the Auctions sub-tab.
2. **Remove "Country" from search filters** — keep Rider/Team only.
3. **Replace "Save" button with "Add to Draft"** — calls `addDraft` action instead of `placeBid`.
4. **Remove horizontal scrollbar** on the filter chips container.
5. **Show "Next Round" date/time** at the top (keep existing behavior).
6. **Add "Load more" button** — initial display of 100 riders, button loads 100 more.
7. **Remove the save sticky bar** — no more inline saving, just "Add to Draft" per rider.

The input field still shows the min salary (pre-filled, editable). Button text changes from "Save" to "Add to Draft".

For riders already in drafts, show a visual indicator (e.g., cyan background tint or "In Draft" tag).

- [ ] **Step 3: Delete phase-setup.tsx**

```bash
rm apps/web/app/\(game\)/league/\[leagueId\]/team/market/phase-setup.tsx
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(market): remove phase-setup, add draft system, simplify filters"
```

---

## Task 9: Rider Detail — Action Bar Changes

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`

- [ ] **Step 1: Read the current rider-detail-client.tsx**

Understand the current action bar logic (bid/cancel buttons, sticky bar).

- [ ] **Step 2: Update action bar logic**

Three states for the action bar:
1. **Not in roster, not in draft** → Show input + "Add to Draft" button. Calls `addDraft`.
2. **Already in draft** → Show "Cancel Draft" button (red secondary). Calls `removeDraft`.
3. **In roster** → Show "Release" button (red destructive). If not Round 1, show confirmation popup: *"Release [name]? Salary already paid for this phase. Not refunded."* Calls `releaseRider`.

Fix: action bar must NOT be transparent (set explicit `bg-[var(--bg-app)]` with `border-t`).

- [ ] **Step 3: Fix back navigation**

Ensure `?from=` searchParam correctly routes back:
- `?from=market` → `/league/[id]/team/market`
- `?from=auctions` → `/league/[id]/team/auctions`
- default → `router.back()`

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/rider/
git commit -m "feat(rider-detail): update action bar for draft/release flow"
```

---

## Task 10: Sticky Bar — Deficit State

**Files:**
- Modify: `apps/web/components/sticky-bar.tsx`

- [ ] **Step 1: Read current sticky-bar.tsx**

- [ ] **Step 2: Add deficit state support**

Add props:
- `isDeficit: boolean` — when true, remaining text turns red, button is disabled
- `deficitMessage?: string` — shown below the bar in red text

When `isDeficit` is true:
- Remaining amount text: `text-red-400` instead of `text-[var(--accent-highlight)]`
- Slots text: `text-red-400` if over max
- Button: `bg-[var(--bg-surface)] text-[var(--text-low)]` (disabled look), non-clickable
- Message bar below: red text centered

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sticky-bar.tsx
git commit -m "feat(sticky-bar): add deficit state with red indicators and disabled button"
```

---

## Task 11: UI Polish Items (from Improvements file)

**Files:** Various components

- [ ] **Step 1: Geist Mono only on numbers**

Search for places where `font-mono` is applied to non-numeric labels. Fix by splitting text nodes — label in sans-serif, numbers in mono.

Key locations: Market rider cards, Budget page, Rider detail metric boxes.

```bash
grep -rn "font-mono" apps/web/components/ apps/web/app/ | head -30
```

- [ ] **Step 2: Segment control full-width in Rider Detail**

In the rider detail page, find the segmented control (tabs for stats/ranking/etc.) and ensure it takes `w-full` with proper left/right padding matching `px-4`.

- [ ] **Step 3: Search bar — remove background, keep stroke**

In `market-client.tsx`, update the search input:
```tsx
// From:
className="bg-[var(--bg-surface)] ..."
// To:
className="bg-transparent border border-[var(--border-default)] ..."
```

- [ ] **Step 4: Remove cyan left border in bid rows**

Search for left-border cyan styling on bid/draft rows and remove it:
```bash
grep -rn "border-l.*cyan\|border-l-2\|border-l-\[" apps/web/
```

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(ui): design system polish — mono font, full-width tabs, search bar, borders"
```

---

## Task 12: Performance — Market Pagination

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx`

- [ ] **Step 1: Add pagination state**

```tsx
const PAGE_SIZE = 100;
const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
```

- [ ] **Step 2: Slice the rider list**

Instead of rendering all riders, slice to `displayCount`:
```tsx
const visibleRiders = filteredRiders.slice(0, displayCount);
```

- [ ] **Step 3: Add "Load more" button**

After the rider list:
```tsx
{displayCount < filteredRiders.length && (
  <button
    onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
    className="w-full py-3 text-center text-[length:var(--type-body)] text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
  >
    Load more ({filteredRiders.length - displayCount} remaining)
  </button>
)}
```

- [ ] **Step 4: Reset count on filter change**

When the active filter tab changes, reset `displayCount` to `PAGE_SIZE`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/market/market-client.tsx
git commit -m "perf(market): add load-more pagination (100 riders per page)"
```

---

## Task 13: Bug Fixes

**Files:** Various

- [ ] **Step 1: Fix salary deduction bug**

Investigate `confirmPhaseSetup` action. The user reported salaries not being deducted at auction launch. Check that treasury is updated correctly:

```bash
grep -rn "confirmPhaseSetup" apps/web/
```

Read the action, verify the salary deduction logic. The new `validateRound` action (Task 5) should replace this flow, but ensure the old path also works until fully migrated.

- [ ] **Step 2: Fix home page next races**

```bash
grep -rn "next.*race\|nextRace\|upcoming" apps/web/app/\(game\)/league/\[leagueId\]/page.tsx
```

Investigate why races aren't displayed. Likely a query filter issue (wrong date comparison or missing data).

- [ ] **Step 3: Fix bid state loss on navigation**

The current Market stores bid state in React state that gets lost on navigation. With the new draft system (DB-persisted), this bug is automatically resolved — drafts survive navigation.

Verify that the new Market page reads drafts from DB on mount.

- [ ] **Step 4: Fix action bar transparency on mobile**

In rider detail action bar, ensure:
```tsx
className="fixed bottom-0 ... bg-[var(--bg-app)] border-t border-[var(--border-default)]"
```

Not `bg-transparent` or missing background.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: salary deduction, home races, action bar transparency"
```

---

## Task 14: Final Verification & Documentation

- [ ] **Step 1: Full build check**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
pnpm typecheck && pnpm build
```

- [ ] **Step 2: Manual test checklist**

Test in browser:
1. Navigate to Team → Market → browse riders → Add to Draft
2. Navigate to Team → Auctions → see drafts appear
3. Adjust bid amounts with +/−
4. Remove a draft with trash button
5. Release a roster rider
6. Check budget summary updates in real-time
7. Try to validate with budget < 0 → button disabled
8. Validate with budget ≥ 0 → success
9. Check rider detail action bar states (Add to Draft / Cancel Draft / Release)
10. Check mobile: sticky bar, no transparency, back navigation

- [ ] **Step 3: Update CLAUDE.md**

Add to the Architecture section:
- `team/auctions/` — Auctions sub-tab (draft bids, round validation)
- Update "Règles critiques" — remove release fee mention, add "validation forces balance"
- Update constants: remove RELEASE_FEE

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md for auction redesign"
```
