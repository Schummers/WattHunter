"use client";

import { useState, useTransition } from "react";
import { BackHeader } from "@/components/back-header";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { updateRoundDates, createNextPhaseAuctions } from "./actions";

interface RoundRow {
  id: string;
  name: string;
  date: string;
  time: string;
}

interface RoundsClientProps {
  leagueId: string;
  leagueName: string;
  initialRounds: RoundRow[];
  isCreating: boolean;
}

function getParisDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

export function RoundsClient({
  leagueId,
  leagueName,
  initialRounds,
  isCreating,
}: RoundsClientProps) {
  const [rounds, setRounds] = useState<RoundRow[]>(
    isCreating
      ? [
          { id: "", name: "Round 1", date: getParisDate(1), time: "00:00" },
          { id: "", name: "Round 2", date: getParisDate(2), time: "00:00" },
          { id: "", name: "Round 3", date: getParisDate(3), time: "00:00" },
        ]
      : initialRounds
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const navVisible = useScrollDirection();

  const inputClass =
    "flex-1 min-w-0 bg-transparent border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--type-body)] font-mono text-[var(--text-high)] focus:border-[var(--accent-default)] focus:outline-none transition-colors [color-scheme:dark]";

  function handleChange(
    index: number,
    field: "date" | "time",
    value: string
  ) {
    setRounds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSuccess(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      let result;
      if (isCreating) {
        result = await createNextPhaseAuctions({
          leagueId,
          rounds: rounds.map((r) => ({
            date: r.date,
            time: r.time,
          })),
        });
      } else {
        result = await updateRoundDates({
          leagueId,
          rounds: rounds.map((r) => ({
            id: r.id,
            date: r.date,
            time: r.time,
          })),
        });
      }
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg-app)]">
      <BackHeader label={isCreating ? "Setup Phase Rounds" : "Edit Round Dates"} />

      <div className="flex-1 px-4 pt-4 pb-28 space-y-6 max-w-lg mx-auto w-full">
        <div>
          <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
            {leagueName}
          </h1>
          <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {isCreating
              ? "Configure the 3 auction rounds for this phase."
              : "Adjust the date and time for each auction round."}
          </p>
        </div>

        <div className="border-b border-[var(--border-subtle)]" />

        <div className="space-y-4">
          {rounds.map((round, i) => {
            return (
              <div key={round.name} className="space-y-2">
                <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)] uppercase tracking-wide">
                  {round.name} — Closes
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={round.date}
                    onChange={(e) => handleChange(i, "date", e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                  <input
                    type="time"
                    value={round.time}
                    onChange={(e) => handleChange(i, "time", e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">
            {error}
          </p>
        )}
        {success && (
          <p className="text-[length:var(--type-body)] text-[var(--status-success)]">
            {isCreating ? "Rounds created." : "Round dates saved."}
          </p>
        )}
      </div>

      {/* Sticky save button — sits above bottom nav on mobile */}
      <div
        className="fixed inset-x-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 transition-[bottom] duration-200 lg:hidden"
        style={{ bottom: navVisible ? "3.5rem" : "0" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full rounded-[var(--radius-md)] cta-gradient px-4 py-2.5 text-[length:var(--type-emphasis)] font-semibold text-black transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : isCreating ? "Create rounds" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Desktop save button (no bottom nav) */}
      <div className="hidden lg:block fixed bottom-0 inset-x-0 border-t border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 lg:left-[180px]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full rounded-[var(--radius-md)] cta-gradient px-4 py-2.5 text-[length:var(--type-emphasis)] font-semibold text-black transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : isCreating ? "Create rounds" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
