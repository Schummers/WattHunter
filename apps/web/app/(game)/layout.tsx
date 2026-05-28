// Auth gating lives in the per-league layout
// (`league/[leagueId]/layout.tsx`) and per-page server components so demo
// routes (`/league/demo/*`, anonymous-reachable) can opt out. Keeping a hard
// `redirect("/login")` here would short-circuit those forks before they run.
export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
