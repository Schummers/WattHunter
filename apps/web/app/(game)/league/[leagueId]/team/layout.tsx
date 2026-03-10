"use client";

import { usePathname } from "next/navigation";
import { useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;
  const hideTabs = pathname.includes("/policies");

  return (
    <>
      {!hideTabs && (
        <SubTabs
          tabs={[
            { label: "My Team", href: `/league/${leagueId}/team` },
            { label: "Recruts", href: `/league/${leagueId}/team/recruts` },
          ]}
        />
      )}
      {children}
    </>
  );
}
