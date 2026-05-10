import { Flame } from "lucide-react";
import type { RemontadaData } from "@/lib/race-feed-types";

type Props = { data: RemontadaData };

export function RaceFeedRemontadaCard({ data }: Props) {
  const stageWord = data.stagesRemaining === 1 ? "stage" : "stages";
  const mult = Number.isInteger(data.multiplier)
    ? `×${data.multiplier}`
    : `×${data.multiplier.toFixed(1)}`;

  return (
    <div className="rounded-[10px] border bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.20)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Flame size={14} className="text-[var(--warning)]" aria-hidden="true" />
        <span>Remontada · {data.teamName}</span>
      </div>
      {data.overtakenTeamName && (
        <div className="mt-1 text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Overtook {data.overtakenTeamName} in the rankings
        </div>
      )}
      <div className="mt-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        {mult} XP boost for the next {data.stagesRemaining} {stageWord}
      </div>
    </div>
  );
}
