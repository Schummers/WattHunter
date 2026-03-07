# UI Polish — Todo List

## Design System
- [ ] Create `FormField` component (label + input wrapper, consistent gap/font/color)
- [ ] Replace all inline label+input patterns with FormField (login, signup, create league, join league, invite code)
- [ ] FormField should handle error/success messages tight to the input (no extra gap)

## Home / Lobby
- [ ] Remove padlock icons from locked bottom nav items (they're already visually disabled)
- [ ] Fix spacing: TopBar too close to content, separators touching icons
- [ ] TopBar height: 32px → 40px
- [ ] TopBar: replace Zap icon with custom watthunter-icon.svg
- [ ] TopBar right: replace avatar with Settings gear icon
- [ ] "Pending" badge spacing fix
- [ ] Bottom nav: fix spacing between separator and icons

## Forms consistency
- [ ] Invite code input: remove bold, align left, keep uppercase, same color as other inputs
- [ ] Join league form: apply FormField, consistent labels (text-sm font-semibold text-mid)
- [ ] Create league form: apply FormField

## Auth / Invite flow
- [x] Unauthenticated user opening /league/join → redirect to /onboarding (fixed in middleware)

## Navigation
- [ ] League switcher (TopBar chevron) — clicking should show dropdown to switch between leagues
