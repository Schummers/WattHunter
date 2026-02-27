# WattHunter — PCS Pipeline & Auction System Design

**Date**: 2026-02-27
**Status**: Approved
**Scope**: PCS data pipeline + Auction system (US-07 to US-13)

---

## 1. Overview

This phase builds the core game engine: fetching real rider data from ProCyclingStats and implementing the full sealed-bid auction system over 3 rounds.

**User Stories covered:**
- US-07 — Auction calendar view
- US-08 — Browse rider catalogue (filtered by level, with search)
- US-09 — Rider detail profile
- US-10 — Place a sealed bid with budget validation
- US-11 — Modify/cancel a bid before midnight resolution
- US-12 — Email notification after round resolution
- US-13 — Treasury balance + total exposure widget

---

## 2. Architecture — 3 Jobs in FastAPI + GitHub Actions Cron

### 2.1 Overview

All backend logic lives in the FastAPI Python service (`services/pcs-sync/`), deployed on Railway. GitHub Actions triggers each job at scheduled times via HTTP POST.

```
GitHub Actions (cron, free)
│
├── daily-pipeline.yml (08:00 UTC, every day)
│     step 1: POST /jobs/sync-riders    → wait for 200 OK
│     step 2: POST /jobs/daily-scoring  → wait for 200 OK
│
├── auction-resolve.yml (00:00 UTC, only during auction days)
│     step 1: POST /jobs/resolve-auction → atomic transaction
│
└── (future) monthly-finances.yml (1st of month)
      step 1: POST /jobs/monthly-finances
```

All endpoints protected by a shared secret (`X-Job-Secret` header stored in GitHub repository secrets).

### 2.2 JOB 1 — sync-riders (08:00 UTC daily)

Two sequential steps:

**Step A — Rider profiles (~200 riders from 7 ProTeams):**
- Fetch each rider's profile page via `procyclingstats` Python library
- UPSERT into `riders` table: name, nationality, team, age, specialty, photo_url, pcs_points_rolling_1y, pcs_rank, min_salary_monthly
- Rate limit: 4 seconds between requests (~13 min total)
- Serves the CATALOGUE (display, filters, auctions)

**Step B — Race results (only contracted riders):**
- For each rider with an active contract, fetch recent race results
- Filter for today's date, sum PCS points earned
- INSERT into `rider_pcs_history` with actual `points_delta` (real points earned, NOT rolling delta)
- Purge `rider_pcs_history` entries older than 7 days
- Serves SCORING and TREASURY calculations

**Initial ProTeams (alpha):**
1. Tudor Pro Cycling Team
2. Cofidis
3. Q36.5 Pro Cycling Team
4. Unibet
5. TotalEnergies
6. Caja Rural - Seguros RGA
7. Bardiani CSF

### 2.3 JOB 2 — daily-scoring (chained after JOB 1)

- Read `rider_pcs_history` WHERE date = today
- Join with `contracts` (which rider belongs to which team)
- Join with `team_policies` (active policy multipliers)
- Calculate XP: `points_delta * (1 + sum(policy_bonuses))`
- UPSERT into `rider_xp_daily` (idempotent on `rider_id, team_id, date`)
- Increment `teams.xp_cumulative`
- Calculate revenue: `points_delta * CONVERSION_RATE`
- INSERT into `treasury_log` (with dedup check on `team_id, date, type='rider_revenue'`)
- Update `teams.treasury`

### 2.4 JOB 3 — resolve-auction (00:00 UTC, auction days only)

Runs as a **single database transaction** (all-or-nothing):

1. Determine current round: `round = (today - auction.opens_at).days + 1`
2. Get all bids WHERE `auction_id = X AND round = current AND status = 'active'`
3. Group by `rider_id`
4. For each rider with bids:
   - Winner = highest `amount`, tiebreak = earliest `created_at`
   - Set winner's bid status = `won`
   - Set all other bids status = `outbid`
   - Create `contracts` row (purchase_price = amount, contract_salary = rider's current min_salary_monthly)
   - Deduct `teams.treasury` for the winner
   - Log in `treasury_log` (type = 'auction_win')
   - Set `riders.is_active_in_game = true`
5. If round = 3: set `auctions.status = 'closed'`
6. Send recap email to all participants (one email per player per round)

### 2.5 Idempotency

Every job is idempotent by design — safe to run twice for the same date:
- `rider_pcs_history`: UPSERT on `(rider_id, date)` UNIQUE constraint
- `rider_xp_daily`: UPSERT on `(rider_id, team_id, date)` UNIQUE constraint
- `treasury_log`: check for existing entry `(team_id, date, type)` before INSERT
- `resolve-auction`: bids already in `won`/`outbid` status are skipped

### 2.6 Why actual race results (not rolling delta)

The rolling 1yr PCS total can decrease even when a rider earns points (old results from 366 days ago drop off the window). Example:

```
Day 1: Pogacar has 7200 pts rolling 1yr
Day 2: He wins 80 pts in a stage
       BUT 150 pts from 366 days ago drop off
       → rolling 1yr = 7130 (delta = -70, despite earning 80 pts)
```

For XP and treasury calculations we need ACTUAL points earned, not the rolling delta. The `procyclingstats` library provides race-by-race results with exact PCS points per race, filtered by date.

The rolling 1yr total on `riders.pcs_points_rolling_1y` is still used for:
- Salary calculation
- Catalogue display
- Level-based rider access filtering

---

## 3. Data Model Changes

### 3.1 auction_bids — add round column

```sql
ALTER TABLE auction_bids ADD COLUMN round int NOT NULL DEFAULT 1
  CHECK (round BETWEEN 1 AND 3);

-- One bid per player per rider per round
CREATE UNIQUE INDEX auction_bids_unique_per_round
  ON auction_bids(auction_id, rider_id, team_id, round)
  WHERE status = 'active';
```

### 3.2 Auction mechanics

- One `auctions` row = one 3-day event
- Round is calculated: `round = (current_date - opens_at).days + 1`
- `closes_at = opens_at + 3 days`
- Auction calendar is pre-defined by admin (Jonathan) directly in Supabase dashboard
- First auction of a league is triggered by the commissioner (already implemented in US-06)

### 3.3 Bid statuses

| Status | Meaning |
|--------|---------|
| `active` | Bid placed, not yet resolved |
| `won` | Winner of the round for this rider |
| `outbid` | Someone bid higher (or earlier at equal amount) |
| `cancelled` | Player cancelled before midnight |

### 3.4 Data retention

| Table | Retention | Rationale |
|-------|-----------|-----------|
| `riders` | Permanent, updated daily | Catalogue |
| `rider_pcs_history` | 7-day rolling window | Only needed for daily scoring + safety margin |
| `rider_xp_daily` | Permanent | Game history, player stats |
| `treasury_log` | Permanent | Full audit trail |

---

## 4. Frontend — Routes

```
/league/[leagueId]/auctions                     → US-07: Auction calendar
/league/[leagueId]/auctions/[auctionId]          → US-08/10/11/13: Catalogue + bidding
/league/[leagueId]/auctions/[auctionId]/results  → Round results
```

Rider detail (US-09) is a Dialog (modal) over the catalogue — no separate route.

---

## 5. US-07 — Auction Calendar

**Route**: `/league/[leagueId]/auctions`

**Layout:**
- Active auction (if any): highlighted card (`bg-wh-surface`, `border`, `rounded-md`) with round indicator, countdown to midnight, rider count, bid count, and "Voir les coureurs" brand button
- Upcoming auctions: simple list with `border-b` separators, `Badge variant="secondary"` for "scheduled"
- Past auctions: simple list with `border-b`, `Badge variant="outline"` for "closed", rider count recruited, link to results

**Data:** Server Component, single query on `auctions WHERE league_id = ?` ordered by `opens_at DESC`.

---

## 6. US-08 + US-13 — Rider Catalogue + Treasury Widget

**Route**: `/league/[leagueId]/auctions/[auctionId]`

### 6.1 Treasury Widget (US-13)

Sticky bar at top of page, `bg-wh-surface`, `border-b`:
- Treasury balance (from `teams.treasury`)
- Active bids total (sum of my `active` bids this round)
- Available budget (treasury - bids)
- Available budget in `text-accent` if positive, `text-destructive` if < 50,000

### 6.2 My Bids Section

Visible only if player has active bids this round. Each bid shows:
- Rider name, team, amount
- "Modifier" button (ghost) and "Annuler" button (ghost destructive)

### 6.3 Rider Table (US-08)

Table columns: photo (24px rounded-full), name, team, specialty (3-letter abbrev), nationality, PCS points rolling 1yr, min salary/month.

**Filters** (client-side, all ~200 riders loaded in memory):
- Text search on name (Input with 300ms debounce)
- Team (Select, 7 ProTeams)
- Specialty (Select: climber, sprinter, rouleur, puncheur, time_trialist, all_rounder)
- Nationality (Select, populated from catalogue)

**Sort**: PCS points descending by default.

**States**:
- Riders already under contract: greyed out + "Recrute" badge, not clickable
- Riders I've bid on: "Mise" accent badge
- Click on available rider → opens rider detail Dialog

---

## 7. US-09 — Rider Detail Dialog

Dialog (`rounded-lg`, `bg-background`, overlay `bg-zinc-950/80`):

**Header**: rider photo (64px, `rounded-md`), name (`text-lg font-semibold`), team + nationality + age (`text-sm text-muted-foreground`)

**Info list** (label/value pairs separated by `border-b`):
- Specialty
- PCS points (1yr rolling)
- PCS rank
- Min salary/month
- Status (Available in `text-accent` / Recruited in `text-muted-foreground`)

**Bid form** (below separator):
- If no existing bid: Input for amount (min = rider min salary), validation, "Confirmer la mise" brand button
- If existing bid: shows current bid amount, Input for new amount, "Modifier la mise" brand button + "Annuler la mise" ghost destructive link

**Client-side validation**:
- `amount >= rider.min_salary_monthly`
- `amount % 100 === 0` (100 EUR increment)
- `active_bids_total + amount <= teams.treasury`
- Dynamic text: "Budget dispo apres mise: X EUR" (destructive color if negative)

---

## 8. US-10 + US-11 — Bidding (Server Actions)

Two Server Actions:

**`placeBid(auctionId, riderId, amount)`**:
- Validate: auction is open, correct round, amount >= min salary, budget check
- INSERT into `auction_bids` (or UPDATE if modifying existing bid)
- Revalidate path to refresh treasury widget

**`cancelBid(bidId)`**:
- UPDATE `auction_bids` SET status = 'cancelled' WHERE id = bidId
- Revalidate path

All validation is duplicated server-side (never trust client-only validation).

---

## 9. US-12 — Email Notification

Sent by FastAPI after each round resolution. One email per player per round.

**Format**: plain text (no HTML template for alpha).

**Content**:
- Subject: "Round X/3 termine — [auction label]"
- Riders won (name, team, amount)
- Bids lost (name, team, my bid vs winning bid)
- Current treasury balance
- Next round info (if not round 3)

**Provider**: SMTP via Resend free tier (100 emails/day) or Supabase SMTP. Decision deferred to implementation — FastAPI sends via `smtplib`, provider is configurable via env var.

---

## 10. Round Results Page

**Route**: `/league/[leagueId]/auctions/[auctionId]/results`

**Layout**:
- Tabs (underline style): one tab per round
- "Coureurs attribues" table: photo, name, team, specialty, nationality, winner name (accent if it's me), winning amount
- "Coureurs sans mise" section: muted, riders nobody bid on
- Summary block (StatRow pattern): total riders assigned, total amount spent, average bid

During active auction: resolved rounds show results, current round tab shows "En cours — resolution a minuit".

---

## 11. Implementation Sequence (suggested)

| Phase | Content |
|-------|---------|
| **Phase 2a** | FastAPI: sync-riders endpoint (PCS fetch for 7 ProTeams) |
| **Phase 2b** | FastAPI: daily-scoring endpoint + GitHub Actions workflow |
| **Phase 2c** | DB migration: add `round` to `auction_bids` |
| **Phase 2d** | Frontend: auction calendar page (US-07) |
| **Phase 2e** | Frontend: rider catalogue + treasury widget (US-08, US-13) |
| **Phase 2f** | Frontend: rider detail dialog + bidding (US-09, US-10, US-11) |
| **Phase 2g** | FastAPI: resolve-auction endpoint + email notification (US-12) |
| **Phase 2h** | Frontend: round results page |
| **Phase 2i** | GitHub Actions: auction-resolve.yml cron |
