# WattHunter — Backlog

> Consolidated from TODO_UI_POLISH.md + TODO_DESIGN_AUDIT.md (2026-03-07)
> Wireframe vs Prod audit added 2026-03-07

---

## P1 — Pre-Alpha (done)

- [x] Lobby round config — Race Director configures dates for first 3 rounds before launch
- [x] Team name instead of user name in lobby (team_name = username by default)
- [x] League switcher dropdown (TopBar chevron)

## My Team — Wireframe Audit (2026-03-07)

### ~~MT-1: Header — 2 metric blocks side by side~~ ✅
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: XP + "Ranked #—" on one line
- **Target**: Two separate blocks. Left: label "TOTAL XP SEASON" + big number + "Updated after each race" subtitle. Right: label "RANKING" + "3rd / 12 >" tappable
- **Priority**: high

### ~~MT-2: Ranking block tappable
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: Static text "Ranked #—"
- **Target**: Entire ranking block (number + text + chevron) is a Link to ranking page. Not just the chevron — the whole block.
- **Priority**: high

### ~~MT-3: Boost pill with calculated value
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: No boost pill, only "Policies →" link
- **Target**: Pill showing "+X% Boost" (no colored dot, no "active" word). X = sum of all active policy boosts weighted by impacted riders. If no active policy → "+0% Boost". Aligned left, same row as "Change policies →" link on right.
- **Calcul**: For each active policy, sum the boost % × number of roster riders matching that policy. Display total.
- **Priority**: high

### ~~MT-4: "Change policies →" alignment
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: "Policies →" link exists but not aligned with boost pill
- **Target**: Same row as boost pill, right-aligned. Text: "Change policies →"
- **Priority**: high

### ~~MT-5: Separator line between header and Roster
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Target**: Add a divider (border-subtle) between the header block (metrics + boost row) and the Roster section
- **Priority**: low

### ~~MT-6: Section order — Roster before Pending Bids
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: Pending Bids → Roster → Team Level
- **Target**: Roster → Pending Bids → Team Level
- **Priority**: high

### ~~MT-7: Flags instead of country codes
- **Scope**: Global — all rider cards across the app
- **Current**: Some riders show "NL", country code text
- **Target**: Use flag emoji (🇳🇱, 🇧🇪, etc.) from nationality field. Already stored in DB as flag emoji — verify it's passed through correctly everywhere.
- **Priority**: high

### ~~MT-8: Pending Bids — round info + closing time
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: Shows "X bids" count
- **Target**: Show "Round N · closes [date/time]" (e.g., "Round 1 · closes Mar 8 18:00"). Requires reading auction round number + closes_at from the active auction.
- **Priority**: medium

### ~~MT-9: Pending Bids — outbid lifecycle rule
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Rule**: All bids stay visible in Pending Bids until the 3-round auction cycle completes. Won riders → move to Roster. Lost riders → disappear from My Team (viewable in Auction History only).
- **Current**: Only shows active bids
- **Target**: Show all bids from current auction cycle (active + outbid + lost), with appropriate visual states
- **Priority**: medium (deprioritize if complex)

### ~~MT-10: Pending Bids — bid amount without "/mo"
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: "155 000 /mo"
- **Target**: "155 000" (plain number, no suffix)
- **Priority**: low

### ~~MT-11: Open slot — hover state
- **Component**: `apps/web/components/rider-card.tsx`
- **Current**: No hover feedback on open slot card
- **Target**: Add hover:bg-[var(--bg-subtle)] like regular rider cards. No "→ Go to Recruts" subtitle needed.
- **Priority**: low

### ~~MT-12: Tertiary buttons / links — hover state (Design System)
- **Scope**: Global — all "→" links (Change policies →, See all →, History →, etc.)
- **Current**: No visible hover state
- **Target**: On hover, text color becomes a darker shade of brand color. No background change. Just text color shift.
- **Priority**: medium

### ~~MT-14: Pending Bids rider cards — make clickable
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/page.tsx`
- **Current**: Pending Bid rider cards have no `href` — not clickable
- **Target**: Each pending bid rider card links to `/league/${leagueId}/rider/${riderId}?from=team`. User can view details and update/remove bid from there.
- **Priority**: high

### MT-13: Team Level — redesign (card + page)
- **Design doc**: `docs/plans/2026-03-08-team-level-redesign-design.md`
- **Card "Team Level"** (reusable on My Team + Home):
  - Mesh gradient CSS background (animated, `animate-mesh-slow`)
  - Inside card: "Team level" title (13px/600, --text-mid) + "All levels →" CTA (12px/500, --text-low)
  - Level badge left [3] + progress bar full-width + level badge right [4]
  - "240 / 350 XP" left-aligned above the progress bar
  - Badges taller to match height of (XP text + progress bar)
  - Pills below showing **new unlocks at next level only**
  - Hover: scale-[1.01] + cyan glow shadow
  - Clickable → `/league/{id}/team/levels`
- **Page "All Levels"** (`/league/{id}/team/levels`):
  - Back header "← My Team" (no sub-tabs My Team/Recruts)
  - Hero: same mesh gradient card as above, without "Team level" / "All levels →"
  - List of all 10 levels with dividers (NOT cards)
  - Each level: "Level N" left + XP right (same line), pills of **new** unlocks below
  - Current level: "240 / 350 XP" on right + progress bar + not dimmed
  - Past levels: normal opacity, no checkmarks
  - Future levels: dimmed (--text-low), pills dimmed too
  - No padlocks, no left border bar, no level names (just "Level 1", "Level 2"...)
  - No numbering badges — just text "Level N"
- **Pills content per level**: new slots, new pool range, new policy type, new max policies, new sponsor (tier + amount, e.g., "Sponsor T3 · 125k€"), dual sponsor unlock at Lv5
- **Priority**: high

### MT-15: Recruts bid card — remove cyan background tint
- **Component**: `apps/web/components/rider-card.tsx` or `recruts-client.tsx`
- **Current**: Rider cards with active bids have a faded cyan/tinted background
- **Target**: Use `--bg-surface-hover` background instead (same as card hover state). The cyan input field is sufficient to indicate a bid — no need for background tint.
- **Priority**: high

## Recruts — Wireframe Audit (2026-03-07)

### ~~RC-1: Round header — smaller, less prominent
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`
- **Current**: Bold, prominent text with round name + date + J-countdown
- **Target**: Same font size as History CTA (text-sm). Round name in bold (e.g., "Round 1") but rest in normal weight. Use `--text-mid` color, not `--text-high`. Less visually dominant.
- **Priority**: high

### ~~RC-2: Round header — smart countdown
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`
- **Current**: Shows "J-X" (days until close)
- **Target**: Smart format based on time remaining:
  - \> 1 day → "in X days" (e.g., "in 14 days")
  - < 1 day → "in X hours" (e.g., "in 4 hours")
  - Display next to round name, e.g., "**Round 1** · in 8 days"
- **Implementation**: Simple date math, no live timer needed. Computed on render.
- **Priority**: high

### ~~RC-3: Bid input — wider + space separator for thousands
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`
- **Current**: `w-16` input, no thousands separator, step=100
- **Target**:
  - Increase input width by ~30% (w-16 → w-20 or similar, test visually)
  - Display space as thousands separator (e.g., "80 000" not "80000")
  - Change step from 100 to 1000 (arrow keys increment by 1000)
  - Allow any integer value (not just multiples of step)
- **Priority**: high

### ~~RC-4: Bid input — fix "invalid data" errors
- **Page**: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`
- **Current**: Some valid numbers trigger "invalid data" (e.g., 27033). Likely a Zod validation issue (step constraint or rounding).
- **Target**: Accept any positive integer ≥ minimum salary. Only reject if below min salary or non-numeric. Write tests covering edge cases (exact min, min-1, odd numbers, large numbers, negatives, zero).
- **Priority**: high

### ~~RC-5: Bid input — better error for slot overflow
- **Page**: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts`
- **Current**: Shows "invalid data" when bidding on more riders than available slots
- **Target**: Show specific message like "No available slots (6/6 used)" instead of generic "invalid data"
- **Priority**: medium

### ~~RC-6: Sticky bar — € symbol instead of "EUR"
- **Component**: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`
- **Current**: "57 000 EUR"
- **Target**: "57 000 €"
- **Priority**: low

### ~~RC-7: Avatar photos — align to top (show faces, not jerseys)
- **Component**: `apps/web/components/ui/avatar.tsx` or `rider-card.tsx`
- **Current**: Photos centered in circle → jerseys/maillots dominate, faces cut off
- **Target**: Add `object-position: top` to AvatarImage so the top of the photo (face) is visible instead of the center (jersey).
- **Priority**: high

### ~~RC-8: History link — add real href
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/recruts/recruts-client.tsx`
- **Current**: `<button>` with no navigation
- **Target**: Change to `<Link href={/league/${leagueId}/team/recruts/history}>` so it actually navigates to auction history
- **Priority**: medium

## Rider Detail — Wireframe Audit (2026-03-07)

> 3 states depending on context: **Recruts** (available rider), **My Team** (owned rider), **Ranking** (any rider, read-only)

### ~~RD-1: 3-state architecture
- **Page**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/page.tsx` + `rider-detail-client.tsx`
- **Current**: Same layout for all riders, `isOwned` boolean only affects Game XP metric highlight
- **Target**: Determine context from referrer or query param (`?from=recruts|team|ranking`). Render conditionally:

| | **Recruts** (available) | **My Team** (owned) | **Ranking** (any) |
|---|---|---|---|
| Back label | ← Recruts | ← My Team | ← Ranking |
| Metrics | GAME XP (—) + BONUS (—) + MIN. SALARY | GAME XP + BONUS € + PAID SALARY | GAME XP + BONUS € (2 boxes) |
| Boost badge | No | +X% badge in hero tags | No |
| Action | Bid section (stepper + save + remove) | Release button ("Release rider — 1 month notice") | None |
| Ownership line | — | — | "Owned by @user · Team" or "Not recruited" |
| Tabs | PCS Stats / Game Stats | PCS Stats / Game Stats | Game Stats only (no segmented control) |

- **Data needed from page.tsx**: `context` (recruts/team/ranking), `activeRound`, `currentBid`, `minSalary`, `paidSalary`, `ownerInfo` (user display_name + team name, for ranking view)
- **Priority**: high

### ~~RD-2: Back header — contextual label + remove divider
- **Component**: `apps/web/components/back-header.tsx` + `rider-detail-client.tsx`
- **Current**: "← Back" with a divider line underneath
- **Target**: Label changes based on context (Recruts / My Team / Ranking). Remove the divider/separator line under the back header.
- **Priority**: medium

### ~~RD-3: Hero layout — horizontal (avatar left, info right)
- **Page**: `rider-detail-client.tsx`
- **Current**: Avatar centered on top, name centered below (vertical stack)
- **Target**: Avatar left (larger, ~size-16/size-20), name + flag + team + tags on the right. PCS rank badge overlapping bottom of avatar (like rider-card). Avatar height ≈ height of name + team + tags block.
- **Spacing**: Name and team close together (gap-0.5). More space between team line and tags (gap-2).
- **Tags**: Keep all (specialty, age, height, weight). In owned state, add boost badge (+X%) near name — white bg + black text (not green).
- **Priority**: high

### ~~RD-4: Metric boxes — conditional per state
- **Page**: `rider-detail-client.tsx`
- **Current**: 3 boxes: "PCS Points" + "PCS Rank" + "Game XP"
- **Target per state**:
  - **Recruts**: GAME XP (—) + BONUS € (—) + MIN. SALARY (max(5000, pcs_points_1yr × 2000 / 12))
  - **My Team**: GAME XP (value) + BONUS € (+Xk€) + PAID SALARY (locked_salary from contract)
  - **Ranking**: GAME XP (value) + BONUS € (value) — only 2 boxes
- **Style**: Bigger font for values (text-xl or text-2xl font-mono font-bold). Current MetricBox feels too small.
- **Priority**: high

### ~~RD-5: Bid section (Recruts state only)
- **Page**: `rider-detail-client.tsx`
- **Current**: No bid section exists
- **Target**: Below metric boxes, visible only when context=recruts AND active auction exists:
  - Input field (same style as Recruts bid input, space thousands separator)
  - − / + buttons on either side (step = 1000)
  - Default value = min salary (placeholder)
  - "Save" button (disabled until amount entered/changed, re-disables after save)
  - "Remove bid" link below Save (tertiary style, no icon)
  - Calls same `placeBid` / `cancelBid` server actions
- **Priority**: high

### ~~RD-6: Release button (My Team state only)
- **Page**: `rider-detail-client.tsx`
- **Current**: Absent
- **Target**: Below metric boxes, visible only when context=team (owned rider). Secondary button, full width: "Release rider — 1 month notice". Calls a server action to set contract status to "notice".
- **Priority**: high

### ~~RD-7: Ownership line (Ranking state only)
- **Page**: `rider-detail-client.tsx`
- **Current**: Absent
- **Target**: Below metric boxes. Shows "Owned by @username · Team Name" if recruited, or "Not recruited" if no active contract. Subtle text (--text-mid).
- **Priority**: medium

### ~~RD-8: Segmented control — restyle or hide
- **Component**: `apps/web/components/segmented-control.tsx`
- **Current**: Visually doesn't fit the dark theme
- **Target**:
  - **Recruts + My Team**: Show segmented control (PCS Stats / Game Stats), restyle with pill shape + contrasting active state
  - **Ranking**: No segmented control — show Game Stats directly with "GAME RESULTS" section title
- **Priority**: medium

### ~~RD-9: Season rankings — flat table, not cards
- **Page**: `rider-detail-client.tsx`
- **Current**: Individual bordered cards per season
- **Target**: Flat table rows with inset dividers. Columns: Year | Team | Points | #Rank. No card borders/backgrounds.
- **Data**: Join `rider_season_rankings` with `rider_teams` to show team per season. Both tables exist in DB.
- **Bug**: Investigate why rank column shows "--" — data may be null in DB. Check Pipeline A/E.
- **Priority**: high

### ~~RD-10: Race programme section (PCS Stats tab)
- **Page**: `rider-detail-client.tsx`
- **Current**: Absent
- **Target**: Section "RACE PROGRAMME" in PCS Stats tab. Same flat table format. Columns: Race name (bold) + date (subtitle) | Category badge (WT/GT).
- **Data**: `race_startlists` table, query by rider_id. Populated by Pipeline C.
- **Priority**: high

### ~~RD-11: Game Results section (Game Stats tab)
- **Page**: `rider-detail-client.tsx`
- **Current**: Placeholder text "Game stats will be available once this rider is on a team."
- **Target**: When data exists: section "GAME RESULTS" grouped by month (APRIL 2026, MARCH 2026...). Each row: date | race name | PCS pts | XP | bonus € (green accent).
  - Column labels (PCS, XP, €) above the values, not below — or inline with value (e.g., "840 PCS"). Not underneath.
  - Tight spacing between date and race name (no excessive gap).
  - Inset dividers between rows.
  - When no data: keep placeholder "Game stats will be available once this rider is on a team." (no extra title, the tab name is enough).
- **Data**: `race_results` table joined with game scoring data. Show only results since rider was contracted.
- **Priority**: high (but depends on actual race data existing)

### ~~RD-12: Section spacing
- **Page**: `rider-detail-client.tsx`
- **Target**: Consistent vertical spacing between major sections (space-y-6). No explicit dividers — rely on natural spacing. No separator line between action zone and tabs.
- **Priority**: low

## Settings — Wireframe Audit (2026-03-07)

### ~~ST-1: Restructure into 3 sections
- **Page**: `apps/web/app/(game)/league/[leagueId]/settings/page.tsx`
- **Current**: Profile hero → League section → Documentation → Sign out (flat)
- **Target**: 3 clearly separated sections with dividers between them:
  1. **Account Settings**: Avatar + name + email + Sign out (secondary button)
  2. **League Settings**: League selector + team name (editable) + invite code + invite URL + Leave league (secondary button with icon)
  3. **Documentation**: Keep current design (icon cards with chevrons)
- **Priority**: high

### ~~ST-2: Remove "Edit profile →"
- **Page**: `settings/page.tsx`
- **Current**: "Edit profile →" link next to avatar
- **Target**: Remove — there's nothing to edit
- **Priority**: low

### ~~ST-3: Sign out — move to Account section as secondary button
- **Page**: `settings/page.tsx`
- **Current**: Sign out at the very bottom, standalone
- **Target**: Move into Account Settings section, right below name/email. Style as secondary button.
- **Priority**: medium

### ~~ST-4: League selector (switch between leagues)
- **Page**: `settings/page.tsx`
- **Current**: Only shows current league name + role
- **Target**: Dropdown/select field showing current league name. If user has multiple leagues, can switch between them. Changing selection updates the league context below (team name, invite code, etc.).
- **Data**: Query all leagues for current user from `league_members`. Changing league updates section below without redirect (client-side state).
- **Priority**: high

### ~~ST-5: Team name — editable with save button
- **Page**: `settings/page.tsx`
- **Current**: Read-only `<span>` in a bordered div
- **Target**: Editable `<input>` with a small save button (icon) to the right. Save button is disabled by default. When text changes → save button activates. On click → server action updates `teams.name`. After save → button disables again.
- **Priority**: high

### ~~ST-6: Invite URL + invite code
- **Page**: `settings/page.tsx`
- **Current**: Only invite code with Copy button
- **Target**: Show both:
  - Invite URL (full link to join page) with Copy button
  - Invite code (WH-XXXXX) with Copy button
- **Priority**: medium

### ~~ST-7: Leave league — secondary button with icon
- **Page**: `settings/page.tsx`
- **Current**: Plain red text link
- **Target**: Secondary button style with icon (e.g., DoorOpen or LogOut). Confirmation dialog before action.
- **Priority**: medium

### ~~ST-8: Documentation items — add hover state
- **Page**: `settings/page.tsx`
- **Current**: No hover feedback on doc items
- **Target**: Add hover:bg-[var(--bg-subtle)] on doc item rows (same pattern as rider cards)
- **Priority**: low

### ST-9: Back header — remove divider (global)
- **Component**: `apps/web/components/back-header.tsx`
- **Current**: Divider line under back header
- **Target**: Remove divider globally from back-header component. Applies everywhere (Settings, Rider Detail, etc.)
- **Priority**: high

## Auction History — Wireframe Audit (2026-03-07)

### ~~AH-1: Round header — simplify to name + date only
- **Page**: `apps/web/app/(game)/league/[leagueId]/team/recruts/history/page.tsx`
- **Current**: Round name + date + "X riders" in bg-subtle block
- **Target**: Just round name + date. Remove rider count.
- **Priority**: low

### ~~AH-2: Amount format — € symbol + space separator
- **Page**: `history/page.tsx`
- **Current**: "180,000 EUR" (comma separator + EUR text)
- **Target**: "180 000 €" (space separator + € symbol)
- **Priority**: medium

### AH-3: Keep prod layout (no avatar, no badges)
- **Note**: Keep the current prod layout (rider name as title, sub-rows per bidder). Do NOT add avatars, Won/Lost/My bid badges, or bid counts. Prod is cleaner.

## P2 — Gameplay Core

- [ ] Rider Detail bid/release — stepper bid (available rider), Release button (owned rider)
- [ ] Policies save flow — sticky bar "X/Y active policies" + old/new boost + Save
- [ ] Settings team name — inline editable input (currently read-only)
- [ ] Recruts accordions — grouped view when filtering by Teams/Specialty/etc.

## P3 — UI Polish

- [ ] Sub-tabs (My Team / Recruts) — double the top padding above the tab bar to give more breathing room between TopBar and tabs
- [ ] FormField component (label + input wrapper, consistent gap/font/color)
- [ ] Replace all inline label+input patterns with FormField
- [ ] Invite code input: remove bold, align left, keep uppercase
- [ ] "Pending" badge spacing fix
- [ ] Naming convention audit: team_name everywhere in game, never user name

## P4 — Deferred (post-alpha)

- [ ] Home Feed — mesh gradient + contextual cards (next races, results, XP, active auction)
- [ ] Ranking page — tabs Teams/Riders, course filter, Team Detail
- [ ] Auction Calendar — 8 rounds/year, calendar view
- [ ] Keyboard-up overlay — fixed overlay above mobile keyboard: photo + stepper + budget + confirm
- [ ] Policies coverage — progress bars "X/Y riders covered" per policy
