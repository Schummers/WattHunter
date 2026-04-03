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
  const hideTabs =
    pathname.includes("/policies") || pathname.includes("/auctions/");

  return (
    <>
      {!hideTabs && (
        <SubTabs
          tabs={[
            { label: "My Team", href: `/league/${leagueId}/team` },
            { label: "Market", href: `/league/${leagueId}/team/market` },
            { label: "Auctions", href: `/league/${leagueId}/team/auctions` },
          ]}
        />
      )}
      {children}
    </>
  );
}
