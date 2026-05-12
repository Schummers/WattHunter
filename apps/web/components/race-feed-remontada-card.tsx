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
    <div className="relative rounded-[10px] border border-[rgba(245,158,11,0.35)] bg-[var(--bg-app)]">
      {/* Floating label — same pattern as RaceCardPast */}
      <span
        className="absolute left-3 z-10 flex items-center gap-1 whitespace-nowrap font-semibold"
        style={{
          top: -6,
          lineHeight: "12px",
          paddingLeft: 4,
          paddingRight: 4,
          fontSize: "var(--type-micro)",
          background: "var(--bg-app)",
          borderRadius: 2,
          color: "var(--warning)",
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
          {mult} XP boost for the next {data.stagesRemaining} {stageWord}
        </span>
      </div>
    </div>
  );
}
