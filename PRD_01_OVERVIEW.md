# PRD 01 — Overview & Vision
## Cycling Fantasy Game MVP

**Version:** 3.0
**Date:** 21 février 2026
**Author:** Jonathan Schummers
**Status:** Active — In Development
**Supersedes:** PRD_MVP.md v2.0
**Read alongside:** PRD_02_MECHANICS.md · PRD_03_TECHNICAL.md

---

## How to Use These Documents

| Document | Purpose | Read when you need to... |
|----------|---------|--------------------------|
| **PRD_01_OVERVIEW** (this file) | Vision, goals, user stories, metrics | Understand what we're building and why |
| **PRD_02_MECHANICS** | All game rules in detail | Implement any game logic (scoring, economy, progression, policies, sponsors, auctions) |
| **PRD_03_TECHNICAL** | Stack, DB schema, all REQs with AC | Build features — each requirement has explicit acceptance criteria |

---

## Executive Summary

A mobile fantasy cycling game for groups of friends. Players build a virtual team by buying professional cyclists at monthly auctions, earn points based on real-world race results (PCS data), and compete in a private league against 6–12 friends. The core innovation is a dual-indicator system: a **Team Score** (XP from rider performance) that drives progression and league ranking, and a **Treasury** (cash flow) that determines which riders you can afford to buy. Managing both levers — scouting undervalued riders who generate strong ROI — is the central strategic challenge.

---

## Problem Statement

Passionate cycling fans follow the sport all season but lack an engaging way to turn that passion into sustained group competition. Existing fantasy games (Velogames, Rouleur Fantasy) offer shallow strategy — a few clicks per month, no economic layer, no progression. The result: friend groups have no platform to transform their cycling knowledge into a continuous, strategic, social experience with real decisions (auctions, budget management, long-term progression).

---

## Goals

### User Goals

1. **Sustained social engagement** — Friend groups interact 3+ times/week during the season (auctions, standings, trash talk via WhatsApp/Discord)
2. **Meaningful strategic decisions** — Players spend 15–30 min preparing auction bids and feel their choices have a real impact on results
3. **Sense of progression** — Players see their team evolve over months, unlocking new capabilities and access to better riders

### Business Goals

4. **Concept validation** — 80%+ of alpha testers want to continue after 2 months
5. **Organic acquisition** — Each league generates 2+ new player invitations (word of mouth) during alpha

---

## Non-Goals (MVP)

1. **In-app chat** — Out of scope. Groups use WhatsApp/Discord. Add in V1.5 if strong demand.
2. **Live race data** — Daily PCS point updates are sufficient. Real-time gaps/positions are V2.
3. **Push notifications** — Email only for MVP. Push added in V1.5.
4. **Multi-league per user** — One player = one league for MVP. Multi-league in V2.
5. **Competitive global mode** — Focus entirely on private group experience to validate PMF.
6. **Real-money betting** — Never. Only virtual mechanics.

---

## User Personas

### "The Fanatic" — Jonathan, 32
- Watches every Grand Tour, knows PCS rankings by heart
- Wants deep strategy and real economic decisions
- Willing to spend 30+ min/week managing his team
- **Pain point:** Existing fantasy games are too simple, no depth

### "The Casual" — Marc, 28
- Watches the big races, knows the top 10 riders
- Wants to participate in group fun without heavy investment
- 15 min/week max
- **Pain point:** Doesn't know how to start, wants guidance

### "The Commissioner" — Sophie, 35
- Organizes the friend group, creates the league
- Wants control over league settings and auction schedule
- **Pain point:** Needs simple tools to manage the league without being a developer

---

## Core Gameplay Loop

```
SEASON START
    ↓
Create team (300,000€ treasury)
    ↓
[MONTHLY AUCTION — 72h]
Browse riders (filtered by your level)
Place bids → Highest bidder wins
New riders added to roster
    ↓
[SEASON IN PROGRESS — Daily]
Real races happen → PCS points awarded to riders
Your riders' PCS points × Policy multipliers = XP gained
XP accumulates → Team Score → League ranking
PCS points × conversion rate − salary = daily cash flow update
    ↓
[MONTHLY — 1st of month]
Salaries deducted
Sponsor contract income added
Treasury updated
    ↓
Level up? → Unlock new slots, policies, sponsors, rider access
    ↓
[NEXT AUCTION — around Grand Tour start or monthly]
Buy new riders, release underperforming ones
    ↓
Repeat until season end → Highest XP wins the league
```

---

## MVP Feature Scope & Priority

> Build in this order. The first 3 phases are the core. Policies and Sponsors can come after.

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0 — Core Loop** | Auth + onboarding | Gate to everything |
| **P0 — Core Loop** | Private leagues (create + join) | Social context |
| **P0 — Core Loop** | Rider catalogue + PCS data | Foundation |
| **P0 — Core Loop** | Auction system (72h, async) | Main acquisition mechanic |
| **P0 — Core Loop** | Team management + treasury | Economic layer |
| **P0 — Core Loop** | Scoring engine (PCS → XP) | Points = winning |
| **P0 — Core Loop** | League standings | Competitive output |
| **P0 — Core Loop** | Level progression (10 levels) | Retention + unlocks |
| **P1 — Depth** | Policies system (5 types) | Strategic multipliers |
| **P2 — Monetisation** | Sponsors system | Cash flow booster |
| **P3 — Polish** | Dark mode, graphs, advanced stats | Nice-to-have |

---

## User Stories

### New Player
- **US-01** — Sign in with Google or Apple in one tap
- **US-02** — Join a private league via 6-character code
- **US-03** — Complete onboarding in ≤3 screens (skip available)

### League Commissioner
- **US-04** — Create a private league and share invitation code
- **US-05** — Set league size (6–12 players)
- **US-06** — Launch the first auction manually (min. 4 players joined)
- **US-07** — View and manage scheduled auction calendar for the season

### Auction Participant
- **US-08** — Browse available riders filtered by my level, with search (name, nationality, team, specialty)
- **US-09** — View full rider profile: photo, age, nationality, real team, specialty, PCS points 1yr, estimated salary
- **US-10** — Place a bid with real-time budget validation
- **US-11** — Modify a bid before auction closes
- **US-13** — See my treasury balance and total exposure (sum of all active bids)

### Team Manager
- **US-14** — See my full roster with per-rider stats (PCS points this month, salary, profit/loss)
- **US-15** — See my treasury widget at all times: balance, monthly salary burn, projected 3-month runway
- **US-16** — Release a rider (1-month notice: pay 1 more month salary, slot freed immediately)
- **US-17** — Activate a policy (if my level unlocks it)
- **US-18** — Configure parameterized policies (choose nationality, real team, or specialty)
- **US-19** — Choose and activate a sponsor contract (if my level unlocks it)
- **US-20** — See detailed rider profitability: "Salary: 40k€/mo | Revenue: 55k€/mo | Profit: +15k€/mo"

### Competitor
- **US-21** — See league standings updated daily (rank, team name, XP, change vs yesterday ↑↓)
- **US-22** — See my level progress bar and next unlock preview
- **US-23** — View team detail of any competitor (roster, score, level)

### Edge Cases
- **US-24** — If disconnected during auction, my bids remain active
- **US-25** — If I miss an auction entirely, my existing team is preserved with no penalty
- **US-26** — If treasury hits zero: "Bankrupt" state shown clearly, riders auto-release after 1 month non-payment (most expensive first)

---

## Success Metrics

### Leading Indicators (Week 1–4)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion | 90%+ | `onboarding_complete` / `signup` |
| Auction participation | 80%+ place ≥1 bid | `COUNT(DISTINCT user_id) FROM auction_bids` |
| Standings view frequency | 3+/week | `leaderboard_view` event |
| D7 retention | 70%+ | Users with login in first 7 days |

### Lagging Indicators (Month 1–2)

| Metric | Target | Measurement |
|--------|--------|-------------|
| D30 retention | 60%+ | Active users 30d post-signup |
| NPS | 40+ | In-app survey at 2 weeks |
| Organic invitations | 2+ per league | `league_members WHERE invited_by IS NOT NULL` |
| Season completion rate | 50%+ active to end | Login in last week of season |
| Willingness to pay V2 | 40%+ "yes" | End-of-alpha survey |

---

## Timeline

### Soft Targets (no hard external deadline)

| Week | Deliverable |
|------|-------------|
| 1–2 | Infra setup (Supabase, Expo, GitHub) + Auth + DB schema |
| 3–4 | Core features: leagues, auctions, team management |
| 5–6 | Scoring engine, standings, level progression |
| 7 | Policies system |
| 8 | Polish, bug fixes, onboarding refinement |
| 9 | Sponsors system |
| 10 | Alpha launch — 6–8 friends |

### Phasing if cutting scope

1. **Phase 1 — Core loop** (4 weeks): Auth + leagues + auctions + team + scoring → Already testable
2. **Phase 2 — Depth** (2 weeks): Policies + level progression + treasury ROI
3. **Phase 3 — Sponsors** (1 week): Sponsor contract system
4. **Phase 4 — Polish** (1 week): Dark mode, graphs, advanced stats

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 5 fév 2026 | Initial draft |
| 2.0 | 20 fév 2026 | Budget 300k€, salary formula, 10 levels, Policy MVP |
| 3.0 | 21 fév 2026 | **UCI → PCS everywhere. Policies revised (0/1/2/3 max). Sponsors system added. Auction calendar aligned to Grand Tours. Contract system added. Priority order defined.** |

---

## Open Questions (Critical — Resolve Before Dev)

1. **[Jonathan — BLOCKER]** Calibrate conversion rate €/PCS point. Run Excel simulation: 300k€ start, top 500 PCS riders (level-gated), target break-even economy over 6 months. Placeholder: 500€/PCS point.
2. **[Engineering]** Does `procyclingstats` Python lib run on Supabase Edge Functions (Deno) or need external Node.js microservice?
3. **[Jonathan]** Confirm salary floor (5,000€/mo) and cap (300,000€/mo) once PCS-based formula is tested with real data.
4. **[Jonathan]** Confirm XP thresholds once real PCS data simulated (current thresholds estimated).
5. **[Design]** App color palette and branding.
6. **[Jonathan]** Email provider: Supabase built-in or SendGrid/Postmark?

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 5 fév 2026 | React Native + Expo (not PWA) | Native notifications + real-time perf + App Store distribution |
| 5 fév 2026 | Supabase (not Firebase) | Postgres > NoSQL for complex relations |
| 5 fév 2026 | procyclingstats lib (not paid API) | 0€ vs 200–500€/mo, acceptable for MVP |
| 5 fév 2026 | 72h auctions (not 2 weeks) | 2 weeks kills dynamism |
| 5 fév 2026 | No in-app chat MVP | Low value vs effort; groups use WhatsApp |
| 20 fév 2026 | Budget 300k€ start | Calibrated for top 500 PCS rider pool with level gating |
| 20 fév 2026 | Option B data loading (on-demand for recruited riders) | Saves 60–70% scraping, avoids PCS IP ban |
| 21 fév 2026 | **PCS replaces UCI everywhere** | PCS is richer, more accurate for fantasy, freely accessible via lib |
| 21 fév 2026 | **Policies: max 3 (unlock L3/L6/L10)** | Simpler to balance; more impactful per slot |
| 21 fév 2026 | **Sponsors system added to MVP** | Core cash flow mechanic, P2 priority |
| 21 fév 2026 | **Auction calendar aligned to Grand Tours** | Seasonal rhythm matches real cycling excitement spikes |
