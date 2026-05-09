import { Flame } from "lucide-react";
import type { RemontadaData } from "@/lib/race-feed-types";

type Props = { data: RemontadaData };

export function RaceFeedRemontadaCard({ data }: Props) {
  const percentBoost = Math.round((data.multiplier - 1) * 100);
  const dayLabel = data.daysRemaining === 1 ? "jour" : "jours";

  return (
    <div className="rounded-[10px] border bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.20)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Flame size={14} className="text-[var(--warning)]" aria-hidden="true" />
        <span>Remontada · {data.teamName}</span>
      </div>
      <div className="mt-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        Boost +{percentBoost}% pendant {data.daysRemaining} {dayLabel}
      </div>
    </div>
  );
}
