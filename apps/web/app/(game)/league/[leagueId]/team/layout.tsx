"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";
import { getGTSubTabLabel } from "@/lib/gt-phases";
import { isClassic, type LeagueMode } from "@/lib/league-mode";
import { useLeagueMode } from "@/contexts/league-mode-context";

interface TeamSubTabsProps {
  leagueId: string;
  mode: LeagueMode;
}

export function TeamSubTabs({ leagueId, mode }: TeamSubTabsProps) {
  const gtLabel = getGTSubTabLabel(); // "Giro Team" / "Tour Team" / "Vuelta Team" / "Race Team"

  if (isClassic(mode)) {
    return (
      <SubTabs
        tabs={[
          { label: gtLabel, href: `/league/${leagueId}/team/gt` },
          { label: "Peloton", href: `/league/${leagueId}/team/peloton` },
        ]}
      />
    );
  }

  return (
    <SubTabs
      tabs={[
        { label: "My Team", href: `/league/${leagueId}/team` },
        { label: gtLabel, href: `/league/${leagueId}/team/gt` },
        { label: "Peloton", href: `/league/${leagueId}/team/peloton` },
        { label: "Budget", href: `/league/${leagueId}/team/budget` },
      ]}
    />
  );
}

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;
  const mode = useLeagueMode();

  // Strategies page keeps its own page-level hide (unchanged access from My Team card).
  const hideTabs = pathname.includes("/strategies") || pathname.includes("/rescue");

  return (
    <>
      {!hideTabs && (
        <TeamSubTabs leagueId={leagueId} mode={mode} />
      )}
      {children}
    </>
  );
}
