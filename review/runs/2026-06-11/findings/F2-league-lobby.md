# F2-league-lobby — Findings (3)

| ID | Sev | Eff | Lane | file:line | Issue | Fix | Test idea |
|---|---|---|---|---|---|---|---|
| F2-ARCH-03 | P2 | S | B | `apps/web/app/(lobby)/lobby/[leagueId]/page.tsx:23-47:23-47` | Auth/authorization gating is split between layout.tsx and page.tsx in ... | Consolidate the gate. Either fetch league+membersh... | N/A (relies on RLS + render-order between layout a |
| F2-ARCH-04 | P2 | S | A | `apps/web/app/(lobby)/lobby/[leagueId]/_components/launch-button.tsx:5:5` | Cross-route-group coupling: the lobby component imports launchFirstAuc... | Move launchFirstAuction into the lobby's own actio... | Lint/architecture rule (e.g. eslint no-restricted- |
| F2-ARCH-05 | P2 | S | B | `apps/web/app/(lobby)/lobby/[leagueId]/_components/launch-button.tsx:29:29` | Client launch gate is `canLaunch = memberCount >= 1`, and the server R... | Decide the minimum-player rule explicitly. If >=2,... | Once decided: pgTAP test that launch_first_auction |