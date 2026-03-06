# WattHunter Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Zinc/Inter/Solar/desktop-first UI with a dark-first, mobile-first design system using Radix Slate + Tailwind Cyan, Geist Sans, Lucide icons, and a responsive app shell with bottom nav.

**Architecture:** Incremental replacement — update foundation (tokens, fonts, icons), then rebuild the app shell (mobile bottom nav + desktop sidebar), then restyle all existing components and screens in place. No route changes needed — same Next.js 16 App Router structure.

**Tech Stack:** Next.js 16, Tailwind CSS v4 (CSS-first config), shadcn/ui, Supabase, Lucide React, Phosphor React, next-themes, Geist font

**Design doc:** `docs/plans/2026-03-06-redesign-design.md` (source of truth for all visual specs)

---

## Phase 1: Foundation (Tasks 1-4)

### Task 1: Install new dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install packages**

Run:
```bash
cd apps/web && pnpm add geist next-themes @phosphor-icons/react && pnpm remove @fontsource-variable/inter @iconify/react @iconify-json/solar
```

**Step 2: Verify install**

Run: `cd apps/web && pnpm ls geist next-themes @phosphor-icons/react lucide-react`
Expected: All 4 packages listed with versions

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml ../../pnpm-lock.yaml
git commit -m "deps: swap Inter/Solar for Geist/Phosphor, add next-themes"
```

---

### Task 2: Design tokens — replace globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

**Step 1: Read current globals.css**

Read: `apps/web/app/globals.css`

**Step 2: Replace with new design tokens**

Replace the entire file with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  /* Primitive tokens — Radix Slate Dark */
  --color-slate-1: #111113;
  --color-slate-2: #18191b;
  --color-slate-3: #212225;
  --color-slate-4: #272a2d;
  --color-slate-5: #2e3135;
  --color-slate-6: #363a3f;
  --color-slate-7: #43484e;
  --color-slate-9: #696e77;
  --color-slate-11: #b0b4ba;
  --color-slate-12: #edeef0;

  /* Primitive tokens — Tailwind Cyan */
  --color-cyan-400: #22d3ee;
  --color-cyan-500: #06b6d4;
  --color-cyan-600: #0891b2;
  --color-cyan-700: #0e7490;
  --color-cyan-800: #155e75;
  --color-cyan-950: #083344;

  /* Font families */
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  /* Border radius */
  --radius-sm: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
}

/* Semantic tokens (dark-first) */
:root {
  color-scheme: dark;

  /* Backgrounds */
  --bg-app: var(--color-slate-1);
  --bg-subtle: var(--color-slate-2);
  --bg-surface: var(--color-slate-3);
  --bg-surface-hover: var(--color-slate-4);
  --bg-surface-active: var(--color-slate-5);

  /* Borders */
  --border-subtle: var(--color-slate-3);
  --border-default: var(--color-slate-6);
  --border-hover: var(--color-slate-7);

  /* Text */
  --text-high: var(--color-slate-12);
  --text-mid: var(--color-slate-11);
  --text-low: var(--color-slate-9);
  --text-ghost: var(--color-slate-7);

  /* Accent */
  --accent-default: var(--color-cyan-500);
  --accent-highlight: var(--color-cyan-400);
  --accent-hover: var(--color-cyan-600);
  --accent-active: var(--color-cyan-700);
  --accent-focus-ring: oklch(0.78 0.15 195 / 0.4);

  /* Status */
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;

  /* Component tokens */
  --bid-active-bg: oklch(0.65 0.15 195 / 0.10);
  --bid-active-border: var(--accent-default);
  --bid-outbid-bg: oklch(0.5 0 0 / 0.08);
  --cta-text: #020617;
  --cta-shadow: 0 4px 24px oklch(0.65 0.15 195 / 0.25);

  /* shadcn/ui compat — map semantic tokens to shadcn variables */
  --background: var(--bg-app);
  --foreground: var(--text-high);
  --card: var(--bg-subtle);
  --card-foreground: var(--text-high);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-high);
  --primary: var(--accent-default);
  --primary-foreground: var(--cta-text);
  --secondary: var(--bg-surface);
  --secondary-foreground: var(--text-mid);
  --muted: var(--bg-subtle);
  --muted-foreground: var(--text-low);
  --accent: var(--bg-surface);
  --accent-foreground: var(--text-high);
  --destructive: var(--color-danger);
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--accent-focus-ring);
}

/* Base styles */
body {
  background-color: var(--bg-app);
  color: var(--text-high);
  font-family: var(--font-sans);
  overscroll-behavior-y: contain;
}

/* Smooth scrolling with reduced motion respect */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
```

**Step 3: Verify the app compiles**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`
Expected: Build succeeds (may have page errors from missing data — that's fine, no CSS errors)

**Step 4: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style: replace Zinc palette with Radix Slate + Tailwind Cyan design tokens"
```

---

### Task 3: Font setup — Geist Sans + Geist Mono

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Step 1: Read current layout**

Read: `apps/web/app/layout.tsx`

**Step 2: Replace font import and apply**

Replace the Inter import and font setup with Geist. The layout should become:

```tsx
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "WattHunter",
  description: "Fantasy cycling manager",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#111113",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`
Expected: Build succeeds, no font errors

**Step 4: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "style: switch to Geist Sans/Mono + add next-themes ThemeProvider"
```

---

### Task 4: Update shadcn components to use new tokens

**Files:**
- Modify: `apps/web/components/ui/button.tsx`
- Modify: `apps/web/components/ui/badge.tsx`
- Modify: `apps/web/components/ui/progress.tsx`
- Modify: `apps/web/components/ui/input.tsx`
- Modify: `apps/web/components/ui/tabs.tsx`

**Step 1: Read all 5 component files**

Read each file to understand current variant definitions.

**Step 2: Update button.tsx**

Replace the `brand` variant with `cta` variant:

```tsx
cta: "bg-gradient-to-br from-cyan-500 to-cyan-400 text-[var(--cta-text)] font-bold shadow-[var(--cta-shadow)] hover:from-cyan-600 hover:to-cyan-500 disabled:opacity-40 disabled:shadow-none",
```

Also update `secondary` variant:
```tsx
secondary: "border border-[var(--accent-default)] bg-transparent text-[var(--accent-default)] hover:bg-[var(--bg-surface)]",
```

And `ghost` variant:
```tsx
ghost: "text-[var(--text-mid)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]",
```

And `destructive` variant:
```tsx
destructive: "text-[var(--color-danger)] bg-transparent hover:bg-[var(--bg-surface)]",
```

**Step 3: Update badge.tsx**

Update variants to match design doc badges:
- `default` → bg-surface + text-mid + border
- `boost` → bg-surface + text-high (for +5% badges)
- `warning` → text-warning
- Remove unused variants

**Step 4: Update progress.tsx**

- Track: `bg-[var(--bg-surface)]`
- Fill: `bg-[var(--accent-default)]`
- Border radius: `rounded-sm` (4px)

**Step 5: Update input.tsx**

- Border: `border-[var(--border-default)]`
- Focus ring: `focus-visible:ring-[var(--accent-focus-ring)]`
- Placeholder: `placeholder:text-[var(--text-ghost)]`
- Background: `bg-[var(--bg-surface)]`

**Step 6: Update tabs.tsx**

- Ensure `line` variant uses `border-b-2 border-[var(--accent-default)]` for active
- Active text: `text-[var(--text-high)]`
- Inactive text: `text-[var(--text-mid)]`

**Step 7: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 8: Commit**

```bash
git add apps/web/components/ui/
git commit -m "style: update shadcn components to Radix Slate + Cyan tokens"
```

---

## Phase 2: App Shell & Navigation (Tasks 5-7)

### Task 5: Create BottomNav component (mobile)

**Files:**
- Create: `apps/web/components/bottom-nav.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, Users, BadgeEuro, Trophy, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface BottomNavProps {
  leagueId: string;
  unlockedTabs: ("home" | "team" | "budget" | "ranking")[];
}

const tabs = [
  { id: "home" as const, label: "Home", icon: House, href: "" },
  { id: "team" as const, label: "Team", icon: Users, href: "/team" },
  { id: "budget" as const, label: "Budget", icon: BadgeEuro, href: "/budget" },
  { id: "ranking" as const, label: "Ranking", icon: Trophy, href: "/ranking" },
];

export function BottomNav({ leagueId, unlockedTabs }: BottomNavProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY <= 0 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const basePath = `/league/${leagueId}`;

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-around px-4 pt-2">
        {tabs.map((tab) => {
          const href = `${basePath}${tab.href}`;
          const isActive = tab.id === "home"
            ? pathname === basePath
            : pathname.startsWith(href);
          const isLocked = !unlockedTabs.includes(tab.id);
          const Icon = tab.icon;

          if (isLocked) {
            return (
              <div
                key={tab.id}
                className="flex flex-col items-center gap-0.5 px-3 py-1 text-[var(--text-ghost)]"
              >
                <div className="relative">
                  <Icon size={20} />
                  <Lock size={8} className="absolute -right-1 -top-1" />
                </div>
                <span className="text-[9px] font-bold">{tab.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={tab.id}
              href={href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center gap-0.5 px-3 py-1 ${
                isActive
                  ? "text-[var(--accent-default)]"
                  : "text-[var(--text-low)]"
              }`}
            >
              <Icon size={20} />
              {isActive && (
                <div className="h-1 w-1 rounded-full bg-[var(--accent-default)]" />
              )}
              <span className="text-[9px] font-bold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add apps/web/components/bottom-nav.tsx
git commit -m "feat: add BottomNav component with hide-on-scroll + locked tabs"
```

---

### Task 6: Create TopBar component (mobile)

**Files:**
- Modify: `apps/web/components/topbar.tsx`

**Step 1: Read current topbar**

Read: `apps/web/components/topbar.tsx`

**Step 2: Rewrite TopBar**

Replace the current file with the new 32px mobile-first top bar:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

interface TopBarProps {
  leagueName: string;
  hasMultipleLeagues?: boolean;
  userAvatarUrl?: string | null;
  userInitials: string;
  settingsHref: string;
  onLeagueSwitch?: () => void;
}

export function TopBar({
  leagueName,
  hasMultipleLeagues = false,
  userAvatarUrl,
  userInitials,
  settingsHref,
  onLeagueSwitch,
}: TopBarProps) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY <= 0 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 flex h-8 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <button
        onClick={hasMultipleLeagues ? onLeagueSwitch : undefined}
        className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-high)]"
      >
        <Zap size={16} className="text-[var(--accent-highlight)]" />
        <span>WattHunter</span>
        <span className="text-[var(--text-low)]">{leagueName}</span>
        {hasMultipleLeagues && (
          <ChevronDown size={12} className="text-[var(--text-low)]" />
        )}
      </button>

      <Link href={settingsHref}>
        <Avatar className="h-6 w-6">
          <AvatarImage src={userAvatarUrl ?? undefined} />
          <AvatarFallback className="bg-[var(--bg-surface)] text-[9px] font-bold text-[var(--text-mid)]">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add apps/web/components/topbar.tsx
git commit -m "style: redesign TopBar — 32px, zap logo, league switcher, hide-on-scroll"
```

---

### Task 7: Rewrite Sidebar (desktop) + game layout

**Files:**
- Modify: `apps/web/components/sidebar.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

**Step 1: Read current files**

Read both files.

**Step 2: Rewrite sidebar.tsx**

Replace with desktop sidebar (220px, hidden on mobile):

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, Users, BadgeEuro, Trophy, Settings, Zap, Lock } from "lucide-react";

interface SidebarProps {
  leagueId: string;
  leagueName: string;
  unlockedTabs: ("home" | "team" | "budget" | "ranking")[];
}

const navItems = [
  { id: "home" as const, label: "Home", icon: House, href: "" },
  { id: "team" as const, label: "Team", icon: Users, href: "/team", children: [
    { label: "My Team", href: "/team" },
    { label: "Recruts", href: "/team/recruts" },
  ]},
  { id: "budget" as const, label: "Budget", icon: BadgeEuro, href: "/budget" },
  { id: "ranking" as const, label: "Ranking", icon: Trophy, href: "/ranking" },
];

export function Sidebar({ leagueId, leagueName, unlockedTabs }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/league/${leagueId}`;

  return (
    <aside className="hidden lg:flex lg:w-[220px] lg:flex-col lg:border-r lg:border-[var(--border-subtle)] lg:bg-[var(--bg-subtle)]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Zap size={20} className="text-[var(--accent-highlight)]" />
        <span className="text-sm font-bold text-[var(--text-high)]">WattHunter</span>
      </div>

      {/* League name */}
      <div className="px-4 pb-4">
        <span className="text-xs text-[var(--text-low)]">{leagueName}</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive = item.id === "home"
            ? pathname === basePath
            : pathname.startsWith(href);
          const isLocked = !unlockedTabs.includes(item.id);
          const Icon = item.icon;

          if (isLocked) {
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-ghost)]"
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <Lock size={10} className="ml-auto" />
              </div>
            );
          }

          return (
            <div key={item.id}>
              <Link
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--accent-default)]/10 text-[var(--accent-default)]"
                    : "text-[var(--text-mid)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
              {/* Sub-items for Team */}
              {isActive && item.children && (
                <div className="ml-8 mt-1 flex flex-col gap-0.5">
                  {item.children.map((child) => {
                    const childHref = `${basePath}${child.href}`;
                    const childActive = pathname === childHref;
                    return (
                      <Link
                        key={child.href}
                        href={childHref}
                        className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                          childActive
                            ? "text-[var(--accent-default)]"
                            : "text-[var(--text-low)] hover:text-[var(--text-mid)]"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-4">
        <Link
          href={`${basePath}/settings`}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-mid)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
```

**Step 3: Rewrite league layout**

Update `apps/web/app/(game)/league/[leagueId]/layout.tsx` to use both Sidebar (desktop) and BottomNav (mobile) + TopBar:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch league membership
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_name, role, leagues(name)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/onboarding");

  const leagueName = (membership.leagues as { name: string })?.name ?? "League";
  const userInitials = (membership.team_name ?? user.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  // Check how many leagues user is in
  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // TODO: determine unlocked tabs based on league state
  // For now, unlock all tabs
  const unlockedTabs: ("home" | "team" | "budget" | "ranking")[] = [
    "home", "team", "budget", "ranking",
  ];

  return (
    <div className="flex h-[100svh] overflow-hidden">
      <Sidebar
        leagueId={leagueId}
        leagueName={leagueName}
        unlockedTabs={unlockedTabs}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          leagueName={leagueName}
          hasMultipleLeagues={(count ?? 0) > 1}
          userAvatarUrl={user.user_metadata?.avatar_url}
          userInitials={userInitials}
          settingsHref={`/league/${leagueId}/settings`}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-20 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pb-8">
          {children}
        </main>
        <BottomNav leagueId={leagueId} unlockedTabs={unlockedTabs} />
      </div>
    </div>
  );
}
```

**Step 4: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add apps/web/components/sidebar.tsx apps/web/components/topbar.tsx apps/web/components/bottom-nav.tsx apps/web/app/(game)/league/*/layout.tsx
git commit -m "feat: responsive app shell — mobile bottom nav + desktop sidebar + TopBar"
```

---

## Phase 3: Core Components (Tasks 8-12)

### Task 8: Create RiderCard component

**Files:**
- Create: `apps/web/components/rider-card.tsx`

**Step 1: Create card-minimal rider card**

Build the unified rider card per design doc section 3.1-3.2. This replaces any existing rider row/table pattern:

```tsx
"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RiderCardProps {
  rider: {
    id: string;
    name: string;
    nationality_flag?: string;
    team_name?: string;
    pcs_rank?: number;
    photo_url?: string | null;
    specialty?: string;
  };
  /** XP display for roster riders */
  xp?: number;
  /** Active boost percentage */
  boostPct?: number;
  /** Bid state */
  bidState?: "active" | "outbid" | "not-accepted" | "none";
  /** Outbid message */
  outbidMessage?: string;
  /** Show as empty slot */
  isOpenSlot?: boolean;
  /** Link destination */
  href?: string;
  /** Right-side content override (e.g., bid input) */
  rightContent?: React.ReactNode;
}

export function RiderCard({
  rider,
  xp,
  boostPct,
  bidState = "none",
  outbidMessage,
  isOpenSlot = false,
  href,
  rightContent,
}: RiderCardProps) {
  if (isOpenSlot) {
    return (
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-0 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)]">
          <span className="text-[9px] font-bold text-[var(--text-ghost)]">+</span>
        </div>
        <span className="text-sm text-[var(--text-ghost)]">
          Open slot
        </span>
        <ChevronRight size={14} className="ml-auto text-[var(--text-ghost)]" />
      </div>
    );
  }

  const initials = rider.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isMuted = bidState === "outbid" || bidState === "not-accepted";

  const content = (
    <div
      className={`flex items-center gap-3 border-b border-[var(--border-subtle)] px-0 py-3 ${
        bidState === "active" ? "bg-[var(--bid-active-bg)]" : ""
      } ${isMuted ? "opacity-60" : ""}`}
    >
      {/* Avatar + PCS rank */}
      <div className="flex flex-col items-center gap-0.5">
        <Avatar className="h-9 w-9">
          <AvatarImage src={rider.photo_url ?? undefined} />
          <AvatarFallback className="bg-[var(--bg-surface)] text-[9px] font-bold text-[var(--text-mid)]">
            {initials}
          </AvatarFallback>
        </Avatar>
        {rider.pcs_rank && (
          <span className="text-[9px] font-bold text-[var(--text-mid)]">
            #{rider.pcs_rank}
          </span>
        )}
      </div>

      {/* Name + team */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--text-high)]">
            {rider.name}
          </span>
          {rider.nationality_flag && (
            <span className="text-xs">{rider.nationality_flag}</span>
          )}
          {boostPct && (
            <span className="rounded-lg bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-high)]">
              +{boostPct}%
            </span>
          )}
        </div>
        <span className="truncate text-xs text-[var(--text-mid)]">
          {rider.team_name}
        </span>
        {bidState === "outbid" && outbidMessage && (
          <span className="text-xs text-[var(--text-mid)]">{outbidMessage}</span>
        )}
      </div>

      {/* Right side */}
      {rightContent ?? (
        <div className="flex flex-col items-end gap-0.5">
          {xp !== undefined && (
            <>
              <span className="text-base font-bold text-[var(--text-high)]">
                {xp.toLocaleString()}
              </span>
              <span className="text-[9px] text-[var(--text-low)]">XP</span>
            </>
          )}
        </div>
      )}

      {href && (
        <ChevronRight size={14} className="text-[var(--text-ghost)]" />
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add apps/web/components/rider-card.tsx
git commit -m "feat: add RiderCard component — card-minimal with bid states"
```

---

### Task 9: Create MetricBox component

**Files:**
- Create: `apps/web/components/metric-box.tsx`

**Step 1: Create component**

```tsx
interface MetricBoxProps {
  value: string | number;
  label: string;
  highlight?: boolean;
}

export function MetricBox({ value, label, highlight = false }: MetricBoxProps) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <span
        className={`font-mono text-base font-bold ${
          highlight ? "text-[var(--accent-highlight)]" : "text-[var(--text-high)]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
        {label}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/metric-box.tsx
git commit -m "feat: add MetricBox component with Geist Mono values"
```

---

### Task 10: Create Pill/Chip component

**Files:**
- Create: `apps/web/components/pill.tsx`

**Step 1: Create unified pill component**

```tsx
"use client";

interface PillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Pill({ label, active = false, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[var(--text-high)] text-[var(--bg-app)]"
          : "border border-[var(--border-default)] text-[var(--text-mid)] hover:border-[var(--border-hover)]"
      }`}
    >
      {label}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/pill.tsx
git commit -m "feat: add Pill component — unified filter chip"
```

---

### Task 11: Create SegmentedControl component

**Files:**
- Create: `apps/web/components/segmented-control.tsx`

**Step 1: Create component**

```tsx
"use client";

interface SegmentedControlProps {
  segments: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({
  segments,
  activeIndex,
  onChange,
}: SegmentedControlProps) {
  return (
    <div className="flex rounded-lg bg-[var(--bg-app)] p-0.5">
      {segments.map((segment, i) => (
        <button
          key={segment}
          onClick={() => onChange(i)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            i === activeIndex
              ? "bg-[var(--bg-surface)] text-[var(--text-high)]"
              : "text-[var(--text-mid)]"
          }`}
        >
          {segment}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/segmented-control.tsx
git commit -m "feat: add SegmentedControl component"
```

---

### Task 12: Create SubTabs component (My Team / Recruts)

**Files:**
- Create: `apps/web/components/sub-tabs.tsx`

**Step 1: Create component with hide-on-scroll**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SubTabsProps {
  tabs: { label: string; href: string }[];
}

export function SubTabs({ tabs }: SubTabsProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY <= 0 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`sticky top-8 z-40 flex gap-6 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:top-0 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 pt-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-b-2 border-[var(--accent-default)] text-[var(--text-high)]"
                : "text-[var(--text-mid)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/sub-tabs.tsx
git commit -m "feat: add SubTabs component with hide-on-scroll"
```

---

## Phase 4: Screen Restyling (Tasks 13-18)

### Task 13: Restyle auth pages (Login, Signup, Onboarding)

**Files:**
- Modify: `apps/web/app/(auth)/layout.tsx`
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/app/(auth)/signup/page.tsx`
- Modify: `apps/web/app/(auth)/onboarding/page.tsx`
- Modify: `apps/web/app/(auth)/league/create/page.tsx`
- Modify: `apps/web/app/(auth)/league/join/page.tsx`

**Step 1: Read all auth page files**

Read each file to understand current structure and data flow.

**Step 2: Update auth layout**

- Background: `bg-[var(--bg-app)]`
- Center content: `flex min-h-[100svh] items-center justify-center px-4`

**Step 3: Restyle login/signup**

- Replace any Zinc/Inter-specific styles with new tokens
- Input fields: `bg-[var(--bg-surface)] border-[var(--border-default)]`
- CTA button: use new `cta` variant
- Links: `text-[var(--accent-default)]`
- Keep all Supabase auth logic intact

**Step 4: Restyle onboarding**

Per design doc section 4.1 (Welcome):
- Replace current 3-step cards with new design
- Feature cards: `bg-[var(--bg-app)]/80 backdrop-blur rounded-xl border-[var(--border-subtle)]`
- Zap logo icon in `--accent-highlight`
- CTA gradient button

**Step 5: Restyle league create/join**

Per design doc sections 4.2-4.3:
- Two tappable options: `bg-[var(--bg-surface)] rounded-xl border-[var(--border-default)]`
- Icons from Lucide: `plus` and `arrow-right`

**Step 6: Verify build**

Run: `cd apps/web && pnpm build 2>&1 | tail -20`

**Step 7: Commit**

```bash
git add apps/web/app/\(auth\)/
git commit -m "style: restyle auth pages with Radix Slate tokens"
```

---

### Task 14: Build Home/Lobby page

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/lobby-view.tsx`

**Step 1: Read current files**

Read both files.

**Step 2: Restyle lobby-view.tsx**

Per design doc section 4.4 (Home: Lobby):
- Invite link: read-only input + Copy button
- Player list: rows with avatar + team name + badge "Race Director"
- Round configuration section
- CTA "Launch first auction" gradient button
- All using new design tokens

**Step 3: Restyle dashboard page**

Per design doc section 4.5 (Home: Feed):
- Feed cards with `bg-[var(--bg-app)]/90 backdrop-blur rounded-xl`
- Upcoming races, last results, next level cards
- Contextual cards for auction state

**Step 4: Verify build + Commit**

```bash
git add apps/web/app/\(game\)/league/*/page.tsx apps/web/app/\(game\)/league/*/lobby-view.tsx
git commit -m "style: restyle Home/Lobby with new design tokens + feed cards"
```

---

### Task 15: Build My Team page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/team/layout.tsx`

**Step 1: Create team layout with SubTabs**

```tsx
import { SubTabs } from "@/components/sub-tabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return (
    <>
      <SubTabs
        tabs={[
          { label: "My Team", href: `/league/${leagueId}/team` },
          { label: "Recruts", href: `/league/${leagueId}/team/recruts` },
        ]}
      />
      {children}
    </>
  );
}
```

**Step 2: Create My Team page**

Per design doc section 4.6:
- Header: Total XP hero + Ranking link + boost pill + Policies link
- Roster section using `<RiderCard>` components
- Open slots
- Pending bids section (conditional on active round)
- Team level progress section

Fetch data from Supabase: `league_members`, `team_riders`, `riders` tables.

**Step 3: Verify build + Commit**

```bash
git add apps/web/app/\(game\)/league/*/team/
git commit -m "feat: add My Team page with rider roster + XP header"
```

---

### Task 16: Build Recruts page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/recruts/page.tsx`
- Create: `apps/web/components/sticky-bar.tsx`

**Step 1: Create StickyBar component**

The sticky bar appears only when bids are unsaved:

```tsx
"use client";

interface StickyBarProps {
  visible: boolean;
  slotInfo: string;
  budgetInfo: string;
  onSave: () => void;
  saving?: boolean;
}

export function StickyBar({ visible, slotInfo, budgetInfo, onSave, saving }: StickyBarProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(max(8px,env(safe-area-inset-bottom))+52px)] left-0 right-0 z-30 animate-slide-up border-t border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-2 lg:bottom-0">
      <div className="flex items-center justify-between lg:mx-auto lg:max-w-2xl">
        <span className="text-sm font-bold text-[var(--text-high)]">
          {slotInfo} &middot; {budgetInfo}
        </span>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 px-4 py-1.5 text-sm font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create Recruts page**

Per design doc section 4.7:
- Round header with countdown
- Search input
- Filter pills (All, Teams, Speciality, Nationality, Age) — horizontal scroll
- Rider list with inline bid inputs using `<RiderCard rightContent={<BidInput />}>`
- Accordion view for grouped filters
- StickyBar for unsaved bids
- Confirmation modal on leave

Fetch riders from Supabase `riders` table, filtered by team level pool access.

**Step 3: Verify build + Commit**

```bash
git add apps/web/components/sticky-bar.tsx apps/web/app/\(game\)/league/*/team/recruts/
git commit -m "feat: add Recruts page with filter pills + bid inputs + sticky bar"
```

---

### Task 17: Build Rider Detail page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx`

**Step 1: Create Rider Detail page**

Per design doc section 4.8:
- No bottom nav, no top bar — back arrow + origin screen name
- Hero: photo 56px + PCS rank badge + name + team + specialty/age pills
- 3 metric boxes using `<MetricBox>`
- Bid zone (if available rider during active round) or Roster zone (if in team)
- Segmented control: PCS Stats / Game Stats
- Tab content for each

Fetch from Supabase: `riders`, `rider_season_rankings`, `race_results`, `team_riders`

**Step 2: Create a back-header component for detail pages**

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackHeaderProps {
  label: string;
}

export function BackHeader({ label }: BackHeaderProps) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--text-mid)]"
    >
      <ArrowLeft size={18} />
      {label}
    </button>
  );
}
```

**Step 3: Verify build + Commit**

```bash
git add apps/web/components/back-header.tsx apps/web/app/\(game\)/league/*/rider/
git commit -m "feat: add Rider Detail page with PCS/Game stats tabs + bid zone"
```

---

### Task 18: Restyle auction pages

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/auction-client.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/rider-table.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/rider-dialog.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/treasury-widget.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/results/page.tsx`

**Step 1: Read all auction files**

Read each to understand current structure.

**Step 2: Restyle all auction components**

Apply new design tokens throughout:
- Replace all Zinc references with Slate tokens
- Replace `bg-wh-surface` with `bg-[var(--bg-surface)]`
- Replace `text-wh-accent` with `text-[var(--accent-default)]`
- Replace `bg-wh-accent-muted` with `bg-[var(--bid-active-bg)]`
- Update rider-table to use `<RiderCard>` component
- Update rider-dialog to use new token colors
- Update treasury-widget to use `<MetricBox>` pattern
- Replace Solar icons with Lucide icons

**Step 3: Verify build + Commit**

```bash
git add apps/web/app/\(game\)/league/*/auctions/
git commit -m "style: restyle auction pages with new design tokens + RiderCard"
```

---

## Phase 5: Secondary Screens (Tasks 19-22)

### Task 19: Build Policies page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/policies/page.tsx`

Per design doc section 4.9. Back arrow, bottom nav preserved. Policy slots with toggles, coverage indicators, locked slot placeholders.

**Commit:** `feat: add Policies page with toggle slots + timing banner`

---

### Task 20: Build Auction History page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/recruts/history/page.tsx`

Per design doc section 4.10. Back arrow, no bottom nav. Grouped by round, all bids visible, winners normal / losers muted.

**Commit:** `feat: add Auction History page grouped by round`

---

### Task 21: Build Levels page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/levels/page.tsx`

Per design doc section 4.11. Back arrow, no bottom nav. Hero with current level + XP progress. List of all 10 levels with done/current/locked states.

**Commit:** `feat: add Levels page with 10-level progression + XP bar`

---

### Task 22: Build Settings page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/settings/page.tsx`

Per design doc section 4.12. Back arrow, bottom nav preserved. Profile hero, league switcher (text + chevron), contextual league section, documentation links, sign out.

**Commit:** `feat: add Settings page with league switcher + profile`

---

## Phase 6: Final Polish (Tasks 23-25)

### Task 23: Add hide-on-scroll to main layout

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

Create a shared `useScrollDirection` hook and wire it to TopBar, SubTabs, and BottomNav consistently. Extract the duplicated scroll logic into:

**Create:** `apps/web/hooks/use-scroll-direction.ts`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollDirection() {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY <= 0 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return visible;
}
```

Then refactor TopBar, BottomNav, SubTabs to use this shared hook instead of duplicating the logic.

**Commit:** `refactor: extract useScrollDirection hook, deduplicate scroll logic`

---

### Task 24: Progressive tab unlocking

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

**Step 1: Implement unlock logic**

Replace the hardcoded `unlockedTabs` with actual logic based on league state:

```tsx
// Determine unlocked tabs
const unlockedTabs: ("home" | "team" | "budget" | "ranking")[] = ["home"];

// Check if first auction has been launched
const { data: auctions } = await supabase
  .from("auction_rounds")
  .select("id, status")
  .eq("league_id", leagueId)
  .limit(1);

if (auctions && auctions.length > 0) {
  unlockedTabs.push("team");

  // Check if any auction round is completed
  const hasCompleted = auctions.some((a) => a.status === "completed");
  if (hasCompleted) {
    unlockedTabs.push("budget", "ranking");
  }
}
```

**Commit:** `feat: progressive tab unlocking based on auction state`

---

### Task 25: Remove legacy Solar icon references

**Files:**
- Search all files for `@iconify` or `solar:` references
- Remove any remaining Solar icon imports
- Replace with Lucide equivalents

**Step 1: Find all references**

Run: `cd apps/web && grep -r "iconify\|solar:" --include="*.tsx" --include="*.ts" -l`

**Step 2: Replace each occurrence with Lucide icon**

Map Solar icons to Lucide:
- `solar:home-2` -> `House`
- `solar:bolt` -> `Zap`
- `solar:users-group` -> `Users`
- `solar:wallet` -> `BadgeEuro`
- `solar:chart-2` -> `Trophy`
- `solar:target` -> `Shield`
- `solar:handshake` -> `Handshake`
- `solar:settings` -> `Settings`

**Step 3: Verify no Solar references remain**

Run: `cd apps/web && grep -r "iconify\|solar:" --include="*.tsx" --include="*.ts"`
Expected: No matches

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace all Solar icons with Lucide"
```

---

## Task Dependency Graph

```
Task 1 (deps) ──→ Task 2 (tokens) ──→ Task 3 (fonts)
                                           │
                                           ▼
                                      Task 4 (shadcn)
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
              Task 5 (BottomNav)    Task 6 (TopBar)        Task 8 (RiderCard)
                    │                      │                      │
                    └──────────┬───────────┘               Task 9 (MetricBox)
                               ▼                           Task 10 (Pill)
                         Task 7 (Layout)                   Task 11 (Segmented)
                               │                           Task 12 (SubTabs)
                               ▼                                  │
                    ┌──────────┼──────────┐                       │
                    ▼          ▼          ▼                       ▼
              Task 13     Task 14    Task 15 ◄────────────────────┘
              (auth)      (home)     (team)
                                       │
                                       ▼
                                  Task 16 (recruts)
                                       │
                                       ▼
                              Task 17 (rider detail)
                                       │
                                       ▼
                              Task 18 (auctions)
                                       │
                    ┌──────────┬───────┼───────┬──────────┐
                    ▼          ▼       ▼       ▼          ▼
              Task 19     Task 20  Task 21  Task 22   Task 23
              (policies)  (history) (levels) (settings) (scroll hook)
                                                          │
                                                          ▼
                                                     Task 24 (unlock)
                                                          │
                                                          ▼
                                                     Task 25 (cleanup)
```

## Verification Checklist

After all tasks:
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] No `@iconify` or `solar:` references remain
- [ ] No `Inter` font references remain
- [ ] No `bg-wh-surface` or `text-wh-accent` references remain
- [ ] All pages render in dark mode at 390px mobile viewport
- [ ] Bottom nav visible on mobile, sidebar on desktop
- [ ] Touch targets >= 44px on all interactive elements
