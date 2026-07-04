"use client";

import { useState } from "react";
import { RiderTable } from "./rider-table";
import { RiderDialog } from "./rider-dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { type LeagueMode } from "@/lib/league-mode";
import { cancelBid } from "./actions";

interface Rider {
  id: string;
  full_name: string;
  real_team: string | null;
  specialty: string | null;
  nationality: string | null;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
  is_contracted: boolean;
  cooldown_until: string | null;
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
  sponsorIncome: number;
  activeSalaries: number;
  auctionId: string;
  currentRound: number;
  mode?: LeagueMode;
}

export function AuctionClient({
  riders,
  myBids,
  team,
  sponsorIncome,
  activeSalaries,
  auctionId,
  currentRound,
  mode,
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
          <span className="text-[length:var(--type-label)] font-bold uppercase text-[var(--text-mid)]">
            My bids ({myBids.length})
          </span>
          {myBids.map((bid) => {
            const rider = riders.find((r) => r.id === bid.rider_id);
            return (
              <div
                key={bid.id}
                className="flex items-center justify-between border-b border-[var(--border-default)] py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[length:var(--type-body)] font-medium text-[var(--text-high)]">
                    {rider?.full_name ?? "—"}
                  </span>
                  <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
                    {rider?.real_team}
                  </span>
                  <span className="text-[length:var(--type-body)] font-semibold font-mono text-[var(--accent-default)]">
                    {formatMoney(bid.amount)}
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
                    onClick={() => cancelBid(bid.id, auctionId)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="my-2 border-b border-[var(--border-default)]" />
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
        sponsorIncome={sponsorIncome}
        activeSalaries={activeSalaries}
        activeBidsTotal={activeBidsTotal}
        mode={mode}
        auctionId={auctionId}
        currentRound={currentRound}
        onClose={() => setSelectedRider(null)}
      />
    </>
  );
}
