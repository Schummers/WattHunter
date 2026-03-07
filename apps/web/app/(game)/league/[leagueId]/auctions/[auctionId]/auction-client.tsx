"use client";

import { useState } from "react";
import { RiderTable } from "./rider-table";
import { RiderDialog } from "./rider-dialog";
import { Button } from "@/components/ui/button";
import { cancelBid } from "./actions";

interface Rider {
  id: string;
  full_name: string;
  real_team: string;
  specialty: string;
  nationality: string;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
  is_contracted: boolean;
}

interface Bid {
  id: string;
  rider_id: string;
  amount: number;
}

interface Team {
  id: string;
  treasury: number;
}

interface AuctionClientProps {
  riders: Rider[];
  myBids: Bid[];
  team: Team;
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
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const myBidRiderIds = new Set(myBids.map((b) => b.rider_id));
  const activeBidsTotal = myBids.reduce((s, b) => s + b.amount, 0);

  const existingBid = selectedRider
    ? (myBids.find((b) => b.rider_id === selectedRider.id) ?? null)
    : null;

  return (
    <>
      {myBids.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-[var(--text-mid)]">
            My bids ({myBids.length})
          </span>
          {myBids.map((bid) => {
            const rider = riders.find((r) => r.id === bid.rider_id);
            return (
              <div
                key={bid.id}
                className="flex items-center justify-between border-b border-border py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--text-high)]">
                    {rider?.full_name ?? "—"}
                  </span>
                  <span className="text-sm text-[var(--text-mid)]">
                    {rider?.real_team}
                  </span>
                  <span className="text-sm font-semibold text-[var(--accent-default)]">
                    {bid.amount.toLocaleString("en-US")} EUR
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rider && setSelectedRider(rider)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[var(--status-danger)]"
                    onClick={() => cancelBid(bid.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="my-2 border-b border-border" />
        </div>
      )}

      <RiderTable
        riders={riders}
        myBidRiderIds={myBidRiderIds}
        onRiderClick={setSelectedRider}
      />

      <RiderDialog
        rider={selectedRider}
        existingBid={existingBid}
        treasury={team.treasury}
        activeBidsTotal={activeBidsTotal}
        auctionId={auctionId}
        currentRound={currentRound}
        onClose={() => setSelectedRider(null)}
      />
    </>
  );
}
