# Late Join — Design Spec

**Date:** 2026-05-05
**Status:** Approved

## Overview

Allow any user with the league code to join a league that is already in progress. The late joiner receives the average XP and average treasury of existing players, which automatically determines their level. They can participate in the current phase only if Round 1 has not yet closed; otherwise they wait for the next auction phase.

---

## Rules

### Who can join
Anyone with the league code can join at any time, regardless of whether the league is in progress. No commissioner approval required.

### Starting values
- **XP:** `AVG(xp)` of all existing teams in the league → level derived from standard XP thresholds (0/25/150/350/600/1200/1800/2400)
- **Treasury:** `AVG(treasury)` of all existing teams
- **Sponsor:** none assigned at join time
- **Strategies:** none assigned at join time

**Edge cases:**
- If all teams have 0 XP (league just started): level 1, treasury = 200 000 € (standard starting value)
- If only one team exists: new player inherits that team's exact XP and treasury

### Cutoff rule — can they play in the current phase?

| Condition | Outcome |
|---|---|
| Round 1 of current phase **not yet closed** | `confirm_phase_setup` available immediately — player participates in current phase |
| Round 1 of current phase **closed** | Sponsor locked — player waits for next auction phase |
| League not yet started (no active phase) | Standard join flow — no `join_league_late` involved |

---

## Implementation

### RPC: `join_league_late` (SECURITY DEFINER)

**Parameters:** `p_league_id uuid`, `p_user_id uuid`

**Logic:**
1. Verify league exists
2. Verify user is not already a member of the league
3. `SELECT AVG(xp), AVG(treasury) FROM teams WHERE league_id = p_league_id`
4. Compute level from average XP using standard thresholds
5. `INSERT INTO teams (league_id, user_id, xp, level, treasury)` — no sponsor, no strategies
6. Check if Round 1 is closed: `SELECT closed_at FROM auction_rounds WHERE league_id = p_league_id AND round = 1 ORDER BY created_at DESC LIMIT 1`
7. Return `{ team_id, can_join_current_phase: (closed_at IS NULL) }`

### Server action: `joinLeague`

- Remove the existing guard that blocks joining when `league.status = 'in_progress'`
- If `league.status = 'in_progress'`: call `join_league_late` RPC instead of standard team creation
- If `league.status != 'in_progress'`: standard join flow unchanged
- On success: redirect to league home

### UI — Waiting state

Detected client-side when: `team.sponsor_id === null && league.current_phase > 0`

- **Home:** info banner — "You joined mid-season. You can select your sponsor and start bidding at the next auction phase."
- **Budget / Marketplace:** sponsor section locked, same message
- **My Team / Auctions:** readable (explore only) — existing `place_bid` guards already block bidding with no active sponsor

### UI — Can join current phase

When `can_join_current_phase = true`:
- Redirect directly to `confirm_phase_setup` flow after joining
- Player selects sponsor and strategies, then participates normally in remaining rounds

### Ranking

Late joiner appears immediately in the league ranking with their average XP/treasury values. No special label.

---

## What does NOT change

- `confirm_phase_setup` RPC — unchanged, handles sponsor selection for late joiners exactly like any other player
- `place_bid` RPC — unchanged, existing guards (active round, sponsor required) already block invalid bids
- All other RPCs — unchanged

---

## Out of scope

- Commissioner approval flow
- Pro-rated sponsor income for the current phase (late joiner receives full sponsor income starting from their first active phase)
- Notifications / email when a player joins mid-season
