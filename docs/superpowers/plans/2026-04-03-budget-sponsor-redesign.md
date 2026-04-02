# Budget & Sponsor Pages Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sponsor marketplace (tier grouping, Switch toggles, auto-save) and budget page (slim sponsor card, fixed transaction filters + rider photos).

**Architecture:** 6 tasks — extract shared BonusDetails component, rewrite marketplace with tier groups and auto-save, slim down budget sponsor card, fix transaction types and add rider photos. Shared bonus display component avoids duplication between marketplace and budget.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Supabase, Shadcn UI (Switch), Lucide icons

**Design spec:** `docs/superpowers/specs/2026-04-03-budget-sponsor-redesign.md`

**Design system:** `docs/watthunter-design-system-v3.md` — READ BEFORE ANY FRONTEND WORK.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/lib/sponsors.ts` | Modify | Add `groupByTier()` helper |
| `apps/web/components/sponsor-bonus-details.tsx` | **Create** | Shared BonusDetails component (marketplace + budget) |
| `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx` | Rewrite | Tier groups, Switch toggle, auto-save, banner |
| `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx` | Modify | Pass `nextPhaseName`, `isInAuctionWindow` |
| `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx` | Modify | Slim sponsor card with expand + fix filter types |
| `apps/web/app/(game)/league/[leagueId]/budget/page.tsx` | Modify | Pass full sponsor data + join rider photo in treasury_log query |
| `apps/web/app/(game)/league/[leagueId]/budget/transactions/transactions-client.tsx` | Modify | Fix filter types |
| `apps/web/components/transaction-row.tsx` | Modify | Add `payday_salary`, `release_fee`, `transfer_bonus` + rider photo |

---

### Task 1: Add `groupByTier` helper and fix filter function

**Files:**
- Modify: `apps/web/lib/sponsors.ts`

- [ ] **Step 1: Add `groupByTier` helper**

In `apps/web/lib/sponsors.ts`, add at the end of the file:

```typescript
/**
 * Group sponsors by tier for marketplace display.
 * Returns array of { tier, unlockLevel, sponsors[] } sorted by tier.
 */
export function groupByTier(sponsors: SponsorRow[]): {
  tier: number;
  unlockLevel: number;
  sponsors: SponsorRow[];
}[] {
  const map = new Map<number, { tier: number; unlockLevel: number; sponsors: SponsorRow[] }>();

  for (const s of sponsors) {
    if (!map.has(s.tier)) {
      map.set(s.tier, { tier: s.tier, unlockLevel: s.unlock_level, sponsors: [] });
    }
    map.get(s.tier)!.sponsors.push(s);
  }

  return Array.from(map.values())
    .sort((a, b) => a.tier - b.tier)
    .map((g) => ({
      ...g,
      sponsors: g.sponsors.sort((a, b) => a.sort_order - b.sort_order),
    }));
}

/**
 * Shared filter function for treasury_log transactions.
 * Used by both budget-client and transactions-client.
 */
export const TRANSACTION_FILTER_OPTIONS = [
  { label: "All" },
  { label: "Bonuses" },
  { label: "Salaries" },
  { label: "Sponsors" },
];

export import { ORIENTATION_LABELS } from "@/lib/sponsors";

export function filterTransactions<T extends { type: string }>(
  transactions: T[],
  filterIndex: number,
): T[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1)
    return transactions.filter((t) =>
      ["sponsor_bonus", "transfer_bonus"].includes(t.type),
    );
  if (filterIndex === 2)
    return transactions.filter((t) =>
      ["payday_salary", "auction_purchase", "release_fee", "bankruptcy_release"].includes(t.type),
    );
  if (filterIndex === 3)
    return transactions.filter((t) =>
      ["sponsor_payment"].includes(t.type),
    );
  return transactions;
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/sponsors.ts
git commit -m "feat(sponsors): add groupByTier helper and shared filter function"
```

---

### Task 2: Extract shared `BonusDetails` component

**Files:**
- Create: `apps/web/components/sponsor-bonus-details.tsx`

This component is used in both the marketplace (expanded sponsor row) and the budget page (expanded sponsor card). It includes the multiplier bug fix — ×2 is shown for ALL T1-T4 sponsors.

- [ ] **Step 1: Create the component**

Create `apps/web/components/sponsor-bonus-details.tsx`:

```tsx
import {
  formatBudget,
  thresholdLabel,
  expandNationality,
  type SponsorRow,
} from "@/lib/sponsors";

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function BonusLine({
  label,
  threshold,
  bonus,
  suffix,
}: {
  label: string;
  threshold: number;
  bonus: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-body)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
        {suffix && (
          <span className="ml-1 text-[var(--text-low)]">{suffix}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Shared bonus details for a sponsor.
 * Renders BASE BONUS lines + MULTIPLIERS section.
 * Used in marketplace expanded row and budget card expanded state.
 *
 * BUG FIX: ×2 Monuments & Grand Tours is now shown for ALL T1-T4 sponsors
 * (previously only shown when bonus_monument > bonus_one_day, which was always
 * false for T1-T4 since they don't have explicit monument amounts).
 */
export function SponsorBonusDetails({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = expandNationality(sponsor.nationality);
  const nationalityFlags =
    nationalities.length > 0
      ? nationalities.map(countryFlag).join(" ")
      : null;

  return (
    <div className="mt-3 space-y-3">
      {/* BASE BONUS */}
      <div>
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-low)] block mb-2">
          Base Bonus
        </span>
        <div className="space-y-0.5">
          {sponsor.has_explicit_prestige ? (
            <>
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_monument != null && sponsor.bonus_monument > 0 && sponsor.monument_threshold != null && (
                <BonusLine label="Monument" threshold={sponsor.monument_threshold} bonus={sponsor.bonus_monument} />
              )}
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="Stage Race GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0 && sponsor.grand_tour_threshold != null && (
                <BonusLine label="Grand Tour GC" threshold={sponsor.grand_tour_threshold} bonus={sponsor.bonus_grand_tour} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} suffix="(×2 GT)" />
              )}
            </>
          ) : (
            <>
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
              )}
            </>
          )}
        </div>
      </div>

      {/* MULTIPLIERS — shown for ALL T1-T4 (non-explicit prestige) */}
      {!sponsor.has_explicit_prestige && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-low)] block mb-2">
            Multipliers
          </span>
          <ul className="space-y-2 text-[length:var(--type-body)] text-[var(--text-mid)]">
            <li className="flex items-center gap-2">
              <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-app)] border border-[var(--border-default)] text-[length:var(--type-caption)]">
                ×2
              </span>
              <span>Monuments & Grand Tours</span>
            </li>
            {nationalityFlags && (
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-app)] border border-[var(--border-default)] text-[length:var(--type-caption)]">
                  ×1.5
                </span>
                <span>for riders {nationalityFlags}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sponsor-bonus-details.tsx
git commit -m "feat(sponsors): extract shared BonusDetails component with multiplier bug fix"
```

---

### Task 3: Rewrite Marketplace page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`
- Rewrite: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`

- [ ] **Step 1: Update marketplace `page.tsx` to pass extra props**

Replace the full content of `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketplaceClient } from "./marketplace-client";
import { getCurrentPhase, getNextPhase, isInAuctionWindow, isLeagueFirstCycle } from "@/lib/phases";
import type { SponsorRow, TeamSponsor } from "@/lib/sponsors";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function MarketplacePage({ params }: Props) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, pending_sponsor_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  const [{ data: sponsors }, { data: teamSponsor }] = await Promise.all([
    supabase.from("sponsors").select("*").order("sort_order"),
    supabase
      .from("team_sponsors")
      .select("*, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
  ]);

  // Determine if changes are immediate or pending
  const nextPhase = getNextPhase();
  const immediate = isInAuctionWindow() || await isLeagueFirstCycle(supabase, leagueId);

  return (
    <MarketplaceClient
      leagueId={leagueId}
      teamId={team.id}
      teamLevel={team.level}
      sponsors={(sponsors ?? []) as SponsorRow[]}
      currentSponsor={teamSponsor as TeamSponsor | null}
      nextPhaseName={nextPhase?.label ?? null}
      isImmediate={immediate}
      pendingSponsorId={team.pending_sponsor_id ?? null}
    />
  );
}
```

- [ ] **Step 2: Rewrite `marketplace-client.tsx`**

Replace the full content of `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`:

```tsx
"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BackHeader } from "@/components/back-header";
import { Tag } from "@/components/pill";
import { SponsorBonusDetails } from "@/components/sponsor-bonus-details";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  groupByTier,
  type SponsorRow,
  type TeamSponsor,
} from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";
import { saveSponsor } from "../actions";

interface MarketplaceClientProps {
  leagueId: string;
  teamId: string;
  teamLevel: number;
  sponsors: SponsorRow[];
  currentSponsor: TeamSponsor | null;
  nextPhaseName: string | null;
  isImmediate: boolean;
  pendingSponsorId: string | null;
}

import { ORIENTATION_LABELS } from "@/lib/sponsors";

function SponsorRow({
  sponsor,
  teamLevel,
  isSelected,
  defaultExpanded,
  onToggle,
}: {
  sponsor: SponsorRow;
  teamLevel: number;
  isSelected: boolean;
  defaultExpanded: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isLocked = teamLevel < sponsor.unlock_level;
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

  const handleRowClick = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  return (
    <div className={cn(isLocked && "opacity-40")}>
      {/* Clickable row — expand/collapse */}
      <button
        type="button"
        onClick={handleRowClick}
        className="flex w-full flex-col gap-1 py-4 text-left"
      >
        {/* Line 1: chevron + name */}
        <div className="flex items-center gap-2">
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 text-[var(--text-low)] transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {sponsor.name}
          </span>
        </div>

        {/* Line 2: tags left, budget + toggle right */}
        <div className="flex items-center justify-between pl-[22px]">
          <div className="flex items-center gap-1.5">
            <Tag variant="highlighted">{ORIENTATION_LABELS[sponsor.orientation]}</Tag>
            {nationalities.map((nat) => (
              <Tag key={nat} variant="default">{countryCodeToFlag(nat)}</Tag>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
              {formatBudget(sponsor.monthly_budget)}
            </span>
            {isLocked ? (
              <Lock size={16} className="text-[var(--text-low)]" />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <Switch checked={isSelected} />
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded bonus details */}
      {expanded && (
        <div className="pl-[22px] pb-4">
          <SponsorBonusDetails sponsor={sponsor} />
        </div>
      )}
    </div>
  );
}

export function MarketplaceClient({
  leagueId,
  teamId,
  teamLevel,
  sponsors,
  currentSponsor,
  nextPhaseName,
  isImmediate,
  pendingSponsorId,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    type: "immediate" | "pending";
    name: string;
  } | null>(
    // Show pending banner on load if there's a pending sponsor change
    pendingSponsorId
      ? { type: "pending", name: sponsors.find((s) => s.id === pendingSponsorId)?.name ?? "" }
      : null,
  );

  const activeSponsorId = currentSponsor?.sponsor_id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(activeSponsorId);

  const tierGroups = groupByTier(sponsors);

  // Find the highest unlocked tier for default expand
  const highestUnlockedTier = Math.max(
    ...sponsors
      .filter((s) => teamLevel >= s.unlock_level)
      .map((s) => s.tier),
    0,
  );

  const handleToggle = useCallback(
    (sponsorId: string) => {
      if (isPending) return;
      if (sponsorId === activeSponsorId) return; // already active

      setSelectedId(sponsorId);
      const sponsorName = sponsors.find((s) => s.id === sponsorId)?.name ?? "";

      startTransition(async () => {
        const result = await saveSponsor({ teamId, sponsorId });
        if (result.success) {
          setBanner({
            type: result.immediate ? "immediate" : "pending",
            name: result.sponsorName ?? sponsorName,
          });
          router.refresh();
        } else if (result.error) {
          // Revert on error
          setSelectedId(activeSponsorId);
          alert(result.error);
        }
      });
    },
    [isPending, activeSponsorId, sponsors, teamId, startTransition, router],
  );

  return (
    <div className="pb-24">
      <BackHeader label="Budget" />

      {/* Header */}
      <div className="px-4 pb-4 pt-2">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Choose your Sponsor
        </h1>
        <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
          One sponsor per team.
        </p>
      </div>

      {/* Confirmation banner */}
      {banner?.type === "immediate" && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            ✓ {banner.name} — changes applied
          </p>
        </div>
      )}
      {banner?.type === "pending" && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            ⏳ {banner.name} — active from {nextPhaseName ?? "next phase"}
          </p>
        </div>
      )}

      {/* Tier groups */}
      <div className="px-4 max-w-[600px] mx-auto">
        {tierGroups.map((group, groupIdx) => (
          <div
            key={group.tier}
            className={cn(groupIdx > 0 && "mt-5")}
          >
            {/* Tier section header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
                Tier {group.tier}
              </span>
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-low)]">
                Lv. {group.unlockLevel}
              </span>
            </div>

            {/* Sponsor rows */}
            <div className="divide-y divide-[var(--border-subtle)]">
              {group.sponsors.map((sponsor) => (
                <SponsorRow
                  key={sponsor.id}
                  sponsor={sponsor}
                  teamLevel={teamLevel}
                  isSelected={selectedId === sponsor.id}
                  defaultExpanded={group.tier === highestUnlockedTier}
                  onToggle={() => handleToggle(sponsor.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors. If `isLeagueFirstCycle` import fails, check the exact export name in `apps/web/lib/phases.ts`.

- [ ] **Step 4: Visual check**

Run: `pnpm dev` and navigate to `/league/[id]/budget/marketplace`
Verify:
- Sponsors grouped by tier with section headers
- Tier header shows "Tier N" left, "Lv. N" right
- Chevron rotates on expand
- Switch toggles work (one ON at a time)
- Current tier sponsors expanded by default
- Banner appears after toggling
- Locked tiers have opacity 40% + lock icon
- Multipliers ×2 shown for ALL T1-T4 sponsors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/marketplace/
git commit -m "feat(marketplace): tier grouping, Switch toggles, auto-save, multiplier fix"
```

---

### Task 4: Redesign sponsor card in Budget page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx`

- [ ] **Step 1: Update `budget/page.tsx` to pass full sponsor data**

In `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`, change the sponsor query to fetch all sponsor fields needed for the bonus details card.

Replace the `sponsorData` extraction block (lines 93-109) and the `currentSponsor` prop shape:

```typescript
  // Sponsor info for display — pass full SponsorRow for expanded card
  const sponsorRow = teamSponsor?.sponsors
    ? (Array.isArray(teamSponsor.sponsors) ? teamSponsor.sponsors[0] : teamSponsor.sponsors)
    : null;
```

Update the `team_sponsors` query (line 50-52) to select all sponsor fields:

```typescript
    supabase
      .from("team_sponsors")
      .select("id, sponsor_id, activated_at, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
```

Then pass `sponsorRow` as the full `SponsorRow | null` to `BudgetClient`:

```tsx
  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      income={income}
      outgoing={outgoing}
      transactions={transactions ?? []}
      phaseIndex={phaseIndex}
      currentSponsor={sponsorRow as SponsorRow | null}
      phaseSalaries={phaseSalaries}
    />
  );
```

Import `SponsorRow` at the top:

```typescript
import type { SponsorRow } from "@/lib/sponsors";
```

- [ ] **Step 2: Update `budget-client.tsx` — sponsor card + filter fix**

Replace the full content of `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PhaseNavigator } from "@/components/phase-navigator";
import { FilterChips } from "@/components/filter-chips";
import { TransactionRow } from "@/components/transaction-row";
import { Tag } from "@/components/pill";
import { SponsorBonusDetails } from "@/components/sponsor-bonus-details";
import { formatEuro } from "@/lib/format";
import { countryCodeToFlag } from "@/lib/format";
import {
  formatBudget,
  TRANSACTION_FILTER_OPTIONS,
  filterTransactions,
  type SponsorRow,
} from "@/lib/sponsors";
import { cn } from "@/lib/utils";

import { ORIENTATION_LABELS } from "@/lib/sponsors";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  rider_photo_url?: string | null;
  rider_name?: string | null;
}

interface BudgetClientProps {
  leagueId: string;
  treasury: number;
  level: number;
  income: number;
  outgoing: number;
  transactions: Transaction[];
  phaseIndex: number;
  currentSponsor: SponsorRow | null;
  phaseSalaries: number;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k €`;
  return formatEuro(amount);
}

export function BudgetClient({
  leagueId,
  treasury,
  income,
  outgoing,
  transactions,
  currentSponsor,
  phaseIndex,
}: BudgetClientProps) {
  const router = useRouter();
  const [filterIndex, setFilterIndex] = useState(0);
  const [sponsorExpanded, setSponsorExpanded] = useState(false);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  function handlePhaseChange(newIndex: number) {
    router.replace(`?phase=${newIndex}`, { scroll: false });
  }

  const nationalities = currentSponsor?.nationality
    ? currentSponsor.nationality.split("/").map((c) => c.trim())
    : [];

  return (
    <div className="pb-24">
      {/* Phase Navigator */}
      <PhaseNavigator currentIndex={phaseIndex} onChange={handlePhaseChange} />

      {/* Balance Hero Card */}
      <div className="xp-card-body mx-4 mt-2 p-5 mb-6">
        <div className="xp-content">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Balance
          </span>
          <div className="mt-1 font-mono text-[length:var(--type-display)] font-black leading-none text-[var(--accent-highlight)] tabular-nums">
            {formatEuro(treasury)}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[length:var(--type-caption)]">
            <span className="text-[var(--text-low)]">
              Income{" "}
              <span className="font-mono font-semibold text-[var(--text-high)]">+{formatCompact(income)}</span>
            </span>
            <span className="text-[var(--text-low)]">
              Outgoing{" "}
              <span className="font-mono font-semibold text-[var(--text-high)]">-{formatCompact(outgoing)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sponsor Section */}
      <div className="mt-2 mb-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Sponsor
          </span>
          <Link
            href={`/league/${leagueId}/budget/marketplace`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Change &rarr;
          </Link>
        </div>

        <div className="px-4">
          {currentSponsor ? (
            <button
              type="button"
              onClick={() => setSponsorExpanded((v) => !v)}
              className="block w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left transition-colors hover:bg-[var(--bg-surface-hover)]"
            >
              {/* Line 1: chevron + name + budget */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-[var(--text-low)] transition-transform duration-200",
                      sponsorExpanded && "rotate-90",
                    )}
                  />
                  <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                    {currentSponsor.name}
                  </span>
                </div>
                <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
                  {formatBudget(currentSponsor.monthly_budget)}
                </span>
              </div>

              {/* Line 2: tags */}
              <div className="flex items-center gap-1.5 mt-1 pl-[22px]">
                <Tag variant="highlighted">{ORIENTATION_LABELS[currentSponsor.orientation]}</Tag>
                {nationalities.map((nat) => (
                  <Tag key={nat} variant="default">{countryCodeToFlag(nat)}</Tag>
                ))}
              </div>

              {/* Expanded bonus details */}
              {sponsorExpanded && (
                <div className="pl-[22px] mt-2">
                  <SponsorBonusDetails sponsor={currentSponsor} />
                </div>
              )}
            </button>
          ) : (
            <Link href={`/league/${leagueId}/budget/marketplace`}>
              <div className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-5 hover:bg-[var(--bg-surface-hover)] transition-colors">
                <span className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)]">
                  Select a sponsor &rarr;
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Transactions Section */}
      <div className="mt-2 mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Transactions
          </span>
          <Link
            href={`/league/${leagueId}/budget/transactions`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            See all &rarr;
          </Link>
        </div>

        <div className="px-4 mb-3 border-b border-[var(--border-subtle)] pb-3">
          <FilterChips
            options={TRANSACTION_FILTER_OPTIONS}
            activeIndex={filterIndex}
            onChange={setFilterIndex}
          />
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
              No transactions this phase
            </p>
          ) : (
            filtered.map((t) => (
              <TransactionRow
                key={t.id}
                type={t.type}
                amount={t.amount}
                description={t.description}
                date={t.created_at}
                riderPhotoUrl={t.rider_photo_url}
                riderName={t.rider_name}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: May have errors from `transaction-row.tsx` not yet having the new props — this is OK, will be fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/budget/budget-client.tsx
git commit -m "feat(budget): slim sponsor card with expand + fix transaction filters"
```

---

### Task 5: Fix TransactionRow + transaction filters in transactions page

**Files:**
- Modify: `apps/web/components/transaction-row.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/transactions/transactions-client.tsx`

- [ ] **Step 1: Update `transaction-row.tsx` — new types + rider photo**

Replace the full content of `apps/web/components/transaction-row.tsx`:

```tsx
import Image from "next/image";
import { formatEuro } from "@/lib/format";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string | null;
  date: string;
  riderPhotoUrl?: string | null;
  riderName?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getAvatarFallback(type: string): { text: string; isSponsor: boolean } {
  if (type === "sponsor_payment") return { text: "SP", isSponsor: true };
  if (type === "sponsor_bonus") return { text: "B", isSponsor: true };
  if (type === "starting_fund") return { text: "WH", isSponsor: true };
  if (type === "payday_salary") return { text: "SAL", isSponsor: false };
  if (type === "release_fee") return { text: "REL", isSponsor: false };
  if (type === "transfer_bonus") return { text: "TR", isSponsor: false };
  if (type === "bankruptcy_release") return { text: "BR", isSponsor: false };
  return { text: "??", isSponsor: false };
}

function getSubtitle(type: string, description: string | null): string {
  switch (type) {
    case "sponsor_payment": return "Sponsorship";
    case "sponsor_bonus": return "Race bonus";
    case "payday_salary": return "Salary";
    case "monthly_salary":
    case "phase_salary": return "Salary";
    case "auction_purchase": return "Salary";
    case "release_fee": return "Release fee";
    case "transfer_bonus": return "Transfer bonus";
    case "starting_fund": return "Starting fund";
    case "bankruptcy_release": return "Bankruptcy release";
    case "monthly_bonus":
    case "rider_revenue": return description?.split(" — ")[1] ?? "Bonus";
    default: return description ?? "";
  }
}

function getName(type: string, description: string | null, riderName?: string | null): string {
  // If we have a rider name from the join, use it for rider-related types
  if (riderName && ["payday_salary", "auction_purchase", "release_fee", "transfer_bonus", "sponsor_bonus", "bankruptcy_release"].includes(type)) {
    return riderName;
  }

  switch (type) {
    case "sponsor_payment": return description ?? "Sponsor";
    case "sponsor_bonus": return description ?? "Sponsor bonus";
    case "payday_salary": return description ?? "Phase salaries";
    case "phase_salary": return description ?? "Phase salaries";
    case "starting_fund": return "Initial treasury";
    case "auction_purchase": return description?.split(" — ")[1] ?? description ?? "Contract";
    case "release_fee": return description ?? "Release";
    case "transfer_bonus": return description ?? "Transfer";
    case "bankruptcy_release": return description ?? "Auto-release";
    default: return description?.split(" — ")[0] ?? "Unknown";
  }
}

export function TransactionRow(props: TransactionRowProps) {
  const name = getName(props.type, props.description, props.riderName);
  const subtitle = getSubtitle(props.type, props.description);
  const prefix = props.amount >= 0 ? "+" : "";
  const avatar = getAvatarFallback(props.type);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Avatar — rider photo or fallback circle */}
      {props.riderPhotoUrl ? (
        <Image
          src={props.riderPhotoUrl}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[length:var(--type-micro)] font-semibold text-[var(--text-mid)] ${
            avatar.isSponsor ? "bg-[var(--bg-surface-active)]" : "bg-[var(--bg-surface)]"
          }`}
        >
          {avatar.text}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {name}
        </div>
        <div className="truncate text-[length:var(--type-caption)] text-[var(--text-low)]">
          {subtitle}
        </div>
      </div>

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

- [ ] **Step 2: Update `transactions-client.tsx` — use shared filter**

In `apps/web/app/(game)/league/[leagueId]/budget/transactions/transactions-client.tsx`:

Replace the imports and filter logic. Change:

```typescript
const FILTER_SEGMENTS = ["All", "Bonuses", "Salaries", "Sponsors"];

function filterTransactions(transactions: Transaction[], filterIndex: number): Transaction[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1) return transactions.filter((t) => ["rider_revenue", "monthly_bonus", "sponsor_bonus"].includes(t.type));
  if (filterIndex === 2) return transactions.filter((t) => ["monthly_salary", "phase_salary"].includes(t.type));
  if (filterIndex === 3) return transactions.filter((t) => ["sponsor_payment", "phase_sponsor_base"].includes(t.type));
  return transactions;
}
```

To:

```typescript
import {
  TRANSACTION_FILTER_OPTIONS,
  filterTransactions,
} from "@/lib/sponsors";

const FILTER_SEGMENTS = TRANSACTION_FILTER_OPTIONS.map((o) => o.label);
```

And remove the local `filterTransactions` function since it's now imported from `lib/sponsors.ts`.

Also add `riderPhotoUrl` and `riderName` to the `Transaction` interface and pass them to `TransactionRow`:

```typescript
interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  rider_photo_url?: string | null;
  rider_name?: string | null;
}
```

And in the `TransactionRow` call:

```tsx
<TransactionRow
  key={t.id}
  type={t.type}
  amount={t.amount}
  description={t.description}
  date={t.created_at}
  riderPhotoUrl={t.rider_photo_url}
  riderName={t.rider_name}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/transaction-row.tsx apps/web/app/\(game\)/league/\[leagueId\]/budget/transactions/transactions-client.tsx
git commit -m "fix(transactions): correct filter types, add new type display, rider photos"
```

---

### Task 6: Join rider photo in budget server components

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/transactions/page.tsx`

The treasury_log table has `rider_id` which references `riders`. We need to join to get `photo_url` and name for display.

- [ ] **Step 1: Update budget `page.tsx` treasury_log query**

In `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`, change the transactions query (around line 55-60):

Replace:

```typescript
    supabase
      .from("treasury_log")
      .select("*")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
```

With:

```typescript
    supabase
      .from("treasury_log")
      .select("*, riders:rider_id(photo_url, last_name, first_name)")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
```

Then map the transactions before passing to BudgetClient to flatten the rider data:

```typescript
  const mappedTransactions = (transactions ?? []).map((t: Record<string, unknown>) => {
    const rider = t.riders as { photo_url: string | null; last_name: string; first_name: string } | null;
    return {
      id: t.id as string,
      type: t.type as string,
      amount: t.amount as number,
      description: t.description as string | null,
      created_at: t.created_at as string,
      rider_photo_url: rider?.photo_url ?? null,
      rider_name: rider ? `${rider.first_name} ${rider.last_name}` : null,
    };
  });
```

Pass `mappedTransactions` instead of `transactions ?? []` to `BudgetClient`.

- [ ] **Step 2: Update transactions `page.tsx`**

Check `apps/web/app/(game)/league/[leagueId]/budget/transactions/page.tsx` and apply the same rider join pattern to its treasury_log query. If it queries treasury_log, add the rider join and map similarly.

- [ ] **Step 3: Verify build and visual check**

Run: `cd apps/web && pnpm tsc --noEmit`
Then `pnpm dev` and check:
- Transaction rows with `rider_id` show rider photo
- New types (`payday_salary`, `release_fee`, `transfer_bonus`) display correctly
- Filters work correctly — "Bonuses" shows `sponsor_bonus` + `transfer_bonus`, "Salaries" shows `payday_salary` + `auction_purchase` + `release_fee` + `bankruptcy_release`, "Sponsors" shows `sponsor_payment`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/
git commit -m "feat(budget): join rider photos in treasury_log queries"
```

---

## Final Verification

After all 6 tasks:

- [ ] **Full build check:** `cd apps/web && pnpm build`
- [ ] **Lint:** `pnpm lint`
- [ ] **Type check:** `pnpm typecheck`
- [ ] **Visual check:** Navigate through all pages:
  - `/league/[id]/budget` — slim sponsor card, correct filters, rider photos
  - `/league/[id]/budget/marketplace` — tier groups, Switch toggles, auto-save
  - `/league/[id]/budget/transactions` — correct filters, rider photos
