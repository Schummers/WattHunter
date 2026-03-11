# Design Doc — Budget Page & Sponsor Marketplace

**Date:** 2026-03-11
**Status:** Validated
**PRD sources:** `watthunter-prd-budget.md`, `watthunter-prd-budget-sponsors.md`
**Wireframe validated:** `docs/wireframes/marketplace-proposal-B.html` (Proposal B — Slot sections)

---

## 1. Scope

3 new pages under `/league/[leagueId]/budget/`:

| Page | Route | Description |
|------|-------|-------------|
| **Budget** | `/budget` | Balance hero + transactions + sponsor cards |
| **All Transactions** | `/budget/transactions` | Full transaction history grouped by month |
| **Marketplace** | `/budget/marketplace` | Sponsor selection with toggles |

Budget becomes the **3rd tab** in the bottom nav (Home, Team, **Budget**, Ranking).

---

## 2. Data Model Changes

### 2.1 Overhaul `sponsors` table

The current table has 10 generic sponsors with an A/B option system. Replace entirely with the 14 real cycling sponsors from the PRD.

**New schema:**

```sql
drop table if exists public.team_sponsors;
drop table if exists public.sponsors;

create table public.sponsors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  abbreviation    text not null,          -- 3-letter: SQS, GRP, INE, etc.
  tier            int not null check (tier between 1 and 5),
  slot            text not null check (slot in ('secondary', 'principal')),
  monthly_budget  int not null,           -- euros/month (200k, 350k, 550k, 750k, 1M)
  unlock_level    int not null check (unlock_level between 1 and 10),
  nationality     text,                   -- null = no nationality condition
  nationality_count int default 0,        -- e.g. 2 = "2× 🇫🇷"
  specialty       text[],                 -- OR logic: ['OneDay', 'Sprint']
  result_condition text,                  -- null, 'top10_classic', 'top10_stage_race', 'top10_gt_monument', 'top5_gt_monument'
  sort_order      int not null default 0, -- display order within tier
  created_at      timestamptz not null default now()
);

-- RLS: public read for authenticated users
alter table public.sponsors enable row level security;
create policy "Sponsors are readable by authenticated users"
  on public.sponsors for select to authenticated using (true);
```

### 2.2 Overhaul `team_sponsors` table

Replace the contract-based system (2-month expiry) with a simpler slot-based system for MVP. Changes take effect at next auction phase.

```sql
create table public.team_sponsors (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  sponsor_id      uuid not null references public.sponsors(id) on delete restrict,
  slot            text not null check (slot in ('secondary', 'principal')),
  status          text not null default 'active' check (status in ('active', 'pending_change')),
  pending_sponsor_id uuid references public.sponsors(id),  -- next phase sponsor (null = no change)
  activated_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(team_id, slot)  -- 1 sponsor per slot per team
);
```

**Key decisions:**
- `unique(team_id, slot)` — max 1 active per slot
- `pending_sponsor_id` — stores the next-phase switch (null = no pending change)
- No 2-month contract expiry in MVP (confidence system is post-MVP)

### 2.3 Seed the 14 sponsors

```sql
insert into public.sponsors (name, abbreviation, tier, slot, monthly_budget, unlock_level, nationality, nationality_count, specialty, result_condition, sort_order) values
  ('Lotto',             'LOT', 1, 'secondary',  200000, 1, null,  0, '{}',                       null,                   1),
  ('Groupama-FDJ',      'GRP', 2, 'secondary',  350000, 3, 'FR',  2, '{GC}',                     null,                   2),
  ('Movistar',          'MOV', 2, 'secondary',  350000, 3, 'ES',  2, '{GC}',                     null,                   3),
  ('Uno-X',             'UNX', 2, 'secondary',  350000, 3, 'DK',  2, '{OneDay}',                 null,                   4),
  ('Alpecin',           'ALP', 2, 'secondary',  350000, 3, 'BE',  2, '{OneDay,Sprint}',          null,                   5),
  ('Decathlon',         'DEC', 3, 'principal',   550000, 5, 'FR',  2, '{GC,Sprint}',              'top10_stage_race',     6),
  ('Soudal Quick-Step', 'SQS', 3, 'principal',   550000, 5, 'BE',  2, '{OneDay,Sprint}',          'top10_classic',        7),
  ('Ineos Grenadiers',  'INE', 3, 'principal',   550000, 5, 'GB',  2, '{OneDay,GC}',              'top10_stage_race',     8),
  ('Bora-Hansgrohe',    'BOR', 3, 'principal',   550000, 5, 'DE',  2, '{OneDay,GC}',              'top10_classic',        9),
  ('Trek',              'TRK', 3, 'principal',   550000, 5, 'US',  2, '{OneDay,TT}',              'top10_classic',       10),
  ('Lidl',              'LID', 4, 'principal',   750000, 7, null,  0, '{GC,Sprint}',              'top10_gt_monument',   11),
  ('Red Bull',          'RBL', 4, 'principal',   750000, 7, null,  0, '{GC,TT}',                  'top10_gt_monument',   12),
  ('Visma',             'VIS', 4, 'principal',   750000, 7, null,  0, '{GC,OneDay}',              'top10_gt_monument',   13),
  ('UAE Group',         'UAE', 5, 'principal',  1000000, 8, null,  0, '{GC}',                     'top5_gt_monument',    14);
```

### 2.4 Auction Phases (hardcoded, not a table)

7 phases per season — static, hardcoded in `apps/web/lib/phases.ts`:

```typescript
export const AUCTION_PHASES = [
  { id: 1, label: "Season Start",    start: "Jan 1",  end: "Feb 28" },
  { id: 2, label: "The Flandrians",  start: "Mar 1",  end: "Apr 12" },
  { id: 3, label: "The Ardennes",    start: "Apr 13", end: "May 10" },
  { id: 4, label: "Giro d'Italia",   start: "May 11", end: "Jun 14" },
  { id: 5, label: "Tour de France",  start: "Jun 15", end: "Aug 2"  },
  { id: 6, label: "La Vuelta",       start: "Aug 3",  end: "Sep 21" },
  { id: 7, label: "End of Season",   start: "Sep 22", end: "Nov 2"  },
] as const;
```

No DB table — these are game constants. `getCurrentPhase()` helper determines current phase from today's date.

### 2.5 `treasury_log` — no schema changes

Existing types are sufficient: `sponsor_payment`, `monthly_salary`, `monthly_bonus`, `rider_revenue`, `auction_purchase`, `starting_fund`, `bankruptcy_release`.

The `description` field stores context (race name for bonuses, sponsor name for payments).

### 2.6 Uno-X nationality: DK + NO

Uno-X accepts Danish OR Norwegian riders. Since `nationality` is a single text field, we use `'DK'` and handle the OR logic (DK or NO) at the application level via a `nationality_alt` column or a check in code. **Decision: store as 'DK' with a note, handle 'NO' in application logic via a constant map.**

```typescript
// lib/sponsors.ts
export const NATIONALITY_ALIASES: Record<string, string[]> = {
  'DK': ['DK', 'NO'],  // Uno-X accepts both
  'BE': ['BE', 'NL'],  // Alpecin accepts both
};
```

---

## 3. Page Designs

### 3.1 Budget Main Page (`/budget`)

**Layout (top to bottom):**

1. **Phase Navigator** — centered phase name + date range, left/right arrows
   - Typography: phase name = `--type-emphasis` (14px/600), dates = `--type-caption` (12px/500, `--text-low`)
   - Arrows: 32px touch target, `--border-default` background, disabled = opacity 0.35

2. **Brand Card (Balance Hero)** — frosted glass card (reuse `team-level-card.tsx` pattern)
   - "BALANCE" label: `--type-label` uppercase, `--text-low`
   - Balance value: `--type-display` (32px/900), `--accent-highlight` (cyan-400), Geist Mono
   - Below: "Income +€XXXk · Outgoing −€XXXk" inline
     - Labels: `--type-caption`, `--text-low`
     - Values: `--type-caption`, `--text-high`, Geist Mono, **no color** (just +/− prefix)
   - **1 Brand Card per screen** rule respected (this is the only one)

3. **Transactions Section**
   - Header: "Transactions" (`--type-section`) + "See all →" (`--type-caption`, `--accent-default`)
   - Filter Chips (Contained Light): All / Bonuses / Salaries / Sponsors
   - Last 4–5 transactions from current phase
   - Transaction row (Pattern A — List Row):
     - Avatar circle 32px with initials (rider) or abbreviation (sponsor)
       - Rider: `--bg-surface`, `--text-mid` initials
       - Sponsor: `--bg-surface-active`, `--text-mid` abbreviation
     - Name: `--type-emphasis`, `--text-high`
     - Subtitle: `--type-caption`, `--text-low` (race name / "Salary" / "Sponsorship")
     - Amount: `--type-emphasis`, `--text-high`, Geist Mono, +/− prefix, **no color**
     - Date: `--type-micro`, `--text-low`, right-aligned below amount
   - Dividers: `--border-subtle`

4. **Sponsors Section**
   - Header: "Sponsors" (`--type-section`)
   - Active sponsor cards only (1 or 2 depending on slots unlocked)
   - Card (Standard): `--bg-surface`, `--border-default`, `--radius-lg`
     - **No logo circle** — name starts at left edge
     - Name: `--type-emphasis`, `--text-high`
     - Tier info: `--type-caption`, `--text-low` ("Secondary · T2")
     - Amount: `--type-stat` (20px/800), `--text-high`, Geist Mono, right-aligned
     - "/ month": `--type-micro`, `--text-low`, below amount
     - Condition tags: Tag component (default variant), `--radius-pill`
     - "Change sponsor →": `--type-caption`, `--accent-default`, navigates to marketplace
   - Locked slot: dashed border, opacity 0.4, "Unlocks at Level X"

### 3.2 All Transactions (`/budget/transactions`)

**Layout:**

1. **Back Header**: "← Budget" (`back-header.tsx` component)
2. **Filter Chips**: All / Bonuses / Salaries / Sponsors (same pattern)
3. **Transaction list**: all transactions, **no phase navigation** — everything in one scroll
4. **Grouped by calendar month**: "MARCH 2026" header (`--type-label` uppercase) + monthly net total right-aligned (`--type-caption`, Geist Mono, `--text-high`)
5. **Same transaction row pattern** as Budget main page (consistent)

### 3.3 Sponsor Marketplace (`/budget/marketplace`)

**Validated design: Proposal B (Slot Sections)**

**Layout:**

1. **Back Header**: "← Budget"
2. **Page title**: "Choose a sponsor" (`--type-page-title`)
3. **Info banner**: "Change will take effect after the next auction phase." (`--bg-subtle`, `--border-default`, `--type-caption`, `--text-mid`)

4. **Slot sections** (like Policies pattern):

   **SECONDARY SPONSOR** section:
   - Header: "SECONDARY SPONSOR" (`--type-label` uppercase, `--text-low`) + "1 / 1 active" counter
   - Description: "T1 – T2 · Budget up to €350k/month" (`--type-caption`, `--text-ghost`)
   - Sponsor rows (divide-y):
     - Name (`--type-emphasis`) + Tier badge pill (`--type-micro`, `--bg-surface-hover`, `--radius-pill`)
     - Amount (`--type-emphasis`, Geist Mono, `--text-high`) — **aligned to fixed position**
     - Toggle (44×24px) — **same min-width as lock badge for alignment**
     - Condition tags below (Tag default variant)

   **MAIN SPONSOR** section:
   - Same pattern, lists T3/T4/T5 sponsors
   - Locked sponsors: opacity 0.35, lock badge replaces toggle (same width)

5. **Alignment rule**: toggle and lock badge share `min-width: 56px` so amounts stay aligned vertically

6. **Sponsor eligibility & toggle behavior**:

   **Business rule:** Every sponsor (except Lotto T1) requires **all** its conditions to be met before the toggle is enabled:
   - `nationality` → team roster has ≥ `nationality_count` riders of that nationality (respecting aliases: DK↔NO, BE↔NL)
   - `specialty` → at least 1 roster rider has one of the listed specialties (OR logic)
   - `result_condition` → at least 1 **currently contracted** rider achieved that result type this season (queried from `race_results`)

   **Lotto (T1)** has no conditions → always activable from level 1.

   **Condition is live:** if a rider who fulfilled a condition is released, the sponsor loses eligibility. The team must replace them or the sponsor gets auto-deactivated (post-MVP: grace period?).

   **3 states in the Marketplace:**

   | State | Visual | Toggle |
   |-------|--------|--------|
   | **Level-locked** | opacity 0.35, lock badge | No toggle |
   | **Unlocked, conditions NOT met** | Normal opacity, tags default (gray) | Toggle **disabled** |
   | **Unlocked, conditions met** | Normal opacity, matched tags **green** (success variant) | Toggle **enabled** |

   **Green tags (individual):** Each condition tag turns `success` variant independently. A sponsor can show 1 green tag and 2 gray tags — the player instantly sees "I need 1 more Belgian rider + a classic result".

   **Toggle slot rules:**
   - ON a sponsor in secondary slot → auto-OFF the previous secondary
   - ON a sponsor in principal slot → auto-OFF the previous principal
   - Max 1 per slot at any time
   - Cannot turn OFF the last active sponsor (must have at least 1 in secondary)

7. **Sticky CTA** (visible only when changes exist):
   - "New monthly budget": `--type-caption`, `--text-low`
   - Amount: `--type-emphasis`, Geist Mono, `--text-high`
   - Button: "Save sponsors →" (CTA gradient)

---

## 4. Bottom Nav Update

Add Budget as 3rd tab:

| Position | Label | Icon (Lucide) | Route |
|----------|-------|---------------|-------|
| 1 | Home | Home | `/league/[id]` |
| 2 | Team | Users | `/league/[id]/team` |
| 3 | **Budget** | **Wallet** | `/league/[id]/budget` |
| 4 | Ranking | BarChart3 | `/league/[id]/ranking` |

---

## 5. Server Actions

### 5.1 `getbudgetData(leagueId)`

Fetches for the Budget main page:
- Team treasury, level
- Active sponsors (via `team_sponsors` join `sponsors`)
- Last 5 treasury_log entries for current phase date range
- Income/outgoing totals for current phase

### 5.2 `getAllTransactions(leagueId)`

Fetches all treasury_log entries for the team, ordered by `created_at DESC`. Client-side filtering by type and grouping by month.

### 5.3 `getMarketplaceData(leagueId)`

Fetches:
- All 14 sponsors (with locked state based on team level)
- Current active sponsors (team_sponsors)
- Team level for gating
- **Sponsor eligibility per sponsor** (see 5.5)

### 5.4 `saveSponsors(teamId, changes)`

Server action to save sponsor selection:
- Validates team level vs sponsor tier
- **Validates sponsor eligibility** (all conditions must be met — nationality, specialty, result)
- Updates `team_sponsors` rows (upsert)
- Sets `pending_sponsor_id` if mid-phase, or directly swaps if at phase boundary
- **MVP simplification**: changes apply immediately (not next phase) — revisit for post-MVP

### 5.5 `checkSponsorEligibility(teamId)`

Server-side helper called by `getMarketplaceData`. Returns per-sponsor eligibility status:

```typescript
interface SponsorEligibility {
  sponsorId: string;
  eligible: boolean;           // all conditions met?
  conditions: {
    nationality: boolean | null;  // null = no nationality condition
    specialty: boolean | null;    // null = no specialty condition
    result: boolean | null;       // null = no result condition
  };
}
```

**Implementation:**
1. Fetch active contracts → get `rider_id[]` for the team
2. Fetch riders data (nationality, specialty) for those rider IDs
3. Fetch `race_results` for those riders this season (for result_condition checks)
4. For each sponsor, check each condition independently:
   - `nationality`: count riders matching nationality (respecting `NATIONALITY_ALIASES`)
   - `specialty`: any rider has one of the sponsor's specialties (OR logic)
   - `result_condition`: any rider has a matching result (top10 classic, top10 stage race, etc.)
5. Return per-condition booleans → drives green tags + toggle enabled/disabled

**Query is lightweight:** roster is 6–12 riders, called once per Marketplace load. No caching needed.

---

## 6. Auto-assign Default Sponsor

On team creation (onboarding), auto-assign **Lotto (T1)** to the secondary slot. This ensures every team has at least 1 sponsor from day 1.

```sql
-- In the team creation flow (server action)
insert into team_sponsors (team_id, sponsor_id, slot)
select NEW.id, s.id, 'secondary'
from sponsors s where s.name = 'Lotto';
```

---

## 7. Game Rules Update

Update `GAME_RULES.md` §9 (Sponsors) to match PRD budget-sponsors:
- Replace generic sponsor amounts with real grid (200k–1M)
- Document 2-slot system (secondary + principal)
- Document 14 sponsors with conditions
- Mark confidence/leave as post-MVP

---

## 8. Files to Create/Modify

### New files:
- `apps/web/lib/phases.ts` — auction phases constants + helpers
- `apps/web/lib/sponsors.ts` — nationality aliases, sponsor helpers, eligibility checker
- `apps/web/app/(game)/league/[leagueId]/budget/page.tsx` — Budget main page (server component)
- `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx` — client interactivity
- `apps/web/app/(game)/league/[leagueId]/budget/transactions/page.tsx` — All Transactions
- `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx` — Marketplace (server)
- `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx` — client
- `apps/web/app/(game)/league/[leagueId]/budget/actions.ts` — server actions (saveSponsors)
- `apps/web/components/phase-navigator.tsx` — reusable phase nav component
- `apps/web/components/transaction-row.tsx` — reusable transaction row
- `apps/web/components/sponsor-card.tsx` — sponsor card for Budget main page
- `supabase/migrations/20260311000000_sponsors_overhaul.sql` — new sponsor schema + seed

### Modified files:
- `apps/web/components/bottom-nav.tsx` — add Budget tab
- `apps/web/lib/levels.ts` — verify sponsor unlock data matches new schema
- `docs/GAME_RULES.md` — update §9 Sponsors

---

## 9. Open Decisions (resolved)

| Question | Decision |
|----------|----------|
| Confidence/leave system? | Post-MVP. Not implemented. |
| Sponsor change timing? | MVP: immediate. Post-MVP: next phase. |
| Logo circles on sponsor cards? | No. Name starts at left edge. |
| Phase navigation on All Transactions? | No. Flat list grouped by month. |
| "MAIN SPONSOR" label above title? | Removed. Just "Choose a sponsor". |
| Tier subtitle below title? | Removed. Tier info in section headers. |
| Toggle vs radio select? | Toggle on/off. Auto-deselects other in same slot. |
| Min sponsors? | Always 1 in secondary (Lotto default, cannot turn off last). |
| Uno-X DK/NO and Alpecin BE/NL? | Application-level alias map. |
| Sponsor eligibility enforcement? | All conditions must be met (nationality + specialty + result). Toggle disabled if not. Lotto exempt. |
| Eligibility visual feedback? | Tags turn green (success variant) individually when condition met. No red for unmet. |
| Result condition scope? | Based on currently contracted riders only. Release rider → lose eligibility. |
| Eligibility computation? | Server-side helper, computed per Marketplace load. No cache. |
