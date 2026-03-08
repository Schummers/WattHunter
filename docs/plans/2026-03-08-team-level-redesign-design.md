# WattHunter — Team Level Redesign Design

> Validated 2026-03-08. Source of truth for the Team Level card and All Levels page.

---

## Overview

Two components:
1. **Team Level Card** — reusable on My Team page + Home feed. Mesh gradient background, shows current level progress + next level unlocks. Clickable.
2. **All Levels Page** — full list of 10 levels with dividers. Hero reuses the same card format. Each level shows its new unlocks.

### Design principles
- Mesh gradient = visual signature of the level/progression system. Used ONLY here.
- No level names — just "Level 1", "Level 2", etc.
- Pills show only NEW unlocks per level (not cumulative).
- Simple progress bar (not gaming-style glow).
- All text in English.

---

## 1. Team Level Card (reusable component)

### Placement
- My Team page: below Pending Bids section
- Home feed: as a dashboard card

### Background
- Mesh gradient CSS fallback (radial-gradients from Design System Layer 4)
- Animated with `animate-mesh-slow` (20s ease-in-out infinite)
- Colors: `#020617`, `#0b1120`, `#1e293b`, `rgba(6,182,212,0.25)`, `rgba(34,211,238,0.18)`
- No WebGL — CSS fallback is sufficient for a card

### Layout

```
┌─ mesh gradient bg ──────────────────────────┐
│  Team level                  All levels →    │
│                                              │
│  240 / 350 XP                                │
│  ┌───┐  ████████████████░░░░░░░░░░  ┌───┐   │
│  │ 3 │                              │ 4 │   │
│  └───┘                              └───┘   │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ 8 slots  │ │ Pool #101│ │ Policy: Age │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
└──────────────────────────────────────────────┘
```

### Styling details

| Element | Style |
|---------|-------|
| Card | `rounded-xl`, overflow hidden, padding 16px |
| "Team level" | 13px/600 (`--type-heading-sm`), `--text-mid` |
| "All levels →" | 12px/500, `--text-low` |
| XP text ("240 / 350 XP") | 12px/500 (`--type-caption`), `--text-mid`, left-aligned above progress bar |
| Level badges [3] [4] | `rounded-lg`, `--bg-surface` bg, `--text-high` bold number. Height matches (XP text + progress bar) stacked. Current badge = normal, next badge = `--text-ghost` |
| Progress bar | Full width between badges, standard `<Progress>` component, `--accent-default` fill |
| Unlock pills | Outline style, `--text-mid` text, `--border-default` border, `text-[11px]` |
| Hover state | `hover:scale-[1.01]` + `hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]` |
| Click | Entire card is a `<Link>` to `/league/{id}/team/levels` |

### Pills content
Only show what's **new** at the next level. Examples:
- Level 3 → 4: "8 slots", "Pool #101-500"
- Level 4 → 5: "9 slots", "Policy: Teams", "2 max policies", "Pool #76-500", "Sponsor T3 · 125k€"
- Level 9 → 10: "12 slots", "Pool #1-500"

### Edge cases
- Level 10 (max): no next level. Show "Max level reached" or hide pills. Progress bar = 100%.
- Level 1 (start): next = Level 2. Pills show "7 slots", "Pool #251-500".

---

## 2. All Levels Page

### Route
`/league/{leagueId}/team/levels`

### Structure
1. Back header: "← My Team"
2. Hero section: mesh gradient (same card format, without "Team level" / "All levels →")
3. Level list: 10 levels with dividers

### No sub-tabs
Remove the My Team / Recruts sub-tabs from this page. Only show "← My Team" back header.

### Hero section

Same visual as the Team Level Card but without the title row:

```
┌─ mesh gradient bg ──────────────────────────┐
│                                              │
│  240 / 350 XP                                │
│  ┌───┐  ████████████████░░░░░░░░░░  ┌───┐   │
│  │ 3 │                              │ 4 │   │
│  └───┘                              └───┘   │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ 8 slots  │ │ Pool #101│ │ Policy: Age │  │
│  └──────────┘ └──────────┘ └─────────────┘  │
└──────────────────────────────────────────────┘
```

Gradient fades out into `--bg-app` before the list starts.

### Level list

```
  Level 1                                0 XP
  ┌────────────┐ ┌─────────────────┐
  │  6 slots   │ │ Policy: Spec.   │
  └────────────┘ └─────────────────┘
  ───────────────────────────────────────────

  Level 2                               50 XP
  ┌────────────┐ ┌─────────────────┐
  │  7 slots   │ │ Pool #251-500   │
  └────────────┘ └─────────────────┘
  ───────────────────────────────────────────

  Level 3                         240 / 350 XP
  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
  ┌────────────┐ ┌─────────────────┐
  │  7 slots   │ │ Policy: Nation. │
  └────────────┘ └─────────────────┘
  ───────────────────────────────────────────

  Level 4                              350 XP    ← dimmed
  ┌────────────┐ ┌─────────────────┐
  │  8 slots   │ │ Pool #101-500   │
  └────────────┘ └─────────────────┘
  ───────────────────────────────────────────

  Level 5                              700 XP    ← dimmed
  ┌──────────┐ ┌───────────────┐
  │  9 slots │ │ Policy: Teams │
  └──────────┘ └───────────────┘
  ┌────────────────┐ ┌────────────────┐
  │ 2 max policies │ │ Pool #76-500   │
  └────────────────┘ └────────────────┘
  ┌──────────────────────┐
  │ Sponsor T3 · 125k€  │
  └──────────────────────┘
  ───────────────────────────────────────────

  Level 6                            1 200 XP    ← dimmed
  ┌────────────┐ ┌─────────────────┐
  │  9 slots   │ │ Pool #51-500    │
  └────────────┘ └─────────────────┘
  ───────────────────────────────────────────

  Level 7                            1 900 XP    ← dimmed
  ┌────────────┐ ┌──────────────────┐
  │  10 slots  │ │ Policy: Age      │
  └────────────┘ └──────────────────┘
  ┌────────────────────────┐
  │ Sponsor T4 · 200k€    │
  └────────────────────────┘
  ┌────────────────┐
  │ Pool #26-500   │
  └────────────────┘
  ───────────────────────────────────────────

  Level 8                            2 900 XP    ← dimmed
  ┌────────────┐ ┌──────────────────────┐
  │  11 slots  │ │ Sponsor T5 · 400k€  │
  └────────────┘ └──────────────────────┘
  ┌────────────────┐
  │ Pool #11-500   │
  └────────────────┘
  ───────────────────────────────────────────

  Level 9                            4 400 XP    ← dimmed
  ┌────────────────┐
  │ Pool #4-500    │
  └────────────────┘
  ───────────────────────────────────────────

  Level 10                           6 400 XP    ← dimmed
  ┌────────────┐ ┌────────────────┐
  │  12 slots  │ │ Pool #1-500    │
  └────────────┘ └────────────────┘
```

### Styling per state

| State | "Level N" | XP right | Progress bar | Pills |
|-------|-----------|----------|--------------|-------|
| **Past** | `--text-high`, 15px/600 | XP threshold, `--text-low` | None | Normal opacity |
| **Current** | `--text-high`, 15px/700 | "240 / 350 XP", `--accent-default` | Shown, full width | Normal opacity |
| **Future** | `--text-low`, 15px/600 | XP threshold, `--text-ghost` | None | Dimmed (`--text-ghost` text, `--border-subtle` border) |

### Level data reference

| Level | XP | Slots | Pool | Policy unlock | Max policies | Sponsor |
|-------|-----|-------|------|---------------|--------------|---------|
| 1 | 0 | 6 | #351-500 | Speciality | 1 | Secondary T1 (40k€) |
| 2 | 50 | 7 | #251-500 | — | 1 | — |
| 3 | 150 | 7 | #176-500 | Nationality | 1 | Secondary T2 (60k€) |
| 4 | 350 | 8 | #101-500 | — | 1 | — |
| 5 | 700 | 9 | #76-500 | Teams | 2 | Principal T3 (125k€) |
| 6 | 1 200 | 9 | #51-500 | — | 2 | — |
| 7 | 1 900 | 10 | #26-500 | Age | 2 | Principal T4 (200k€) |
| 8 | 2 900 | 11 | #11-500 | — | 2 | Principal T5 (400k€) |
| 9 | 4 400 | 11 | #4-500 | — | 2 | — |
| 10 | 6 400 | 12 | #1-500 | — | 2 | — |

### New unlocks per level (pills to display)

| Level | Pills |
|-------|-------|
| 1 | 6 slots · Policy: Speciality · Sponsor T1 · 40k€ |
| 2 | 7 slots · Pool #251-500 |
| 3 | Policy: Nationality · Pool #176-500 · Sponsor T2 · 60k€ |
| 4 | 8 slots · Pool #101-500 |
| 5 | 9 slots · Policy: Teams · 2 max policies · Pool #76-500 · Sponsor T3 · 125k€ |
| 6 | Pool #51-500 |
| 7 | 10 slots · Policy: Age · Pool #26-500 · Sponsor T4 · 200k€ |
| 8 | 11 slots · Pool #11-500 · Sponsor T5 · 400k€ |
| 9 | Pool #4-500 |
| 10 | 12 slots · Pool #1-500 |

---

## 3. Additional change: Recruts bid card background

- **Current**: Rider cards with active bids have a faded cyan/tinted background
- **Change**: Use `--bg-surface-hover` background instead. The cyan bid input is sufficient visual indicator.

---

## 4. Not in scope

- Level names (removed — just "Level N")
- WebGL mesh gradient (CSS fallback sufficient)
- Percentage display on progress bar
- Padlock icons on locked levels
- Left border accent bar on current level
