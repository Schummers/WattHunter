"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";
import { getGTSubTabLabel } from "@/lib/gt-phases";
import { isClassic, type LeagueMode } from "@/lib/league-mode";

interface TeamSubTabsProps {
  leagueId: string;
  mode: LeagueMode;
}

export function TeamSubTabs({ leagueId, mode }: TeamSubTabsProps) {
  const gtLabel = getGTSubTabLabel(); // "Giro Team" / "Tour Team" / "Vuelta Team" / "Race Team"

  if (isClassic(mode)) {
    return (
      <SubTabs
        tabs={[{ label: gtLabel, href: `/league/${leagueId}/team/gt` }]}
      />
    );
  }

  return (
    <SubTabs
      tabs={[
        { label: "My Team", href: `/league/${leagueId}/team` },
        { label: gtLabel, href: `/league/${leagueId}/team/gt` },
        { label: "Budget", href: `/league/${leagueId}/team/budget` },
      ]}
    />
  );
}

export default function TeamLayout({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode?: LeagueMode;
}) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  // Strategies page keeps its own page-level hide (unchanged access from My Team card).
  const hideTabs = pathname.includes("/strategies") || pathname.includes("/rescue");

  return (
    <>
      {!hideTabs && (
        <TeamSubTabs leagueId={leagueId} mode={mode ?? "manager"} />
      )}
      {children}
    </>
  );
}
