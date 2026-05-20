import { Flame } from "lucide-react";
import type { RemontadaData } from "@/lib/race-feed-types";

type Props = { data: RemontadaData };

export function RaceFeedRemontadaCard({ data }: Props) {
  const stageWord = data.stagesRemaining === 1 ? "stage" : "stages";
  const mult = Number.isInteger(data.multiplier)
    ? `×${data.multiplier}`
    : `×${data.multiplier.toFixed(1)}`;

  const overtookLine = data.overtakenTeamName
    ? `${data.teamName} overtook ${data.overtakenTeamName}`
    : data.teamName;

  return (
    <div className="relative rounded-[var(--radius-compound)] border border-[rgba(245,158,11,0.35)] bg-[var(--bg-app)]">
      {/* Floating label — same pattern as RaceCardPast */}
      <span
        className="absolute left-3 z-10 flex items-center gap-1 whitespace-nowrap font-semibold leading-3 text-[length:var(--type-micro)] text-[var(--warning)]"
        style={{
          top: -6,
          paddingLeft: 4,
          paddingRight: 4,
          background: "var(--bg-app)",
          borderRadius: 2,
        }}
      >
        Remontada
        <Flame size={10} aria-hidden="true" />
      </span>

      <div className="px-3.5 py-3 flex flex-col gap-0.5">
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)] leading-tight">
          {overtookLine}
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          <span className="font-mono tabular-nums">{mult}</span> XP boost for the next <span className="font-mono tabular-nums">{data.stagesRemaining}</span> {stageWord}
        </span>
      </div>
    </div>
  );
}
