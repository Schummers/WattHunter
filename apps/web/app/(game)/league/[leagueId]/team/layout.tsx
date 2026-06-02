"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";
import { getGTSubTabLabel } from "@/lib/gt-phases";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  // Strategies page keeps its own page-level hide (unchanged access from My Team card).
  const hideTabs = pathname.includes("/strategies") || pathname.includes("/rescue");

  const gtLabel = getGTSubTabLabel(); // "Giro Team" / "Tour Team" / "Vuelta Team" / "Race Team"

  return (
    <>
      {!hideTabs && (
        <SubTabs
          tabs={[
            { label: "My Team", href: `/league/${leagueId}/team` },
            { label: gtLabel, href: `/league/${leagueId}/team/gt` },
            { label: "Budget", href: `/league/${leagueId}/team/budget` },
          ]}
        />
      )}
      {children}
    </>
  );
}
