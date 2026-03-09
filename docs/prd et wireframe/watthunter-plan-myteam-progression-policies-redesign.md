# Plan — My Team, Progression & Policies Redesign

## Context

The My Team, Team Progression (Levels), and Policies pages exist but need redesign per the PRD `docs/prd et wireframe/watthunter-prd-myteam-progression.md` and Design System v3. Currently: My Team has flat metrics + TeamLevelCard at bottom; Levels is a flat list with pills; Policies has non-functional toggles on the left, no selects, no save, no sticky footer. The redesign adds visual hierarchy (branded XP card, policy slots preview), a timeline-style progression page, and a fully interactive policies page with server actions.

---

## Phase 0 — Shared Infrastructure (~30 min)

### 0A. Create `apps/web/lib/policies.ts`
Single source of truth for policy types (currently duplicated in policies page + rail).

```ts
export const POLICY_TYPES = [
  { slug: "specialist", emoji: "🎯", name: "Speciality", description: "...", unlockLevel: 1, paramKey: "specialty", options: ["GC", "Sprint", "TT", "One Day"] },
  { slug: "national_pride", emoji: "🌍", name: "Nationality", description: "...", unlockLevel: 3, paramKey: "nationality", options: null }, // dynamic
  { slug: "team_chemistry", emoji: "🤝", name: "Teams", description: "...", unlockLevel: 5, paramKey: "team", options: null }, // dynamic
  { slug: "young_blood", emoji: "⏳", name: "Age", description: "...", unlockLevel: 7, paramKey: "max_age", options: ["23", "25", "28"] },
];
export function getMaxActivePolicies(level: number): number { return level >= 5 ? 2 : 1; }
```

Note: DB slugs are `specialist`, `national_pride`, `team_chemistry`, `young_blood`. `road_warriors` exists in DB but is NOT user-configurable — skip in UI.

### 0B. Update `apps/web/lib/levels.ts` — add `getUnlockDescriptions()`
New function returning sentence-style descriptions with `**bold**` markers for the progression page (TP-2).

Patterns per PRD:
- `"Roster expanded to **X slots** (was Y)"`
- `"Access riders ranked **#X to #500**"`
- `"Unlock **[type]** policy type"`
- `"Use **X policies** at the same time"`
- `"Access **Tier X sponsor** · budget"`

### 0C. Export `riderMatchesPolicy` from `apps/web/lib/boost.ts`
Currently private. Needed for coverage calculation in the Policies page footer.

### 0D. Add Shadcn Select component
`npx shadcn@latest add select` → style with DS v3 tokens (bg-surface, border-default, focus accent, radius-md).

### 0E. DB migration: unique constraint on `team_policies`
```sql
ALTER TABLE public.team_policies ADD CONSTRAINT team_policies_team_policy_unique UNIQUE (team_id, policy_id);
```
Needed for safe upsert in the server action.

---

## Phase 1 — My Team Page Redesign (~1h)

**File:** `apps/web/app/(game)/league/[leagueId]/team/page.tsx`

### MT-2: Branded XP Hero Card (replaces current header + TeamLevelCard)
Build inline in the page (not a separate component — TeamLevelCard stays for Home).

Structure:
- **XP hero**: `--type-display` (32px/900) Geist Mono, `--accent-highlight` (cyan-400)
- **Ranking pill**: `Tag variant="default"` showing `#4 / 12`, NOT a link (PRD says "info only")
- **Progress bar**: sky-500 fill, tappable → `/league/[id]/levels` via `RailLink`
- **XP targets**: `12,847 / 15,000 XP` in `--type-caption` Geist Mono, `--text-low`
- **Chevron** affordance next to progress %

Remove `<TeamLevelCard>` at bottom of page.

### MT-3: Policy Slots Section (replaces boost pill + link)
Between hero card and roster:
- Section header: "Policies" (`--type-section`) + `RailLink` "See all →" to policies page
- Render `getMaxActivePolicies(level)` slots:
  - **Active**: emoji + type name + `Tag variant="highlighted"` `+5%` + chevron
  - **Empty** (unlocked but inactive): dashed circle + "Open slot" `--text-ghost`
  - **Locked** (level too low): 50% opacity + "Open slot · Level X"

Data: use `activePolicies` already fetched + `POLICY_TYPES` from new `lib/policies.ts`.

### MT-4: Roster — per-rider boost badge
Pass `boostPct` per rider to `<RiderCard>`. For each rider, check which active policies match using `riderMatchesPolicy`. The boost % = count of matching policies × 5%.

### MT-5: Bid amounts in success green
Change bid amount color from `--accent-default` to `--success` for active bids.

### Summary of changes

| Section | Before | After |
|---------|--------|-------|
| Hero | 2 metric blocks (XP + Ranking) | Branded card with XP hero, ranking pill, progress bar |
| Policies | Boost pill + "Change policies →" | Policy slots preview (active/empty/locked) |
| Roster | RiderCard without boost | RiderCard with per-rider boost badge |
| Bids | Cyan amounts | Success green amounts |
| Bottom | TeamLevelCard | Removed (merged into hero) |

---

## Phase 2 — Team Progression Page Redesign (~1h)

**File:** `apps/web/app/(game)/league/[leagueId]/levels/page.tsx`

### TP-1: Hybrid timeline layout
Replace flat list with 3 visual states:

| State | Icon | Layout | Opacity |
|-------|------|--------|---------|
| **Completed** | Green checkmark (`CircleCheck`, `--success`) | Collapsed: level name + XP only | 60% |
| **Current** | Sky dot (8px circle, `--accent-label`) | Expanded: progress bar + bullet unlocks | 100% |
| **Locked** | Lock icon (`Lock`, `--text-ghost`) | Expanded: bullet unlocks visible | 70% |

Optional vertical line connecting icons via `border-l` on a wrapper div.

### TP-2: Bullet descriptions
Use `getUnlockDescriptions()`. Parse `**text**` and render as `<strong className="text-[var(--text-high)]">` (current level) or `<strong className="text-[var(--text-mid)]">` (locked).

Bullet dots: `--accent-label` (sky-500) for current, `--text-ghost` for locked.

### TP-3: Progress bar on current level
XP value in `--accent-highlight` (cyan-400) Geist Mono. Fill `--accent-label` (sky-500). Track neutral.

### TP-4: Back navigation
Update `BackHeader` label to "Back" with accent color. Add `accent?: boolean` prop to `back-header.tsx` → switches text from `--text-mid` to `--accent-default`.

### Remove TeamLevelCard hero
The title `"{teamName} progression"` stays. The TeamLevelCard is removed — current level is shown inline in the timeline.

---

## Phase 3 — Policies Page Redesign (~2-3h)

This is the most complex change. The page becomes interactive.

### Architecture: Server + Client split
- `policies/page.tsx` — server component, fetches all data, renders `<PoliciesClient />`
- `policies/policies-client.tsx` — **new** client component with toggles, selects, save logic
- `policies/actions.ts` — **new** server action `savePolicies`

### 3A. Server data fetch (`page.tsx` rewrite)
Fetch:
1. Team data (level, team_id) — existing
2. All `policies` rows (5 entries) — to get policy_id per slug
3. Current `team_policies` for this team (is_active, config)
4. Dynamic select options:
   - `SELECT DISTINCT nationality FROM riders WHERE nationality IS NOT NULL ORDER BY nationality`
   - `SELECT DISTINCT real_team FROM riders WHERE real_team IS NOT NULL ORDER BY real_team`
5. Roster riders (contracts + riders) for coverage calculation

### 3B. Server action (`actions.ts`)
```ts
"use server"
// savePolicies(teamId, leagueId, policies: { slug, isActive, config }[])
// 1. Auth check
// 2. Verify team ownership (team_id belongs to user via teams.user_id)
// 3. Validate level unlocks (can't activate policy type above current level)
// 4. Validate max active count
// 5. Zod validation (NEVER skip per CLAUDE.md)
// 6. For each policy: upsert team_policies (INSERT ON CONFLICT DO UPDATE)
// 7. revalidatePath
```

### 3C. Client component (`policies-client.tsx`)

**State:**
- `localPolicies: Map<slug, { isActive: boolean, config: Record<string, string> | null }>`
- `savedPolicies`: snapshot for dirty-checking
- `hasChanges`: derived boolean
- `saving`: boolean

**PO-1: Flat list of all 4 types**
All 4 from `POLICY_TYPES`. Locked rows: 40% opacity + `Tag variant="default"` with `🔒 Lv.X`.

**PO-2: Toggle on RIGHT**
- ON: `data-[state=checked]:bg-[var(--accent-default)]` (cyan-500)
- OFF: `data-[state=unchecked]:bg-[var(--bg-surface-active)]`
- Forced ON (min==max at Lv.1): 50% opacity, disabled
- Locked: 30% opacity, disabled
- Max active reached → disable remaining OFF toggles

**PO-3: Select dropdown (conditional)**
Visible only when toggled ON. Appears below the policy description.
- `specialist`: ["GC", "Sprint", "TT", "One Day"]
- `national_pride`: dynamic nationalities from DB (show flag + country name)
- `team_chemistry`: dynamic team names from DB
- `young_blood`: ["Under 23", "Under 25", "Under 28"]

**PO-4: Section header**
`"Slots"` in `--type-label` uppercase + `"X / Y max active"` in `--type-caption` `--text-low`.

**PO-5: Sticky footer**
Adapt `StickyBar` to accept `children` prop (or create inline). Content:
- Left: `"X / Y riders covered"` (`--text-mid`, `--type-caption`)
- Center: `"+X% boost"` (`--accent-highlight`, Geist Mono, `--type-page-title`, font-extrabold)
- Right: Save button (CTA gradient, enabled only when `hasChanges`)

Coverage = count of roster riders matching ANY active policy (use `riderMatchesPolicy`).

**PO-6: Pending banner**
- No pending: neutral bg-subtle banner, "Changes apply to the next round..."
- After save: amber banner (`bg-amber-500/[0.06]`, `border-amber-500/20`), "Saved for next round" + bullet list of active policies with their selection value

---

## Phase 4 — Rail Pages Update (~30 min)

### `components/rail-pages/policies-rail.tsx`
Rewrite to render `<PoliciesClient>` with data fetched client-side. Mirrors Phase 3C but uses `useEffect` + browser Supabase client for data fetching.

### `components/rail-pages/levels-rail.tsx`
Apply same timeline layout as Phase 2 (3 states, bullet descriptions).

---

## Files Summary

### New files
| File | Purpose |
|------|---------|
| `apps/web/lib/policies.ts` | POLICY_TYPES constant + helpers |
| `apps/web/app/(game)/league/[leagueId]/team/policies/policies-client.tsx` | Interactive policies UI |
| `apps/web/app/(game)/league/[leagueId]/team/policies/actions.ts` | savePolicies server action |
| `supabase/migrations/YYYYMMDD_team_policies_unique.sql` | Unique constraint |

### Modified files
| File | Changes |
|------|---------|
| `apps/web/app/(game)/league/[leagueId]/team/page.tsx` | Hero card, policy slots, per-rider boost, remove TeamLevelCard |
| `apps/web/app/(game)/league/[leagueId]/levels/page.tsx` | Timeline layout, 3 states, bullet descriptions |
| `apps/web/app/(game)/league/[leagueId]/team/policies/page.tsx` | Rewrite as server fetcher + PoliciesClient |
| `apps/web/lib/levels.ts` | Add `getUnlockDescriptions()` |
| `apps/web/lib/boost.ts` | Export `riderMatchesPolicy` |
| `apps/web/components/back-header.tsx` | Add `accent` prop |
| `apps/web/components/sticky-bar.tsx` | Support children/ReactNode |
| `apps/web/components/rail-pages/policies-rail.tsx` | Mirror redesign |
| `apps/web/components/rail-pages/levels-rail.tsx` | Mirror redesign |

### Reused as-is
| File | Usage |
|------|-------|
| `components/rider-card.tsx` | Already supports `boostPct` prop |
| `components/pill.tsx` (Tag) | 4 variants used throughout |
| `components/sub-tabs.tsx` | My Team / Recruts tabs unchanged |
| `components/ui/progress.tsx` | Progress bars |
| `components/ui/switch.tsx` | Policy toggles |
| `lib/format.ts` | formatThousands, countryCodeToFlag, smartCountdown |

---

## Implementation Order

1. Phase 0 (infra) — unblocks everything
2. Phase 2 (Levels/Progression) — simplest, no new interactivity
3. Phase 1 (My Team) — depends on lib/policies.ts
4. Phase 3 (Policies) — most complex, depends on all infra
5. Phase 4 (Rails) — mirrors Phase 2+3

---

## Verification

After each phase:
1. `pnpm typecheck` — no type errors
2. `pnpm build` — clean build
3. `pnpm dev` — visual check at `http://localhost:3000/league/[id]/team`
4. Check all 3 pages render correctly
5. Policies: test toggle → select → save → reload confirms persistence
6. Progression: verify completed/current/locked states display correctly
7. My Team: verify policy slots show active policies, XP hero card renders
