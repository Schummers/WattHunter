import Link from "next/link";
import { FlagTriangleRight } from "lucide-react";
import { formatRound1DateLabel } from "@/lib/race-feed-helpers";

type Props = {
  leagueId: string;
  nextPhaseRound1Date: string | null;
  nextPhaseLabel: string | null;
};

export function RaceFeedPhaseEndBanner({
  leagueId,
  nextPhaseRound1Date,
}: Props) {
  if (!nextPhaseRound1Date) {
    return (
      <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
        <div className="flex items-center gap-2 text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          <FlagTriangleRight
            size={16}
            className="text-[var(--accent-default)]"
            aria-hidden="true"
          />
          <span>Saison terminée</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--accent-default)]/30 bg-[var(--bg-surface)] px-3.5 py-3.5">
      <div className="flex items-center gap-2 text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
        <FlagTriangleRight
          size={16}
          className="text-[var(--accent-default)]"
          aria-hidden="true"
        />
        <span>Prochaine phase</span>
      </div>
      <div className="mt-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        Round 1 ouvre le {formatRound1DateLabel(nextPhaseRound1Date)}
      </div>
      <Link
        href={`/league/${leagueId}/auction`}
        className="mt-2 inline-block text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
      >
        Voir l'enchère →
      </Link>
    </div>
  );
}
