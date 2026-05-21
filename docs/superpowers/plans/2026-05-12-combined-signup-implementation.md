# Combined Signup + League Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing separate signup → choose → create/join flow with a combined 2-screen flow that lets a visitor create their league and account in one go.

**Architecture:** Two new server actions (`signupAndCreateLeague`, `signupAndJoinLeague`) that perform Supabase `auth.signUp` server-side then call existing league creation/join logic in one transaction-like sequence. Pages stay at `/league/create` and `/league/join` but become public routes with a 2-screen client-side state machine (engaging action first, account creation second). Google OAuth uses a short-lived `signup_intent` cookie to carry form data through the OAuth callback.

**Tech Stack:** Next.js 16 App Router, Supabase SSR (`@supabase/ssr`), Zod v4, React client state (`useState`), vitest, existing UI components (FormField, Input, Button).

**Branch:** `feature/try-before-signup`

**Spec:** `docs/archive/specs/2026-05-12-try-before-signup-design.md`

---

## File Structure

### Files to create

| Path | Responsibility |
|------|---------------|
| `apps/web/app/(auth)/league/create/actions.ts` | (rewrite) `signupAndCreateLeague` server action |
| `apps/web/app/(auth)/league/create/actions.test.ts` | Tests for the action |
| `apps/web/app/(auth)/league/create/page.tsx` | (rewrite) 2-screen client page |
| `apps/web/app/(auth)/league/join/actions.ts` | (rewrite) `signupAndJoinLeague` server action |
| `apps/web/app/(auth)/league/join/actions.test.ts` | Tests for the action |
| `apps/web/app/(auth)/league/join/page.tsx` | (rewrite) 2-screen client page with `?code=` support |
| `apps/web/app/auth/callback/oauth-intent.ts` | Helper: read/write `signup_intent` cookie |
| `apps/web/components/email-confirmation-banner.tsx` | Soft reminder banner for unconfirmed emails |

### Files to modify

| Path | Change |
|------|--------|
| `apps/web/lib/supabase/middleware.ts` | Add `/league/create`, `/league/join`, `/league/choose` to public paths |
| `apps/web/app/(auth)/league/choose/page.tsx` | Remove auth guard (already a client component, just needs middleware) |
| `apps/web/app/auth/callback/route.ts` | Read `signup_intent` cookie, complete create/join after OAuth |
| `apps/web/app/(auth)/signup/page.tsx` | Remove `displayName` field; use email-prefix as default `display_name` |
| `apps/web/app/(game)/league/[leagueId]/layout.tsx` | Mount `<EmailConfirmationBanner />` |

### Supabase config

- Disable email confirmation requirement in Supabase project settings (`Authentication → Providers → Email → "Confirm email" = OFF`). This means `auth.signUp()` returns a session immediately. Manual step, documented in Task 1.

---

## Task 1: Disable Supabase email confirmation + add public routes to middleware

**Files:**
- Modify: `apps/web/lib/supabase/middleware.ts`

### - [ ] Step 1: Disable email confirmation in Supabase project (manual)

Manual step on Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/uuvshpykvpnhpeondqjt/auth/providers
2. Click "Email" provider
3. Toggle **"Confirm email"** to **OFF**
4. Save

This makes `supabase.auth.signUp()` return a session immediately, instead of requiring email confirmation first. Recovery emails still work for password reset.

Expected behavior after: a new user can sign up and be logged in instantly, with `email_confirmed_at = null` initially. The reminder banner (Task 9) handles UX for confirmation.

### - [ ] Step 2: Read current middleware public paths

Run: `grep -n "publicPaths\|public_paths\|isPublicPath" apps/web/lib/supabase/middleware.ts`
Expected: find the list of public paths around line 30-50.

### - [ ] Step 3: Add new public paths to middleware

Open `apps/web/lib/supabase/middleware.ts` and locate the `publicPaths` array. Add `/league/create`, `/league/join`, `/league/choose`:

```typescript
const publicPaths = [
  "/login",
  "/signup",
  "/auth",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/prototype",
  "/league/create",  // NEW
  "/league/join",    // NEW
  "/league/choose",  // NEW
];
```

### - [ ] Step 4: Verify routes load when logged out

Run dev server: `pnpm dev` (from repo root)
In a private/incognito window, visit:
- http://localhost:3000/league/choose → should render (not redirect to onboarding)
- http://localhost:3000/league/create → should render
- http://localhost:3000/league/join → should render

Expected: pages load. Current Create/Join pages will throw an error because they call server actions that expect auth — that's fine for now, we replace them in subsequent tasks.

### - [ ] Step 5: Commit

```bash
git add apps/web/lib/supabase/middleware.ts
git commit -m "chore(auth): allow public access to league create/join/choose routes"
```

---

## Task 2: Write tests for `signupAndCreateLeague` server action

**Files:**
- Create: `apps/web/app/(auth)/league/create/actions.test.ts`

### - [ ] Step 1: Write the failing tests

Create `apps/web/app/(auth)/league/create/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockGetUser, mockSignUp, mockSignInWithPassword, mockRedirect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { signupAndCreateLeague } from "./actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function fluentQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  q.select = vi.fn().mockReturnValue(q);
  q.insert = vi.fn().mockReturnValue(q);
  q.upsert = vi.fn().mockResolvedValue(result);
  q.eq = vi.fn().mockReturnValue(q);
  q.single = vi.fn().mockResolvedValue(result);
  return q;
}

describe("signupAndCreateLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when league name is too short", async () => {
    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "A",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("League name") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects when passwords do not match", async () => {
    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "different",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("match") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("returns supabase signUp error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email already registered" },
    });

    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "taken@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Email already") });
  });

  it("creates account + league + team + sponsor + member on success", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1", email: "new@b.com" }, session: { access_token: "tok" } },
      error: null,
    });

    const userUpsert = fluentQuery({ data: null, error: null });
    const leagueInsert = fluentQuery({ data: { id: "league-1", invite_code: "ABC123" }, error: null });
    const teamInsert = fluentQuery({ data: { id: "team-1" }, error: null });
    const sponsorAssign = fluentQuery({ data: null, error: null });
    const memberInsert = fluentQuery({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(userUpsert)      // users upsert
      .mockReturnValueOnce(leagueInsert)    // leagues insert
      .mockReturnValueOnce(teamInsert)      // teams insert
      .mockReturnValueOnce(sponsorAssign)   // sponsor assignment
      .mockReturnValueOnce(memberInsert);   // league_members insert

    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      signupAndCreateLeague(
        null,
        makeFormData({
          league_name: "Test League",
          team_name: "MyTeam",
          email: "new@b.com",
          password: "secret123",
          confirm_password: "secret123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@b.com",
      password: "secret123",
      options: expect.any(Object),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/league/league-1");
  });
});
```

### - [ ] Step 2: Run tests to verify they fail

Run: `pnpm --filter web test -- apps/web/app/\(auth\)/league/create/actions.test.ts`
Expected: FAIL with "Cannot find module './actions'" or similar (action doesn't exist yet).

### - [ ] Step 3: Commit the failing tests

```bash
git add apps/web/app/\(auth\)/league/create/actions.test.ts
git commit -m "test(auth): add tests for signupAndCreateLeague action"
```

---

## Task 3: Implement `signupAndCreateLeague` server action

**Files:**
- Modify (rewrite): `apps/web/app/(auth)/league/create/actions.ts`

### - [ ] Step 1: Read existing `createLeague` action for reference

Run: `cat apps/web/app/\(auth\)/league/create/actions.ts`
Note the existing pattern: Zod validation → user upsert → invite code generation → league insert → team insert → sponsor assignment → member insert → redirect.

The new action follows the same pattern, but prepended with `auth.signUp()`. Reuse the invite code generator and sponsor assignment logic.

### - [ ] Step 2: Rewrite `actions.ts`

Replace the content of `apps/web/app/(auth)/league/create/actions.ts`:

```typescript
"use server";

import { z } from "zod/v4";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  league_name: z.string().min(2, "League name must be at least 2 characters.").max(50),
  team_name: z.string().min(2, "Team name must be at least 2 characters.").max(30),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match.",
  path: ["confirm_password"],
});

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const SPONSOR_BY_LEVEL: Record<number, string> = {
  1: "Lotto",
  2: "Astana",
  3: "Cofidis",
  4: "Bahrain Victorious",
  5: "Groupama-FDJ",
  6: "Soudal Quick-Step",
  7: "Visma | Lease a Bike",
  8: "UAE Team Emirates",
};

export async function signupAndCreateLeague(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const parsed = schema.safeParse({
    league_name: formData.get("league_name"),
    team_name: formData.get("team_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { league_name, team_name, email, password } = parsed.data;
  const supabase = await createClient();

  // 1. Sign up the user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: team_name },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }
  if (!signUpData.user) {
    return { error: "Signup failed. Please try again." };
  }

  const userId = signUpData.user.id;

  // 2. Upsert public.users row
  const { error: userError } = await supabase.from("users").upsert(
    { id: userId, display_name: team_name, avatar_url: null },
    { onConflict: "id" }
  );
  if (userError) {
    return { error: `User profile error: ${userError.message}` };
  }

  // 3. Determine recommended starting level (default to 1 if helper unavailable)
  // We rely on a recommended-level helper from lib/levels; falling back is safe.
  const startingLevel = 1;

  // 4. Create the league
  let inviteCode = generateInviteCode();
  // Retry up to 5 times if the random code collides (very rare)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("leagues")
      .insert({
        name: league_name,
        invite_code: inviteCode,
        commissioner_id: userId,
        starting_level: startingLevel,
        status: "pending",
        max_players: 8,
      })
      .select("id, invite_code")
      .single();

    if (!error && data) {
      // 5. Create commissioner's team
      const { error: teamError } = await supabase.from("teams").insert({
        league_id: data.id,
        user_id: userId,
        name: team_name,
        level: startingLevel,
      });
      if (teamError) return { error: `Team creation failed: ${teamError.message}` };

      // 6. Assign default sponsor
      const sponsorName = SPONSOR_BY_LEVEL[startingLevel] ?? SPONSOR_BY_LEVEL[1];
      await supabase.from("sponsor_assignments").insert({
        team_id: (await supabase
          .from("teams")
          .select("id")
          .eq("league_id", data.id)
          .eq("user_id", userId)
          .single()).data?.id,
        sponsor_name: sponsorName,
      });

      // 7. Add commissioner as a league member
      const { error: memberError } = await supabase.from("league_members").insert({
        league_id: data.id,
        user_id: userId,
      });
      if (memberError) return { error: `Member creation failed: ${memberError.message}` };

      redirect(`/league/${data.id}`);
    }

    // Collision retry
    if (error?.code === "23505") {
      inviteCode = generateInviteCode();
      continue;
    }

    return { error: `League creation failed: ${error?.message ?? "unknown"}` };
  }

  return { error: "Could not generate a unique invite code. Please retry." };
}
```

### - [ ] Step 3: Run tests to verify they pass

Run: `pnpm --filter web test -- apps/web/app/\(auth\)/league/create/actions.test.ts`
Expected: PASS (all 4 tests).

If any test fails, read the error, fix the action implementation, re-run.

### - [ ] Step 4: Commit

```bash
git add apps/web/app/\(auth\)/league/create/actions.ts
git commit -m "feat(auth): add signupAndCreateLeague combined server action"
```

---

## Task 4: Build the Create page with 2-screen state machine

**Files:**
- Modify (rewrite): `apps/web/app/(auth)/league/create/page.tsx`

### - [ ] Step 1: Rewrite the page

Replace the content of `apps/web/app/(auth)/league/create/page.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { signupAndCreateLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { setSignupIntentCookie } from "@/app/auth/callback/oauth-intent";

export default function CreateLeaguePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [leagueName, setLeagueName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(signupAndCreateLeague, null);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (leagueName.trim().length < 2) {
      setStep1Error("League name must be at least 2 characters.");
      return;
    }
    if (teamName.trim().length < 2) {
      setStep1Error("Team name must be at least 2 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStep1Error("Please enter a valid email address.");
      return;
    }
    setStep1Error(null);
    setStep(2);
  }

  async function handleGoogle() {
    if (leagueName.trim().length < 2 || teamName.trim().length < 2) {
      setStep1Error("Please fill league name and team name first.");
      return;
    }
    await setSignupIntentCookie({
      kind: "create",
      league_name: leagueName.trim(),
      team_name: teamName.trim(),
    });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=create` },
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Link
        href="/league/choose"
        className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          Create a league
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {step === 1 ? "Tell us about your league." : "Secure your account."}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <FormField label="League name" htmlFor="league_name">
            <Input
              id="league_name"
              name="league_name"
              placeholder="Ex: The Watt Hunters"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
            />
          </FormField>
          <FormField label="Your team name" htmlFor="team_name">
            <Input
              id="team_name"
              name="team_name"
              placeholder="Ex: Les Grimpeurs"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              minLength={2}
              maxLength={30}
            />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>

          {step1Error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{step1Error}</p>
          )}

          <Button type="submit" variant="cta">Next</Button>
          <Button type="button" variant="outline" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="league_name" value={leagueName} />
          <input type="hidden" name="team_name" value={teamName} />
          <input type="hidden" name="email" value={email} />

          <FormField label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm_password">
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={6}
            />
          </FormField>

          {state?.error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{state.error}</p>
          )}

          <Button type="submit" variant="cta" disabled={pending}>
            {pending ? "Creating..." : "Create League and Account"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
```

### - [ ] Step 2: Test manually

Run dev server, visit `/league/create` (logged out, incognito):
- Screen 1: fill league name + team name + email → Next → screen 2 should show
- Screen 2: fill matching passwords → submit → should redirect to `/league/[id]`
- Back to Screen 1: error if league name < 2 chars

Expected: full flow works, league created, user logged in.

### - [ ] Step 3: Commit

```bash
git add apps/web/app/\(auth\)/league/create/page.tsx
git commit -m "feat(auth): rewrite create league page with 2-screen combined signup"
```

---

## Task 5: Write tests for `signupAndJoinLeague` server action

**Files:**
- Create: `apps/web/app/(auth)/league/join/actions.test.ts`

### - [ ] Step 1: Write the failing tests

Create `apps/web/app/(auth)/league/join/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc, mockGetUser, mockSignUp, mockRedirect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignUp: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser, signUp: mockSignUp },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { signupAndJoinLeague } from "./actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("signupAndJoinLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid code", async () => {
    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "!@#$%^",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("code") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "different",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("match") });
  });

  it("returns signUp error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email already registered" },
    });

    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "taken@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Email already") });
  });

  it("maps 'League not found' RPC error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "League not found" },
      error: null,
    });

    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Invalid code") });
  });

  it("creates account + joins league + redirects on success", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    mockRpc.mockResolvedValue({
      data: { ok: true, league_id: "league-1", late_join: false, team_id: "team-1" },
      error: null,
    });
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      signupAndJoinLeague(
        null,
        makeFormData({
          code: "ABCDEF",
          team_name: "MyTeam",
          email: "a@b.com",
          password: "secret123",
          confirm_password: "secret123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRpc).toHaveBeenCalledWith("join_league_by_code", expect.objectContaining({
      p_code: "ABCDEF",
    }));
    expect(mockRedirect).toHaveBeenCalledWith("/league/league-1");
  });
});
```

### - [ ] Step 2: Run tests to verify they fail

Run: `pnpm --filter web test -- apps/web/app/\(auth\)/league/join/actions.test.ts`
Expected: FAIL (action doesn't exist yet).

### - [ ] Step 3: Commit

```bash
git add apps/web/app/\(auth\)/league/join/actions.test.ts
git commit -m "test(auth): add tests for signupAndJoinLeague action"
```

---

## Task 6: Implement `signupAndJoinLeague` server action

**Files:**
- Modify (rewrite): `apps/web/app/(auth)/league/join/actions.ts`

### - [ ] Step 1: Read existing `joinLeague` action

Run: `cat apps/web/app/\(auth\)/league/join/actions.ts`
Note: uses `join_league_by_code` RPC. We reuse that RPC; the new action just prepends `signUp`.

### - [ ] Step 2: Rewrite `actions.ts`

Replace `apps/web/app/(auth)/league/join/actions.ts`:

```typescript
"use server";

import { z } from "zod/v4";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().length(6).regex(/^[A-Z2-9]+$/, "Invalid code."),
  team_name: z.string().min(2, "Team name must be at least 2 characters.").max(30),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match.",
  path: ["confirm_password"],
});

export async function signupAndJoinLeague(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const parsed = schema.safeParse({
    code: (formData.get("code") as string)?.toUpperCase(),
    team_name: formData.get("team_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code, team_name, email, password } = parsed.data;
  const supabase = await createClient();

  // 1. Sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: team_name } },
  });
  if (signUpError) return { error: signUpError.message };
  if (!signUpData.user) return { error: "Signup failed. Please try again." };

  const userId = signUpData.user.id;

  // 2. Upsert user profile
  const { error: userError } = await supabase.from("users").upsert(
    { id: userId, display_name: team_name, avatar_url: null },
    { onConflict: "id" }
  );
  if (userError) return { error: `User profile error: ${userError.message}` };

  // 3. Join via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc("join_league_by_code", {
    p_code: code,
    p_team_name: team_name,
  });

  if (rpcError) return { error: rpcError.message };

  if (rpcResult && typeof rpcResult === "object" && "ok" in rpcResult && !rpcResult.ok) {
    const errMsg = (rpcResult as { error?: string }).error ?? "Unknown error";
    if (errMsg.includes("not found")) return { error: "Invalid code. Check with your Race Director." };
    if (errMsg.includes("full")) return { error: "This league is full." };
    return { error: errMsg };
  }

  const leagueId = (rpcResult as { league_id: string }).league_id;
  redirect(`/league/${leagueId}`);
}
```

**Note:** This assumes `join_league_by_code` accepts an optional `p_team_name` parameter. If it doesn't currently, add a small migration to extend the RPC signature. Check first:

Run: `grep -A 30 "join_league_by_code" supabase/migrations/*.sql | head -60`

If the RPC doesn't accept `p_team_name`, see Task 6b below.

### - [ ] Step 2b (conditional): Migrate `join_league_by_code` to accept team_name

If needed, create `supabase/migrations/<timestamp>_join_league_team_name.sql`:

```sql
CREATE OR REPLACE FUNCTION public.join_league_by_code(
  p_code TEXT,
  p_team_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_league RECORD;
  v_member_count INTEGER;
  v_team_id UUID;
  v_team_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, name, max_players, status, starting_level
    INTO v_league
    FROM leagues
    WHERE invite_code = p_code;

  IF v_league.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'League not found');
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM league_members WHERE league_id = v_league.id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('ok', true, 'league_id', v_league.id, 'already_member', true);
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_member_count FROM league_members WHERE league_id = v_league.id;
  IF v_member_count >= v_league.max_players THEN
    RETURN jsonb_build_object('ok', false, 'error', 'League is full');
  END IF;

  v_team_name := COALESCE(NULLIF(TRIM(p_team_name), ''), 'Team ' || substr(v_user_id::text, 1, 4));

  -- Create team
  INSERT INTO teams (league_id, user_id, name, level)
  VALUES (v_league.id, v_user_id, v_team_name, v_league.starting_level)
  RETURNING id INTO v_team_id;

  -- Add as member
  INSERT INTO league_members (league_id, user_id) VALUES (v_league.id, v_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'league_id', v_league.id,
    'team_id', v_team_id,
    'late_join', v_league.status = 'active'
  );
END;
$$;
```

Then apply: `supabase db push --linked`

### - [ ] Step 3: Run tests to verify they pass

Run: `pnpm --filter web test -- apps/web/app/\(auth\)/league/join/actions.test.ts`
Expected: PASS.

### - [ ] Step 4: Commit

```bash
git add apps/web/app/\(auth\)/league/join/actions.ts supabase/migrations/
git commit -m "feat(auth): add signupAndJoinLeague combined server action"
```

---

## Task 7: Build the Join page with 2-screen state machine

**Files:**
- Modify (rewrite): `apps/web/app/(auth)/league/join/page.tsx`

### - [ ] Step 1: Rewrite the page

Replace `apps/web/app/(auth)/league/join/page.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signupAndJoinLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { setSignupIntentCookie } from "@/app/auth/callback/oauth-intent";

export default function JoinLeaguePage() {
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code")?.toUpperCase() ?? "";

  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState(prefilledCode);
  const [teamName, setTeamName] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(signupAndJoinLeague, null);

  useEffect(() => {
    if (prefilledCode) setCode(prefilledCode);
  }, [prefilledCode]);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(c)) {
      setStep1Error("Code must be 6 characters (letters and 2-9).");
      return;
    }
    if (teamName.trim().length < 2) {
      setStep1Error("Team name must be at least 2 characters.");
      return;
    }
    setStep1Error(null);
    setCode(c);
    setStep(2);
  }

  async function handleGoogle() {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(c) || teamName.trim().length < 2) {
      setStep1Error("Please fill code and team name first.");
      return;
    }
    await setSignupIntentCookie({
      kind: "join",
      code: c,
      team_name: teamName.trim(),
    });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=join` },
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Link
        href="/league/choose"
        className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          Join a league
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {step === 1 ? "Enter the code your Race Director shared." : "Create your account to join."}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <FormField label="Invite code" htmlFor="code">
            <Input
              id="code"
              name="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={6}
              maxLength={6}
              className="text-center text-[length:var(--type-section)] font-semibold tracking-widest uppercase"
            />
          </FormField>
          <FormField label="Your team name" htmlFor="team_name">
            <Input
              id="team_name"
              name="team_name"
              placeholder="Ex: Les Grimpeurs"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              minLength={2}
              maxLength={30}
            />
          </FormField>

          {step1Error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{step1Error}</p>
          )}

          <Button type="submit" variant="cta">Next</Button>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="team_name" value={teamName} />

          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" placeholder="At least 6 characters" required minLength={6} />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm_password">
            <Input id="confirm_password" name="confirm_password" type="password" required minLength={6} />
          </FormField>

          {state?.error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{state.error}</p>
          )}

          <Button type="submit" variant="cta" disabled={pending}>
            {pending ? "Joining..." : "Join League and Create Account"}
          </Button>
          <Button type="button" variant="outline" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
```

### - [ ] Step 2: Test manually

Visit `/league/join` (logged out):
- Empty code: Next is blocked
- Valid code (e.g. `ABCDEF`) + team name: Next moves to step 2
- `/league/join?code=ABCDEF`: code is pre-filled

Expected: full flow works.

### - [ ] Step 3: Commit

```bash
git add apps/web/app/\(auth\)/league/join/page.tsx
git commit -m "feat(auth): rewrite join league page with 2-screen combined signup"
```

---

## Task 8: OAuth intent helper + callback integration

**Files:**
- Create: `apps/web/app/auth/callback/oauth-intent.ts`
- Modify: `apps/web/app/auth/callback/route.ts`

### - [ ] Step 1: Create the cookie helper

Create `apps/web/app/auth/callback/oauth-intent.ts`:

```typescript
"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "signup_intent";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

export type SignupIntent =
  | { kind: "create"; league_name: string; team_name: string }
  | { kind: "join"; code: string; team_name: string };

export async function setSignupIntentCookie(intent: SignupIntent): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, JSON.stringify(intent), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function readSignupIntentCookie(): Promise<SignupIntent | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.kind === "create" || parsed.kind === "join") return parsed as SignupIntent;
    return null;
  } catch {
    return null;
  }
}

export async function clearSignupIntentCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
```

### - [ ] Step 2: Read the existing callback route

Run: `cat apps/web/app/auth/callback/route.ts`

Note the existing flow: exchange code → upsert user profile → redirect to next. We need to insert a step: if `signup_intent` cookie is present, process create/join intent before the final redirect.

### - [ ] Step 3: Update the callback to process intent

Modify `apps/web/app/auth/callback/route.ts`. After the existing user profile upsert and BEFORE the final redirect, add:

```typescript
// (existing code: exchange code, upsert user profile)

import { readSignupIntentCookie, clearSignupIntentCookie } from "./oauth-intent";
// ... at top of file

// After successful exchange and user profile upsert:
const intent = await readSignupIntentCookie();
if (intent) {
  await clearSignupIntentCookie();

  if (intent.kind === "create") {
    // Inline create-league logic (or call a shared helper)
    const inviteCode = generateInviteCode(); // import from a shared utility
    const startingLevel = 1;

    const { data: league, error: leagueErr } = await supabase
      .from("leagues")
      .insert({
        name: intent.league_name,
        invite_code: inviteCode,
        commissioner_id: user.id,
        starting_level: startingLevel,
        status: "pending",
        max_players: 8,
      })
      .select("id")
      .single();

    if (!leagueErr && league) {
      await supabase.from("teams").insert({
        league_id: league.id,
        user_id: user.id,
        name: intent.team_name,
        level: startingLevel,
      });
      await supabase.from("league_members").insert({
        league_id: league.id,
        user_id: user.id,
      });
      return NextResponse.redirect(`${requestUrl.origin}/league/${league.id}`);
    }
  } else if (intent.kind === "join") {
    const { data: rpcResult } = await supabase.rpc("join_league_by_code", {
      p_code: intent.code,
      p_team_name: intent.team_name,
    });
    if (rpcResult && (rpcResult as { ok?: boolean }).ok) {
      const leagueId = (rpcResult as { league_id: string }).league_id;
      return NextResponse.redirect(`${requestUrl.origin}/league/${leagueId}`);
    }
  }
}

// (existing default redirect logic continues here)
```

**Refactor opportunity (do this in this step):** Extract the invite code generator and sponsor lookup from `signupAndCreateLeague` into `apps/web/lib/league-creation.ts` and import from both places to keep DRY.

Create `apps/web/lib/league-creation.ts`:

```typescript
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export const SPONSOR_BY_LEVEL: Record<number, string> = {
  1: "Lotto",
  2: "Astana",
  3: "Cofidis",
  4: "Bahrain Victorious",
  5: "Groupama-FDJ",
  6: "Soudal Quick-Step",
  7: "Visma | Lease a Bike",
  8: "UAE Team Emirates",
};
```

Then update `signupAndCreateLeague` in `actions.ts` to `import { generateInviteCode, SPONSOR_BY_LEVEL } from "@/lib/league-creation";` and remove the duplicates.

### - [ ] Step 4: Manual smoke test the OAuth flow

In dev:
1. Visit `/league/create` (incognito)
2. Fill league name + team name + email
3. Click "Continue with Google"
4. Complete OAuth on Google's side
5. After redirect: should land on `/league/[newLeagueId]` with the league created

Expected: league is in DB with correct name + the OAuth-authed user as commissioner.

### - [ ] Step 5: Commit

```bash
git add apps/web/app/auth/callback/oauth-intent.ts apps/web/app/auth/callback/route.ts apps/web/lib/league-creation.ts apps/web/app/\(auth\)/league/create/actions.ts
git commit -m "feat(auth): handle signup_intent cookie in OAuth callback for create/join"
```

---

## Task 9: Update `/league/choose` page (unauth-friendly UI)

**Files:**
- Modify: `apps/web/app/(auth)/league/choose/page.tsx`

### - [ ] Step 1: Read current page

Run: `cat apps/web/app/\(auth\)/league/choose/page.tsx`
Note: it already has "Create a league" and "Join a league" cards. We just need to ensure it reads well for unauth users (currently the copy assumes authed).

### - [ ] Step 2: Update copy to be unauth-friendly

The existing copy ("Create a new league or join an existing one") is already neutral. Update the title to "Get Started" instead of "WattHunter":

```typescript
// Replace the heading block at top of the page
<div className="flex flex-col items-center gap-2 text-center">
  <Image src="/watthunter-icon.png" alt="WattHunter" width={48} height={48} />
  <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
    Get Started
  </h1>
  <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
    Create a new league with friends, or join one with an invite code.
  </p>
</div>
```

Add a "Already have an account?" link at the bottom:

```typescript
<p className="text-[length:var(--type-caption)] text-[var(--text-mid)] text-center mt-4">
  Already have an account?{" "}
  <Link href="/login" className="text-[var(--accent-default)] underline">Log in</Link>
</p>
```

### - [ ] Step 3: Test manually

Visit `/league/choose` (incognito) → should render the chooser without requiring auth.

### - [ ] Step 4: Commit

```bash
git add apps/web/app/\(auth\)/league/choose/page.tsx
git commit -m "feat(auth): update league/choose page for unauthenticated visitors"
```

---

## Task 10: Add email confirmation reminder banner

**Files:**
- Create: `apps/web/components/email-confirmation-banner.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/layout.tsx`

### - [ ] Step 1: Create the banner component

Create `apps/web/components/email-confirmation-banner.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";

interface EmailConfirmationBannerProps {
  email: string | null;
  isConfirmed: boolean;
}

export function EmailConfirmationBanner({ email, isConfirmed }: EmailConfirmationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (isConfirmed || !email || dismissed) return null;

  return (
    <div className="flex items-center gap-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 py-2">
      <Mail className="size-4 text-[var(--text-mid)] shrink-0" />
      <p className="flex-1 text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Confirm your email <span className="text-[var(--text-high)]">{email}</span> so we can help you recover your account if needed.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-[var(--text-low)] hover:text-[var(--text-mid)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
```

### - [ ] Step 2: Mount banner in the game shell layout

Open `apps/web/app/(game)/league/[leagueId]/layout.tsx`. Find where the user is fetched (look for `supabase.auth.getUser()`). After that, render the banner at the top of the main content area.

Add the import:
```typescript
import { EmailConfirmationBanner } from "@/components/email-confirmation-banner";
```

In the JSX (place just inside the outermost layout container, above sidebar/main split):
```typescript
<EmailConfirmationBanner
  email={user?.email ?? null}
  isConfirmed={!!user?.email_confirmed_at}
/>
```

### - [ ] Step 3: Test manually

1. Sign up via `/league/create` flow.
2. Land on the league page.
3. Banner should show "Confirm your email <new@example.com>...".
4. Click X → banner disappears for the session.

Expected: banner shows for new users with unconfirmed email; hidden after dismissal.

### - [ ] Step 4: Commit

```bash
git add apps/web/components/email-confirmation-banner.tsx apps/web/app/\(game\)/league/\[leagueId\]/layout.tsx
git commit -m "feat(auth): add dismissable email confirmation reminder banner"
```

---

## Task 11: Simplify the classic `/signup` page

**Files:**
- Modify: `apps/web/app/(auth)/signup/page.tsx`

### - [ ] Step 1: Remove the `displayName` field

Open `apps/web/app/(auth)/signup/page.tsx`. Remove:
- The `displayName` state variable
- The "Username" `FormField` block
- The validation check on `displayName.length < 2`

Update the `signUp` call to derive a default display name from the email:

```typescript
const defaultDisplayName = email.split("@")[0];

const { error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    data: { display_name: defaultDisplayName },
  },
});
```

### - [ ] Step 2: Update the page copy

Change the subtitle from "Join WattHunter and start your fantasy season" to:
```
"Already started a league? Sign in instead." (no — leave subtitle, just remove username row)
```

Keep the existing form structure (Email → Password → Confirm), just one less field.

### - [ ] Step 3: Test manually

Visit `/signup` (incognito):
- Form shows: Email, Password, Confirm Password (no Username).
- Submit creates an account with `display_name = email-prefix`.
- Redirects to `/league/choose`.

### - [ ] Step 4: Commit

```bash
git add apps/web/app/\(auth\)/signup/page.tsx
git commit -m "refactor(auth): simplify signup page by removing username field"
```

---

## Task 12: Final type check, lint, and test pass

### - [ ] Step 1: Run typecheck

Run: `pnpm typecheck`
Expected: zero errors.

If errors, fix them inline (typically import paths or type mismatches in the new files).

### - [ ] Step 2: Run lint

Run: `pnpm lint`
Expected: zero errors.

### - [ ] Step 3: Run all tests

Run: `pnpm --filter web test`
Expected: all tests pass, including the new ones from Tasks 2 and 5.

### - [ ] Step 4: Run dev build

Run: `pnpm --filter web build`
Expected: build succeeds.

### - [ ] Step 5: Final commit (if any fixes)

```bash
git add -A
git commit -m "chore: typecheck and lint fixes for combined signup flow"
```

---

## Task 13: Update living docs

**Files:**
- Modify: `docs/ARCHITECTURE.md` (if it documents auth flow)
- Move: `docs/archive/specs/2026-05-12-try-before-signup-design.md` → leave there (already archived)

### - [ ] Step 1: Update `docs/ARCHITECTURE.md`

Search the file for the auth section: `grep -n "signup\|auth" docs/ARCHITECTURE.md | head -20`. Update the Auth flow section to reflect:
- Combined signup happens at `/league/create` and `/league/join`
- Old `/signup` page still exists as a fallback (simplified, no username)
- New server actions: `signupAndCreateLeague`, `signupAndJoinLeague`
- New cookie: `signup_intent` for OAuth handoff

If no auth section exists, add a short paragraph under a new "Authentication" heading.

### - [ ] Step 2: Commit

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md for combined signup flow"
```

---

## Out of scope for this plan (covered by later plans)

- Landing page redesign with video (Chantier A)
- Demo mode at `/league/demo` (Chantier B)
- Lobby redesign with 3 tabs (Chantier D)
- The "Get Started" branded landing page that replaces the current `/onboarding`

These are tracked in the parent spec `docs/archive/specs/2026-05-12-try-before-signup-design.md` and will get their own plans.
