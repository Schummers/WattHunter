# Try Before You Sign Up — Design Spec

> Date: 2026-05-12
> Status: Draft
> Goal: Let visitors explore a live demo of WattHunter before creating an account, maximize conversion through zero-friction onboarding.

---

## 1. Problem

Today, unauthenticated visitors land on `/onboarding` — a static page with 3 feature cards and Sign Up / Log In buttons. There's zero interactivity before account creation. For a fantasy league game where the target audience already understands the concept, the best pitch is the product itself. Visitors need to **feel** the app quality, not read about it.

## 2. High-Level Flow

```
Visitor arrives
    │
    ├─ Has active session? ──yes──► Redirect to /league/[leagueId] (unchanged)
    │
    └─ No session
         │
         ▼
    Landing Page (video motion + CTAs)
         │
         ├─ "Log in" ──► /login (existing flow)
         │
         ├─ Video ends ──► Fade out, reveal demo mode
         │                  (prefetch demo data during video)
         │
         └─ "Get Started" ──► Create or Join flow
              │
              ├─ "Create a league" ──► Combined signup + league creation
              │
              └─ "Join a league" ──► Combined signup + league join
```

Visitors arriving via a **direct invite link** (`/league/join?code=ABC123`) skip the landing page entirely and go straight to the Join flow with the code pre-filled.

## 3. Chantier A — Landing Page

### 3.1 Layout

- **Video container** (full-width, auto-play, muted): motion demo showcasing key app pages and features
- **Below video**: two CTAs side by side
  - Left: **"Log in"** (secondary/text style) → `/login`
  - Right: **"Get Started"** (primary/CTA style) → Create or Join chooser
- Video is an **external dependency** (created by Jonathan in Figma/After Effects/ScreenStudio). Code delivers the container + fade transition only.

### 3.2 Video-to-Demo Transition

- When the video ends (or user scrolls past it): video fades out, demo app reveals underneath
- During video playback: **prefetch demo league data** in the background so the transition is instant
- The transition visual is baked into the video itself — code handles the fade-out + show of the demo shell
- If the user clicks "Get Started" before the video ends, go directly to the Create/Join flow (skip demo)

### 3.3 Technical Notes

- New page: `/app/page.tsx` rewrite (or new `(public)` route group)
- Video format: MP4 or WebM, lazy-loaded, `<video autoPlay muted playsInline>`
- Prefetch: load demo JSON/data into a client-side cache during video playback
- Authenticated users never see this page (existing redirect logic in `page.tsx` handles this)

## 4. Chantier B — Demo Mode

### 4.1 URL Structure

`/league/demo/...` — uses the exact same routes as the real app:
- `/league/demo` → Home
- `/league/demo/team` → Team
- `/league/demo/budget` → Budget
- `/league/demo/ranking` → Ranking
- etc.

The `[leagueId]` layout detects `leagueId === "demo"` and switches to demo mode.

### 4.2 Data Source

- **Real league snapshot** from Jonathan's active league, anonymized:
  - Player/team names replaced with fictional names (e.g., "Team Flamme Rouge", "Les Grimpeurs")
  - Real PCS rider names and data preserved (public data, adds credibility)
  - Snapshot targets mid-season state (e.g., mid-Giro) for maximum content richness
- **Stored in database** as a real league row with `is_demo = true` flag
  - Same Supabase queries, same components, same code paths
  - When a new feature ships, it automatically appears in the demo
- **Refresh script**: CLI command to re-snapshot Jonathan's league → anonymize → upsert demo league
  - Run manually when fresh data is desired (new race results, new GT, etc.)

### 4.3 Visitor Point of View

The visitor is assigned the **team ranked 2nd in the general ranking**. This provides:
- A realistic perspective (not first, not last)
- Full "My Team" experience with riders, budget, strategies
- Visible competition context in rankings

### 4.4 Demo UI Chrome

**Top banner** (fixed, above content):
- Text: "You're exploring a demo league"
- Button: "Get Started" (links to Create/Join flow)
- Base style: subtle, neutral background (`--bg-surface` with accent border)
- **Pulse behavior**: when the visitor clicks any blocked action, the banner briefly glows in cyan (~1 second animation) — no toast, no modal, no popup

**Bottom CTA** (below the bottom nav on mobile):
- Text: "Create your league"
- Scroll-hides together with the bottom nav (uses existing `use-scroll-direction` hook)
- Tapping it → goes to the Create/Join flow

**Blocked actions**: all mutations are disabled in demo mode:
- `place_bid`, `release_rider`, `validate_round`, etc.
- UI buttons remain visually normal (not grayed out) but trigger the banner pulse on click
- Implementation: demo mode context provider that intercepts mutation calls

### 4.5 Navigation in Demo Mode

Same navigation as the real app:
- Mobile: BottomNav (Home, Team, Budget, Ranking) + TopBar
- Desktop: Sidebar + Main + Detail Rail
- All pages accessible, all data visible, all read-only

### 4.6 Performance Considerations

- Prefetch demo data during video playback
- Demo league data can be cached aggressively (CDN, ISR) since it only changes when the refresh script runs
- No real-time subscriptions needed in demo mode
- Consider static generation of demo pages at build time for instant loads

## 5. Chantier C — Combined Signup + League Creation

### 5.1 Path "Create a League"

**Screen 1** — The engaging action:
| Field | Type | Validation |
|-------|------|-----------|
| League name | Text input | 2-50 chars, required |
| Team name | Text input | 2-30 chars, required |
| Email | Email input | Valid email, required |

CTAs:
- **"Next"** (primary) → goes to Screen 2
- **"Continue with Google"** (secondary) → Google OAuth, skips Screen 2, creates league + account immediately

**Screen 2** — The account:
| Field | Type | Validation |
|-------|------|-----------|
| Password | Password input | Min 6 chars, required |
| Confirm password | Password input | Must match, required |

CTA: **"Create League and Account"**

**After submit**: account created + league created (level = recommended default) → redirect to **Lobby** (`/league/[newLeagueId]`).

### 5.2 Path "Join a League"

**Screen 1** — The engaging action:
| Field | Type | Validation |
|-------|------|-----------|
| Invite code | Text input (6 chars) | Required, uppercase |
| Team name | Text input | 2-30 chars, required |

CTA: **"Next"**

Pre-fill: if URL contains `?code=ABC123`, the invite code field is pre-filled.

**Screen 2** — The account:
| Field | Type | Validation |
|-------|------|-----------|
| Email | Email input | Valid email, required |
| Password | Password input | Min 6 chars, required |
| Confirm password | Password input | Must match, required |

CTAs:
- **"Join League and Create Account"** (primary)
- **"Continue with Google"** (secondary)

**After submit**: account created + joined league → redirect to league home.

### 5.3 Direct Invite Link

When a visitor arrives via `/league/join?code=ABC123`:
- Skip landing page, video, and demo entirely
- Go directly to Join Screen 1 with code pre-filled
- Visitor just enters Team name → Next → account creation → done

### 5.4 Google OAuth Flow

- On "Continue with Google": initiate OAuth, on callback get email + profile
- If on Create path: create account + create league (league name + team name already provided on Screen 1)
- If on Join path: create account + join league
- Redirect to appropriate destination

### 5.5 Email Verification

- **Nothing is blocked** before email confirmation
- Small reminder banner in the lobby/app: "Confirm your email for account recovery"
- Supabase config: set `enable_confirmations` behavior to allow immediate access
- Worst case (fake email): user can't reset password — their problem, not ours

### 5.6 User Model Simplification

- Remove `display_name` / `first_name` from signup flow
- **Team name = player identity** throughout the app
- Clean up existing signup page to match (remove username/display_name fields)
- The `users.display_name` column can remain in DB for backward compat but is no longer collected at signup

## 6. Chantier D — Lobby Redesign (Pending League)

### 6.1 Separate Interface

When a league is in **pending** state (no auctions launched), it uses a **dedicated setup UI** instead of the full game shell:
- No sidebar / no bottom nav from the game
- Own tab-based navigation
- Page title = league name
- Clean, focused experience for the setup phase

Once the commissioner clicks "Launch first auction" → league becomes active → redirect to the full game shell with standard navigation.

### 6.2 Three Tabs

#### Tab 1: Lobby
- **Invite section**: invite code (copy) + invite link (copy) + helper text
- **Player list**: avatars, team names, Race Director badge, count (X/8)
- **Auction explainer**: card with short text explaining the 3-round sealed-bid system + "Learn more" link to `/league/[id]/help`
- **Launch button**: "Launch first auction" (commissioner only, enabled when ≥1 player)
  - No more round date inputs — rounds are automatic
  - The explainer text covers this: "3 auction rounds, auto-close after deadline"

#### Tab 2: Level & Pool
- **Game loop explainer**: one paragraph explaining XP → level → sponsors/strategies/riders → money → auctions
- **Level selector**: horizontal pills (1-8), "REC" badge on recommended level, selected state = cyan highlight
  - Default = recommended level based on current WT phase
  - Commissioner can change; non-commissioners see but can't edit
- **Stats cards** (update on level change): 3 cards showing Rider Slots, Sponsor Income/phase, Strategies count
- **Rider pool list**: full scrollable list of available riders for the selected level
  - Shows: PCS rank, rider name, points
  - Pool range updates based on level (e.g., Level 4 = #30–#600)
  - Rider rows are tappable → navigate to rider detail page

#### Tab 3: Rules
- List of documentation sections as navigation links
- Links to `/league/[id]/help` sub-pages (existing Help page structure)
- Sections: How auctions work, Scoring & XP, Levels & progression, Sponsors & budget, Strategies & boosts, Grand Tour mode, Release & cooldown

### 6.3 Non-Commissioner View

Players who joined (not the commissioner) see the same 3 tabs but:
- Lobby: no "Launch" button, text says "Waiting for the Race Director to start the auction"
- Level & Pool: level selector is read-only (displays current level)
- Rules: same

## 7. Migration & Data Changes

### 7.1 Database

- Add `is_demo BOOLEAN DEFAULT false` column to `leagues` table
- Add demo league row (created by refresh script)
- Modify RLS: allow unauthenticated read access to demo league data only
- No changes to existing RPCs (they already require auth — demo visitors can't call them)

### 7.2 Refresh Script

- Location: `services/pcs-sync/` or new `scripts/` directory
- Input: Jonathan's real league ID
- Process: export league data → anonymize team/player names → upsert demo league + related tables (contracts, teams, auction_bids, rider_xp_daily, etc.)
- Output: demo league in database, ready to serve

### 7.3 Auth Flow Changes

- Modify `/app/page.tsx`: unauthenticated → new landing page (not `/onboarding`)
- New route group `(public)` for landing page
- Modify `league/[leagueId]/layout.tsx`: handle `leagueId === "demo"` (skip auth check, enable demo context)
- New `DemoProvider` context: provides `isDemo` flag, intercepts mutations
- Modify existing signup/login pages or create new combined flow pages

### 7.4 Existing Pages Affected

| Page | Change |
|------|--------|
| `app/page.tsx` | Redirect unauth to new landing (not `/onboarding`) |
| `(auth)/onboarding/page.tsx` | Replaced by new landing page |
| `(auth)/signup/page.tsx` | Simplified (remove display_name), or replaced by combined flow |
| `(auth)/league/create/page.tsx` | Replaced by combined flow |
| `(auth)/league/join/page.tsx` | Replaced by combined flow (keep `?code=` support) |
| `(auth)/league/choose/page.tsx` | Integrated into "Get Started" flow |
| `(game)/league/[leagueId]/layout.tsx` | Add demo mode detection + DemoProvider |
| `(game)/league/[leagueId]/page.tsx` | Show lobby redesign for pending leagues |
| `(game)/league/[leagueId]/lobby-view.tsx` | Major redesign (3 tabs) |
| `lib/supabase/middleware.ts` | Allow `/league/demo/...` without auth |

## 8. Out of Scope

- Video creation (external dependency)
- Help/documentation content writing (existing `/help` page structure used as-is)
- Notification system for email reminders
- Mobile app (web only)
- A/B testing of conversion flows
- Analytics/tracking integration
