# Phase 0 + Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the WattHunter design system (Zinc dark-first, accent #34F6F2, 8px grid, Solar Icons, layout shell) then implement Auth, Onboarding, and League CRUD (REQ-001 to REQ-005).

**Architecture:** Next.js 16 App Router with route groups: `(auth)` for login/onboarding (no sidebar), `(game)` for all in-app pages (sidebar + topbar). Supabase Auth with `@supabase/ssr` for server-side session management. Server Actions for mutations (create league, join league, launch auction). Middleware protects `(game)` routes.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, Shadcn UI (customized), Supabase (Auth + Postgres), @iconify/react + @iconify-json/solar, Inter font

**Design doc:** `docs/plans/2026-02-21-design-system-and-phase1-design.md`

---

## Phase 0: Design System

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install Solar Icons via Iconify + Inter font**

Run from repo root:
```bash
cd apps/web && pnpm add @iconify/react @iconify-json/solar @fontsource-variable/inter
```

**Step 2: Verify installation**

Run: `ls apps/web/node_modules/@iconify/react && ls apps/web/node_modules/@iconify-json/solar`
Expected: directories exist

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore: add solar icons, iconify, inter font"
```

---

### Task 2: Configure theme — globals.css

**Files:**
- Modify: `apps/web/app/globals.css`

Replace the entire file with the WattHunter theme. Key changes:
- Zinc scale for neutrals (dark-first: `html` gets `class="dark"` by default)
- `#34F6F2` accent color (oklch ~`0.9 0.148 192`)
- Accent-muted as `accent` at 15% opacity
- `--radius: 0.375rem` (6px = `rounded-md`)
- Keep Shadcn variable names for compatibility
- Remove Geist font references, use Inter

**Step 1: Replace globals.css**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 6px);
  --radius-2xl: calc(var(--radius) + 10px);
  --radius-3xl: calc(var(--radius) + 14px);
  --radius-4xl: calc(var(--radius) + 18px);
  --color-wh-accent: var(--wh-accent);
  --color-wh-accent-muted: var(--wh-accent-muted);
  --color-wh-surface: var(--wh-surface);
}

/* ============================
   LIGHT MODE (secondary)
   ============================ */
:root {
  --radius: 0.375rem;
  /* Zinc 50 / 950 */
  --background: #fafafa;
  --foreground: #09090b;
  /* Surface */
  --wh-surface: #ffffff;
  /* Cards & Popovers */
  --card: #ffffff;
  --card-foreground: #09090b;
  --popover: #ffffff;
  --popover-foreground: #09090b;
  /* Primary = Zinc 900 on light */
  --primary: #18181b;
  --primary-foreground: #fafafa;
  /* Secondary = Zinc 100 */
  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;
  /* Muted = Zinc 100 */
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  /* Accent = teal #34F6F2 */
  --accent: #34F6F2;
  --accent-foreground: #09090b;
  --wh-accent: #34F6F2;
  --wh-accent-muted: rgba(52, 246, 242, 0.15);
  /* Destructive */
  --destructive: #ef4444;
  /* Borders = Zinc 200 */
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #34F6F2;
  /* Charts */
  --chart-1: #34F6F2;
  --chart-2: #06b6d4;
  --chart-3: #0ea5e9;
  --chart-4: #8b5cf6;
  --chart-5: #f59e0b;
  /* Sidebar (light) */
  --sidebar: #ffffff;
  --sidebar-foreground: #09090b;
  --sidebar-primary: #18181b;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #f4f4f5;
  --sidebar-accent-foreground: #18181b;
  --sidebar-border: #e4e4e7;
  --sidebar-ring: #34F6F2;
}

/* ============================
   DARK MODE (primary)
   ============================ */
.dark {
  /* Zinc 950 */
  --background: #09090b;
  --foreground: #fafafa;
  /* Surface = Zinc 900 */
  --wh-surface: #18181b;
  /* Cards & Popovers = Zinc 900 */
  --card: #18181b;
  --card-foreground: #fafafa;
  --popover: #18181b;
  --popover-foreground: #fafafa;
  /* Primary = Zinc 50 on dark */
  --primary: #fafafa;
  --primary-foreground: #09090b;
  /* Secondary = Zinc 800 */
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  /* Muted = Zinc 800 */
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  /* Accent stays bright */
  --accent: #34F6F2;
  --accent-foreground: #09090b;
  --wh-accent: #34F6F2;
  --wh-accent-muted: rgba(52, 246, 242, 0.15);
  /* Destructive */
  --destructive: #f87171;
  /* Borders = Zinc 800 */
  --border: #27272a;
  --input: #27272a;
  --ring: #34F6F2;
  /* Charts */
  --chart-1: #34F6F2;
  --chart-2: #06b6d4;
  --chart-3: #0ea5e9;
  --chart-4: #8b5cf6;
  --chart-5: #f59e0b;
  /* Sidebar (dark) */
  --sidebar: #18181b;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #34F6F2;
  --sidebar-primary-foreground: #09090b;
  --sidebar-accent: #27272a;
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: #27272a;
  --sidebar-ring: #34F6F2;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style: configure Zinc dark-first theme with #34F6F2 accent"
```

---

### Task 3: Switch to Inter font + dark class default

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Step 1: Update layout.tsx**

Replace entire file:

```tsx
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "WattHunter",
  description: "Le fantasy game du cyclisme professionnel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

Key changes:
- Remove Geist fonts, import Inter via `@fontsource-variable/inter`
- `className="dark"` on `<html>` for dark-first
- `lang="fr"` since this is a French app
- Updated metadata title/description

**Step 2: Verify dev server**

Run: `cd apps/web && pnpm dev`
Expected: Page loads with dark background (#09090b), Inter font

**Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "style: switch to Inter font, dark mode default, update metadata"
```

---

### Task 4: Customize Badge — rounded-md instead of rounded-full

**Files:**
- Modify: `apps/web/components/ui/badge.tsx`

**Step 1: Update badge base class**

In `badge.tsx`, change `rounded-full` to `rounded-md` in the `cva()` base string (line 8).

**Step 2: Commit**

```bash
git add apps/web/components/ui/badge.tsx
git commit -m "style: badge uses rounded-md per design system"
```

---

### Task 5: Add brand variant to Button

**Files:**
- Modify: `apps/web/components/ui/button.tsx`

**Step 1: Add brand variant**

In the `variant` object inside `buttonVariants` cva, add after the `link` variant:

```ts
brand:
  "bg-wh-accent text-wh-accent-foreground font-semibold hover:bg-wh-accent/90 shadow-sm shadow-wh-accent/25",
```

Note: `wh-accent-foreground` doesn't exist yet as a Tailwind color. We use `text-accent-foreground` which maps to `--accent-foreground` (dark text on bright accent). So actually:

```ts
brand:
  "bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-sm shadow-accent/25",
```

**Step 2: Commit**

```bash
git add apps/web/components/ui/button.tsx
git commit -m "feat: add brand button variant for primary CTAs"
```

---

### Task 6: Customize Progress bar

**Files:**
- Modify: `apps/web/components/ui/progress.tsx`

**Step 1: Update Progress track and indicator**

Change the track from `bg-primary/20` to `bg-muted` and indicator from `bg-primary` to `bg-accent`. Change height from `h-2` to `h-1` (4px per design). Remove `rounded-full`, use `rounded-sm`.

In `progress.tsx` line 17, replace:
```
"bg-primary/20 relative h-2 w-full overflow-hidden rounded-full"
```
with:
```
"bg-muted relative h-1 w-full overflow-hidden rounded-sm"
```

In line 24, replace:
```
"bg-primary h-full w-full flex-1 transition-all"
```
with:
```
"bg-accent h-full w-full flex-1 transition-all"
```

**Step 2: Commit**

```bash
git add apps/web/components/ui/progress.tsx
git commit -m "style: progress bar uses accent color, 4px height"
```

---

### Task 7: Create Supabase client helpers

**Files:**
- Create: `apps/web/lib/supabase/browser.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/middleware.ts`

**Step 1: Create browser client**

`apps/web/lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

`apps/web/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

**Step 3: Create middleware helper**

`apps/web/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users trying to access game routes
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/join") &&
    request.nextUrl.pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

**Step 4: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/web/lib/supabase/
git commit -m "feat: add Supabase client helpers (browser, server, middleware)"
```

---

### Task 8: Create Next.js middleware

**Files:**
- Create: `apps/web/middleware.ts`

**Step 1: Create middleware**

`apps/web/middleware.ts`:
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: add auth middleware to protect game routes"
```

---

### Task 9: Create layout shell components — Sidebar

**Files:**
- Create: `apps/web/components/sidebar.tsx`

**Step 1: Create Sidebar component**

`apps/web/components/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

function getNavItems(leagueId: string): NavItem[] {
  return [
    { label: "Tableau de bord", href: `/league/${leagueId}`, icon: "solar:home-2-linear" },
    { label: "Encheres", href: `/league/${leagueId}/auctions`, icon: "solar:bolt-linear" },
    { label: "Mon equipe", href: `/league/${leagueId}/team`, icon: "solar:users-group-rounded-linear" },
    { label: "Tresorerie", href: `/league/${leagueId}/treasury`, icon: "solar:wallet-linear" },
    { label: "Classement", href: `/league/${leagueId}/standings`, icon: "solar:chart-2-linear" },
    { label: "Politiques", href: `/league/${leagueId}/policies`, icon: "solar:target-linear" },
    { label: "Sponsors", href: `/league/${leagueId}/sponsors`, icon: "solar:handshake-linear" },
  ];
}

export function Sidebar({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const navItems = getNavItems(leagueId);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-wh-surface">
      {/* Logo */}
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold text-foreground">WattHunter</span>
      </div>

      <div className="border-b border-border" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === `/league/${leagueId}`
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-wh-accent-muted text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon icon={item.icon} className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-b border-border" />

      {/* Bottom section */}
      <div className="p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon icon="solar:settings-linear" className="size-4 shrink-0" />
          Parametres
        </Link>
      </div>
    </aside>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: create Sidebar component with Solar Icons navigation"
```

---

### Task 10: Create layout shell — TopBar

**Files:**
- Create: `apps/web/components/topbar.tsx`

**Step 1: Create TopBar component**

`apps/web/components/topbar.tsx`:
```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TopBarProps {
  title: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
}

export function TopBar({ title, userDisplayName, userAvatarUrl }: TopBarProps) {
  const initials = userDisplayName
    ? userDisplayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-8">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
      <Avatar className="size-8">
        {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userDisplayName ?? ""} />}
        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/topbar.tsx
git commit -m "feat: create TopBar component with avatar"
```

---

### Task 11: Create game layout with Sidebar + TopBar

**Files:**
- Create: `apps/web/app/(game)/layout.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

**Step 1: Create game route group layout**

`apps/web/app/(game)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
```

**Step 2: Create league-specific layout with Sidebar + TopBar**

`apps/web/app/(game)/league/[leagueId]/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile + league name
  const [{ data: profile }, { data: league }] = await Promise.all([
    supabase.from("users").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("leagues").select("name").eq("id", leagueId).single(),
  ]);

  if (!league) {
    redirect("/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar leagueId={leagueId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={league.name}
          userDisplayName={profile?.display_name}
          userAvatarUrl={profile?.avatar_url ?? undefined}
        />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
```

**Step 3: Create placeholder dashboard page**

Create `apps/web/app/(game)/league/[leagueId]/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Tableau de bord</h2>
      <p className="mt-2 text-sm text-muted-foreground">Bienvenue dans votre ligue.</p>
    </div>
  );
}
```

**Step 4: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/web/app/\(game\)/
git commit -m "feat: create game layout shell with sidebar + topbar"
```

---

### Task 12: Create auth route group + login page

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`

**Step 1: Create auth layout (no sidebar, centered)**

`apps/web/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
```

**Step 2: Create login page**

`apps/web/app/(auth)/login/page.tsx`:
```tsx
"use client";

import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold text-foreground">WattHunter</h1>
        <p className="text-sm text-muted-foreground">
          Le fantasy game du cyclisme professionnel
        </p>
      </div>

      {/* Login button */}
      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={handleGoogleLogin}
      >
        <Icon icon="solar:letter-linear" className="size-4" />
        Continuer avec Google
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        En continuant, vous acceptez nos conditions d&apos;utilisation.
      </p>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/
git commit -m "feat: create login page with Google OAuth"
```

---

### Task 13: Create auth callback route

**Files:**
- Create: `apps/web/app/auth/callback/route.ts`

**Step 1: Create OAuth callback handler**

`apps/web/app/auth/callback/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user profile already exists
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Upsert user profile
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, has_onboarded")
          .eq("id", user.id)
          .single();

        if (!existingUser) {
          // First login — create profile
          await supabase.from("users").insert({
            id: user.id,
            display_name:
              user.user_metadata?.full_name ??
              user.email?.split("@")[0] ??
              "Joueur",
            avatar_url: user.user_metadata?.avatar_url ?? null,
          });
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        if (!existingUser.has_onboarded) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        // Returning user — go to next or home
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

**Step 2: Commit**

```bash
git add apps/web/app/auth/
git commit -m "feat: add OAuth callback route with user profile upsert"
```

---

### Task 14: Add has_onboarded column to users table

**Files:**
- Create: `supabase/migrations/20260222000000_add_has_onboarded.sql`

**Step 1: Create migration**

```sql
-- Add has_onboarded flag to users table
alter table public.users add column has_onboarded boolean not null default false;
```

**Step 2: Push migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260222000000_add_has_onboarded.sql
git commit -m "feat: add has_onboarded column to users table"
```

---

### Task 15: Update home page to redirect

**Files:**
- Modify: `apps/web/app/page.tsx`

**Step 1: Replace home page with auth redirect logic**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has a league
  const { data: membership } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership) {
    redirect(`/league/${membership.league_id}`);
  }

  // No league yet — go to onboarding or league creation
  redirect("/onboarding");
}
```

**Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: home page redirects based on auth and league state"
```

---

## Phase 1b: Onboarding

---

### Task 16: Create onboarding flow

**Files:**
- Create: `apps/web/app/(auth)/onboarding/page.tsx`

**Step 1: Create onboarding page**

`apps/web/app/(auth)/onboarding/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

const steps = [
  {
    icon: "solar:cycling-linear",
    title: "Bienvenue sur WattHunter",
    description:
      "Le premier fantasy game base sur le cyclisme professionnel. Construisez votre equipe, suivez les courses reelles et grimpez au classement.",
  },
  {
    icon: "solar:gamepad-linear",
    title: "Comment ca marche ?",
    description:
      "Recrutez des coureurs aux encheres, gagnez des points grace a leurs performances reelles, et montez en niveau pour debloquer de nouveaux avantages.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const handleComplete = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ has_onboarded: true })
        .eq("id", user.id);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
    setStep(steps.length); // Go to final step
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete().then(() => setStep(steps.length));
    }
  };

  // Final step — create or join
  if (step >= steps.length) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon
            icon="solar:users-group-rounded-linear"
            className="size-12 text-accent"
          />
          <h2 className="text-xl font-semibold text-foreground">
            Rejoignez une ligue
          </h2>
          <p className="text-sm text-muted-foreground">
            Creez votre propre ligue ou rejoignez-en une avec un code
            d&apos;invitation.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            variant="brand"
            className="w-full"
            onClick={() => router.push("/league/create")}
          >
            Creer une ligue
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/league/join")}
          >
            Rejoindre avec un code
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = steps[step];

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8">
      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-8 rounded-sm transition-colors ${
              i <= step ? "bg-accent" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon
          icon={currentStep.icon}
          className="size-12 text-accent"
        />
        <h2 className="text-xl font-semibold text-foreground">
          {currentStep.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {currentStep.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-3">
        <Button variant="brand" className="w-full" onClick={handleNext}>
          Suivant
        </Button>
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={handleSkip}
        >
          Passer
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/onboarding/
git commit -m "feat: create 3-step onboarding flow (REQ-002)"
```

---

## Phase 1c: League CRUD

---

### Task 17: Create league — server action + page

**Files:**
- Create: `apps/web/app/(auth)/league/create/page.tsx`
- Create: `apps/web/app/(auth)/league/create/actions.ts`

**Step 1: Create the server action**

`apps/web/app/(auth)/league/create/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode(): string {
  // 6 chars, alphanumeric, excluding 0/O, 1/I/l
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLeague(formData: FormData) {
  const name = formData.get("name") as string;
  const maxPlayers = Number(formData.get("maxPlayers"));

  if (!name || name.trim().length < 2) {
    return { error: "Le nom de la ligue doit contenir au moins 2 caracteres." };
  }
  if (maxPlayers < 6 || maxPlayers > 12) {
    return { error: "Le nombre de joueurs doit etre entre 6 et 12." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  // Generate unique invite code (retry if collision)
  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  // Create league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: name.trim(),
      invite_code: inviteCode,
      commissioner_id: user.id,
      max_players: maxPlayers,
    })
    .select("id")
    .single();

  if (leagueError || !league) {
    return { error: "Erreur lors de la creation de la ligue." };
  }

  // Create team for commissioner
  const { data: team } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: `Equipe de ${user.user_metadata?.full_name ?? "Commissioner"}`,
    })
    .select("id")
    .single();

  // Add commissioner as league member
  await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team?.id ?? null,
  });

  redirect(`/league/${league.id}`);
}
```

**Step 2: Create the page**

`apps/web/app/(auth)/league/create/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { createLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateLeaguePage() {
  const [state, formAction, pending] = useActionState(createLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Creer une ligue
        </h2>
        <p className="text-sm text-muted-foreground">
          Invitez vos amis avec le code genere apres creation.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Nom de la ligue
          </label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: Les Forçats de la Route"
            required
            minLength={2}
            maxLength={50}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="maxPlayers"
            className="text-sm font-medium text-foreground"
          >
            Nombre de joueurs
          </label>
          <select
            id="maxPlayers"
            name="maxPlayers"
            defaultValue="8"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {[6, 7, 8, 9, 10, 11, 12].map((n) => (
              <option key={n} value={n}>
                {n} joueurs
              </option>
            ))}
          </select>
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Creation..." : "Creer la ligue"}
        </Button>
      </form>
    </div>
  );
}
```

**Step 3: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/league/create/
git commit -m "feat: create league page with server action (REQ-003)"
```

---

### Task 18: Join league — server action + page

**Files:**
- Create: `apps/web/app/(auth)/league/join/page.tsx`
- Create: `apps/web/app/(auth)/league/join/actions.ts`

**Step 1: Create server action**

`apps/web/app/(auth)/league/join/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinLeague(formData: FormData) {
  const code = (formData.get("code") as string)?.toUpperCase().trim();

  if (!code || code.length !== 6) {
    return { error: "Le code doit contenir exactement 6 caracteres." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  // Find league by code
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, status, max_players")
    .eq("invite_code", code)
    .single();

  if (!league) {
    return { error: "Code invalide. Verifiez aupres du commissaire de la ligue." };
  }

  if (league.status === "active") {
    return { error: "Cette ligue a deja demarre. Impossible de la rejoindre." };
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    redirect(`/league/${league.id}`);
  }

  // Check capacity
  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (count !== null && count >= league.max_players) {
    return { error: "Cette ligue est pleine." };
  }

  // Create team
  const { data: team } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: `Equipe de ${user.user_metadata?.full_name ?? "Joueur"}`,
    })
    .select("id")
    .single();

  // Join league
  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team?.id ?? null,
  });

  if (joinError) {
    return { error: "Erreur lors de l'inscription a la ligue." };
  }

  redirect(`/league/${league.id}`);
}
```

**Step 2: Create page**

`apps/web/app/(auth)/league/join/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { joinLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinLeaguePage() {
  const [state, formAction, pending] = useActionState(joinLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Rejoindre une ligue
        </h2>
        <p className="text-sm text-muted-foreground">
          Entrez le code a 6 caracteres fourni par le commissaire.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            Code d&apos;invitation
          </label>
          <Input
            id="code"
            name="code"
            placeholder="Ex: A3K7WN"
            required
            maxLength={6}
            className="text-center text-lg tracking-widest uppercase"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Verification..." : "Rejoindre"}
        </Button>
      </form>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/league/join/
git commit -m "feat: join league page with code validation (REQ-004)"
```

---

### Task 19: League lobby page (pre-game)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`
- Create: `apps/web/app/(game)/league/[leagueId]/actions.ts`

**Step 1: Create server action for launching first auction**

`apps/web/app/(game)/league/[leagueId]/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function launchFirstAuction(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  // Verify commissioner
  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, status")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Seul le commissaire peut lancer la premiere enchere." };
  }

  if (league.status !== "pending") {
    return { error: "La ligue a deja demarre." };
  }

  // Check minimum 4 players
  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);

  if (count === null || count < 4) {
    return { error: "Il faut au moins 4 joueurs pour lancer la ligue." };
  }

  const now = new Date();
  const closesAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +72h

  // Create first auction
  const { error: auctionError } = await supabase.from("auctions").insert({
    league_id: leagueId,
    name: `Pre-Saison ${now.getFullYear()}`,
    status: "open",
    opens_at: now.toISOString(),
    closes_at: closesAt.toISOString(),
  });

  if (auctionError) {
    return { error: "Erreur lors de la creation de l'enchere." };
  }

  // Update league status to active
  await supabase
    .from("leagues")
    .update({ status: "active" })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}
```

**Step 2: Replace dashboard page with lobby/dashboard logic**

`apps/web/app/(game)/league/[leagueId]/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { LobbyView } from "./lobby-view";

export default async function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: league }, { data: members }, { count: memberCount }] =
    await Promise.all([
      supabase
        .from("leagues")
        .select("id, name, invite_code, commissioner_id, status, max_players")
        .eq("id", leagueId)
        .single(),
      supabase
        .from("league_members")
        .select("user_id, users(display_name, avatar_url)")
        .eq("league_id", leagueId),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

  if (!league || !user) {
    return <p className="text-muted-foreground">Ligue introuvable.</p>;
  }

  const isCommissioner = league.commissioner_id === user.id;
  const isPending = league.status === "pending";

  // If league is pending, show lobby
  if (isPending) {
    return (
      <LobbyView
        league={league}
        members={members ?? []}
        memberCount={memberCount ?? 0}
        isCommissioner={isCommissioner}
      />
    );
  }

  // Active league — dashboard (placeholder for now)
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Tableau de bord</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        La ligue est active. Les encheres et le classement arrivent bientot.
      </p>
    </div>
  );
}
```

**Step 3: Create LobbyView client component**

`apps/web/app/(game)/league/[leagueId]/lobby-view.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";
import { launchFirstAuction } from "./actions";

interface LobbyViewProps {
  league: {
    id: string;
    name: string;
    invite_code: string;
    commissioner_id: string;
    max_players: number;
  };
  members: Array<{
    user_id: string;
    users: { display_name: string; avatar_url: string | null } | null;
  }>;
  memberCount: number;
  isCommissioner: boolean;
}

export function LobbyView({
  league,
  members,
  memberCount,
  isCommissioner,
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canLaunch = memberCount >= 4;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(league.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    const result = await launchFirstAuction(league.id);
    if (result?.error) {
      setError(result.error);
      setLaunching(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            {league.name}
          </h2>
          <Badge variant="secondary">En attente</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {memberCount}/{league.max_players} joueurs
        </p>
      </div>

      <div className="my-6 border-b border-border" />

      {/* Invite code */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">
          Code d&apos;invitation
        </p>
        <div className="flex items-center gap-3">
          <code className="rounded-md bg-muted px-4 py-2 text-lg font-semibold tracking-widest text-foreground">
            {league.invite_code}
          </code>
          <Button variant="ghost" size="sm" onClick={handleCopyCode}>
            <Icon
              icon={copied ? "solar:check-circle-linear" : "solar:copy-linear"}
              className="size-4"
            />
            {copied ? "Copie" : "Copier"}
          </Button>
        </div>
      </div>

      <div className="my-6 border-b border-border" />

      {/* Members list */}
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-foreground">Joueurs</p>
        <div className="flex flex-col">
          {members.map((member) => {
            const name =
              member.users?.display_name ?? "Joueur";
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <Avatar className="size-8">
                  {member.users?.avatar_url && (
                    <AvatarImage
                      src={member.users.avatar_url}
                      alt={name}
                    />
                  )}
                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">{name}</span>
                {member.user_id === league.commissioner_id && (
                  <Badge variant="outline" className="ml-auto">
                    Commissaire
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Commissioner launch button */}
      {isCommissioner && (
        <>
          <div className="my-6 border-b border-border" />
          <div className="flex flex-col gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="brand"
              className="w-full"
              disabled={!canLaunch || launching}
              onClick={handleLaunch}
            >
              {launching
                ? "Lancement..."
                : canLaunch
                  ? "Lancer la premiere enchere"
                  : `En attente (${memberCount}/4 joueurs minimum)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 4: Verify typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/
git commit -m "feat: league lobby with member list + commissioner launch (REQ-005)"
```

---

### Task 20: Verify build + final commit

**Step 1: Full typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors

**Step 2: Full build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds

**Step 3: Manual smoke test**

Run: `cd apps/web && pnpm dev`
Verify:
- `/login` shows dark background, Inter font, Google button
- Color accent `#34F6F2` is visible on focus rings
- Layout is clean, no Geist font artifacts

---

## Summary

| Task | Description | Files created/modified |
|------|-------------|----------------------|
| 1 | Install Solar Icons + Inter | `package.json` |
| 2 | Configure Zinc + accent theme | `globals.css` |
| 3 | Switch to Inter font, dark default | `layout.tsx` |
| 4 | Badge rounded-md | `badge.tsx` |
| 5 | Button brand variant | `button.tsx` |
| 6 | Progress bar accent | `progress.tsx` |
| 7 | Supabase client helpers | `lib/supabase/*` (3 files) |
| 8 | Next.js middleware | `middleware.ts` |
| 9 | Sidebar component | `components/sidebar.tsx` |
| 10 | TopBar component | `components/topbar.tsx` |
| 11 | Game layout shell | `app/(game)/*` layouts |
| 12 | Login page | `app/(auth)/login/page.tsx` |
| 13 | Auth callback | `app/auth/callback/route.ts` |
| 14 | has_onboarded migration | `migrations/20260222*.sql` |
| 15 | Home page redirect | `app/page.tsx` |
| 16 | Onboarding flow | `app/(auth)/onboarding/page.tsx` |
| 17 | Create league | `app/(auth)/league/create/*` |
| 18 | Join league | `app/(auth)/league/join/*` |
| 19 | League lobby | `app/(game)/league/[leagueId]/*` |
| 20 | Final verification | — |
