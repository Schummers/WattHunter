"use client";

import { usePathname, useParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

export default function AuctionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  // Hide sub-tabs on detail routes (auction detail, rounds deep-link)
  const hide = /\/auction\/(rounds|[0-9a-f-]{36})(\/|$)/.test(pathname);

  return (
    <>
      {!hide && (
        <SubTabs
          tabs={[
            { label: "Auctions", href: `/league/${leagueId}/auction` },
            { label: "Market", href: `/league/${leagueId}/auction/market` },
            { label: "League", href: `/league/${leagueId}/auction/status` },
            { label: "History", href: `/league/${leagueId}/auction/history` },
          ]}
        />
      )}
      {children}
    </>
  );
}
