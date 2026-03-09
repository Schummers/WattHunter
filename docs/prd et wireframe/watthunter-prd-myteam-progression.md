# PRD — My Team, Team Progression & Policies Redesign

**Product:** WattHunter · Fantasy Cycling
**Version:** v2.4 Design System
**Author:** Jonathan Schummers + Claude
**Date:** 2026-03-09
**Status:** Draft
**Wireframes:** `watthunter-myteam-wireframe.html`, `watthunter-progression-wireframe.html`, `watthunter-policies-wireframe.html`

---

## Problem Statement

The current My Team page lacks visual hierarchy — the branded XP card, roster, policies, and bids compete for attention without clear structure. The Team Progression page uses chip/tag badges for level unlocks, which is hard to scan and doesn't communicate what each level brings. The Policies management page uses a numbered toggle + select combo that creates double interaction and doesn't scale as new policy types unlock. All three pages need a coherent redesign aligned with the v2.4 design system (Sky Blue Night palette).

**Who is affected:** All active players (~100% of DAU interact with My Team). Progression and Policies are accessed by engaged players managing their strategy.

**Impact of not solving:** Players miss strategic depth (policies, leveling), the app feels inconsistent visually, and the brand identity (mesh gradient, beam animation) is underutilized on key pages.

---

## Goals

1. Make My Team the most polished page in the app — it's where players spend the most time
2. Create a clear information hierarchy: brand card (aspirational) → policies (strategic) → roster (operational) → bids (transactional)
3. Redesign Progression as a motivational, scannable page with explicit unlock descriptions
4. Redesign Policies as a clear, scalable management page with pending changes awareness
5. Apply the v2.4 color system consistently: cyan-400 hero stat, cyan-500 interactive, sky-500 gradients + badges only

---

## Non-Goals

- **Home page redesign** — deferred; different information architecture, will follow same DS tokens
- **Budget page** — next iteration, will reuse same branded card + divider list patterns
- **Recruits tab content** — separate feature, own hero and content structure
- **Desktop/tablet layout** — mobile-first only (390px); responsive layout is a future phase
- **Policy gameplay balancing** — boost percentages and level thresholds are fixed; this PRD covers UX only

---

## User Stories

### As a casual player
- I want to see my XP and level progress at a glance so that I know where I stand without digging
- I want to understand what I unlock next so that I stay motivated to earn XP

### As a strategic player
- I want to manage my policies efficiently so that I maximize my team's boost percentage
- I want to see which riders are covered by my policies so that I can make informed roster decisions
- I want to know when my policy changes take effect so that I don't expect instant results

### As a leveling-up player
- I want to see locked policy types and their unlock levels so that I have a roadmap for my team's growth
- I want to see all future level unlocks expanded so that I can plan my strategy ahead

---

## Requirements

### P0 — Must-Have

**My Team page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| MT-1 | Page-level tabs (My Team / Recruits) at top, below app bar | Tabs render below WattHunter logo + settings. Active tab = cyan-500 underline. Branded card only visible in My Team tab. |
| MT-2 | Branded card with XP hero stat, ranking pill, tappable progress bar | XP in cyan-400 Geist Mono 32px/900. Ranking in text-high pill (not a link). Progress bar sky-500 fill, tap navigates to Progression. Chevron affordance. |
| MT-3 | Policy slots section with "Policies" header + "See all →" | Active policies show emoji + type + value + sky badge. Empty = dashed circle + "Open slot". Locked = 50% opacity + "Open slot · Level X". |
| MT-4 | Roster section with rider rows + open slots | Rider rows: avatar, name, team, boost badge (combined %), XP (Geist Mono). Open slots same pattern as policies. |
| MT-5 | Pending Bids section below roster | Section header with round status. Bid rows with amount in success green. |
| MT-6 | Bottom navigation (Home, Team, Budget, Rankings) | 4 items, Team active = cyan-500. Icons + 10px labels. |

**Team Progression page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| TP-1 | Hybrid layout: completed collapsed, current + locked expanded | Completed = green checkmark, 60% opacity, single row. Current = sky dot, expanded with progress bar + bullet unlocks. Locked = lock icon, 70% opacity, expanded with bullet unlocks. |
| TP-2 | Explicit bullet-point unlock descriptions | Sentences start with verbs. Key values in bold. Patterns: "Roster expanded to **X slots**", "Access riders ranked **#X to #500**", "Unlock **[type]** policy type", etc. |
| TP-3 | Progress bar on current level only | XP value in cyan-400, bar fill sky-500, track neutral. |
| TP-4 | Back navigation to My Team | `← Back` in cyan-500. No bottom nav on this sub-page. |

**Policies page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| PO-1 | Flat list showing ALL policy types (including locked) | 4 types visible: Specialty (Lv.1), Nationality (Lv.3), Team (Lv.5), Age (Lv.7). Locked rows at 40% opacity with `🔒 Lv.X` tag inline after title. |
| PO-2 | Toggle on the RIGHT, standard placement | ON = cyan-500. OFF = surface-active. Forced ON (50% opacity) when min == max. Locked = 30% opacity. |
| PO-3 | Select dropdown visible only when toggled ON | Appears below description. bg-surface, border-default, focus cyan-500. |
| PO-4 | Section header "Slots" + "X / Y max active" | Title 16px/700. Meta 12px/500 text-low, not uppercase. Max scales: 1 (Lv.1–4), 2 (Lv.5+). |
| PO-5 | Sticky footer: coverage + boost + Save | "X / Y riders covered" in text-mid. Boost = sum of active policies in cyan-400 Geist Mono 18px/800. Save enabled only when changes differ from saved state. |
| PO-6 | Pending changes banner | Info banner (neutral) when no pending. Amber banner "Saved for next round" + bullet list after save. Each save overwrites. |

### P1 — Nice-to-Have

| # | Requirement | Notes |
|---|-------------|-------|
| P1-1 | Boost transition animation in footer | Old value strikethrough → arrow → new value. Could animate on change. |
| P1-2 | Completed levels expandable on tap | Chevron to expand/collapse. Remember state locally. |
| P1-3 | Policy slot tap on My Team → deep-link to Policies page with type pre-selected | Tapping an active policy slot scrolls to and highlights that policy row. |
| P1-4 | Locked slot tap → Progression page anchored to unlock level | Scroll-to-level behavior with highlight pulse. |

### P2 — Future Considerations

| # | Requirement | Notes |
|---|-------------|-------|
| P2-1 | Policy change history / audit log | Show previous round's choices. |
| P2-2 | Policy simulation ("what if") | Preview coverage + boost before saving. |
| P2-3 | Push notification when pending policies activate | "Your policies for Round 2 are now active." |
| P2-4 | Budget page redesign using same patterns | Branded card + divider list, same DS tokens. |

---

## Success Metrics

### Leading indicators (change within 2 weeks)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Policy adoption rate | +30% players activate at least 1 policy | % of eligible players with active policy / total eligible |
| Progression page visits | +50% vs. current | Tap-through from branded card progress bar |
| Policy save completion rate | >80% of users who open Policies page | Saves / page opens |

### Lagging indicators (change within 1–2 months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Policy engagement depth | >40% of Lv.5+ players use 2 policies | % of Lv.5+ with 2 active policies |
| Time on My Team page | +20% session time | Average time per session on My Team |
| XP awareness | Fewer support tickets asking "how do I level up" | Support ticket count tagged "leveling" |

---

## Design Specifications

### Color System Rules (v2.4)

| Token | Usage on these pages |
|-------|---------------------|
| `--cyan-400` (accent-highlight) | Total XP hero number (1 per screen), current level XP value, policies footer boost value |
| `--cyan-500` (accent-default) | Tab underline, "Back" link, "See all →" actions, bottom nav active, toggle ON state, Save button |
| `--sky-500` (accent-label) | Branded card gradient/mesh/beam, progress bar fill, badge text, bullet dots |
| `--badge-bg` | Badge background (boost tags in roster + policies summary on My Team) |
| `--text-high` | Ranking, rider names, XP values (roster), level names (current), unlock strong text, policy names |
| `--text-low` | Labels, captions, team names, section counts, XP targets, policy descriptions, lock tags, "max active" |
| `--text-mid` | Coverage line, info banner text, pending banner items |
| `--success` | Completed checkmarks, bid amounts |
| `--warning` | Pending changes banner (title, dots, border) |

**Rule:** Max 1 sky element per visual group. Max 1 cyan-400 hero stat per screen.

### My Team — Branded Card

| Element | Token | Notes |
|---------|-------|-------|
| Label "TOTAL XP SEASON" | `--text-low`, uppercase, 10px/700 | Neutral label, NOT sky |
| XP number "12,847 XP" | `--cyan-400`, Geist Mono 32px/900 | ONE hero stat per screen |
| Ranking "#4 / 12" | `--text-high` on subtle bg pill | Info only, NOT a link |
| Progress bar (Level 4 → 5) | Sky-500 fill, neutral track | Tappable → Progression page |
| Chevron `›` next to "68%" | `--text-low` | Tap affordance |
| XP targets "12,847 / 15,000" | `--text-low`, Geist Mono 10px | Below progress bar |

Card visual treatment: frosted glass + SVG noise + border beam animation (unchanged from v2.3).

### My Team — Policy Slots

| State | Icon | Content | Right side |
|-------|------|---------|------------|
| Active policy | Emoji (⛰️/🇫🇷/🏢) | Type + selection value | Sky badge `+5%` + chevron |
| Empty slot | `+` dashed circle | "Open slot" | Chevron |
| Locked slot | `+` dashed circle, 50% opacity | "Open slot · Level 5" | Chevron |

### My Team — Roster Row

| Element | Token | Notes |
|---------|-------|-------|
| Avatar (36px circle) | Flag emoji + `#number` badge | Same as current prod |
| Name | `--text-high`, 14px/600 | |
| Team | `--text-low`, 12px | Below name |
| Boost badge | Sky text on `--badge-bg` | Combined boost %, detail on tap |
| XP value | `--text-high`, Geist Mono 16px/700 | Right-aligned |
| Chevron | `--text-ghost` | → rider detail |

### Progression — Level States

| State | Icon | Layout | Opacity |
|-------|------|--------|---------|
| **Completed** | Green checkmark (`--success`) | Collapsed: name + XP + chevron | 60% |
| **Current** | Sky dot (`--accent-label`) | Expanded: progress bar + bullet unlocks | 100% |
| **Locked** | Lock icon (`--text-ghost`) | Expanded: bullet unlocks visible | 70% |

### Progression — Unlock Sentence Patterns

| Unlock type | Pattern | Example |
|-------------|---------|---------|
| Roster slots | "Roster expanded to **X slots** (was Y)" | "Roster expanded to **8 slots** (was 7)" |
| Pool access | "Access riders ranked **#X to #500**" | "Access riders ranked **#101 to #500**" |
| Policy type | "Unlock **[type]** policy type" | "Unlock **Teams** policy type" |
| Policy count | "Use **X policies** at the same time" | "Use **2 policies** at the same time" |
| Sponsor tier | "Access **Tier X sponsor** · [budget]" | "Access **Tier 3 sponsor** · 550k€ budget" |

Bullet dot: sky-500 (current level), text-ghost (locked). Key value `<strong>` text-high (current) / text-mid (locked).

### Policies — Toggle States

| State | Toggle | Interaction | Notes |
|-------|--------|-------------|-------|
| **Active** | ON (cyan-500) | Tap to deactivate | Select visible below |
| **Available (OFF)** | OFF (surface-active) | Tap to activate | Select hidden |
| **Forced ON** | ON, 50% opacity | Not tappable | min == max (Lv.1: 1/1) |
| **Locked** | OFF, 30% opacity | Not tappable | Row at 40% opacity |

**Constraint:** Max active filled → other available toggles disabled. min == max → forced ON.

### Policies — Types Reference

| Policy type | Description | Boost | Unlock |
|-------------|-------------|-------|--------|
| Specialty boost | +5% to riders matching selected specialty | +5% | Lv.1 |
| Nationality boost | +5% to riders from a specific country | +5% | Lv.3 |
| Team boost | +5% to riders from a specific pro team | +5% | Lv.5 |
| Age boost | +5% to riders within a specific age range | +5% | Lv.7 |

### Policies — Sticky Footer

| Element | Token | Notes |
|---------|-------|-------|
| Coverage | `--text-mid`, 12px/500 | "X / Y riders covered" |
| Boost | `--cyan-400`, Geist Mono 18px/800 | "+X% boost" (sum of active) |
| Boost transition | Old: `--text-low` strikethrough → new: `--cyan-400` | After change |
| Save (active) | `--cyan-500` bg, dark text, 14px/700 | Changes differ from saved |
| Save (disabled) | `--bg-surface-active`, `--text-ghost` | No changes |

### Policies — Pending Banner

| State | Style | Content |
|-------|-------|---------|
| No pending | `--bg-surface` bg, `--border-default` border | "Changes apply to the next auction round. Current policies are active until round closes." |
| Pending saved | `rgba(245,158,11,0.06)` bg, `rgba(245,158,11,0.20)` border | "Saved for next round" + bullet per policy |

Each save overwrites previous pending state.

---

## Level Data Reference

| Level | XP Threshold | Unlocks |
|-------|-------------|---------|
| 1 | 0 | 6 slots, Pool #351-500, Specialty policy, Tier 1 sponsor (200k€) |
| 2 | 50 | 7 slots, Pool #251-500 |
| 3 | 150 | Pool #176-500, Nationality policy, Tier 2 sponsor (350k€) |
| 4 | 350 | 8 slots, Pool #101-500 |
| 5 | 700 | 9 slots, Pool #76-500, Teams policy, 2 max policies, Tier 3 sponsor (550k€) |
| 6 | 1,200 | Pool #51-500 |
| 7 | 1,900 | 10 slots, Pool #26-500, Tier 4 sponsor (800k€) |

---

## Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| OQ-1 | What happens when a player downgrades (e.g. XP decay)? Do active policies auto-deactivate? | Product / Backend | Affects forced toggle logic and error states |
| OQ-2 | Should the pending banner persist across sessions or reset on page reload? | Product | UX consistency — currently spec'd as server-side |
| OQ-3 | How are policy select options ordered? Alphabetical, popularity, or match count? | Design / Backend | Affects discoverability of best choices |
| OQ-4 | Is coverage computed on current roster or projected roster (including pending bids)? | Product / Backend | Affects footer accuracy and user trust |
| OQ-5 | Should locked policy types show their description, or just the name + lock tag? | Design | Currently spec'd with description — validate with users |
| OQ-6 | Do we need an "undo" after Save, or is overwrite-on-next-save sufficient? | Product | Affects complexity and error recovery |

---

## Timeline Considerations

- **Hard dependency:** v2.4 design system tokens must be finalized and implemented in the component library before page work begins
- **Phasing suggestion:** My Team (P0) → Progression (P0) → Policies (P0) → P1 items → Budget page (P2)
- **Auction round timing:** Policy pending changes are tied to round cycles (~1 month). Feature should ship before a round boundary for clean testing.
- **No breaking API changes:** Policy save/load already exists — this is a frontend restructure with 1 new endpoint (pending state banner data)

---

## Implementation Notes

- All text in **English**
- Mobile-first (390px), no desktop-specific layout
- Typography: Geist Sans for UI text, Geist Mono for all numbers with `tabular-nums`
- Progress bar tap zone: entire `progress-section` div, not just the bar
- Policy slot locked state: CSS `opacity: 0.5`, no pointer cursor
- Completed levels: store expanded/collapsed state locally (default: collapsed)
- Boost badge: compute combined % from active policies server-side, send as single value
- Policies: pending state stored server-side, one pending state per team, each save overwrites
- Policies: coverage (riders covered) computed server-side based on active policy criteria
- Policies: forced toggle when `min_active == max_active` (Lv.1 = forced ON)
- Policies: select dropdown options fetched from API per policy type
- Policies: Save button enabled only when current state differs from last saved pending state
- Policies: pending banner shows bullet list of active policies with their selection value
