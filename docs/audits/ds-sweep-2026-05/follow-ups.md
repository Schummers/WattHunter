# Follow-ups (hors scope sweep)

Items repérés pendant le sweep mais qui sortent du scope A-E. À traiter dans un chantier séparé.

| Date | Source (audit/repair) | Item | Type |
|---|---|---|---|
| 2026-05-21 | auction-detail / rider-dialog.tsx D-002 | `SPECIALTY_NAMES` mapping uses French labels ("Grimpeur", "Sprinteur", "Contre-la-montre", "Polyvalent") — replace with English ("Climber", "Sprinter", "Time Trialist", "All-Rounder") per Language Rule | Language Rule |
| 2026-05-21 | auction-detail / rider-table.tsx D-003 | `<option>` labels in specialty filter use French ("Grimpeur", "Sprinteur", "Polyvalent") — align with English labels | Language Rule |
| 2026-05-21 | auction-detail / rider-table.tsx D-001 | Two native `<select>` elements (Team filter, Specialty filter) should use Shadcn `<Select>` or Filter Chips (`segmented-control.tsx`) per DS pattern | DS Pattern |
| 2026-05-21 | team-gt-rescue / gt-rescue-market.tsx cross-cutting | `renderRight` bid input slot is duplicated in `auction-market/market-client.tsx` renderRiderRight — extract shared `<BidInputSlot>` component after sweep | Refactor |
