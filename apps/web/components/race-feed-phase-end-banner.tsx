import Link from "next/link";
import { FlagTriangleRight } from "lucide-react";
import { formatRound1DateLabel } from "@/lib/race-feed-helpers";

type Props = {
  leagueId: string;
  nextPhaseRound1Date: string | null;
  nextPhaseLabel: string | null;
};

export function RaceFeedPhaseEndBanner({ leagueId, nextPhaseRound1Date }: Props) {
  if (!nextPhaseRound1Date) {
    return (
      <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
        <div className="flex items-start gap-2.5">
          <FlagTriangleRight
            size={16}
            className="mt-0.5 shrink-0 text-[var(--accent-default)]"
            aria-hidden="true"
          />
          <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
            Season over
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
      <div className="flex items-start gap-2.5">
        <FlagTriangleRight
          size={16}
          className="mt-0.5 shrink-0 text-[var(--accent-default)]"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
            Next phase
          </span>
          <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
            Round 1 opens {formatRound1DateLabel(nextPhaseRound1Date)}
          </span>
          <Link
            href={`/league/${leagueId}/auction`}
            className="mt-1 inline-block text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
          >
            View auction →
          </Link>
        </div>
      </div>
    </div>
  );
}
