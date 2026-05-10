import Link from "next/link";
import { formatRound1DateLabel } from "@/lib/race-feed-helpers";

type Props = {
  leagueId: string;
  nextPhaseRound1Date: string | null;
  nextPhaseLabel: string | null;
};

export function RaceFeedPhaseEndBanner({ leagueId, nextPhaseRound1Date, nextPhaseLabel }: Props) {
  if (!nextPhaseRound1Date) {
    return (
      <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          Season over
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: 2 text lines */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
            Next phase{nextPhaseLabel ? ` · ${nextPhaseLabel}` : ""}
          </span>
          <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
            Round 1 opens {formatRound1DateLabel(nextPhaseRound1Date)}
          </span>
        </div>
        {/* Right: action button, spans the full height */}
        <Link
          href={`/league/${leagueId}/auction`}
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--accent-default)]/40 bg-[rgba(6,182,212,0.08)] px-3 py-2 text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:bg-[rgba(6,182,212,0.14)] transition-colors"
        >
          View auction →
        </Link>
      </div>
    </div>
  );
}
