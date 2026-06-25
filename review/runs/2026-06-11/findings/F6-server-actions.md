# F6-server-actions — Findings (3)

| ID | Sev | Eff | Lane | file:line | Issue | Fix | Test idea |
|---|---|---|---|---|---|---|---|
| BR-08 | P2 | S | B | `apps/web/app/(game)/league/[leagueId]/settings/actions.ts:29-136` | updateTeamName and updateLeagueName perform ownership/commissioner che... | Verify the teams and leagues RLS UPDATE policies r... | As a non-owner league member, attempt a direct Pos |
| SEC-F6-4 | P2 | S | A | `apps/web/app/api/admin/revalidate-demo/route.ts:16` | The bearer-secret check uses a plain string comparison (auth !== `Bear... | Compare using a constant-time function (e.g. extra... | Unit test: POST with a wrong-but-same-length token |
| F3-SEC-03 | P2 | M | B | `apps/web/contexts/demo-context.tsx:67-81` | useDemoSafeAction is a client-only write guard: in demo mode it short-... | Add an explicit server-side rejection in the spons... | Call saveSponsor server-side directly with the dem |