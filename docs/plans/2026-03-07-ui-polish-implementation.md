# UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all UI inconsistencies, standardize spacing, create reusable components, and polish navigation after the full redesign.

**Architecture:** 17 tasks across 6 groups — foundation components first, then navigation, forms, spacing, and finally the league switcher feature. All changes are in `apps/web/`. No backend changes.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, Shadcn UI, Lucide React

---

## Group 1: Foundation (Tasks 1–4)

### Task 1: Create FormField component

**Files:**
- Create: `apps/web/components/form-field.tsx`

**Step 1: Create the component**

```tsx
import { type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  success?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, success, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--text-mid)]"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-[var(--status-danger)]">{error}</p>
      )}
      {success && (
        <p className="text-xs text-[var(--status-success)]">{success}</p>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```
feat: add FormField component for consistent form styling
```

---

### Task 2: Install Shadcn Switch

**Step 1: Install the component**

Run: `cd apps/web && pnpm dlx shadcn@latest add switch`

**Step 2: Verify it exists**

Check that `apps/web/components/ui/switch.tsx` was created.

**Step 3: Commit**

```
feat: add Shadcn Switch component
```

---

### Task 3: Fix color token --danger → --status-danger

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx` — line 100
- Modify: `apps/web/app/(auth)/signup/page.tsx` — line 148
- Modify: `apps/web/app/(auth)/league/create/page.tsx` — line 48
- Modify: `apps/web/app/(auth)/league/join/page.tsx` — line 52
- Modify: `apps/web/app/(game)/league/[leagueId]/settings/page.tsx` — lines 160, 204

**Step 1: Replace all occurrences**

In each file, replace `var(--danger)` with `var(--status-danger)`:

- `login/page.tsx:100` — `text-[var(--danger)]` → `text-[var(--status-danger)]`
- `signup/page.tsx:148` — `text-[var(--danger)]` → `text-[var(--status-danger)]`
- `create/page.tsx:48` — `text-[var(--danger)]` → `text-[var(--status-danger)]`
- `join/page.tsx:52` — `text-[var(--danger)]` → `text-[var(--status-danger)]`
- `settings/page.tsx:160` — `text-[var(--danger)]` → `text-[var(--status-danger)]`
- `settings/page.tsx:204` — `text-[var(--danger)]` → `text-[var(--status-danger)]`

**Step 2: Verify no remaining --danger references**

Run: `grep -r "var(--danger)" apps/web/`
Expected: No matches

**Step 3: Commit**

```
fix: use --status-danger token instead of undefined --danger
```

---

### Task 4: Standardize label colors to --text-mid

**Files:**
- Modify: `apps/web/app/(auth)/league/create/page.tsx` — line 34
- Modify: `apps/web/app/(auth)/league/join/page.tsx` — line 37

**Step 1: Fix create league label**

`create/page.tsx:34` — change:
```
text-sm font-medium text-[var(--text-high)]
```
to:
```
text-sm font-medium text-[var(--text-mid)]
```

**Step 2: Fix join league label**

`join/page.tsx:37` — change:
```
text-sm font-medium text-[var(--text-high)]
```
to:
```
text-sm font-medium text-[var(--text-mid)]
```

**Step 3: Commit**

```
fix: standardize form label colors to --text-mid
```

---

## Group 2: Navigation (Tasks 5–10)

### Task 5: TopBar — height, logo, gear icon

**Files:**
- Modify: `apps/web/components/topbar.tsx`
- Copy: `watthunter-icons/favicon.svg` → `apps/web/public/watthunter-icon.svg`

**Step 1: Copy the SVG icon to public**

Run: `cp watthunter-icons/favicon.svg apps/web/public/watthunter-icon.svg`

**Step 2: Rewrite topbar.tsx**

Replace the full file with:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings, ChevronDown } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface TopBarProps {
  leagueName: string;
  hasMultipleLeagues?: boolean;
  settingsHref: string;
  onLeagueSwitch?: () => void;
}

export function TopBar({
  leagueName,
  hasMultipleLeagues,
  settingsHref,
  onLeagueSwitch,
}: TopBarProps) {
  const visible = useScrollDirection();

  return (
    <header
      className={`sticky top-0 z-50 flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <button
        type="button"
        onClick={onLeagueSwitch}
        className="flex items-center gap-1.5 truncate"
        disabled={!hasMultipleLeagues}
      >
        <Image
          src="/watthunter-icon.svg"
          alt="WattHunter"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span className="text-sm font-semibold text-[var(--text-high)]">
          WattHunter
        </span>
        <span className="truncate text-sm text-[var(--text-low)]">
          {leagueName}
        </span>
        {hasMultipleLeagues && (
          <ChevronDown size={12} className="shrink-0 text-[var(--text-low)]" />
        )}
      </button>

      <Link href={settingsHref} className="flex items-center justify-center">
        <Settings size={20} className="text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors" />
      </Link>
    </header>
  );
}
```

Key changes:
- `h-8` → `h-10` (32px → 40px)
- `Zap` icon → `Image` with `/watthunter-icon.svg` (20px)
- Avatar → `Settings` icon (20px)
- Removed `Avatar` import and `userAvatarUrl`/`userInitials` props

**Step 3: Update layout.tsx to match new TopBar props**

In `apps/web/app/(game)/league/[leagueId]/layout.tsx`, update the TopBar usage (lines 92-98):

Remove these props: `userAvatarUrl`, `userInitials`

Change from:
```tsx
<TopBar
  leagueName={leagueName}
  hasMultipleLeagues={hasMultipleLeagues}
  userAvatarUrl={profile?.avatar_url}
  userInitials={userInitials}
  settingsHref="/settings"
/>
```

To:
```tsx
<TopBar
  leagueName={leagueName}
  hasMultipleLeagues={hasMultipleLeagues}
  settingsHref={`/league/${leagueId}/settings`}
/>
```

Also fix: settingsHref should include leagueId path (was "/settings", should be dynamic).

**Step 4: Clean up unused variables in layout.tsx**

If `userInitials`, `displayName`, `profile` are no longer used by TopBar or Sidebar, check if Sidebar still needs them. Sidebar doesn't use them (confirmed from sidebar.tsx). If no other component uses them, remove the `userInitials` computation (lines 55-61) and the `profile` query (lines 49-53) — BUT check first if the profile query is used elsewhere in the layout. Keep the profile query if Settings or other child pages might need it via context. For now, leave the profile query (it might be used for avatar in Settings) but remove `displayName` and `userInitials` variables since they're no longer passed anywhere from the layout.

**Step 5: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -10`
Expected: Build succeeds

**Step 6: Commit**

```
feat: TopBar — 40px height, WattHunter logo SVG, Settings gear icon
```

---

### Task 6: SubTabs sticky offset update

**Files:**
- Modify: `apps/web/components/sub-tabs.tsx` — line 17

**Step 1: Update sticky top offset**

TopBar changed from `h-8` to `h-10`, so SubTabs must change from `top-8` to `top-10`:

`sub-tabs.tsx:17` — change `top-8` to `top-10`:
```
sticky top-10 lg:top-0 z-40
```

**Step 2: Commit**

```
fix: SubTabs sticky offset to match new TopBar height
```

---

### Task 7: BottomNav — remove padlocks, fix spacing

**Files:**
- Modify: `apps/web/components/bottom-nav.tsx`

**Step 1: Remove Lock icon and simplify locked tab**

In `bottom-nav.tsx`, remove `Lock` from the import (line 5):
```tsx
import { House, Users, BadgeEuro, Trophy, type LucideIcon } from "lucide-react";
```

Replace the locked tab rendering (lines 47-58) with:
```tsx
if (!isUnlocked) {
  return (
    <div
      key={tab.key}
      className="relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[var(--text-ghost)]"
    >
      <tab.icon size={20} />
      <span className="text-[9px] font-bold">{tab.label}</span>
    </div>
  );
}
```

This removes the `<div className="relative">` wrapper and the `<Lock size={8} .../>` overlay. The tab is still visually disabled via `--text-ghost` color.

**Step 2: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -5`

**Step 3: Commit**

```
fix: remove padlock icons from locked bottom nav tabs
```

---

### Task 8: Sidebar — remove Lock icons from locked items

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Update sidebar locked items**

In `sidebar.tsx`, remove the Lock icon from locked nav items (line 79):

Replace lines 71-81:
```tsx
if (!isUnlocked) {
  return (
    <div
      key={item.key}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-ghost)]"
    >
      <item.icon size={16} className="shrink-0" />
      <span className="flex-1">{item.label}</span>
    </div>
  );
}
```

Remove `Lock` from the Lucide imports if no longer used (check: Lock is used only in locked items).

Update import line 5-14:
```tsx
import {
  House,
  Users,
  BadgeEuro,
  Trophy,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
```

**Step 2: Update sidebar logo to use WattHunter SVG**

Replace lines 52-56:
```tsx
<div className="flex items-center gap-2 px-4 py-4">
  <Image
    src="/watthunter-icon.svg"
    alt="WattHunter"
    width={20}
    height={20}
    className="shrink-0"
  />
  <span className="text-sm font-bold text-[var(--text-high)]">WattHunter</span>
</div>
```

Add `import Image from "next/image";` at the top.
Remove `Zap` from the Lucide imports.

**Step 3: Commit**

```
fix: sidebar — remove lock icons, use WattHunter logo SVG
```

---

## Group 3: Forms (Tasks 9–12)

### Task 9: Apply FormField to login page

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`

**Step 1: Add FormField import**

Add to imports:
```tsx
import { FormField } from "@/components/form-field";
```

**Step 2: Replace inline label+input patterns**

Replace lines 77-87 (email field):
```tsx
<FormField label="Email" htmlFor="login-email" error={undefined}>
  <Input
    id="login-email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />
</FormField>
```

Replace lines 88-97 (password field):
```tsx
<FormField label="Password" htmlFor="login-password">
  <Input
    id="login-password"
    type="password"
    placeholder="Your password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />
</FormField>
```

Replace line 100 (error message — now handled by a standalone error, NOT inside FormField since it's form-level):
```tsx
{error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
```

This was already fixed in Task 3, so just verify the token is correct.

**Step 3: Commit**

```
refactor: login page — use FormField component
```

---

### Task 10: Apply FormField to signup page

**Files:**
- Modify: `apps/web/app/(auth)/signup/page.tsx`

**Step 1: Add FormField import**

```tsx
import { FormField } from "@/components/form-field";
```

**Step 2: Replace all 4 inline label+input patterns**

Replace lines 99-111 (username):
```tsx
<FormField label="Username" htmlFor="displayName">
  <Input
    id="displayName"
    type="text"
    placeholder="johndoe"
    value={displayName}
    onChange={(e) => setDisplayName(e.target.value)}
    required
    minLength={2}
    maxLength={30}
  />
</FormField>
```

Replace lines 112-122 (email):
```tsx
<FormField label="Email" htmlFor="email">
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />
</FormField>
```

Replace lines 123-134 (password):
```tsx
<FormField label="Password" htmlFor="password">
  <Input
    id="password"
    type="password"
    placeholder="Min. 6 characters"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    minLength={6}
  />
</FormField>
```

Replace lines 135-146 (confirm password):
```tsx
<FormField label="Confirm password" htmlFor="confirmPassword">
  <Input
    id="confirmPassword"
    type="password"
    placeholder="Repeat password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    required
    minLength={6}
  />
</FormField>
```

Replace lines 148-149 (error/success — form-level, keep standalone):
```tsx
{error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
{message && <p className="text-xs text-[var(--status-success)]">{message}</p>}
```

**Step 3: Commit**

```
refactor: signup page — use FormField component
```

---

### Task 11: Apply FormField to create league page

**Files:**
- Modify: `apps/web/app/(auth)/league/create/page.tsx`

**Step 1: Add FormField import**

```tsx
import { FormField } from "@/components/form-field";
```

**Step 2: Replace inline label+input (lines 33-45)**

```tsx
<FormField label="League name" htmlFor="name">
  <Input
    id="name"
    name="name"
    placeholder="Ex: The Watt Hunters"
    required
    minLength={2}
    maxLength={50}
  />
</FormField>
```

Replace line 47-49 (error — form-level, keep standalone):
```tsx
{state?.error && (
  <p className="text-xs text-[var(--status-danger)]">{state.error}</p>
)}
```

**Step 3: Commit**

```
refactor: create league page — use FormField component
```

---

### Task 12: Apply FormField to join league page + fix invite code input

**Files:**
- Modify: `apps/web/app/(auth)/league/join/page.tsx`

**Step 1: Add FormField import**

```tsx
import { FormField } from "@/components/form-field";
```

**Step 2: Replace inline label+input and fix invite code styling (lines 36-49)**

```tsx
<FormField label="Invite code" htmlFor="code">
  <Input
    id="code"
    name="code"
    placeholder="Ex: A3K7WN"
    required
    maxLength={6}
    defaultValue={prefillCode}
    className="uppercase tracking-widest"
  />
</FormField>
```

Changes to invite code input:
- Removed `text-center` (align left)
- Removed `text-lg` (same size as other inputs)
- Kept `uppercase` and `tracking-widest`

Replace lines 51-53 (error — form-level, keep standalone):
```tsx
{state?.error && (
  <p className="text-xs text-[var(--status-danger)]">{state.error}</p>
)}
```

**Step 3: Commit**

```
refactor: join league page — use FormField, fix invite code input styling
```

---

## Group 4: Spacing Standardization (Tasks 13–14)

### Task 13: Standardize page spacing across all game pages

**Files:**
- Modify: `apps/web/app/(auth)/onboarding/page.tsx` — line 37
- Modify: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx` — line 69
- Modify: `apps/web/app/(game)/league/[leagueId]/team/policies/page.tsx` — line 70
- Modify: `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx` — line 71
- Modify: `apps/web/app/(game)/league/[leagueId]/settings/page.tsx` — line 88

**Step 1: Fix onboarding horizontal padding**

`onboarding/page.tsx:37` — change `px-5` to `px-4`:
```
relative z-10 flex w-full max-w-sm flex-col items-center gap-6 px-4
```

**Step 2: Fix rider detail top padding**

`rider-detail-client.tsx:69` — change `py-2` to `pt-4`:
```
space-y-6 pt-4
```

**Step 3: Fix policies top padding**

`policies/page.tsx:70` — change `px-4 space-y-4` to `px-4 pt-4 space-y-4`:
```
px-4 pt-4 space-y-4
```

**Step 4: Fix levels top padding**

`levels/page.tsx:71` — change `px-4 space-y-6` to `px-4 pt-4 space-y-6`:
```
px-4 pt-4 space-y-6
```

**Step 5: Fix settings top padding**

`settings/page.tsx:88` — change `px-4 space-y-6` to `px-4 pt-4 space-y-6`:
```
px-4 pt-4 space-y-6
```

**Step 6: Fix levels page border-left alignment**

`levels/page.tsx:110` — change `pl-[14px]` to `pl-3.5`:
```
: "pl-3.5"
```

(14px = 3.5 * 4px, stays on the 4px grid with a proper Tailwind class)

**Step 7: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -5`

**Step 8: Commit**

```
fix: standardize page spacing — consistent pt-4, px-4, 4px grid
```

---

### Task 14: Normalize form field gaps

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/app/(auth)/signup/page.tsx`

**Step 1: Fix login form field gaps**

After Task 9, the form fields use FormField which internally uses `gap-1.5`. But the form wrapper still uses `gap-4` (16px between fields) which is correct.

Verify that `login/page.tsx` form wrapper class is:
```
flex w-full flex-col gap-4
```
This is correct — no change needed.

**Step 2: Fix signup form field gaps**

Same check for `signup/page.tsx` — form wrapper should be `gap-4`. Already correct.

**Step 3: Fix create/join league form gaps**

Both use `gap-4` in the form wrapper — correct. The internal `gap-2` in the old `<div className="flex flex-col gap-2">` is now replaced by FormField's `gap-1.5`. Verify this is applied.

No changes needed — the FormField component handles internal gap.

**Step 4: Commit (if any changes)**

Skip if no changes were made — the FormField component already enforces the correct gap-1.5.

---

## Group 5: Policies Switch (Task 15)

### Task 15: Replace custom toggle with Shadcn Switch in Policies

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/policies/page.tsx`

**Step 1: Add Switch import**

```tsx
import { Switch } from "@/components/ui/switch";
```

**Step 2: Replace custom toggle (lines 100-114)**

Replace the custom div-based toggle with:
```tsx
<Switch
  checked={isUnlocked}
  disabled={!isUnlocked}
  className="shrink-0"
/>
```

The full policy row (lines 94-145) becomes:
```tsx
<div
  key={policy.key}
  className="flex items-center gap-3 py-4"
>
  <Switch
    checked={isUnlocked}
    disabled={!isUnlocked}
    className="shrink-0"
  />

  {/* Content */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span
        className={`text-sm font-semibold ${
          isUnlocked
            ? "text-[var(--text-high)]"
            : "text-[var(--text-ghost)]"
        }`}
      >
        {policy.name}
      </span>
      {!isUnlocked && (
        <span className="flex items-center gap-1 text-xs text-[var(--text-ghost)]">
          <Lock size={12} />
          Unlock Lv.{policy.unlockLevel}
        </span>
      )}
    </div>
    <p
      className={`text-xs mt-0.5 ${
        isUnlocked
          ? "text-[var(--text-mid)]"
          : "text-[var(--text-ghost)]"
      }`}
    >
      {policy.description}
    </p>
  </div>
</div>
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -5`

**Step 4: Commit**

```
refactor: policies — replace custom toggle with Shadcn Switch
```

---

## Group 6: League Switcher (Tasks 16–17)

### Task 16: Pass leagues list from layout to TopBar and Sidebar

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`
- Modify: `apps/web/components/topbar.tsx`
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Fetch all user leagues in layout.tsx**

After the `leagueCount` query (line 41-44), add a query to get league names:

```tsx
const { data: userLeagues } = await supabase
  .from("league_members")
  .select("league_id, leagues:league_id(id, name)")
  .eq("user_id", user.id);

const leaguesList = (userLeagues ?? [])
  .map((m) => {
    const league = m.leagues as unknown as { id: string; name: string } | null;
    return league ? { id: league.id, name: league.name } : null;
  })
  .filter((l): l is { id: string; name: string } => l !== null);
```

**Step 2: Pass leagues to TopBar and Sidebar**

Update TopBar usage:
```tsx
<TopBar
  leagueName={leagueName}
  leagueId={leagueId}
  leagues={leaguesList}
  settingsHref={`/league/${leagueId}/settings`}
/>
```

Update Sidebar usage:
```tsx
<Sidebar
  leagueId={leagueId}
  leagueName={leagueName}
  leagues={leaguesList}
  unlockedTabs={unlockedTabs}
/>
```

**Step 3: Commit**

```
feat: pass leagues list to TopBar and Sidebar for league switcher
```

---

### Task 17: Implement league switcher dropdown

**Files:**
- Modify: `apps/web/components/topbar.tsx`
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Update TopBar with dropdown**

Rewrite `topbar.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Settings, ChevronDown, Check } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface League {
  id: string;
  name: string;
}

interface TopBarProps {
  leagueName: string;
  leagueId: string;
  leagues: League[];
  settingsHref: string;
}

export function TopBar({
  leagueName,
  leagueId,
  leagues,
  settingsHref,
}: TopBarProps) {
  const visible = useScrollDirection();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const hasMultiple = leagues.length > 1;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => hasMultiple && setOpen(!open)}
          className="flex items-center gap-1.5 truncate"
          disabled={!hasMultiple}
        >
          <Image
            src="/watthunter-icon.svg"
            alt="WattHunter"
            width={20}
            height={20}
            className="shrink-0"
          />
          <span className="text-sm font-semibold text-[var(--text-high)]">
            WattHunter
          </span>
          <span className="truncate text-sm text-[var(--text-low)]">
            {leagueName}
          </span>
          {hasMultiple && (
            <ChevronDown
              size={12}
              className={`shrink-0 text-[var(--text-low)] transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg">
            {leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  league.id === leagueId
                    ? "text-[var(--accent-default)]"
                    : "text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-high)]"
                }`}
                onClick={() => {
                  setOpen(false);
                  if (league.id !== leagueId) {
                    router.push(`/league/${league.id}`);
                  }
                }}
              >
                {league.name}
                {league.id === leagueId && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <Link href={settingsHref} className="flex items-center justify-center">
        <Settings size={20} className="text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors" />
      </Link>
    </header>
  );
}
```

**Step 2: Update Sidebar with same dropdown logic**

In `sidebar.tsx`, update the interface and add dropdown to the league name section:

Update interface:
```tsx
interface SidebarProps {
  leagueId: string;
  leagueName: string;
  leagues: { id: string; name: string }[];
  unlockedTabs: ("home" | "team" | "budget" | "ranking")[];
}
```

Update component signature:
```tsx
export function Sidebar({ leagueId, leagueName, leagues, unlockedTabs }: SidebarProps) {
```

Replace the logo + league name section (lines 52-59) with:

```tsx
{/* Logo */}
<div className="flex items-center gap-2 px-4 py-4">
  <Image
    src="/watthunter-icon.svg"
    alt="WattHunter"
    width={20}
    height={20}
    className="shrink-0"
  />
  <span className="text-sm font-bold text-[var(--text-high)]">WattHunter</span>
</div>
<div className="relative px-4 pb-4">
  {leagues.length > 1 ? (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex items-center gap-1 text-xs text-[var(--text-low)] hover:text-[var(--text-mid)] transition-colors"
      >
        {leagueName}
        <ChevronDown
          size={10}
          className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
        />
      </button>
      {sidebarOpen && (
        <div className="absolute left-2 right-2 top-full z-50 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/league/${league.id}`}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                league.id === leagueId
                  ? "text-[var(--accent-default)]"
                  : "text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-high)]"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              {league.name}
              {league.id === leagueId && <Check size={14} />}
            </Link>
          ))}
        </div>
      )}
    </>
  ) : (
    <span className="text-xs text-[var(--text-low)]">{leagueName}</span>
  )}
</div>
```

Add state and imports to Sidebar:
```tsx
import { useState } from "react";
import Image from "next/image";
// Add Check and ChevronDown to Lucide imports
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build --no-lint 2>&1 | tail -10`

**Step 4: Visual verification**

Run: `pnpm dev` and test:
- Single league user: no chevron, just league name text
- Multi-league user: chevron visible, click opens dropdown
- Dropdown shows all leagues with check on current
- Clicking other league navigates to it
- Click outside closes dropdown

**Step 5: Commit**

```
feat: league switcher dropdown in TopBar and Sidebar
```

---

## Final Verification

### Task 18: Full build + visual check

**Step 1: Run full build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`
Expected: Clean build, no errors

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No new lint errors

**Step 3: Update TODO file**

Mark all items as done in `docs/TODO_UI_POLISH.md` — or delete the file if all items are covered.

**Step 4: Final commit**

```
chore: mark UI polish tasks complete
```

---

## Task Dependency Graph

```
Task 1 (FormField) ──→ Tasks 9, 10, 11, 12
Task 2 (Switch)    ──→ Task 15
Task 3 (tokens)    ──→ independent
Task 4 (labels)    ──→ independent
Task 5 (TopBar)    ──→ Task 6, Task 17
Task 6 (SubTabs)   ──→ independent (after 5)
Task 7 (BottomNav) ──→ independent
Task 8 (Sidebar)   ──→ Task 17
Tasks 9-12 (Forms) ──→ independent (after 1)
Task 13 (Spacing)  ──→ independent
Task 14 (FormGaps) ──→ independent (after 1)
Task 15 (Policies) ──→ independent (after 2)
Tasks 16-17 (Switcher) ──→ after 5, 8
Task 18 (Final)    ──→ after all
```

**Parallelizable groups:**
- Group A: Tasks 1, 2, 3, 4 (all independent)
- Group B: Tasks 5+6, 7, 8 (navigation, after A)
- Group C: Tasks 9, 10, 11, 12 (forms, after Task 1)
- Group D: Tasks 13, 14, 15 (spacing + policies, after Tasks 1, 2)
- Group E: Tasks 16, 17 (switcher, after Group B)
- Group F: Task 18 (final, after all)
