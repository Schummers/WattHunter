"use client";

import { RiderTable } from "./rider-table";

interface AuctionClientProps {
  riders: any[];
  myBids: any[];
  team: any;
  auctionId: string;
  currentRound: number;
}

export function AuctionClient({
  riders,
  myBids,
  team,
  auctionId,
  currentRound,
}: AuctionClientProps) {
  const myBidRiderIds = new Set(myBids.map((b: any) => b.rider_id));

  return (
    <RiderTable
      riders={riders}
      myBidRiderIds={myBidRiderIds}
      onRiderClick={(rider) => {
        // TODO: Task 10 will add the rider dialog here
        console.log("Rider clicked:", rider.full_name);
      }}
    />
  );
}
