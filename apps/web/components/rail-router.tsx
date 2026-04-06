"use client";

import { lazy, Suspense, useMemo } from "react";

const RiderDetailRail = lazy(() => import("./rail-pages/rider-detail-rail"));
const LevelsRail = lazy(() => import("./rail-pages/levels-rail"));
const StrategiesRail = lazy(() => import("./rail-pages/strategies-rail"));

interface RailRouterProps {
  path: string;
}

function parsePath(path: string) {
  // /league/[leagueId]/rider/[riderId]?from=...
  let match = path.match(/\/league\/([^/]+)\/rider\/([^/?]+)/);
  if (match) {
    const searchParams = new URLSearchParams(path.split("?")[1] ?? "");
    return { type: "rider" as const, leagueId: match[1], riderId: match[2], from: searchParams.get("from") ?? undefined };
  }

  // /league/[leagueId]/levels
  match = path.match(/\/league\/([^/]+)\/levels$/);
  if (match) {
    return { type: "levels" as const, leagueId: match[1] };
  }

  // /league/[leagueId]/team/strategies
  match = path.match(/\/league\/([^/]+)\/team\/strategies$/);
  if (match) {
    return { type: "strategies" as const, leagueId: match[1] };
  }

  return null;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="size-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-default)]" />
    </div>
  );
}

export function RailRouter({ path }: RailRouterProps) {
  const parsed = useMemo(() => parsePath(path), [path]);

  if (!parsed) return null;

  return (
    <Suspense fallback={<LoadingFallback />}>
      {parsed.type === "rider" && (
        <RiderDetailRail leagueId={parsed.leagueId} riderId={parsed.riderId} from={parsed.from} />
      )}
      {parsed.type === "levels" && (
        <LevelsRail leagueId={parsed.leagueId} />
      )}
      {parsed.type === "strategies" && (
        <StrategiesRail leagueId={parsed.leagueId} />
      )}
    </Suspense>
  );
}
