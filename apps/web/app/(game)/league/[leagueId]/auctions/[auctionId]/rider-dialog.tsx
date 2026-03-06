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
      const result = await cancelBid(existingBid.id);
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  const infoRows = [
    {
      label: "Specialite",
      value: SPECIALTY_NAMES[rider.specialty] ?? rider.specialty,
    },
    {
      label: "Points PCS (1 an)",
      value: `${rider.pcs_points_1yr.toLocaleString("fr-FR")} pts`,
    },
    {
      label: "Classement PCS",
      value: rider.pcs_rank ? `#${rider.pcs_rank}` : "—",
    },
    {
      label: "Salaire minimum",
      value: `${rider.monthly_salary.toLocaleString("fr-FR")} EUR/mois`,
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
              <div className="flex size-16 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-xs text-[var(--text-mid)]">
                Photo
              </div>
            )}
            <div>
              <DialogTitle className="text-lg">{rider.full_name}</DialogTitle>
              <p className="text-sm text-[var(--text-mid)]">
                {rider.real_team} · {rider.nationality}
                {rider.age ? ` · ${rider.age} ans` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4 border-b border-border" />

        {infoRows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "flex items-center justify-between py-2 text-sm",
              i < infoRows.length - 1 && "border-b border-border"
            )}
          >
            <span className="text-[var(--text-mid)]">{row.label}</span>
            <span className="font-medium text-[var(--text-high)]">{row.value}</span>
          </div>
        ))}

        <div className="my-4 border-b border-border" />

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-[var(--text-high)]">
            {existingBid ? "Modifier la mise" : "Placer une mise"}
          </span>

          {existingBid && (
            <p className="text-sm text-[var(--text-mid)]">
              Salaire proposé actuel :{" "}
              {existingBid.amount.toLocaleString("fr-FR")} €/mois
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-high)]">
              Salaire mensuel proposé (min.{" "}
              {rider.monthly_salary.toLocaleString("fr-FR")} €/mois)
            </label>
            <Input
              type="number"
              step={100}
              min={rider.monthly_salary}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={rider.monthly_salary.toString()}
            />
          </div>

          <p
            className={cn(
              "text-xs",
              budgetAfter >= 0 ? "text-[var(--text-mid)]" : "text-[var(--status-danger)]"
            )}
          >
            Budget dispo apres engagement salaire :{" "}
            {budgetAfter.toLocaleString("fr-FR")} €/mois
          </p>

          {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}

          <Button
            variant="cta"
            className="w-full"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending
              ? "..."
              : existingBid
                ? "Modifier la mise"
                : "Confirmer la mise"}
          </Button>

          {existingBid && (
            <Button
              variant="ghost"
              className="w-full text-[var(--status-danger)]"
              disabled={isPending}
              onClick={handleCancel}
            >
              Annuler la mise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
