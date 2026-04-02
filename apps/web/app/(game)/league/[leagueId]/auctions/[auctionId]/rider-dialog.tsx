"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/lib/format";
import { placeBid, cancelBid } from "./actions";

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
}

interface ExistingBid {
  id: string;
  amount: number;
}

interface RiderDialogProps {
  rider: Rider | null;
  existingBid: ExistingBid | null;
  treasury: number;
  activeBidsTotal: number;
  auctionId: string;
  currentRound: number;
  onClose: () => void;
}

const SPECIALTY_NAMES: Record<string, string> = {
  climber: "Grimpeur",
  sprinter: "Sprinteur",
  rouleur: "Rouleur",
  puncheur: "Puncheur",
  time_trialist: "Contre-la-montre",
  all_rounder: "Polyvalent",
};

export function RiderDialog({
  rider,
  existingBid,
  treasury,
  activeBidsTotal,
  auctionId,
  currentRound,
  onClose,
}: RiderDialogProps) {
  const [amount, setAmount] = useState(
    existingBid?.amount?.toString() ?? rider?.monthly_salary?.toString() ?? ""
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!rider) return null;

  const numAmount = parseInt(amount) || 0;
  const budgetAfter =
    treasury - activeBidsTotal - numAmount + (existingBid?.amount ?? 0);
  const isValid =
    numAmount >= rider.monthly_salary &&
    numAmount % 100 === 0 &&
    budgetAfter >= 0;

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await placeBid({
        auctionId,
        riderId: rider!.id,
        amount: numAmount,
        round: currentRound,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  function handleCancel() {
    if (!existingBid) return;
    startTransition(async () => {
      const result = await cancelBid(existingBid.id, auctionId);
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  const infoRows = [
    {
      label: "Specialty",
      value: SPECIALTY_NAMES[rider.specialty] ?? rider.specialty,
    },
    {
      label: "PCS Points (1 yr)",
      value: `${rider.pcs_points_1yr.toLocaleString("en-US")} pts`,
    },
    {
      label: "PCS Rank",
      value: rider.pcs_rank ? `#${rider.pcs_rank}` : "—",
    },
    {
      label: "Minimum salary",
      value: `${rider.monthly_salary.toLocaleString("en-US")} EUR/mo`,
    },
  ];

  return (
    <Dialog open={!!rider} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {rider.photo_url ? (
              <img
                src={rider.photo_url}
                alt={rider.full_name}
                className="size-16 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[length:var(--type-caption)] text-[var(--text-mid)]">
                Photo
              </div>
            )}
            <div>
              <DialogTitle className="text-[length:var(--type-section)]">{rider.full_name}</DialogTitle>
              <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
                {rider.real_team} · {rider.nationality ? countryCodeToFlag(rider.nationality) : ""}
                {rider.age ? ` · ${rider.age} yo` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 border-b border-[var(--border-default)]" />

        {infoRows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between py-2 text-[length:var(--type-body)]",
              i < infoRows.length - 1 && "border-b border-[var(--border-default)]"
            )}
          >
            <span className="text-[var(--text-mid)]">{row.label}</span>
            <span className="font-medium font-mono text-[var(--text-high)]">{row.value}</span>
          </div>
        ))}

        <div className="my-4 border-b border-[var(--border-default)]" />

        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
            {existingBid ? "Edit bid" : "Place a bid"}
          </span>

          {existingBid && (
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              Current bid:{" "}
              <span className="font-mono">{existingBid.amount.toLocaleString("en-US")} EUR/mo</span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[length:var(--type-body)] font-medium text-[var(--text-high)]">
              Monthly salary bid (min.{" "}
              {rider.monthly_salary.toLocaleString("en-US")} EUR/mo)
            </label>
            <Input
              type="number"
              step={500}
              min={rider.monthly_salary}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={rider.monthly_salary.toString()}
            />
          </div>

          <p
            className={cn(
              "text-[length:var(--type-caption)]",
              budgetAfter >= 0 ? "text-[var(--text-mid)]" : "text-[var(--status-danger)]"
            )}
          >
            Available budget after salary commitment:{" "}
            <span className="font-mono">{budgetAfter.toLocaleString("en-US")} EUR/mo</span>
          </p>

          {error && <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">{error}</p>}

          <Button
            variant="cta"
            className="w-full"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending
              ? "..."
              : existingBid
                ? "Update bid"
                : "Confirm bid"}
          </Button>

          {existingBid && (
            <Button
              variant="ghost"
              className="w-full text-[var(--status-danger)]"
              disabled={isPending}
              onClick={handleCancel}
            >
              Cancel bid
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
