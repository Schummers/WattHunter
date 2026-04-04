# WattHunter — Full Redesign Design Document

> Version 1.0 - March 6, 2026
> Source of truth for the complete UI redesign
> Dark-first, mobile-first, Radix Slate + Tailwind Cyan

---

## 1. Design System Foundation

### 1.1 Color Architecture — 3 Levels of Tokens

**Level 1 — Primitive tokens (raw values, no semantics)**

```css
/* Neutral — Radix Slate Dark */
--slate-1: #111113;
--slate-2: #18191b;
--slate-3: #212225;
--slate-4: #272a2d;
--slate-5: #2e3135;
--slate-6: #363a3f;
--slate-7: #43484e;
--slate-9: #696e77;
--slate-11: #b0b4ba;
--slate-12: #edeef0;

/* Accent — Tailwind Cyan */
--cyan-400: #22d3ee;
--cyan-500: #06b6d4;
--cyan-600: #0891b2;
--cyan-700: #0e7490;
--cyan-800: #155e75;
--cyan-950: #083344;

/* Semantic colors */
--red-500: #ef4444;
--emerald-500: #10b981;
--amber-500: #f59e0b;
```

**Level 2 — Semantic tokens (intention, reference primitives)**

```css
/* Backgrounds */
--bg-app: var(--slate-1);           /* #111113 — main background */
--bg-subtle: var(--slate-2);        /* #18191b — alternate sections */
--bg-surface: var(--slate-3);       /* #212225 — inputs, wells, metric boxes */
--bg-surface-hover: var(--slate-4); /* #272a2d */
--bg-surface-active: var(--slate-5);/* #2e3135 */

/* Borders */
--border-subtle: var(--slate-3);    /* #212225 — dividers */
--border-default: var(--slate-6);   /* #363a3f — component borders */
--border-hover: var(--slate-7);     /* #43484e */

/* Text */
--text-high: var(--slate-12);       /* #edeef0 — primary text, titles, numbers */
--text-mid: var(--slate-11);        /* #b0b4ba — secondary, descriptions */
--text-low: var(--slate-9);         /* #696e77 — labels, captions */
--text-ghost: var(--slate-7);       /* #43484e — disabled, placeholders */

/* Accent */
--accent-default: var(--cyan-500);    /* interactions, links, active states */
--accent-highlight: var(--cyan-400);  /* hero numbers */
--accent-hover: var(--cyan-600);      /* hover */
--accent-active: var(--cyan-700);     /* pressed */
--accent-focus-ring: rgba(103, 232, 249, 0.4); /* focus ring */

/* Status */
--success: var(--emerald-500);  /* #10b981 — gains, rank up */
--danger: var(--red-500);       /* #ef4444 — budget exceeded, deadline */
--warning: var(--amber-500);    /* #f59e0b — injury, risk */
```

**Level 3 — Component tokens**

```css
--bid-active-bg: var(--accent-default) / 10%;  /* cyan at ~10% opacity */
--bid-active-border: var(--accent-default);     /* cyan-500 solid */
--bid-outbid-bg: var(--text-ghost) / 8%;        /* muted, not destructive */
--cta-gradient: linear-gradient(135deg, var(--cyan-500), var(--cyan-400));
--cta-gradient-hover: linear-gradient(135deg, var(--cyan-600), var(--cyan-500));
--cta-text: #020617; /* Slate-950 on gradient */
--cta-shadow: 0 4px 24px rgba(6, 182, 212, 0.25);
```

### 1.2 Accent Usage Rules

- **Hero number** (`--accent-highlight` / Cyan-400): The most important number on screen. Not strictly limited to 1 per screen.
- **Interactive elements** (`--accent-default` / Cyan-500): Links, tappable numbers, toggles, active states. Distinct from highlight.
- **All other numbers**: `--text-high` (white).
- Semantic colors (success/danger/warning) appear on **text only** — no colored backgrounds. The background always stays neutral Slate.

### 1.3 Typography

**Font:** Geist Sans (variable 100-900). Geist Mono for key numbers in metric boxes.

| Usage | Size | Weight | Tailwind |
|-------|------|--------|----------|
| Hero number | 32px | 900 | `text-3xl font-black` |
| Page title | 20px | 700 | `text-xl font-bold` |
| Section title | 16px | 700 | `text-base font-bold` |
| Body / rider name | 14px | 600-700 | `text-sm font-semibold` |
| Secondary text | 13px | 400 | `text-[13px]` |
| Caption / label | 11px | 600 | `text-xs font-semibold` |
| Micro label | 9px | 700 | `text-[9px] font-bold uppercase tracking-wide` |

Hierarchy by **size + weight**, not by color. `--text-high` carries 90% of information.

### 1.4 Spacing

Base **4px** (Tailwind default).

| Space | Tailwind | Usage |
|-------|----------|-------|
| 4px | `gap-1` | Micro (icon + text in badge) |
| 8px | `gap-2`, `p-2` | Between items in a row |
| 12px | `p-3` | Internal component padding |
| 16px | `gap-4`, `p-4`, `px-4` | Main horizontal padding mobile, section gaps |
| 24px | `gap-6` | Between blocks |

### 1.5 Border Radius

| Usage | Value | Class |
|-------|-------|-------|
| Buttons, inputs, badges | 8px | `rounded-lg` |
| Cards (when allowed), modals | 12px | `rounded-xl` |
| Avatars, pills | Circle | `rounded-full` |
| Progress bar | 4px | `rounded-sm` |

No dashed borders anywhere in the app.

### 1.6 Icons

| Context | Icon | Source |
|---------|------|--------|
| Logo + XP/Score | `zap` | Lucide (also used as app logo placeholder) |
| Points PCS | Custom "PCS" SVG | Monochrome, inspired by PCS favicon |
| Home (nav) | `house` | Lucide |
| Team (nav) | `users` | Lucide |
| Budget (nav) | `badge-euro` | Lucide |
| Ranking (nav) | `trophy` | Lucide |
| Amounts in UI | Text `€` only | No icon needed |

**Lucide** = base icon library (integration native shadcn/ui).
**Phosphor duotone** = gamification elements (levels, unlocks, trophies).

### 1.7 CTA Gradient Button

- Gradient: Cyan-500 -> Cyan-400, 135deg
- Text: `#020617` (Slate-950), `font-bold`
- Shadow: `0 4px 24px rgba(6, 182, 212, 0.25)`
- Max 1 per screen
- Hover: Cyan-600 -> Cyan-500
- Disabled: opacity 40%, no shadow

### 1.8 Layer 4 — Mesh Gradient (marketing/atmospheric only)

5 colors for animated WebGL gradient:

```
uColor1: #020617  (Slate-950) — dark anchor
uColor2: #0b1120  (custom navy) — depth
uColor3: #1e293b  (Slate-800) — subtle relief
uColor4: #06b6d4  (Cyan-500) — brand accent
uColor5: #22d3ee  (Cyan-400) — highlight
```

Used ONLY on: Welcome screen, Home feed background, splash screen.
NEVER on: data screens, behind dense text, cards/panels.

---

## 2. App Shell & Navigation

### 2.1 Mobile (< 1024px)

```
+-------------------------------+
| Top bar (32px)                |
| Logo zap + "WattHunter . Les |
| Forcats chevron" ... [avatar] |
+-------------------------------+
| Sub-tabs (when applicable)    |
| [My Team]  Recruts            |
+-------------------------------+
|                               |
| Content (overflow-y: auto)    |
| padding: 0 16px              |
|                               |
+-------------------------------+
| Sticky bar (conditional)      |
+-------------------------------+
| Bottom nav (4 tabs)           |
| Home . Team . Budget . Ranking|
+-------------------------------+
```

**Top bar:**
- Height: **32px** — single line layout
- Left: zap icon 16px + "WattHunter . Les Forcats chevron" all on one line
- The chevron appears only if user has 2+ leagues
- Whole left area is tappable for league switching
- Right: avatar 24px (Google photo or initials fallback)
- Border bottom: `--border-subtle`
- Background: `--bg-app`
- Hides on scroll down, reappears on scroll up

**Sub-tabs (My Team / Recruts):**
- Visible only when Team tab is active
- Active: `--text-high` + underline 2px `--accent-default`
- Inactive: `--text-mid`
- Hides on scroll down, reappears on scroll up

**Bottom nav:**
- 4 items: Home . Team . Budget . Ranking
- Icons: `house` . `users` . `badge-euro` . `trophy` (Lucide, 20px)
- Active: icon + label in `--accent-default`, dot cyan 4px under icon
- Inactive: `--text-low`
- Locked items (Budget, Ranking at MVP): `--text-ghost` + padlock icon 8px overlay
- Background: `--bg-app`
- Border top: `--border-subtle`
- Padding bottom: `max(8px, env(safe-area-inset-bottom))`
- **Hides on scroll down, reappears on scroll up**
- **Disappears** on detail pages (Rider Detail, History, Levels)

**Sticky bar (Recruts):**
- Appears ONLY when there are unsaved bids
- `4/6 slots . 57 000 EUR` + Save button (CTA gradient compact)
- **Always visible** (does NOT hide on scroll)
- Leaving without saving triggers confirmation modal
- Slide up animation on appearance

### 2.2 Desktop (>= 1024px)

```
+----------+------------------------------+
| Sidebar  | Top bar (league + avatar)    |
| 220px    +------------------------------+
|          |                              |
| Logo     | Content                      |
| Nav      | max-w-2xl mx-auto            |
| items    | p-8                          |
|          |                              |
| Settings |                              |
+----------+------------------------------+
```

- Sidebar: 220px fixed, `--bg-subtle`, border right `--border-subtle`
- Nav item active: `--accent-default` text + icon, bg `--accent-default` at 10%
- Nav item inactive: `--text-mid`, hover `--text-high` + `--bg-surface`
- Locked items: `--text-ghost`, padlock, not clickable
- Sub-tabs "My Team | Recruts" become sub-items of "Team" in sidebar
- Content: max-w-2xl (672px) centered

### 2.3 Viewport & Scroll

- App shell: `height: 100svh` with fallback `100vh`
- `overscroll-behavior-y: contain` on body
- `viewport-fit=cover` in meta tag
- Touch targets: minimum 44x44px
- `scroll-behavior: smooth` with `prefers-reduced-motion: reduce` fallback

---

## 3. Core Components

### 3.1 Rider Card (card-minimal)

Directly on `--bg-app`, separated by dividers `--border-subtle`.

```
[Avatar 36px]  Nom P. flag  [+5%]      [4 210]
  [#5 PCS]     Equipe                    [XP]    >
```

- **Avatar**: 36px circle, rider photo (Pipeline E). Fallback = initials `--text-mid` on `--bg-surface`
- **PCS rank badge**: under avatar, centered. `--bg-surface` + `--text-mid`, `text-[9px] font-bold`
- **Name**: `text-sm font-semibold --text-high`. First initial, full last name. Flag emoji inline
- **Boost badge**: `+5%` inline next to name. `--bg-surface` + `--text-high`, `text-[9px] font-bold rounded-lg`
- **Team**: `text-xs --text-mid`
- **XP (roster)**: `text-base font-bold --text-high` + "XP" label `text-[9px] --text-low`
- **Chevron**: `>` in `--text-ghost`
- **Divider**: `1px --border-subtle`

### 3.2 Rider Card States

| State | Treatment |
|-------|-----------|
| Default | Transparent bg, divider |
| Bid active | `--bid-active-bg` (cyan 10%) + input border `--accent-default` |
| Outbid (during active round) | Muted/disabled treatment + message "Outbid +8k by @Alex" in `--text-mid` |
| Bid not accepted (round closed) | Muted/disabled, not destructive |
| Open slot | All `--text-ghost`, avatar outline border (no dashed), "Open slot -> Go to Recruts" |

Photo never changes based on state. No dark avatar for boosted riders — just the badge inline.

### 3.3 Bid Input (inline in Recruts)

- Field in card, right side: `min-w-[72px] h-7 rounded-lg`
- Default border: `--border-default`
- With value/active bid: border `--accent-default`, text `--accent-default`, bg `--bid-active-bg`
- Shows minimum salary pre-filled in `--text-low`

### 3.4 Keyboard-up State (tap input in Recruts)

1. List goes to 25% opacity
2. Fixed bar above keyboard:
   - Photo + Name + Team + Specialty + Min salary
   - Input `-` / value / `+` (by 1,000)
   - Budget remaining (live update)
   - CTA "Confirm bid" (gradient)
3. Tap elsewhere or Confirm -> closes

### 3.5 Metric Box (Rider Detail, Team Detail)

3 boxes in a row:

- Background: `--bg-surface`, border `--border-subtle`, `rounded-xl`
- Value: Geist Mono `text-base font-bold --text-high`
- Label: `text-[9px] font-semibold uppercase tracking-wide --text-low`

### 3.6 Badges

| Type | Style |
|------|-------|
| Boost `+5%` | `--bg-surface` + `--text-high` |
| Specialty (Puncheur, GC...) | `--bg-surface` + `--text-mid`, border `--border-default` |
| PCS Rank `#5` | `--bg-surface` + `--text-mid` |
| Round status `J-2` | `--warning` text |
| Level badge | `--border-default`, `text-base font-bold`, square rounded |
| Won (history) | Normal visibility |
| Lost (history) | Muted treatment |

### 3.7 Pills/Chips

**One unified component** used everywhere (Recruts filter pills, etc.):
- `rounded-full`
- Active: bg `--text-high` (#edeef0), text `--bg-app` (#111113)
- Inactive: border `--border-default`, text `--text-mid`

**League switcher is NOT a chip/pill** — it's just text with a chevron dropdown for switching leagues.

### 3.8 Buttons

| Variant | Style |
|---------|-------|
| CTA (primary) | Gradient Cyan-500 -> Cyan-400, max 1/screen |
| Secondary | Border `--accent-default`, transparent bg, text `--accent-default` |
| Ghost | No border, text `--text-mid`, hover `--bg-surface` |
| Destructive ghost | Text `--danger`, no bg |

### 3.9 Segmented Control

- 2 segments (e.g., PCS Stats / Game Stats)
- Active: bg `--bg-surface`, text `--text-high`
- Inactive: transparent, text `--text-mid`

---

## 4. Screens

### 4.1 Onboarding: Welcome

- Full screen, **mesh gradient animated** background
- Logo: `zap` icon 48px in `--accent-highlight` + "WattHunter" `text-2xl font-bold --text-high`
- Title + subtitle explaining the game
- 3 feature cards: bg `--bg-app` at 80% opacity + `backdrop-blur`, `rounded-xl`, border `--border-subtle`
- Each card: Lucide icon + title `--text-high` + description `--text-mid`
- CTA: "Get started" gradient button full width
- Link "Already have an account? Log in" in `--accent-default`

### 4.2 Onboarding: Create or Join

- After auth. Simple `--bg-app` background
- Two tappable options: `--bg-surface`, `rounded-xl`, border `--border-default`
- Icons: `plus` and `arrow-right` in `--accent-default`
- "Create a league" / "Join a league"

### 4.3 Onboarding: Create League

- Simple centered form
- Input: league name, border `--border-default`, focus ring `--accent-focus-ring`
- Team name defaults to player's name (modifiable in Settings later)
- CTA gradient

### 4.4 Home: Lobby (pre-first auction)

- Invite link: read-only input + Copy button
- Player list: rows with avatar + team name + badge "Race Director" for creator
- Next auction preview: Round 1 dates
- **Configure rounds**: button that opens round configuration
  - 3 rounds shown by default with sensible defaults (tomorrow 00:00-23:59, 3 consecutive days)
  - Race Director can modify dates or just click "Launch first auction" with defaults
  - Other players see the calendar read-only
- CTA "Launch first auction": gradient, visible only to Race Director
- Team / Budget / Ranking locked in bottom nav
- "Race Director" = the league creator (not "Commissaire")

### 4.5 Home: Feed (post-first auction)

- **Mesh gradient animated background** with cards on top
- Cards: `--bg-app` at 90% opacity + `backdrop-blur`, `rounded-xl`
- Feed of contextual cards:

**Permanent cards:**
- Next 2 WT races + your riders participating
- Last race results: points scored, ranking change
- Next level: XP bar, next unlock, tappable -> Levels detail

**Contextual cards (appear based on timing):**
- Auction active: time remaining, link to Recruts
- Auction coming: countdown
- Level up: congratulations + new unlock
- New sponsor available

### 4.6 My Team

**Header 2 lines:**
- Line 1: Total XP `text-2xl font-black --accent-highlight` (hero) + Ranking `--accent-default` tappable -> Ranking
- Line 2: boost pill (dot cyan + text `--text-high` + border `--border-default`) + "Policies ->" in `--accent-default`

**Roster:**
- Section "Roster" + "5/6 slots" in `--text-low`
- Rider cards card-minimal
- Open slot: `--text-ghost`, avatar outline border, "-> Go to Recruts"

**Pending bids:**
- Visible ONLY during active round
- "Pending bids" + "Round active . J-2" in `--warning`
- Outbid: muted bg + message in `--text-mid` (not destructive red)
- Amounts in italic `--text-low`
- Disappears after round closes

**Team level:**
- Badge: square rounded, border `--border-default`, number `font-bold`
- Progress bar: track `--bg-surface`, fill `--accent-default`
- Next unlock: Phosphor duotone icon + text
- "See all ->" in `--accent-default` -> Levels page

### 4.7 Recruts

**Round header:**
- Left: "Round 1 . Jan 13 . J-8" `text-sm font-bold --text-high`
- Right: "History ->" in `--accent-default`
- Background: `--bg-subtle`

**Search:**
- Input with `search` icon (Lucide), placeholder `--text-ghost`
- Border `--border-default`, focus `--accent-focus-ring`

**Pills:**
- Horizontal scroll, unified chip component (`rounded-full`)
- Active: bg `--text-high`, text `--bg-app`
- Inactive: border `--border-default`, text `--text-mid`
- Order: All . Teams . Speciality . Nationality . Age

**View All (default):**
- Direct list of rider cards with bid input visible
- Counter "186 AVAILABLE" `text-[9px] font-bold uppercase --text-low`
- Sort: "PCS Rank" tappable `--text-low`

**View Teams/Speciality/Nationality/Age:**
- Accordion: trigger with group name + counter "14 avail."
- Open background: `--bg-subtle`
- One accordion open at a time
- Riders in accordion = same rider cards with input

**Sticky bar:**
- Appears ONLY when bids are modified and unsaved
- Background `--bg-subtle`, border top `--border-default`
- "4/6 slots . 57 000 EUR" `text-sm font-bold --text-high`
- Save button: CTA gradient compact
- Slide up animation
- Leave without save -> confirmation modal

### 4.8 Rider Detail

**Navigation:**
- No bottom nav, no top bar
- Arrow <- + origin screen name ("Recruts" or "My Team")

**Hero:**
- Photo 56px circle + PCS rank badge centered below
- Name `text-lg font-black --text-high` + flag
- Team `text-sm --text-mid`
- Tags: specialty + age in pills `--bg-surface` + border `--border-default`
- Boost badge `+5%` inline if active

**Metric boxes:**
- 3 in row, bg `--bg-surface`, Geist Mono values
- Game XP = `--accent-highlight` (if rider in roster with stats)
- "--" in `--text-ghost` if not in roster

**Bid zone (available rider):**
- Background `--bg-surface`, `rounded-xl`
- "My current bid" + amount in `--accent-default`
- Stepper -/+ by 1,000
- Input: border `--accent-default`, bg `--bid-active-bg`
- CTA "Confirm bid" or "Update bid": gradient
- "x Remove bid": ghost, `--text-mid`

**Roster zone (rider in my team):**
- "Paid salary" in metrics instead of "Min. salary"
- Button "Release rider -- 1 month notice": ghost destructive
- Confirmation modal before release

**Segmented control:** PCS Stats / Game Stats

**Tab PCS Stats:**
- "PCS Ranking by season": Year . Team . Points (`font-bold`) . Rank
- "Race programme": Race . Date . Category (WT/GT/Pro)
- Section labels `text-[9px] font-bold uppercase tracking-wide --text-low`

**Tab Game Stats:**
- Grouped by month: "APRIL 2026" section label
- Rows: Day . Race . PCS pts . XP . Bonus EUR
- Bonus in `--success`
- Bank statement style, reverse chronological

### 4.9 Policies

- Arrow <- My Team. **Bottom nav preserved.**
- **Banner timing**: "Changes apply to the next round . Current policies active until [date]"
- Background `--bg-subtle` or subtle accent tint

**Policy slots:**
- Card-minimal style (bg-app, dividers between slots)
- Each active slot: toggle switch (`--accent-default` when on) + slot title (type name baked in) + 1 select (value only) + coverage "X/Y riders covered" + progress bar
- Locked slots: `--text-ghost` + padlock icon Phosphor duotone + "Unlock Lv.X"
- Toggle greyed out if minimum active policies reached (1 min always)
- Types unlocked by level: Speciality (Lv.1) → Nationality (Lv.3) → Teams (Lv.5) → Age (Lv.7). Max 2 active (unlocked at Lv.5)

**Sticky bar:**
- "X/Y active policies" + old boost (strikethrough `--text-low`) -> new boost (`--accent-default`) + Save
- Save greyed out if no changes

### 4.10 Auction History

- Arrow <- Recruts. **No bottom nav.**
- Search bar at top

**Grouped by round** (most recent first):
- Round header: "ROUND 3 -- PRE TOUR . Jan 13 . 14 riders" on bg `--bg-subtle`
- Each rider: show **all bids** (one line per bidder)
- Winner = normal visibility
- Losers = muted treatment (`--text-low` / reduced opacity)
- No colored tags (Won/Lost) — just the contrast between normal and muted
- Amount + number of bids visible
- Keep it simple, not too many colors

### 4.11 Levels & Unlocks

- Arrow <- My Team. **No bottom nav.**

**Hero section:**
- Current level badge + cycling name + XP progress bar
- Badge: `--accent-highlight` fill for current level

**List of all 10 levels** (one item per level):

| Lv | XP | Slots | Riders Pool | New Policy | Max Active |
|----|-----|-------|-------------|------------|------------|
| 1 | 0 | 6 | #401 → #500 | Speciality | 1 |
| 2 | 100 | 7 | #301 → #500 | — | 1 |
| 3 | 250 | 7 | #201 → #500 | Nationality | 1 |
| 4 | 500 | 8 | #151 → #500 | — | 1 |
| 5 | 900 | 9 | #101 → #500 | Teams | 2 |
| 6 | 1,500 | 9 | #76 → #500 | — | 2 |
| 7 | 2,500 | 10 | #51 → #500 | Age | 2 |
| 8 | 4,000 | 11 | #26 → #500 | — | 2 |
| 9 | 6,000 | 11 | #11 → #500 | — | 2 |
| 10 | 9,000 | 12 | #1 → #500 | — | 2 |

4 policy types: Speciality (Lv.1) → Nationality (Lv.3) → Teams (Lv.5) → Age (Lv.7). Max 2 active policies (unlocked at Lv.5).

States:
- Done: badge `--accent-default`, check mark
- Current: badge `--accent-highlight`, progress bar, left border `--accent-default`, "In progress" label
- Locked: badge `--text-ghost`, padlock icon, text `--text-low`
- No dashed borders

### 4.12 Settings

- Tap avatar -> Settings. Arrow <- Back. **Bottom nav preserved.**

**Profile hero:** Avatar 44px + name + email + "Edit profile ->"

**League switcher:** Text-based with chevron dropdown — NOT a chip/pill. Just "Les Forcats chevron" tappable to switch. This is the same component as in the top bar.

**Contextual league section** (changes when switching league):
- League name + role (Race Director / Member) + player count
- Team name: inline editable input
- Invite code: read-only input + Copy button
- "Leave league": `--danger` text, confirmation modal

**Documentation:** 4 sections with icons + title + subtitle:
- How points work
- Bonus & money
- Team levels & unlocks
- Auctions & rounds

**Sign out:** `--danger`, confirmation + redirect

### 4.13 Ranking (design documented, implementation deferred)

- Bottom nav active on Ranking tab.
- 2 tabs: Teams / Riders

**Teams tab:**
- Race filter: select dropdown "All races"
- **No pinned position card** — just my row highlighted with accent bg in the list
- Columns: position . avatar . team name . level cycling name . movement . XP . chevron
- My row: bg `--bid-active-bg` (cyan 10%), no chevron
- Movement: +N `--success` / -N `--danger` / -- `--text-ghost`
- Always display **team name**, never user name

**Riders tab:**
- Tag Active (in a team) / Free (not recruited, opacity 50%)
- Owner visible under name
- My rider: border `--accent-default` on avatar
- Same race filter

**Team Detail:**
- Hero with 3 metric boxes in order: **Ranking -> Season XP -> Level**
- Active roster + Former riders sections
- Former: avatar opacity 50%, no dashed border, "Released . [date]"
- Read-only — no actions visible

**Rider Detail from Ranking:**
- Simplified: no segmented control, no bid zone
- Game Stats only
- Banner "Owned by @[team name]" or "Not recruited"

---

## 5. Navigation Rules Summary

| Screen | Bottom nav | Top bar | Back arrow |
|--------|-----------|---------|------------|
| Home, My Team, Recruts | Yes (hides on scroll) | Yes (hides on scroll) | No |
| Settings, Policies | Yes | No | Yes |
| Rider Detail, History, Levels | No | No | Yes |
| Ranking | Yes | Simplified | No |

---

## 6. Naming Conventions

- League creator = **"Race Director"** (not Commissaire, not Admin)
- Always display **team name** in the game, never user account name
- Team name defaults to player name at league creation, modifiable in Settings
- Players can have different team names per league
- 8 auction rounds per year (not 7)

---

## 7. Progressive Unlock (Tab System)

1. Start: only Home tab active
2. Race Director launches first auction -> Team tab unlocks
3. First auction round completes -> Budget + Ranking tabs unlock

---

## 8. Auction Calendar

- 8 rounds/year (fixed calendar, configurable by Race Director for first 3 rounds)
- Default: 3 consecutive days starting tomorrow
- Race Director can modify dates before launching
- Other players see calendar read-only
- Round days: 00:00 to 23:59 each day

| Round | Phase | Default Dates |
|-------|-------|---------------|
| 1 | January | Mon 13 -> Wed 15 Jan |
| 2 | February | Mon 10 -> Wed 12 Feb |
| 3 | March | Mon 3 -> Wed 5 Mar |
| 4 | April | Wed 2 -> Fri 4 Apr |
| 5 | Pre-Giro | Wed 7 -> Fri 9 May |
| 6 | Pre-Tour | Wed 2 -> Fri 4 Jul |
| 7 | Pre-Vuelta | Tue 19 -> Thu 21 Aug |
| 8 | October | Thu 9 -> Sat 11 Oct |

---

## 9. Design Principles

1. **Dark-first**: tokens designed for dark, screenshots in dark, contrast tests prioritize dark
2. **Card-minimal**: no card containers — rows on bg-app + dividers. Cards only for: Home feed, modals, bottom sheets, expandable content
3. **Restrained Cyan**: every pixel of cyan must have a reason. Accent is surgical, not decorative
4. **Mobile-first**: design at 390px first. Every component must work at 375px with 44px touch targets before any desktop adaptation
5. **Data-dense**: compact but readable. Hierarchy via size + weight, not color
6. **No dashed borders**: nowhere in the app
7. **No emojis in UI**: icons only (Lucide + Phosphor)

---

## 10. Source Documents

- Color system: `docs/research/velopeloton-color-system.md`
- Design system research: `docs/research/designsystembestpractice.md`
- PRD primary: `docs/prd et wireframe/watthunter-prd-v2.md`
- PRD secondary: `docs/prd et wireframe/watthunter-prd-secondary-v2.md`
- Wireframes primary: `docs/prd et wireframe/watthunter-wireframes-v8.html`
- Wireframes secondary: `docs/prd et wireframe/watthunter-secondary-v2.html`
