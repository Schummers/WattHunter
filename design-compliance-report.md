# Design System Compliance Report — WattHunter
Generated: 2026-05-14

## Summary
| Severity | Count |
|----------|-------|
| HIGH     | 12 |
| MEDIUM   | 23 |
| LOW      | 1 |

## HIGH Findings

### H-001 · text size bypasses token scale
- **File**: `apps/web/components/draft-bid-card.tsx`
- **Line**: 207
- **Violation**: `text-lg`
- **Fix**: MANUAL (requires human review)

### H-002 · text size bypasses token scale
- **File**: `apps/web/components/draft-bid-card.tsx`
- **Line**: 243
- **Violation**: `text-lg`
- **Fix**: MANUAL (requires human review)

### H-003 · text size bypasses token scale
- **File**: `apps/web/components/gt-rescue-market.tsx`
- **Line**: 126
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-004 · text size bypasses token scale
- **File**: `apps/web/components/gt-rescue-market.tsx`
- **Line**: 225
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-005 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/lobby-view.tsx`
- **Line**: 207
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-006 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/auction/history/page.tsx`
- **Line**: 110
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-007 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/auction/market/market-client.tsx`
- **Line**: 369
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-008 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/auction/market/market-client.tsx`
- **Line**: 409
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-009 · hardcoded white/black
- **File**: `apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx`
- **Line**: 163
- **Violation**: `text-black`
- **Fix**: MANUAL (requires human review)

### H-010 · hardcoded white/black
- **File**: `apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx`
- **Line**: 176
- **Violation**: `text-black`
- **Fix**: MANUAL (requires human review)

### H-011 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/settings/settings-buttons.tsx`
- **Line**: 54
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

### H-012 · text size bypasses token scale
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 486
- **Violation**: `text-base`
- **Fix**: MANUAL (requires human review)

## MEDIUM Findings

### M-001 · hardcoded border radius
- **File**: `apps/web/components/race-card-past.tsx`
- **Line**: 24
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-002 · hardcoded border radius
- **File**: `apps/web/components/race-card-past.tsx`
- **Line**: 41
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-003 · hardcoded border radius
- **File**: `apps/web/components/race-feed-remontada-card.tsx`
- **Line**: 17
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-004 · hardcoded border radius
- **File**: `apps/web/components/race-card-rest-day.tsx`
- **Line**: 7
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-005 · hardcoded border radius
- **File**: `apps/web/components/filter-chips.tsx`
- **Line**: 22
- **Violation**: `rounded-[6px]`
- **Fix**: MANUAL (requires human review)

### M-006 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/components/rider-card.tsx`
- **Line**: 114
- **Violation**: `<span className="absolute -bottom-1 left-1/2 -tran`
- **Fix**: MANUAL (requires human review)

### M-007 · hardcoded border radius
- **File**: `apps/web/components/race-feed-phase-end-banner.tsx`
- **Line**: 13
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-008 · hardcoded border radius
- **File**: `apps/web/components/race-feed-phase-end-banner.tsx`
- **Line**: 22
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-009 · hardcoded border radius
- **File**: `apps/web/components/race-card-future.tsx`
- **Line**: 17
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-010 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/components/brand-card.tsx`
- **Line**: 66
- **Violation**: `<span className="ml-auto flex items-baseline gap-1`
- **Fix**: MANUAL (requires human review)

### M-011 · hardcoded border radius
- **File**: `apps/web/components/gt-rescue-market.tsx`
- **Line**: 170
- **Violation**: `rounded-[6px]`
- **Fix**: MANUAL (requires human review)

### M-012 · hardcoded border radius
- **File**: `apps/web/components/race-feed-nemesis-card.tsx`
- **Line**: 44
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-013 · hardcoded border radius
- **File**: `apps/web/components/race-card-today.tsx`
- **Line**: 17
- **Violation**: `rounded-[10px]`
- **Fix**: MANUAL (requires human review)

### M-014 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 359
- **Violation**: `<span className="absolute -bottom-1 left-1/2 -tran`
- **Fix**: MANUAL (requires human review)

### M-015 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 382
- **Violation**: `<span className="rounded-full border border-[var(-`
- **Fix**: MANUAL (requires human review)

### M-016 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 387
- **Violation**: `<span className="rounded-full border border-[var(-`
- **Fix**: MANUAL (requires human review)

### M-017 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 392
- **Violation**: `<span className="rounded-full border border-[var(-`
- **Fix**: MANUAL (requires human review)

### M-018 · Wrong component pattern (Tags/Pills)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 397
- **Violation**: `<span className="rounded-full border border-[var(-`
- **Fix**: MANUAL (requires human review)

### M-019 · Wrong font family (Numbers)
- **File**: `apps/web/components/rider-card.tsx`
- **Line**: 189
- **Violation**: `XP`
- **Fix**: MANUAL (requires human review)

### M-020 · Wrong font family (Numbers)
- **File**: `apps/web/app/(game)/league/[leagueId]/ranking/ranking-client.tsx`
- **Line**: 216
- **Violation**: `XP`
- **Fix**: MANUAL (requires human review)

### M-021 · Wrong font family (Numbers)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 214
- **Violation**: `Game XP`
- **Fix**: MANUAL (requires human review)

### M-022 · Wrong font family (Numbers)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 239
- **Violation**: `Game XP`
- **Fix**: MANUAL (requires human review)

### M-023 · Wrong font family (Numbers)
- **File**: `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client.tsx`
- **Line**: 264
- **Violation**: `Game XP`
- **Fix**: MANUAL (requires human review)

## LOW Findings

### L-001 · opacity overlay
- **File**: `apps/web/app/(game)/league/[leagueId]/achievements/achievements-client.tsx`
- **Line**: 110
- **Violation**: `bg-black/30`
- **Fix**: MANUAL (requires human review)

## Verification
- typecheck: PASS (0 errors)
- lint: PASS (0 errors, warnings ignored)
- vitest: PASS (210/210 tests passing)
