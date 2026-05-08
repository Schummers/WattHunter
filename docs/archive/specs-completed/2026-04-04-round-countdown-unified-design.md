# Round Countdown — Unified Design

**Date:** 2026-04-04  
**Status:** Approved

---

## Context

Two countdown functions coexisted and produced inconsistent output across the app:

- `smartCountdown()` in `lib/format.ts` — used in market, outputs `"in 1 day"` / `"in 3 hours"` (coarse, ambiguous)
- `timeUntil()` local to `home-feed.tsx` — outputs `"1d 5h"` / `"3h 45m"` (granular, combined units)

Neither labeled whether the round was opening or closing. Neither was real-time. The goal is one shared function, one consistent format, used everywhere.

---

## Design

### Function signature

```ts
// lib/format.ts
formatRoundCountdown(
  target: Date | string,
  status: "open" | "scheduled"
): { text: string; urgent: boolean }
```

Returns both the display string and an urgency flag for color styling.

### Format rules

| Remaining | Output example |
|-----------|----------------|
| ≥ 1 day | `"closes in 1d 5h"` / `"opens in 1d 5h"` |
| < 1 day, ≥ 1 hour | `"closes in 18h"` / `"opens in 18h"` |
| < 1 hour | `"closes in < 1h"` / `"opens in < 1h"` |
| ≤ 0 (defensive fallback) | `"ended"` — never shown in normal UI flow |

**Granularity:** days + hours only. Minutes never shown.

**Label rule (one condition, no exceptions):**
- `status === "open"` → prefix is `"closes in"`
- `status === "scheduled"` → prefix is `"opens in"`

### Urgency / color

| Remaining | `urgent` | Color token |
|-----------|----------|-------------|
| > 48h | `false` | `--text-mid` (normal) |
| ≤ 48h | `true` | `--warning` (orange) |

### Data source

- Open round → countdown targets `closes_at`
- Scheduled round → countdown targets `opens_at`

Both fields are set by the commissioner's schedule. If the commissioner modifies a round's dates, the countdown automatically reflects the new values on next page load — no additional logic needed.

### "ended" fallback

`"ended"` is a silent defensive fallback for the case where `diffMs <= 0`. It should never appear in the UI under normal operation because:
- Queries only fetch rounds with `status = "open"` or `"scheduled"`
- When a round closes, it transitions to `"closed"` and is no longer fetched
- The UI then switches to displaying the next round

---

## Rendering

**Market page** (`market-client.tsx`):
```
Round 1 · closes in 2d 5h        ← --text-mid (> 48h)
Round 1 · closes in 18h          ← --warning (≤ 48h)
Round 1 · opens in 3d 2h         ← --text-mid (scheduled)
```

**Home page** (`home-feed.tsx`):
```
Round 1
closes in 2d 5h                  ← --text-mid
```

Both use the same `formatRoundCountdown()` function. No local helper functions.

---

## Files to modify

| File | Change |
|------|--------|
| `apps/web/lib/format.ts` | Replace `smartCountdown` with `formatRoundCountdown` |
| `apps/web/app/(game)/league/[leagueId]/home-feed.tsx` | Remove local `timeUntil`, use `formatRoundCountdown` |
| `apps/web/app/(game)/league/[leagueId]/team/market/market-client.tsx` | Replace `smartCountdown` usage with `formatRoundCountdown` |

---

## Out of scope

- Real-time ticking (`setInterval`) — static at page load is sufficient for now
- Minutes in the countdown — not needed
- Any other countdown locations beyond home and market
