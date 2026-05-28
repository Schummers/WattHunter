# Lobby Redesign (Chantier D) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-shell pending-league lobby with a dedicated, tab-based setup interface at `/lobby/[leagueId]` covering invite + members + level/pool config + rules, with separate UI chrome from the active-league game shell.

**Architecture:** New `(lobby)` route group with its own minimal layout (no sidebar / bottom-nav / detail rail). The existing `(game)/league/[leagueId]/page.tsx` server-redirects to `/lobby/[id]` when the league is pending; the new lobby layout server-redirects back to `/league/[id]` when active. The lobby page is a single server component that prefetches league/members/riders and hands data to a client `lobby-panels.tsx` Tab component (Radix Tabs, line variant). Mutations go through two new SECURITY DEFINER RPCs (`set_starting_level`, `launch_first_auction`) so server actions stay as thin Zod-validated `supabase.rpc(...)` wrappers (project rule).

**Tech Stack:** Next.js 16 App Router (server components + server actions), Radix Tabs, Tailwind v4 with WattHunter Design System v3 tokens, Supabase (Postgres + RLS + SECURITY DEFINER RPCs), Zod v4, Vitest + jsdom + React Testing Library.

**Source spec:** `docs/archive/specs/2026-05-12-try-before-signup-design.md` §6 (Chantier D — Lobby Redesign).
**Design system:** `docs/watthunter-design-system-v3.md` — Tokens-only (no hex, no px). Components limited to existing patterns: Underline Tabs (`ui/tabs.tsx` line variant), Filter Chips (`segmented-control.tsx`), Tags (`pill.tsx` / `ui/badge.tsx`). Radius: 6 px = interactive, 20 px = decorative. Geist Mono for all numbers.

**Out of scope (do not touch):**
- The `(game)/league/[leagueId]/layout.tsx` shell (sidebar / topbar / bottom nav / rail).
- Chantier A (landing page) and Chantier B (demo mode).
- `docs/archive/specs/...` movement (Chantier D is part of the same spec — leave the spec where it is).
- Rules-tab help content (links into the existing `/league/[id]/help` page, no rewriting).

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260528000000_rpc_launch_first_auction.sql` | RPC: compute 3 auto-scheduled rounds + flip league to `active`. Replaces TS-side date logic. |
| `supabase/migrations/20260528000001_rpc_set_starting_level.sql` | RPC: commissioner updates `leagues.starting_level` (1–8) while league is pending. |
| `apps/web/app/(lobby)/lobby/[leagueId]/layout.tsx` | Lobby chrome: auth gate, email-confirmation banner, max-width container, page header (league name + Pending badge). Server-redirects to `/league/[id]` when status ≠ pending. |
| `apps/web/app/(lobby)/lobby/[leagueId]/loading.tsx` | Skeleton matching the lobby header. |
| `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx` | Server component: fetches league + members + member count + rider pool (all riders #1–#600), passes everything to `<LobbyPanels>`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx` | Client Tabs container (Underline Tabs / line variant), 3 panels. Owns selected-level state for Tab 2. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/invite-section.tsx` | Client. Invite link + invite code with copy buttons + helper text. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/player-list.tsx` | Server-friendly presentational. Avatars + team names + Race Director badge + X/max count. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/auction-explainer.tsx` | Card explaining the 3-round sealed-bid system + `Learn more` link to `/league/[id]/help`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/launch-button.tsx` | Client. Commissioner-only CTA → calls `launchFirstAuction`. Non-commissioner branch renders the waiting copy. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/game-loop-explainer.tsx` | One-paragraph copy block (XP → level → sponsors/strategies → money). |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-selector.tsx` | Client. Horizontal 1–8 pills, REC badge, cyan selected state, commissioner-edit / non-commissioner-readonly. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-stats-cards.tsx` | 3 cards (Rider Slots / Sponsor Income/phase / Strategies) updating with level. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/rider-pool-list.tsx` | Client. Receives full rider list; filters by `poolMin` of selected level. Rows link to `/league/[id]/rider/[riderId]`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/rules-tab.tsx` | Section list linking into existing `/league/[id]/help`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/actions.ts` | Server actions: `setStartingLevel` → `supabase.rpc("set_starting_level", ...)`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/actions.test.ts` | Vitest unit tests for `setStartingLevel`. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/level-selector.test.tsx` | RTL test: REC badge on default level, click only fires when commissioner. |
| `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/launch-button.test.tsx` | RTL test: commissioner sees button, non-commissioner sees waiting copy. |

**Modified:**

| File | Change |
|---|---|
| `apps/web/app/(game)/league/[leagueId]/page.tsx` | Replace the `if (isPending) return <LobbyView ... />` branch with a server `redirect('/lobby/[leagueId]')`. |
| `apps/web/app/(game)/league/[leagueId]/actions.ts` | Rewrite `launchFirstAuction(leagueId)` (drop `roundDates` param) → thin Zod + `supabase.rpc("launch_first_auction", ...)` wrapper. Delete `getDefaultDates` / `getParisOffset` helpers. |
| `apps/web/app/(game)/league/[leagueId]/audit.test.ts` | Keep — no changes needed. (Listed for completeness if greppable references break.) |

**Deleted:**

| File | Reason |
|---|---|
| `apps/web/app/(game)/league/[leagueId]/lobby-view.tsx` | Replaced by `(lobby)/lobby/[leagueId]/` tree. |

**Final commit:** `docs/ARCHITECTURE.md` updated with the new route group and RPCs.

---

## Conventions Recap (enforce in every task)

- **Tokens only** — never hardcode: typography uses `text-[length:var(--type-*)]`, colors use semantic tokens (`--text-high`, `--text-mid`, `--text-low`, `--bg-app`, `--bg-surface`, `--accent-default`, `--accent-label`, `--accent-highlight`, `--badge-bg`, `--border-subtle`, `--border-default`, `--status-danger`). Numbers in `font-mono` (Geist Mono inherited from `font-mono` Tailwind utility).
- **Radius**: `rounded-[var(--radius-md)]` for interactive (buttons, list rows, inputs); `rounded-[var(--radius-pill)]` for badges/tags; `rounded-[var(--radius-lg)]` for cards/containers.
- **Patterns**: Underline Tabs only via `ui/tabs.tsx` with `<TabsList variant="line">`. Pills/badges via `ui/badge.tsx`. No custom tab/segment components.
- **Server actions**: pattern is `Zod parse → supabase.rpc(...) → forward error`. No DB writes / business logic inline.
- **Migrations** required for every schema/RPC change. After authoring: `supabase db push --linked` then commit the SQL file.
- **Language**: all UI strings in English.
- **Commits**: conventional (`feat(lobby):`, `refactor(lobby):`, `test(lobby):`, `chore(lobby):`, `docs(lobby):`).
- **When in doubt about a design token or pattern** → stop, re-read `docs/watthunter-design-system-v3.md`, ask the user.

---

## Task 1: Lobby route group scaffold + bidirectional redirect

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/layout.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/loading.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx` (empty stub for now)
- Modify: `apps/web/app/(game)/league/[leagueId]/page.tsx`

- [ ] **Step 1: Add the redirect guard at the top of `(game)/league/[leagueId]/page.tsx`**

Replace the existing `if (isPending) { … return <LobbyView /> }` block with a single redirect. Open `apps/web/app/(game)/league/[leagueId]/page.tsx`:

- Add `import { redirect } from "next/navigation";` to the top (it isn't imported yet).
- Remove the `import { LobbyView } from "./lobby-view";` line.
- Replace the entire block:
  ```ts
  if (isPending) {
    const normalizedMembers = (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
      teams: Array.isArray(m.teams) ? m.teams[0] ?? null : (m.teams as { name: string } | null) ?? null,
    }));

    return (
      <LobbyView
        league={league}
        members={normalizedMembers}
        memberCount={memberCount ?? 0}
        isCommissioner={isCommissioner}
      />
    );
  }
  ```
  with:
  ```ts
  if (isPending) {
    redirect(`/lobby/${leagueId}`);
  }
  ```
- Remove the now-unused fetch for `members` and `memberCount` from the destructured `Promise.all` block — the active-league page never needed them. Trim the destructuring to:
  ```ts
  const [{ data: league }] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, invite_code, commissioner_id, status, max_players")
      .eq("id", leagueId)
      .single(),
  ]);
  ```
  and remove `members`/`memberCount` references further down (they are only used inside the deleted block).

- [ ] **Step 2: Create the lobby layout**

Create `apps/web/app/(lobby)/lobby/[leagueId]/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { EmailConfirmationBanner } from "@/components/email-confirmation-banner";
import { Badge } from "@/components/ui/badge";

export default async function LobbyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: membership }, { data: league }] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("leagues")
      .select("id, name, status")
      .eq("id", leagueId)
      .single(),
  ]);

  if (!league) {
    redirect("/league/choose");
  }

  if (!membership) {
    redirect("/league/choose");
  }

  if (league.status !== "pending") {
    redirect(`/league/${leagueId}`);
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--bg-app)]">
      <EmailConfirmationBanner
        email={user.email ?? null}
        isConfirmed={!!user.email_confirmed_at}
      />
      <header className="border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <h1 className="truncate text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
            {league.name}
          </h1>
          <Badge variant="highlighted">Pending</Badge>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create a placeholder lobby page so the route resolves**

Create `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx`:

```tsx
export default async function LobbyPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  await params;
  return (
    <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
      Loading lobby…
    </p>
  );
}
```

(Real content lands in Task 2.)

- [ ] **Step 4: Create the loading skeleton**

Create `apps/web/app/(lobby)/lobby/[leagueId]/loading.tsx`:

```tsx
export default function LobbyLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-1/2 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-surface)]" />
      <div className="h-32 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-surface)]" />
      <div className="h-32 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-surface)]" />
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (no TS errors in apps/web).

- [ ] **Step 6: Smoke-test in dev**

```bash
pnpm dev
```

Manually verify (only because there is no end-to-end test for routing in this repo):
- Visiting `/league/<pending-league-id>` returns a 307 redirect to `/lobby/<id>` and shows the layout header.
- Visiting `/lobby/<active-league-id>` returns a 307 redirect to `/league/<id>` and shows the game shell.

Stop the dev server when verified.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/page.tsx \
        apps/web/app/\(lobby\)
git commit -m "feat(lobby): scaffold dedicated lobby route group with bidirectional redirect"
```

---

## Task 2: Page data fetch + Tabs container (Underline Tabs)

**Files:**
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Replace the placeholder page with the real server fetch**

Open `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx` and replace its contents with:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { getDefaultStartingLevel } from "@/lib/levels";
import { LobbyPanels } from "./lobby-panels";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const user = await getUser();
  if (!user) redirect("/login");

  const [
    { data: league },
    { data: rawMembers },
    { data: riders },
  ] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, invite_code, commissioner_id, max_players, starting_level")
      .eq("id", leagueId)
      .single(),
    supabase
      .from("league_members")
      .select("user_id, users(display_name, avatar_url), teams:team_id(name)")
      .eq("league_id", leagueId),
    supabase
      .from("riders")
      .select("id, full_name, pcs_rank, pcs_points_1yr")
      .eq("ever_in_pool", true)
      .gte("pcs_rank", 1)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true }),
  ]);

  if (!league) {
    return (
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        League not found.
      </p>
    );
  }

  const isCommissioner = league.commissioner_id === user.id;

  const members = (rawMembers ?? []).map((m) => ({
    user_id: m.user_id as string,
    users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
    teams: Array.isArray(m.teams)
      ? m.teams[0] ?? null
      : (m.teams as { name: string } | null) ?? null,
  }));

  const recommendedLevel = getDefaultStartingLevel();

  return (
    <LobbyPanels
      league={{
        id: league.id,
        name: league.name,
        invite_code: league.invite_code,
        commissioner_id: league.commissioner_id,
        max_players: league.max_players,
        starting_level: league.starting_level,
      }}
      members={members}
      memberCount={rawMembers?.length ?? 0}
      recommendedLevel={recommendedLevel}
      isCommissioner={isCommissioner}
      riders={(riders ?? []).map((r) => ({
        id: r.id as string,
        full_name: r.full_name as string,
        pcs_rank: r.pcs_rank as number,
        pcs_points_1yr: (r.pcs_points_1yr as number | null) ?? 0,
      }))}
    />
  );
}
```

- [ ] **Step 2: Create the client tabs container**

Create `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface LobbyLeague {
  id: string;
  name: string;
  invite_code: string;
  commissioner_id: string;
  max_players: number;
  starting_level: number;
}

export interface LobbyMember {
  user_id: string;
  users: { display_name: string; avatar_url: string | null } | null;
  teams: { name: string } | null;
}

export interface LobbyRider {
  id: string;
  full_name: string;
  pcs_rank: number;
  pcs_points_1yr: number;
}

export interface LobbyPanelsProps {
  league: LobbyLeague;
  members: LobbyMember[];
  memberCount: number;
  recommendedLevel: number;
  isCommissioner: boolean;
  riders: LobbyRider[];
}

export function LobbyPanels({
  league,
  members,
  memberCount,
  recommendedLevel,
  isCommissioner,
  riders,
}: LobbyPanelsProps) {
  const [selectedLevel, setSelectedLevel] = useState<number>(league.starting_level);

  return (
    <Tabs defaultValue="lobby" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="lobby">Lobby</TabsTrigger>
        <TabsTrigger value="pool">Level &amp; Pool</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
      </TabsList>

      <TabsContent value="lobby" className="space-y-6 pt-2">
        {/* Task 3-6 populate this panel */}
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {memberCount}/{league.max_players} players · code{" "}
          <span className="font-mono text-[var(--text-high)]">{league.invite_code}</span>
        </p>
      </TabsContent>

      <TabsContent value="pool" className="space-y-6 pt-2">
        {/* Task 7-10 populate this panel */}
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Level {selectedLevel} (recommended: {recommendedLevel}) · {riders.length} riders
          in pool
        </p>
      </TabsContent>

      <TabsContent value="rules" className="space-y-6 pt-2">
        {/* Task 11 populates this panel */}
      </TabsContent>
    </Tabs>
  );
}
```

The unused values (`members`, `isCommissioner`, `setSelectedLevel`) get wired in the next tasks; reference them so TS does not complain:

- Append `void members; void isCommissioner; void setSelectedLevel;` immediately above the `return` statement.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Run dev and verify the tabs render**

```bash
pnpm dev
```

Visit `/lobby/<pending-league-id>`. Three Underline Tabs visible (Lobby / Level & Pool / Rules); switching them swaps the small text. Stop dev when done.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/page.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): server-fetch league/members/riders and render 3-tab shell"
```

---

## Task 3: Tab 1 — Invite section component

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/invite-section.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Create the invite section**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/invite-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface InviteSectionProps {
  inviteCode: string;
}

export function InviteSection({ inviteCode }: InviteSectionProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/league/join?code=${inviteCode}`
      : `/league/join?code=${inviteCode}`;

  async function copy(value: string, setter: (v: boolean) => void) {
    await navigator.clipboard.writeText(value);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Invite players
      </h2>
      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        Share the link or code. Anyone with it can join the league.
      </p>

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={inviteUrl}
          aria-label="Invite link"
          className="flex-1 truncate text-[length:var(--type-body)] text-[var(--text-mid)]"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Copy invite link"
          onClick={() => copy(inviteUrl, setCopiedLink)}
        >
          {copiedLink ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={inviteCode}
          aria-label="Invite code"
          className="flex-1 text-center font-mono text-[length:var(--type-section)] font-semibold tracking-widest text-[var(--text-high)]"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Copy invite code"
          onClick={() => copy(inviteCode, setCopiedCode)}
        >
          {copiedCode ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire it into the Lobby panel**

Open `lobby-panels.tsx`. At the top, add:

```tsx
import { InviteSection } from "./_components/invite-section";
```

Replace the contents of the `<TabsContent value="lobby" …>` panel with:

```tsx
<TabsContent value="lobby" className="space-y-6 pt-2">
  <InviteSection inviteCode={league.invite_code} />
</TabsContent>
```

Drop the no-longer-needed `void members;` from Step 2 of Task 2 (still keep `void isCommissioner; void setSelectedLevel;` until later tasks consume them).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Smoke-test in dev**

```bash
pnpm dev
```

Open the Lobby tab on a pending league. Verify:
- Two rows: invite link + invite code.
- Clicking either Copy button briefly swaps the icon to a check.
- Inputs are read-only (cannot be edited).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/invite-section.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): invite section with copy link + code"
```

---

## Task 4: Tab 1 — Player list

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/player-list.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/player-list.tsx`:

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { LobbyMember } from "../lobby-panels";

export interface PlayerListProps {
  members: LobbyMember[];
  memberCount: number;
  maxPlayers: number;
  commissionerId: string;
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerList({
  members,
  memberCount,
  maxPlayers,
  commissionerId,
}: PlayerListProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Players
        </h2>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
          {memberCount}/{maxPlayers}
        </span>
      </header>

      <ul className="flex flex-col">
        {members.map((member) => {
          const name =
            member.teams?.name ?? member.users?.display_name ?? "Player";
          return (
            <li
              key={member.user_id}
              className="flex items-center gap-3 py-2.5"
            >
              <Avatar className="size-8">
                {member.users?.avatar_url ? (
                  <AvatarImage src={member.users.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback className="bg-[var(--bg-surface)] text-[length:var(--type-caption)] text-[var(--text-mid)]">
                  {initialsFor(name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[length:var(--type-body)] text-[var(--text-high)]">
                {name}
              </span>
              {member.user_id === commissionerId ? (
                <Badge variant="default" className="ml-auto">
                  Race Director
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Wire into Lobby panel**

In `lobby-panels.tsx`, add the import:

```tsx
import { PlayerList } from "./_components/player-list";
```

Append inside the Lobby panel:

```tsx
<PlayerList
  members={members}
  memberCount={memberCount}
  maxPlayers={league.max_players}
  commissionerId={league.commissioner_id}
/>
```

Remove `void members;` from the panel (now consumed).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Dev smoke test**

```bash
pnpm dev
```

Verify on `/lobby/<id>`:
- Players list shows team names (falls back to display_name if no team).
- Race Director badge appears next to the commissioner.
- Count `X/Y` in mono on the right.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/player-list.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): player list with Race Director badge and X/max count"
```

---

## Task 5: Tab 1 — Auction explainer card

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/auction-explainer.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/auction-explainer.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface AuctionExplainerProps {
  leagueId: string;
}

export function AuctionExplainer({ leagueId }: AuctionExplainerProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
    >
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        How the first auction works
      </h2>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Three sealed-bid rounds, one per day. Each round auto-closes after its
        deadline and the next one opens automatically. Bids are revealed only
        after a round closes — your strategy stays private until then.
      </p>
      <Link
        href={`/league/${leagueId}/help`}
        className="inline-flex w-fit items-center gap-1 text-[length:var(--type-body)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
      >
        Learn more
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Wire into Lobby panel**

In `lobby-panels.tsx`:

```tsx
import { AuctionExplainer } from "./_components/auction-explainer";
```

Add inside the Lobby panel after `<PlayerList />`:

```tsx
<AuctionExplainer leagueId={league.id} />
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/auction-explainer.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): auction explainer card with Learn more link"
```

---

## Task 6: Tab 1 — Launch button + `launch_first_auction` RPC

**Files:**
- Create: `supabase/migrations/20260528000000_rpc_launch_first_auction.sql`
- Modify: `apps/web/app/(game)/league/[leagueId]/actions.ts`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/launch-button.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/launch-button.test.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Author the RPC migration**

Create `supabase/migrations/20260528000000_rpc_launch_first_auction.sql`:

```sql
-- RPC launch_first_auction: atomic 3-round auction creation with auto-scheduled dates.
-- Replaces the TS server action that computed dates client-side.
-- Round 1 opens immediately, rounds 2-3 are 'scheduled' and open as the previous closes.
-- Per-round window: 24h, evaluated in Europe/Paris time zone.

CREATE OR REPLACE FUNCTION public.launch_first_auction(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_league      record;
  v_today_paris date;
  v_open_1      timestamptz;
  v_open_2      timestamptz;
  v_open_3      timestamptz;
  v_close_3     timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT id, commissioner_id, status
    INTO v_league
    FROM public.leagues
   WHERE id = p_league_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_not_found');
  END IF;

  IF v_league.commissioner_id <> v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_commissioner');
  END IF;

  IF v_league.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  -- Compute schedule in Europe/Paris.
  v_today_paris := (now() AT TIME ZONE 'Europe/Paris')::date;

  v_open_1 := (v_today_paris::timestamp AT TIME ZONE 'Europe/Paris');
  v_open_2 := ((v_today_paris + INTERVAL '1 day')::timestamp AT TIME ZONE 'Europe/Paris');
  v_open_3 := ((v_today_paris + INTERVAL '2 day')::timestamp AT TIME ZONE 'Europe/Paris');
  v_close_3 := ((v_today_paris + INTERVAL '3 day')::timestamp AT TIME ZONE 'Europe/Paris') - INTERVAL '1 second';

  INSERT INTO public.auctions (league_id, name, status, opens_at, closes_at)
  VALUES
    (p_league_id, 'Round 1', 'open',      v_open_1, v_open_2),
    (p_league_id, 'Round 2', 'scheduled', v_open_2, v_open_3),
    (p_league_id, 'Round 3', 'scheduled', v_open_3, v_close_3);

  UPDATE public.leagues
     SET status = 'active'
   WHERE id = p_league_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_first_auction(uuid) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push --linked
```

Expected: the new migration is applied (no errors).

- [ ] **Step 3: Refactor the TS server action to call the RPC**

Open `apps/web/app/(game)/league/[leagueId]/actions.ts` and replace the entire file with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const LaunchSchema = z.object({
  leagueId: z.uuid(),
});

export async function launchFirstAuction(leagueId: string) {
  const parsed = LaunchSchema.safeParse({ leagueId });
  if (!parsed.success) {
    return { error: "Invalid league id." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("launch_first_auction", {
    p_league_id: parsed.data.leagueId,
  });

  if (error) {
    return { error: "Failed to launch the auction." };
  }

  const payload = data as { ok: boolean; error?: string } | null;
  if (!payload?.ok) {
    switch (payload?.error) {
      case "unauthenticated":
        return { error: "Not authenticated." };
      case "not_commissioner":
        return { error: "Only the Race Director can launch the first auction." };
      case "already_started":
        return { error: "The league has already started." };
      case "league_not_found":
        return { error: "League not found." };
      default:
        return { error: "Failed to launch the auction." };
    }
  }

  revalidatePath(`/league/${parsed.data.leagueId}`);
  redirect(`/league/${parsed.data.leagueId}`);
}
```

- [ ] **Step 4: Create the launch button component**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/launch-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { launchFirstAuction } from "@/app/(game)/league/[leagueId]/actions";

export interface LaunchButtonProps {
  leagueId: string;
  isCommissioner: boolean;
  memberCount: number;
}

export function LaunchButton({
  leagueId,
  isCommissioner,
  memberCount,
}: LaunchButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isCommissioner) {
    return (
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Waiting for the Race Director to start the auction.
      </p>
    );
  }

  const canLaunch = memberCount >= 1;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await launchFirstAuction(leagueId);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="cta"
        className="w-full"
        disabled={!canLaunch || pending}
        onClick={handleClick}
      >
        {pending ? "Launching…" : "Launch first auction"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Wire into Lobby panel + pass `isCommissioner`**

In `lobby-panels.tsx`:

```tsx
import { LaunchButton } from "./_components/launch-button";
```

Append at the bottom of the Lobby panel:

```tsx
<LaunchButton
  leagueId={league.id}
  isCommissioner={isCommissioner}
  memberCount={memberCount}
/>
```

Remove `void isCommissioner;` from the panel (now consumed).

- [ ] **Step 6: Write the launch button RTL test**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/launch-button.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaunchButton } from "../launch-button";

vi.mock("@/app/(game)/league/[leagueId]/actions", () => ({
  launchFirstAuction: vi.fn(async () => ({ success: true })),
}));

describe("LaunchButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the waiting copy for non-commissioners", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner={false}
        memberCount={3}
      />
    );
    expect(
      screen.getByText("Waiting for the Race Director to start the auction.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Launch/ })).toBeNull();
  });

  it("renders the launch button for the commissioner", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner
        memberCount={3}
      />
    );
    const btn = screen.getByRole("button", { name: /Launch first auction/ });
    expect(btn).toBeEnabled();
  });

  it("disables the button when no members have joined", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner
        memberCount={0}
      />
    );
    expect(
      screen.getByRole("button", { name: /Launch first auction/ })
    ).toBeDisabled();
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @watthunter/web test launch-button
```

Expected: 3 tests pass.

- [ ] **Step 8: Search the repo for callers of the old `launchFirstAuction(id, dates)` signature**

```bash
rg "launchFirstAuction\(" apps/web --type ts --type tsx
```

Expected: only the new `LaunchButton` and the action file itself reference it. If `lobby-view.tsx` still does, leave it — it will be deleted in Task 13.

- [ ] **Step 9: Typecheck + smoke-test in dev**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>`:
- Commissioner sees the cyan CTA button at the bottom of the Lobby tab.
- Clicking it triggers the RPC; upon success, the action redirects to `/league/<id>` and the user lands on the active game shell.
- Non-commissioner sees only "Waiting for the Race Director to start the auction."

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260528000000_rpc_launch_first_auction.sql \
        apps/web/app/\(game\)/league/\[leagueId\]/actions.ts \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/launch-button.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/__tests__/launch-button.test.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): launch button + launch_first_auction RPC (auto-scheduled rounds)"
```

---

## Task 7: Tab 2 — Game loop explainer + Level selector

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/game-loop-explainer.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-selector.tsx`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/level-selector.test.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Create the game loop explainer**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/game-loop-explainer.tsx`:

```tsx
export function GameLoopExplainer() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        The game loop
      </h2>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Riders race → your team earns <strong className="text-[var(--text-high)]">XP</strong>{" "}
        → XP unlocks the next <strong className="text-[var(--text-high)]">Level</strong>{" "}
        → each level grants more rider slots, better sponsors, and new strategy types.
        Sponsors top up your <strong className="text-[var(--text-high)]">Treasury</strong>{" "}
        once per WT phase. Treasury funds your bids at the next auction. Picking the
        right starting level shapes the whole season.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Create the level selector**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-selector.tsx`:

```tsx
"use client";

import { LEVELS } from "@/lib/levels";

export interface LevelSelectorProps {
  selected: number;
  recommended: number;
  isCommissioner: boolean;
  onSelect: (level: number) => void;
}

export function LevelSelector({
  selected,
  recommended,
  isCommissioner,
  onSelect,
}: LevelSelectorProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Starting level
      </h2>
      <div
        role="radiogroup"
        aria-label="Starting level"
        className="flex flex-wrap gap-2"
      >
        {LEVELS.map((lvl) => {
          const isSelected = lvl.level === selected;
          const isRecommended = lvl.level === recommended;
          return (
            <button
              key={lvl.level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Level ${lvl.level}${isRecommended ? " (recommended)" : ""}`}
              disabled={!isCommissioner}
              onClick={() => isCommissioner && onSelect(lvl.level)}
              className={[
                "relative inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border px-3 font-mono text-[length:var(--type-body)] font-semibold transition-colors",
                isSelected
                  ? "border-[var(--accent-default)] bg-[var(--badge-bg)] text-[var(--accent-label)]"
                  : "border-[var(--border-default)] text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-high)]",
                !isCommissioner && !isSelected ? "opacity-60" : "",
                "disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {lvl.level}
              {isRecommended ? (
                <span className="ml-2 rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-1.5 py-px text-[length:var(--type-micro)] font-bold uppercase text-[var(--accent-label)]">
                  Rec
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!isCommissioner ? (
        <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Only the Race Director can change the starting level.
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Create the RTL test**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/__tests__/level-selector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelSelector } from "../level-selector";

describe("LevelSelector", () => {
  it("renders 8 levels with REC badge on the recommended one", () => {
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(
      screen.getByRole("radio", { name: "Level 3 (recommended)" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("calls onSelect when a commissioner clicks a different level", () => {
    const onSelect = vi.fn();
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Level 5/ }));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it("does not fire onSelect for non-commissioners and disables the buttons", () => {
    const onSelect = vi.fn();
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner={false}
        onSelect={onSelect}
      />
    );
    const level5 = screen.getByRole("radio", { name: /Level 5/ });
    expect(level5).toBeDisabled();
    fireEvent.click(level5);
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByText("Only the Race Director can change the starting level.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Wire game-loop explainer + level selector into the Pool panel**

In `lobby-panels.tsx`:

```tsx
import { GameLoopExplainer } from "./_components/game-loop-explainer";
import { LevelSelector } from "./_components/level-selector";
```

Replace the contents of `<TabsContent value="pool" …>` with:

```tsx
<TabsContent value="pool" className="space-y-6 pt-2">
  <GameLoopExplainer />
  <LevelSelector
    selected={selectedLevel}
    recommended={recommendedLevel}
    isCommissioner={isCommissioner}
    onSelect={setSelectedLevel}
  />
</TabsContent>
```

Remove `void setSelectedLevel;` (now consumed).

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @watthunter/web test level-selector
```

Expected: 3 tests pass.

- [ ] **Step 6: Typecheck + smoke-test**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>` → Level & Pool tab:
- 8 pills, REC badge on the level returned by `getDefaultStartingLevel()`.
- Commissioner clicks switch selection; non-commissioner cannot click (cursor disabled).

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/game-loop-explainer.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/level-selector.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/__tests__/level-selector.test.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): game loop explainer + 1-8 level selector with REC badge"
```

---

## Task 8: Tab 2 — Stats cards

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-stats-cards.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Resolve sponsor income from level data**

The `LEVELS[i].sponsor` field is a free-form display string (e.g., `"Lotto · 250K"`, `"T4 · 750K (×4)"`, `null`). The stats card must show a monthly-budget number derived from this string. Define a small helper in the component file (no need for a shared util — this is the only consumer):

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/level-stats-cards.tsx`:

```tsx
import { getLevelByNumber } from "@/lib/levels";

export interface LevelStatsCardsProps {
  level: number;
}

/**
 * Extracts the lead sponsor budget shown in the lobby preview.
 * Pulled from the `sponsor` display string in `lib/levels.ts` (e.g. "Lotto · 250K").
 * Returns null when the level has no sponsor unlock.
 */
function previewSponsorBudget(displaySponsor: string | null): string | null {
  if (!displaySponsor) return null;
  const match = displaySponsor.match(/(\d+(?:\.\d+)?)\s*([KMB])/i);
  if (!match) return null;
  const [, amount, suffix] = match;
  return `€${amount}${suffix.toUpperCase()}`;
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
        {label}
      </span>
      <span className="font-mono text-[length:var(--type-stat)] font-bold text-[var(--text-high)]">
        {value}
      </span>
      {hint ? (
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function LevelStatsCards({ level }: LevelStatsCardsProps) {
  const data = getLevelByNumber(level);
  const budget = previewSponsorBudget(data.sponsor);

  return (
    <section className="grid grid-cols-3 gap-3">
      <StatCard label="Rider slots" value={String(data.slots)} />
      <StatCard
        label="Sponsor / phase"
        value={budget ?? "—"}
        hint={budget ? undefined : "Unlocks higher up"}
      />
      <StatCard
        label="Strategies"
        value={`${data.maxActive} active`}
        hint={data.strategy ? `New: ${data.strategy}` : undefined}
      />
    </section>
  );
}
```

- [ ] **Step 2: Wire into the Pool panel**

In `lobby-panels.tsx`:

```tsx
import { LevelStatsCards } from "./_components/level-stats-cards";
```

Insert into the Pool panel, after `<LevelSelector />`:

```tsx
<LevelStatsCards level={selectedLevel} />
```

- [ ] **Step 3: Typecheck + smoke-test**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>` → Level & Pool: three cards update when the commissioner changes the selected level.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/level-stats-cards.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): level stats cards (slots, sponsor, strategies)"
```

---

## Task 9: Tab 2 — Rider pool list

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/rider-pool-list.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Create the rider pool list**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/rider-pool-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getLevelByNumber } from "@/lib/levels";
import type { LobbyRider } from "../lobby-panels";

export interface RiderPoolListProps {
  leagueId: string;
  level: number;
  riders: LobbyRider[];
}

export function RiderPoolList({ leagueId, level, riders }: RiderPoolListProps) {
  const { poolMin } = getLevelByNumber(level);
  const visible = useMemo(
    () => riders.filter((r) => r.pcs_rank >= poolMin && r.pcs_rank <= 600),
    [riders, poolMin]
  );

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Rider pool
        </h2>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
          #{poolMin}–#600 · {visible.length} riders
        </span>
      </header>
      <ul className="flex max-h-[60svh] flex-col overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {visible.map((rider) => (
          <li key={rider.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <Link
              href={`/league/${leagueId}/rider/${rider.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)]"
            >
              <span className="w-10 shrink-0 font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
                #{rider.pcs_rank}
              </span>
              <span className="flex-1 truncate text-[length:var(--type-body)] text-[var(--text-high)]">
                {rider.full_name}
              </span>
              <span className="shrink-0 font-mono text-[length:var(--type-caption)] text-[var(--text-mid)]">
                {rider.pcs_points_1yr.toLocaleString("en-US")} pts
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Wire into the Pool panel**

In `lobby-panels.tsx`:

```tsx
import { RiderPoolList } from "./_components/rider-pool-list";
```

Append at the end of the Pool panel:

```tsx
<RiderPoolList
  leagueId={league.id}
  level={selectedLevel}
  riders={riders}
/>
```

- [ ] **Step 3: Typecheck + smoke-test**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>` → Level & Pool:
- List shows riders for the selected level; #-rank in mono on the left, name centre, points (mono) on the right.
- Switching from Level 4 to Level 1 reduces the list (level 1 cuts to #300+).
- Clicking a row navigates to `/league/<id>/rider/<rider-id>`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/rider-pool-list.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): rider pool list filtered by selected level"
```

---

## Task 10: Tab 2 — Persist starting level via `set_starting_level` RPC

**Files:**
- Create: `supabase/migrations/20260528000001_rpc_set_starting_level.sql`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/actions.ts`
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/actions.test.ts`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Author the migration**

Create `supabase/migrations/20260528000001_rpc_set_starting_level.sql`:

```sql
-- RPC set_starting_level: commissioner-only update of leagues.starting_level (1..8).
-- Only allowed while the league is still in 'pending' status.

CREATE OR REPLACE FUNCTION public.set_starting_level(
  p_league_id uuid,
  p_level     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league  record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_level IS NULL OR p_level < 1 OR p_level > 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_level');
  END IF;

  SELECT id, commissioner_id, status
    INTO v_league
    FROM public.leagues
   WHERE id = p_league_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_not_found');
  END IF;

  IF v_league.commissioner_id <> v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_commissioner');
  END IF;

  IF v_league.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  UPDATE public.leagues
     SET starting_level = p_level
   WHERE id = p_league_id;

  RETURN jsonb_build_object('ok', true, 'level', p_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_starting_level(uuid, integer) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push --linked
```

Expected: clean apply.

- [ ] **Step 3: Create the server action**

Create `apps/web/app/(lobby)/lobby/[leagueId]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const SetLevelSchema = z.object({
  leagueId: z.uuid(),
  level: z.number().int().min(1).max(8),
});

export async function setStartingLevel(leagueId: string, level: number) {
  const parsed = SetLevelSchema.safeParse({ leagueId, level });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid request." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_starting_level", {
    p_league_id: parsed.data.leagueId,
    p_level: parsed.data.level,
  });

  if (error) {
    return { ok: false as const, error: "Failed to update level." };
  }

  const payload = data as { ok: boolean; error?: string } | null;
  if (!payload?.ok) {
    switch (payload?.error) {
      case "unauthenticated":
        return { ok: false as const, error: "Not authenticated." };
      case "not_commissioner":
        return { ok: false as const, error: "Only the Race Director can change the level." };
      case "already_started":
        return { ok: false as const, error: "The league has already started." };
      case "invalid_level":
        return { ok: false as const, error: "Pick a level between 1 and 8." };
      case "league_not_found":
        return { ok: false as const, error: "League not found." };
      default:
        return { ok: false as const, error: "Failed to update level." };
    }
  }

  revalidatePath(`/lobby/${parsed.data.leagueId}`);
  return { ok: true as const };
}
```

- [ ] **Step 4: Write the action test**

Create `apps/web/app/(lobby)/lobby/[leagueId]/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mockRpc }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { setStartingLevel } from "./actions";

const LEAGUE = "00000000-0000-4000-8000-000000000001";

describe("setStartingLevel", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects invalid league id", async () => {
    const res = await setStartingLevel("not-a-uuid", 3);
    expect(res).toEqual({ ok: false, error: "Invalid request." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects out-of-range levels", async () => {
    const res = await setStartingLevel(LEAGUE, 9);
    expect(res).toEqual({ ok: false, error: "Invalid request." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the RPC and returns ok on success", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, level: 4 }, error: null });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(mockRpc).toHaveBeenCalledWith("set_starting_level", {
      p_league_id: LEAGUE,
      p_level: 4,
    });
    expect(res).toEqual({ ok: true });
  });

  it("maps not_commissioner to the user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "not_commissioner" },
      error: null,
    });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({
      ok: false,
      error: "Only the Race Director can change the level.",
    });
  });

  it("maps already_started to its copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "already_started" },
      error: null,
    });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({
      ok: false,
      error: "The league has already started.",
    });
  });

  it("returns generic error on transport failure", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({ ok: false, error: "Failed to update level." });
  });
});
```

- [ ] **Step 5: Wire optimistic persistence into the level selector**

Open `lobby-panels.tsx`. Replace the existing `setSelectedLevel` direct binding with a handler that fires the server action and rolls back on error. Update the file:

- Add at the top:
  ```tsx
  import { useTransition } from "react";
  import { setStartingLevel } from "./actions";
  ```
- Add inside the component body, just below the existing `useState`:
  ```tsx
  const [savingLevel, startSavingLevel] = useTransition();
  const [levelError, setLevelError] = useState<string | null>(null);

  function handleLevelChange(next: number) {
    if (!isCommissioner) return;
    const previous = selectedLevel;
    setSelectedLevel(next);
    setLevelError(null);
    startSavingLevel(async () => {
      const result = await setStartingLevel(league.id, next);
      if (!result.ok) {
        setSelectedLevel(previous);
        setLevelError(result.error);
      }
    });
  }
  ```
- Replace `onSelect={setSelectedLevel}` on `<LevelSelector …>` with `onSelect={handleLevelChange}`.
- Render the inline error + saving indicator above the level selector (only for commissioners):
  ```tsx
  {levelError ? (
    <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">
      {levelError}
    </p>
  ) : savingLevel ? (
    <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
      Saving…
    </p>
  ) : null}
  ```

- [ ] **Step 6: Run the action test**

```bash
pnpm --filter @watthunter/web test lobby/\\[leagueId\\]/actions
```

Expected: 6 tests pass.

- [ ] **Step 7: Typecheck + dev smoke test**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>` (commissioner):
- Click a different level → "Saving…" appears briefly → pill stays on the new value.
- Reload the page — the new level persists (proves the RPC wrote to `leagues.starting_level`).

Non-commissioner: pills disabled (verified in Task 7), no action fires.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260528000001_rpc_set_starting_level.sql \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/actions.ts \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/actions.test.ts \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): persist starting level via set_starting_level RPC"
```

---

## Task 11: Tab 3 — Rules

**Files:**
- Create: `apps/web/app/(lobby)/lobby/[leagueId]/_components/rules-tab.tsx`
- Modify: `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

The Rules tab is a navigation list pointing into the existing `/league/[id]/help` page, whose accordion is keyed by IDs declared in `apps/web/components/game-guide-accordion.tsx` (`overview`, `auctions`, `scoring`, …). We mirror those IDs as URL hash links.

- [ ] **Step 1: Create the rules tab**

Create `apps/web/app/(lobby)/lobby/[leagueId]/_components/rules-tab.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface RulesTabProps {
  leagueId: string;
}

const SECTIONS: Array<{ id: string; title: string; subtitle: string }> = [
  { id: "auctions",   title: "How auctions work",     subtitle: "3 sealed-bid rounds, auto-scheduled" },
  { id: "scoring",    title: "Scoring & XP",          subtitle: "How rider results turn into team XP" },
  { id: "levels",     title: "Levels & progression",  subtitle: "Slots, pool size, sponsors per level" },
  { id: "sponsors",   title: "Sponsors & budget",     subtitle: "Income, marketplace, switching" },
  { id: "strategies", title: "Strategies & boosts",   subtitle: "Specialty, Nationality, Teams, Age" },
  { id: "grand-tour", title: "Grand Tour mode",       subtitle: "Squad, roles, tactics, rescue" },
  { id: "release",    title: "Release & cooldown",    subtitle: "Freeing a rider and the 7-day rule" },
];

export function RulesTab({ leagueId }: RulesTabProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Rules
      </h2>
      <ul className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {SECTIONS.map((s) => (
          <li
            key={s.id}
            className="border-b border-[var(--border-subtle)] last:border-b-0"
          >
            <Link
              href={`/league/${leagueId}/help#${s.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 hover:bg-[var(--bg-surface-hover)]"
            >
              <div className="flex-1">
                <p className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
                  {s.title}
                </p>
                <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {s.subtitle}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--text-low)]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Wire into the Rules panel**

In `lobby-panels.tsx`:

```tsx
import { RulesTab } from "./_components/rules-tab";
```

Replace the Rules panel body:

```tsx
<TabsContent value="rules" className="space-y-6 pt-2">
  <RulesTab leagueId={league.id} />
</TabsContent>
```

- [ ] **Step 3: Typecheck + smoke-test**

```bash
pnpm typecheck
pnpm dev
```

Verify on `/lobby/<id>` → Rules: 7 rows, each opens `/league/<id>/help#<id>` (the help accordion may not jump to the section if its IDs differ — that's expected and out of scope; the link still lands on the help page).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(lobby\)/lobby/\[leagueId\]/_components/rules-tab.tsx \
        apps/web/app/\(lobby\)/lobby/\[leagueId\]/lobby-panels.tsx
git commit -m "feat(lobby): rules tab linking into the existing help page"
```

---

## Task 12: Non-commissioner view audit + waiting copy in Lobby tab

Non-commissioner read-only treatment has been built into each component (`<LaunchButton>` swaps to waiting copy, `<LevelSelector>` disables pills, `<RulesTab>` is identical for both). This task verifies the full read-only flow end-to-end and addresses any leftover commissioner-only affordance.

**Files:**
- Modify (review only — likely no edit needed): `apps/web/app/(lobby)/lobby/[leagueId]/lobby-panels.tsx`

- [ ] **Step 1: Walk through the non-commissioner experience in dev**

```bash
pnpm dev
```

Sign in as a non-commissioner member of a pending league. Visit `/lobby/<id>`:

- Lobby tab: invite section visible (any member can re-share the link — kept by design), player list visible with Race Director badge on someone else, auction explainer visible, waiting copy at the bottom, no Launch button.
- Level & Pool tab: explainer + selector with all pills disabled, current level highlighted, "Only the Race Director can change the starting level." caption visible, stats cards reflect current level, rider pool list visible and tappable (read-only navigation is fine).
- Rules tab: identical to commissioner view.

If anything bleeds through (e.g., a stray "Saving…" indicator), fix it in `lobby-panels.tsx`. The `levelError` / `savingLevel` indicators added in Task 10 should already be unreachable for non-commissioners because `handleLevelChange` early-returns on `!isCommissioner`.

- [ ] **Step 2: Run the full test suite for the lobby tree**

```bash
pnpm --filter @watthunter/web test lobby
```

Expected: all tests in the lobby tree pass.

- [ ] **Step 3: Commit (if any fixes landed; otherwise skip)**

```bash
git diff --stat
# If empty: nothing to commit. Otherwise:
git add apps/web/app/\(lobby\)
git commit -m "fix(lobby): tighten non-commissioner read-only treatment"
```

---

## Task 13: Remove legacy `lobby-view.tsx` + ARCHITECTURE.md update

**Files:**
- Delete: `apps/web/app/(game)/league/[leagueId]/lobby-view.tsx`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Verify no remaining imports of the old view**

```bash
rg "lobby-view" apps/web --type ts --type tsx
```

Expected: no results.

- [ ] **Step 2: Delete the old file**

```bash
git rm apps/web/app/\(game\)/league/\[leagueId\]/lobby-view.tsx
```

- [ ] **Step 3: Update `docs/ARCHITECTURE.md`**

Open `docs/ARCHITECTURE.md`. Locate the section that lists pages/routes (search for `(game)/league/[leagueId]`). Add a sibling entry for the new `(lobby)` route group and document the two new RPCs.

Add a route entry near the existing `(game)/league/[leagueId]` block:

```markdown
- `app/(lobby)/lobby/[leagueId]/` — dedicated setup interface for pending leagues. Server-redirects to `/league/[id]` when the league is active. Three Underline Tabs: Lobby (invite + members + auction explainer + launch CTA), Level & Pool (game-loop explainer + level selector + stats + rider pool), Rules (links into `/league/[id]/help`).
  - `actions.ts` — `setStartingLevel(leagueId, level)` → `supabase.rpc("set_starting_level", …)`.
```

Add to the RPCs / Server actions section (search for `## RPCs` or similar):

```markdown
- `launch_first_auction(p_league_id uuid) → jsonb` — SECURITY DEFINER. Commissioner-only. Inserts 3 auctions (Round 1 `open`, Rounds 2-3 `scheduled`) with auto-scheduled Europe/Paris dates, flips league to `active`. Migration `20260528000000`. Replaces former TS-side date computation.
- `set_starting_level(p_league_id uuid, p_level integer) → jsonb` — SECURITY DEFINER. Commissioner-only, pending leagues only, level 1..8. Migration `20260528000001`.
```

Also update the `(game)/league/[leagueId]/page.tsx` line to mention the redirect:

```markdown
- `(game)/league/[leagueId]/page.tsx` — server redirects to `/lobby/[id]` when status is pending; otherwise renders the Race Feed.
```

- [ ] **Step 4: Final typecheck + test sweep**

```bash
pnpm typecheck
pnpm --filter @watthunter/web test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md \
        apps/web/app/\(game\)/league/\[leagueId\]/lobby-view.tsx
git commit -m "chore(lobby): drop legacy lobby-view and document new route group + RPCs"
```

---

## Self-Review Notes (post-write check)

- **§6.1 Separate Interface**: covered by Task 1 (new `(lobby)` route group + bidirectional redirects + minimal header).
- **§6.2 Tab 1 Lobby — invite section**: Task 3.
- **§6.2 Tab 1 Lobby — player list with Race Director badge + X/8 count**: Task 4.
- **§6.2 Tab 1 Lobby — auction explainer card with Learn more link**: Task 5.
- **§6.2 Tab 1 Lobby — Launch button (commissioner only, ≥1 player, no date inputs)**: Task 6, plus `launch_first_auction` RPC removes the date-input UX.
- **§6.2 Tab 2 Level & Pool — game loop explainer paragraph**: Task 7.
- **§6.2 Tab 2 Level & Pool — 1-8 pills with REC badge, selected = cyan**: Task 7.
- **§6.2 Tab 2 Level & Pool — 3 stats cards updating with level**: Task 8.
- **§6.2 Tab 2 Level & Pool — rider pool list, tappable rows → rider detail**: Task 9.
- **§6.2 Tab 2 — commissioner persistence of the level choice**: Task 10 (RPC + action + optimistic UI).
- **§6.2 Tab 3 Rules — list of sections linking into `/league/[id]/help`**: Task 11.
- **§6.3 Non-commissioner view**: gating threaded through Tasks 6/7/10, audited end-to-end in Task 12.
- **Cleanup + docs**: Task 13.

Every code step shows the full snippet; no `TBD`, no "similar to Task N", no "add appropriate error handling" without showing it. Component prop names (`LobbyLeague`, `LobbyMember`, `LobbyRider`, `selectedLevel`, `recommendedLevel`, `isCommissioner`, `setStartingLevel`, `launchFirstAuction`) are reused consistently across tasks.
