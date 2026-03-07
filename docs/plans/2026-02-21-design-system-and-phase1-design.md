> **OBSOLETE** — Superseded by `docs/watthunter-design-system-v1.md` (March 2026)

# WattHunter — Design System & Phase 1 Design

**Date**: 2026-02-21
**Status**: Obsolete
**Scope**: Design system foundations + Auth + Onboarding + League CRUD (REQ-001 to REQ-005)

---

## 1. Design Foundations

### 1.1 Color Palette

| Token | Dark mode | Light mode | Usage |
|-------|-----------|------------|-------|
| `--background` | Zinc 950 `#09090b` | Zinc 50 `#fafafa` | Page background |
| `--surface` | Zinc 900 `#18181b` | White `#ffffff` | Panels, sidebar |
| `--border` | Zinc 800 `#27272a` | Zinc 200 `#e4e4e7` | Line separators (core design element) |
| `--text-primary` | Zinc 50 `#fafafa` | Zinc 950 `#09090b` | Primary text |
| `--text-secondary` | Zinc 400 `#a1a1aa` | Zinc 500 `#71717a` | Secondary text, labels |
| `--accent` | `#34F6F2` | `#34F6F2` | Links, selections, focus rings |
| `--accent-muted` | `#34F6F2` at 15% opacity | Same | Hover backgrounds, badges |
| `--destructive` | Red 500 | Red 600 | Errors, destructive actions |

- **Theme**: Dark-first with light mode toggle
- **Neutral scale**: Tailwind Zinc

### 1.2 Typography

- **Font**: Inter
- **Scale**: Tailwind defaults (`text-sm` body, `text-xs` labels, `text-lg`/`text-xl` headings)
- **Weights**: Regular 400 (text), Medium 500 (labels), Semibold 600 (headings)

### 1.3 Spacing — 8px Grid System

| Tailwind token | Value | Usage |
|----------------|-------|-------|
| `gap-1` / `p-1` | 4px | Micro-spacing only (icon + label) |
| `gap-2` / `p-2` | 8px | Base unit — intra-component |
| `gap-3` / `p-3` | 12px | Input/button padding |
| `gap-4` / `p-4` | 16px | Between related elements |
| `gap-6` / `p-6` | 24px | Between sections |
| `gap-8` / `p-8` | 32px | Main container padding |
| `gap-12` / `p-12` | 48px | Between major blocks |
| `gap-16` / `p-16` | 64px | Page margins |

**Rule**: Stick to multiples of 8 (8, 16, 24, 32, 48, 64). Only exception: 4px for micro-adjustments. No arbitrary values like `p-[13px]`.

### 1.4 Border Radius

- **Default**: `rounded-md` (6px) — Linear-style
- **Buttons/inputs**: `rounded-md`
- **Modals/dialogs**: `rounded-lg` (8px)
- **No `rounded-xl` or `rounded-full`** except avatars

### 1.5 Design Principles

- **No nested cards** — separation via `border-b border-border`
- **No shadows** except dropdowns/modals (`shadow-sm` only)
- **Generous spacing**: minimum `gap-4` between sections
- **Linear-inspired**: flat, cold, engineering aesthetic
- **Photos** for warmth where appropriate

---

## 2. Components

### 2.1 Shadcn Customizations

**Button** — 3 variants:
- `default`: Zinc 800 bg, Zinc 50 text, hover Zinc 700, border Zinc 700
- `ghost`: transparent, hover `accent-muted`
- `brand`: gradient accent (TBD), dark text, reserved for major CTAs

**Input / Select**: Zinc 900 bg, Zinc 800 border, focus ring `accent` at 50% opacity, `rounded-md`

**Dialog**: Zinc 950/80% overlay, `surface` bg, `rounded-lg`, header/body/footer separated by `border-b`

**Badge**: `accent-muted` bg, `accent` text, `rounded-md` (no pill), destructive variant in red

**Tabs**: Underline style (no background), `accent` border-bottom on active, `text-secondary` → `text-primary` on active

**Table**: No outer borders, `border-b` between rows, header in `text-secondary` `text-xs` uppercase

**Card**: Rarely used — `surface` bg, single `border`, no shadow, never nested

**Progress**: Zinc 800 track, `accent` fill, 4px height

**Avatar**: `rounded-full` (only radius exception), initials fallback on Zinc 800

### 2.2 New Components

- **Sidebar**: Fixed left, 240px, `surface` bg, Solar Icons + labels, sections separated by `border-b`
- **TopBar**: League name + breadcrumb, user avatar right-aligned
- **Divider**: Reusable `<Divider />` = `border-b border-border`
- **StatRow**: Label/value line for dashboards (treasury, XP) — no card, just a line with separator
- **EmptyState**: Solar Icon + title + description + CTA, centered

### 2.3 Icons — Solar Icons

Solar Icons "Linear" style. ~1500 icons, thin outline style. Import via `solar-icon-set` package or selective SVG import to minimize bundle.

---

## 3. Layout Shell

### 3.1 Structure (post-auth)

```
┌──────────┬─────────────────────────────────────┐
│          │  TopBar (breadcrumb + avatar)        │
│  Sidebar │─────────────────────────────────────│
│  240px   │                                     │
│          │  Main content                        │
│  - Logo  │  (scrollable, padding 32px)         │
│  - Nav   │                                     │
│  - League│                                     │
│          │                                     │
└──────────┴─────────────────────────────────────┘
```

### 3.2 Sidebar Navigation

| Icon | Label | Route |
|------|-------|-------|
| Solar:home | Tableau de bord | `/league/[id]` |
| Solar:bolt | Encheres | `/league/[id]/auctions` |
| Solar:users | Mon equipe | `/league/[id]/team` |
| Solar:wallet | Tresorerie | `/league/[id]/treasury` |
| Solar:chart | Classement | `/league/[id]/standings` |
| Solar:target | Politiques | `/league/[id]/policies` |
| Solar:handshake | Sponsors | `/league/[id]/sponsors` |

Bottom: league selector (if multi-league) + settings + profile.

### 3.3 Full-Screen Pages (no sidebar)

- `/login` — centered, full screen
- `/onboarding` — centered, step flow
- `/join` — centered, code input

### 3.4 Responsive Strategy

- **Desktop**: fixed sidebar visible
- **Mobile**: sidebar as drawer (hamburger), full-width content
- Desktop-first, mobile polish later

---

## 4. Auth — REQ-001

- **Provider**: Google OAuth via Supabase Auth (Apple later)
- **Flow**: `/login` → "Continue with Google" button → Supabase callback → redirect to `/onboarding` (first login) or `/league/[id]` (returning user)
- **Session**: managed by `@supabase/ssr`, httpOnly cookies, Next.js middleware to protect `(game)/` routes
- **Login page**: full screen, centered, WattHunter logo + Google button + game tagline
- **AC**: Sign-in < 5 sec, JWT managed by Supabase, user row created in `users` on first login

---

## 5. Onboarding — REQ-002

3 screens, max:

| Screen | Content | Action |
|--------|---------|--------|
| 1 — Concept | "WattHunter, c'est quoi?" — 2-3 line pitch + illustration | Next / Skip |
| 2 — How it works | Recruit → Earn points → Level up — 3 icons | Next / Skip |
| 3 — Join | Two choices: "Create a league" or "Join with a code" | Direct action |

- **Skip** on each screen → jumps to screen 3
- **Marker**: `has_onboarded` field in `users` table to not re-display
- **Design**: full screen, centered, subtle transition animations

---

## 6. Leagues — REQ-003, REQ-004, REQ-005

### 6.1 Create a League (REQ-003)

- **Route**: `/league/create`
- **Form**: league name + player count (6-12, select)
- **Code generation**: 6 alphanumeric chars server-side (excluding 0/O, 1/I/l)
- **Result**: confirmation screen with shareable code (copy button)
- Creator becomes `commissioner` in `league_members`

### 6.2 Join a League (REQ-004)

- **Route**: `/league/join`
- **Input**: 6-char code field, real-time validation
- **Errors**: invalid code, league full, league already active
- **Success**: redirect to league lobby

### 6.3 Lobby + Launch (REQ-005)

- **Route**: `/league/[id]` (when `status = 'draft'`)
- **Player view**: list of joined members, league code to share, waiting state
- **Commissioner view**: same + "Launch first auction" button (enabled when >= 4 players)
- **Launch**: creates `auctions` row with `opens_at = now()`, `closes_at = now() + 72h`, sets league `status = 'active'`
- **Notification**: email sent to all league members (provider TBD)

---

## 7. Implementation Sequence

| Phase | Content |
|-------|---------|
| **Phase 0** | Design system: Zinc dark-first theme, accent `#34F6F2`, 8px grid, Shadcn customization, Solar Icons, sidebar+topbar layout shell |
| **Phase 1a** | Google Auth + session middleware |
| **Phase 1b** | Onboarding 3-screen flow |
| **Phase 1c** | Create league + Join league + Lobby with launch |

Every screen is built with the design system from day one — zero visual debt.
