"use client";

interface Round {
  id: string;
  round: number;
  opens_at: string;
  closes_at: string;
  status: string;
}

interface RoundBlocksProps {
  rounds: Round[];
  activeRound: number | null;
}

function formatRoundDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "Europe/Paris",
    month: "short",
    day: "numeric",
  });
}

function formatRoundTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function RoundBlocks({ rounds, activeRound }: RoundBlocksProps) {
  return (
    <div className="flex gap-2 px-4">
      {rounds.map((r) => {
        const isActive = r.round === activeRound;
        return (
          <div
            key={r.id}
            className={`flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-center transition-colors ${
              isActive
                ? "border-[var(--accent-default)] bg-[rgba(6,182,212,0.05)]"
                : "border-[var(--border-default)] bg-[var(--bg-surface)]"
            }`}
          >
            <span
              className={`text-[length:var(--type-micro)] font-semibold uppercase tracking-wide ${
                isActive ? "text-[var(--accent-default)]" : "text-[var(--text-low)]"
              }`}
            >
              Round {r.round}
            </span>
            <span
              className={`mt-0.5 font-mono text-[length:var(--type-caption)] ${
                isActive ? "text-[var(--text-high)]" : "text-[var(--text-mid)]"
              }`}
            >
              {formatRoundDate(r.closes_at)}
            </span>
            <span className="font-mono text-[length:var(--type-micro)] text-[var(--text-low)]">
              {formatRoundTime(r.closes_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
