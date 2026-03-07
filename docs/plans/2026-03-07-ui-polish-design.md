# WattHunter — UI Polish Design Document

> Version 1.0 - March 7, 2026
> Fixes spacing, consistency, and component issues identified after the full redesign

---

## 1. Scope

14 items from `docs/TODO_UI_POLISH.md` + 3 audit findings + spacing standardization.

---

## 2. Spacing Rules (new addition to design system)

### 2.1 Page-Level Spacing

| Context | Value | Tailwind | Notes |
|---------|-------|----------|-------|
| Page horizontal padding (mobile) | 16px | `px-4` | All pages, no exceptions (fix Onboarding px-5) |
| Page horizontal padding (desktop) | 32px | `lg:px-8` | Applied by layout wrapper |
| Page top padding (below TopBar or BackHeader) | 16px | `pt-4` | Breathing room after nav |
| Page bottom padding (mobile, with BottomNav) | 80px | `pb-20` | Applied by layout wrapper |
| Page bottom padding (mobile, no BottomNav) | 32px | `pb-8` | Detail pages (Rider, History, Levels) |
| Page bottom padding (desktop) | 32px | `lg:pb-8` | Applied by layout wrapper |

### 2.2 Section Spacing

| Context | Value | Tailwind | Notes |
|---------|-------|----------|-------|
| Between major sections | 24px | `space-y-6` | Top-level page structure |
| Between items in a section | 12px | `space-y-3` or `gap-3` | Logical grouping |
| Between tightly coupled elements | 4px | `space-y-1` or `gap-1` | Label + value pairs |

### 2.3 Form Spacing

| Context | Value | Tailwind | Notes |
|---------|-------|----------|-------|
| Label to input gap | 6px | `gap-1.5` | FormField internal |
| Between form fields | 16px | `gap-4` | Standard form rhythm |
| Error/success message to input | 4px | `mt-1` | Tight to the field |
| Form to submit button | 16px | `mt-4` | Matches field gap |

### 2.4 Component Spacing

| Context | Value | Tailwind | Notes |
|---------|-------|----------|-------|
| List item (RiderCard) | 16px h / 12px v | `px-4 py-3` | Already correct |
| List dividers | border-b | `divide-y` | No gap, just the line |
| BackHeader | 16px h / 8px v | `px-4 py-2` | Already correct |
| Filter pills row | 16px h / 8px gap | `px-4 gap-2` | Already correct |

### 2.5 Grid (4px base)

All spacing uses multiples of 4px: 4, 6, 8, 12, 16, 24, 32, 48, 80.
No arbitrary pixel values outside this scale.

---

## 3. Design System Fixes

### 3.1 FormField Component (NEW)

Reusable wrapper for label + input + error/success message.

```tsx
<FormField label="Email" error={error}>
  <Input type="email" ... />
</FormField>
```

Props:
- `label: string` — field label
- `htmlFor?: string` — ties label to input
- `error?: string` — error message (--status-danger)
- `success?: string` — success message (--status-success)
- `children: ReactNode` — the input element

Styling:
- Wrapper: `flex flex-col gap-1.5`
- Label: `text-sm font-medium text-[var(--text-mid)]`
- Error: `text-xs text-[var(--status-danger)] mt-1`
- Success: `text-xs text-[var(--status-success)] mt-1`

### 3.2 Shadcn Switch (INSTALL)

Install via `pnpm dlx shadcn@latest add switch` in apps/web.
Replace custom div-based toggle in Policies page.
Style overrides in globals.css to match design system:
- Track off: `--bg-surface`
- Track on: `--accent-default`
- Thumb: white circle

### 3.3 Color Token Fix

Replace all `--danger` references with `--status-danger`:
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/signup/page.tsx`
- `apps/web/app/(auth)/league/create/page.tsx` (if present)

### 3.4 Label Color Standardization

All form labels use `text-[var(--text-mid)]`.
Fix Create League page which currently uses `text-[var(--text-high)]`.

---

## 4. TopBar Changes

### 4.1 Height: 32px -> 40px
- Change `h-8` to `h-10`
- Update SubTabs sticky offset: `top-8` -> `top-10`
- Update any other components that reference TopBar height

### 4.2 Logo: Zap icon -> WattHunter SVG
- Import `watthunter-icons/watthunter-logo.svg` as a component or inline SVG
- Size: 20px height, auto width
- Keep "WattHunter" text + league name + chevron

### 4.3 Right side: Avatar -> Settings gear
- Replace Avatar with Lucide `Settings` icon (20px)
- Color: `--text-mid`, hover `--text-high`
- Still links to Settings page
- The avatar remains visible only in the Settings page hero

### 4.4 Spacing fix
- Ensure content starts below TopBar with proper gap
- TopBar border-bottom provides visual separation

---

## 5. BottomNav Changes

### 5.1 Remove padlock icons
- Locked tabs keep `--text-ghost` color (visually disabled)
- Remove the 8px Lock icon overlay
- Touch target still 44x44px, still non-clickable

### 5.2 Spacing fix
- Review gap between border-top separator and icon row
- Ensure consistent vertical padding

---

## 6. Forms Consistency

### 6.1 Apply FormField everywhere
Pages to update:
- Login (`apps/web/app/(auth)/login/page.tsx`)
- Signup (`apps/web/app/(auth)/signup/page.tsx`)
- Create League (`apps/web/app/(auth)/league/create/page.tsx`)
- Join League (`apps/web/app/(auth)/league/join/page.tsx`)

### 6.2 Invite code input
- Remove `font-bold` / `text-lg`
- Align left (remove `text-center`)
- Keep `uppercase` and `tracking-widest`
- Same color as other inputs (`--text-high` for value, `--text-ghost` for placeholder)

---

## 7. League Switcher

### 7.1 Behavior
- If user has 1 league: no chevron, just league name text
- If user has 2+ leagues: chevron appears, clicking opens dropdown
- Dropdown: simple list of league names, clicking switches to that league
- Current league has a check mark or accent highlight
- Clicking outside closes dropdown

### 7.2 Implementation
- Small dropdown component anchored to the TopBar left area
- Background: `--bg-surface`, border `--border-default`, rounded-lg
- Items: `px-3 py-2`, hover `--bg-surface-hover`
- Active item: `--accent-default` text + check icon
- Shadow: subtle drop shadow
- z-index: above content, below modals (z-50)

### 7.3 Desktop sidebar
- Same logic: league name in sidebar header
- Chevron only if 2+ leagues
- Same dropdown behavior

---

## 8. Spacing Standardization (pages to fix)

### 8.1 Onboarding
- Change `px-5` to `px-4` (align with all other pages)

### 8.2 My Team
- Already uses `px-4 py-4 space-y-6` -- OK

### 8.3 Rider Detail
- Change `py-2` to `pt-4` (consistent top padding)

### 8.4 Policies
- Add `pt-4` after BackHeader

### 8.5 Levels
- Add `pt-4` after BackHeader
- Fix `pl-[14px]` -> `pl-3.5` (stays on 4px grid: 14px = 3.5 * 4px, use Tailwind class)

### 8.6 Settings
- Add `pt-4` after BackHeader (if missing)

### 8.7 Form field gap normalization
- Login/Signup: `gap-1` -> `gap-1.5` (label to input)
- Create/Join league: `gap-2` -> `gap-1.5` (label to input)

---

## 9. Items NOT in scope
- Mesh gradient WebGL (deferred)
- Ranking page (not yet implemented)
- Budget page (not yet implemented)
- Auction bidding client (separate feature)
- Recruts client bidding logic (separate feature)

---

## 10. Summary: 17 tasks

| # | Category | Task | Effort |
|---|----------|------|--------|
| 1 | Design System | Create FormField component | S |
| 2 | Design System | Install Shadcn Switch | XS |
| 3 | Design System | Fix --danger -> --status-danger | XS |
| 4 | Design System | Standardize label colors to --text-mid | XS |
| 5 | TopBar | Height 32px -> 40px | XS |
| 6 | TopBar | Replace Zap with WattHunter logo SVG | S |
| 7 | TopBar | Replace avatar with Settings gear | XS |
| 8 | TopBar | Fix content spacing below TopBar | XS |
| 9 | BottomNav | Remove padlock icons | XS |
| 10 | BottomNav | Fix separator/icon spacing | XS |
| 11 | Forms | Apply FormField to login | S |
| 12 | Forms | Apply FormField to signup | S |
| 13 | Forms | Apply FormField to create league | S |
| 14 | Forms | Apply FormField to join league + fix invite code | S |
| 15 | Spacing | Standardize all page spacing (6 pages) | M |
| 16 | Spacing | Normalize form field gaps | S |
| 17 | Navigation | League switcher dropdown | M |
