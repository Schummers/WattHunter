# PRD — Ranking (Teams & Riders Leaderboard)

**Product:** WattHunter · Fantasy Cycling
**Version:** v3.0 Design System
**Author:** Jonathan Schummers + Claude
**Date:** 2026-03-11
**Status:** Draft
**Wireframes:** `watthunter-ranking-wireframe.html`, `watthunter-team-detail-wireframe.html`, `watthunter-rider-detail-wireframe.html`

---

## Problem Statement

The Ranking is where competitive tension lives in WattHunter — it's how players understand their position relative to opponents, scout rival rosters, and evaluate rider performance across the league. The current implementation lacks a coherent information hierarchy: movement indicators are plain text, team rows carry too much visual noise (avatars, cycling names), and the rider tab overloads with Active/Free tags and flags that distract from the core data (name, owner, XP). The Team Detail and Rider Detail sub-pages use PCS ranking context instead of game ranking, creating confusion between real-world stats and in-game performance.

**Who is affected:** All active players check the ranking regularly — it's the second most-visited page after My Team. Competitive players (Lv.3+) who scout opponents and plan transfers based on rival rosters are most engaged.

**Impact of not solving:** Players can't quickly scan league standings, don't understand movement trends after each race, and can't evaluate rival team composition. The competitive layer — the primary retention driver for multiplayer fantasy games — feels flat and uninformative.

---

## Goals

1. **Make league standings scannable in 2 seconds** — position, team name, movement, XP visible at a glance with zero cognitive overhead
2. **Surface movement trends as first-class data** — after each race, players should immediately see who gained and who dropped via color-coded tag badges
3. **Enable competitor scouting** — tap any team to see their full roster with game ranking per rider, XP contribution, and movement
4. **Provide race-level filtering** — switch from cumulative to single-race view to understand who scored where
5. **Keep Rider Detail read-only from Ranking context** — Game Stats only, no bid zone, no PCS Stats tab, with clear "Owned by" attribution

---

## Non-Goals

- **Bid placement from Ranking** — Ranking is read-only for scouting; bidding happens from the Auction/Transfer flow (separate feature)
- **PCS Stats integration** — Rider Detail from Ranking shows game data only; PCS Stats are accessible from My Team context where the player owns the rider
- **Historical season comparison** — v1 shows current season only; season-over-season is a P2 future feature
- **Desktop/tablet layout** — mobile-first only (390px); responsive is a future phase
- **Push notifications for rank changes** — separate initiative (notification system)
- **League management (join/leave/admin)** — covered in Settings screen, not in Ranking

---

## User Stories

### As a casual player
- I want to see where my team stands in the league so that I feel the competitive context of my decisions
- I want to see my team highlighted in the list so that I can find it instantly without scrolling through names
- I want to understand what +2 or -1 means next to a team so that I know if they're improving or declining

### As a competitive player
- I want to filter the ranking by a specific race so that I can see who scored the most points at Paris-Roubaix
- I want to tap an opponent's team to see their roster so that I can evaluate their squad strength and identify riders I might want to target
- I want to see each rider's game ranking within their team so that I understand who is performing for my rival
- I want to see a rider's race-by-race results so that I can evaluate their consistency before making a transfer bid

### As a league admin
- I want to see the full list of teams in my league so that I can monitor league activity and engagement
- I want to verify that all riders are correctly attributed to their owners so that disputes can be resolved

### Edge cases
- I want to see riders who are "Not recruited" in the rider ranking so that I know which free agents have been scoring points
- I want former riders in a team detail to still show their XP contribution so that the team's history is complete
- If a race filter returns no results for a rider, I want to see a clear empty state rather than a confusing zero

---

## Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| RK-1 | **Two tabs: Teams / Riders** — Underline Tabs (DS v3.0) with JS switching, cyan-500 active underline | Given I'm on Ranking, When I tap "Riders", Then the Riders tab content displays and the underline moves |
| RK-2 | **Teams tab: position + name + level + movement tag + XP + chevron** — No avatar (no team photos available), just rank position number + team name + "Lv.N" subtitle + movement pill tag + XP value + chevron for navigation | Given I'm on Teams tab, When the page loads, Then I see all league teams sorted by XP descending with position numbers |
| RK-3 | **Movement as color-coded pill tags** — `+N` in success green bg, `-N` in danger red bg, `—` in ghost (no bg). Tags aligned inline with team/rider name | Given a team moved up 2 positions since last race, When I view the ranking, Then I see a green pill tag "+2" next to the team name |
| RK-4 | **My team row highlight** — `bg-surface-active` background only. No cyan left border, no other decoration. "You" label in cyan-500 next to team name. No chevron on my row | Given I'm viewing the Teams tab, When I find my team, Then it has a subtle darker background and a "You" label but no navigation chevron |
| RK-5 | **Race filter (select dropdown)** — Native select element, DS-styled (bg-surface, border-default, radius-md). Default = "All races" (cumulative XP). Selecting a specific race = shows XP earned for that race only | Given I select "Paris-Roubaix" from the dropdown, When the ranking refreshes, Then all XP values reflect only that race's points and positions are re-sorted |
| RK-6 | **Riders tab: position + avatar + name + team owner subtitle + movement tag + XP + chevron** — No flags, no Active/Free tag. Subtitle = "@OwnerName" or "Not recruited" for free riders | Given I'm on Riders tab, When I see a recruited rider, Then their owner's username appears below their name |
| RK-7 | **My riders: cyan-500 border on avatar** — Riders owned by the current player have their avatar circle outlined in cyan-500 | Given I own Van Aert, When I view the Riders tab, Then Van Aert's avatar has a cyan border |
| RK-8 | **Free riders: 60% opacity** — Riders not recruited in the league display at reduced opacity with "Not recruited" as subtitle | Given Roglič is not recruited, When I view the Riders tab, Then his row is visually dimmed at 60% opacity |
| RK-9 | **Tap team → Team Detail sub-page** — Back header "← Ranking", left-aligned team name + "Managed by @owner", 3 stat boxes (Season XP in cyan-400, Ranking position, Level), Active Roster, Former Riders | Given I tap "Echappée Royale" in Teams tab, When the detail page loads, Then I see their full roster with XP per rider |
| RK-10 | **Team Detail: Active Roster** — Riders with avatar + name + movement tag (inline with name) + game ranking (#N in game) as subtitle + XP + chevron. No flags, no specialty tags | Given I view a team's Active Roster, When I scan the list, Then each rider shows their game ranking position and XP contribution |
| RK-11 | **Team Detail: Former Riders** — Same format as active riders but at 50% opacity, dashed avatar border, game ranking + XP, no movement tags, no release date | Given a team released a rider during the season, When I view Former Riders, Then I see them dimmed with their total XP from when they were on the team |
| RK-12 | **Tap rider → Rider Detail sub-page** — Back header "← Ranking", rider hero (avatar + PCS badge + name + flag + team + specialty/age tags), stat boxes (Game XP in cyan-400, Bonus, Paid Salary), Owner banner, Game Results grouped by month | Given I tap a rider in any list, When the detail page loads, Then I see their game stats and race-by-race results |
| RK-13 | **Rider Detail: Game Results** — Race results grouped by month, each row = race name + subtitle "13 Apr · PCS 2nd — 150 pts" (banking-style date inline) + XP right + bonus in text-mid below XP. No race icon circles | Given I'm viewing a rider's Game Results, When I scan the list, Then I see each race with date, PCS result, XP gained, and bonus if applicable |
| RK-14 | **Rider Detail: Owner banner** — Shows "Owned by" + team name + owner pseudo + acquisition phase. If not recruited: dashed border, "Not recruited" in text-mid | Given I view a rider owned by another player, When I see the Owner banner, Then it shows who owns them and their team name |
| RK-15 | **Rider Detail: No bid zone, no PCS Stats** — From Ranking context, the rider detail is read-only. No segmented control (Game Stats only), no "Place bid" button, no PCS career stats | Given I access Rider Detail from Ranking, When the page loads, Then there is no way to place a bid and no PCS Stats tab |
| RK-16 | **Standard WattHunter topnav** — Ranking is a main page (bottom nav visible, standard topnav with bolt icon + team name + user avatar). Not a custom header | Given I'm on the Ranking page, When I look at the top, Then I see the standard WattHunter topnav consistent with other main pages |
| RK-17 | **Bottom nav with Ranking active** — 4-item bottom nav (Home, Team, Budget, Ranking) with Ranking icon and label in cyan-500 | Given I'm on Ranking, When I look at the bottom nav, Then "Ranking" is highlighted in cyan-500 |

### P1 — Nice-to-Have

| ID | Requirement | Notes |
|----|-------------|-------|
| RK-18 | **Movement calculated after each race** — Position changes update after every race result, not just per round or phase | Requires backend event: race results → recalculate positions → compute deltas |
| RK-19 | **Rider Detail: conditional zones based on navigation context** — If accessed from My Team: show bid zone + PCS Stats tab. If from Ranking: read-only game stats only | Shared component with context parameter |
| RK-20 | **Animated tab transitions** — Smooth slide when switching between Teams and Riders tabs | CSS transition with `transform: translateX` |
| RK-21 | **Section count in Team Detail** — "Active roster · 6 riders" and "Former riders · 2 riders" with count in text-ghost | Informational, helps scan |
| RK-22 | **Empty state for Rider Detail with no race results** — "Game stats will be available once this rider is on a team." message | Shown for newly recruited riders or riders with no race during ownership |

### P2 — Future Considerations

| ID | Requirement | Notes |
|----|-------------|-------|
| RK-23 | **Season-over-season comparison** — Compare this season's ranking with previous seasons | Needs historical data storage |
| RK-24 | **League switching** — If player is in multiple leagues, quick-switch from Ranking page | R-11: player can belong to multiple leagues |
| RK-25 | **Performance graphs** — XP trend over time per team or rider (sparkline in detail) | Data visualization, needs charting lib |
| RK-26 | **Head-to-head comparison** — Select two teams and compare rosters side by side | Power user feature, post-v1 |
| RK-27 | **Push notifications for rank changes** — "You dropped to 4th after Milan-Sanremo" | Separate notification infrastructure |

---

## Success Metrics

### Leading Indicators (first 2 weeks)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Ranking page daily visits | 65% of DAU | 80% of DAU | Analytics: page_view event on /ranking |
| Team Detail tap-through rate | 30% of ranking visitors tap at least one team | 45% | Analytics: navigation event ranking → team_detail |
| Race filter usage | 15% of ranking visits use the filter | 25% | Analytics: select_change event on race filter |
| Average time on Ranking | > 45 seconds per session | > 90 seconds | Analytics: session duration on ranking pages |

### Lagging Indicators (4-8 weeks)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Transfer bid volume increase | +15% bids after ranking launch | Compare bid volume before/after, controlling for season phase |
| Competitive engagement (multi-session) | Players who check ranking 3+ times/week increase by 20% | Cohort analysis: ranking frequency vs. retention |
| League retention | 5% improvement in players who stay active in league through full season | Churn analysis at league level |

---

## Design Specifications

### DS v3.0 Compliance

All screens follow the WattHunter Design System v3.0 (Sky Blue Night palette):

| Element | Token | Value |
|---------|-------|-------|
| Background | `--bg-app` | `#0c1012` |
| Row dividers | `--border-subtle` | `#1a2226` |
| My row background | `--bg-surface-active` | `#1f292e` |
| Team/rider name | `--text-high` | `#eaeff1` — 14px/600 Geist Sans |
| Subtitle (level, owner) | `--text-low` | `#74919f` — 12px/500 |
| Position numbers | `--text-mid` | `#89a1ad` — 14px/700 Geist Mono, tabular-nums |
| XP values | `--text-high` | `#eaeff1` — 14px/700 Geist Mono, tabular-nums |
| Hero stat (Season XP) | `--cyan-400` | `#22d3ee` — 20px/800 Geist Mono |
| "You" label | `--cyan-500` | `#06b6d4` — 10px/600 |
| Tab active underline | `--cyan-500` | `#06b6d4` — 2px bottom border |
| My rider avatar border | `--cyan-500` | `#06b6d4` |
| Movement +N tag | `--success` on `rgba(16,185,129,0.10)` | Green pill, radius-pill |
| Movement -N tag | `--danger` on `rgba(239,68,68,0.10)` | Red pill, radius-pill |
| Movement — tag | `--text-ghost` | No background |
| Chevron | `--text-ghost` | `#334249` — 14px stroke |
| Bonus (Rider Detail) | `--text-mid` | `#89a1ad` — 11px/500 Geist Mono |

### Component Mapping

| Component | DS v3.0 Pattern | Notes |
|-----------|-----------------|-------|
| Page navigation (Teams/Riders) | **Underline Tabs** | radius: none, cyan-500 underline, page-level nav |
| Race filter | **Native Select** | radius-md (interactive), bg-surface, border-default |
| Movement indicators | **Tag pills** | radius-pill (decorative/read-only), color semantic |
| Team/Rider rows | **List Row (Pattern A)** | Dividers full-width, no card surfaces |
| Stat boxes (Detail pages) | **Card (Standard)** | bg-surface, border-default, radius-lg |
| Owner banner | **Card (Standard)** | Same surface treatment |

### Layout Rules

| Rule | Detail |
|------|--------|
| Teams tab: no avatar | No team photos exist — position + name is sufficient |
| Riders tab: avatar kept | Initials-based avatar with optional cyan-500 border for owned riders |
| No flags in rankings | Nationality is noise in the competitive context — removed |
| No Active/Free tags | Owner name or "Not recruited" subtitle is clearer and less cluttered |
| Movement tags aligned inline with name | Same visual line as the rider/team name for quick scanning |
| Game ranking in Team Detail, not PCS | "#N in game" subtitle on roster riders — this is the in-game leaderboard, not PCS |
| Banking-style dates in Rider Detail | Date integrated in subtitle line ("13 Apr · PCS 2nd — 150 pts") not as separate column |

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-16 | XP = same counter as season ranking. Reset each season |
| R-17 | Rival roster is visible read-only — active bids are hidden |
| R-18 | Former riders = all riders who belonged to the team during the current season |
| R-19 | Riders tab = recruited riders in league + free riders with PCS season stats (for comparison) |
| R-20 | Movement calculated vs. position after previous race |
| R-NEW-1 | "All races" filter = cumulative XP (default). Specific race filter = XP for that race only |
| R-NEW-2 | Rider Detail from Ranking context = Game Stats only, no bid zone, no PCS Stats |
| R-NEW-3 | My team row: bg-surface-active only, no border decoration, no chevron, "You" label |
| R-NEW-4 | Free riders displayed at 60% opacity, "Not recruited" subtitle, no Active/Free tag |
| R-NEW-5 | Movement is race-level (after each race result), not round-level or phase-level |

---

## Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | How does the "All races" cumulative XP handle mid-season joins? Does a team that joined in Phase 3 show total from Phase 3, or all-time? | Game Design | Yes |
| 2 | Should former riders in Team Detail show their XP from the entire season or only while they were on the team? | Game Design | Yes |
| 3 | What happens when a race filter is selected but a rider didn't participate in that race? Hidden from list or shown with 0 XP? | Product | No |
| 4 | Should the select dropdown include future scheduled races (greyed out) or only completed races? | Product | No |
| 5 | How to handle ties in ranking position? Same position number + shared rank? | Engineering | No |
| 6 | Is the "game ranking" shown in Team Detail roster the global rider ranking or the rider's ranking within the team? | Product | Yes |
| 7 | Should Rider Detail from Ranking show the rider's PCS real-world team name (Euskaltel-Euskadi) or only the fantasy owner? | Product | No |

---

## Timeline Considerations

- **Dependency:** Movement calculation requires race results processing pipeline — coordinate with backend team
- **Dependency:** Race filter requires an endpoint that returns XP scoped to a single race — new API
- **Phasing suggestion:** Ship RK-1 through RK-17 (P0) as v1. P1 items (movement frequency, conditional zones) can follow in the next sprint
- **No hard deadline** — but Ranking is the last main page in the redesign cycle. Completing it unblocks the full v3.0 DS rollout across the app
