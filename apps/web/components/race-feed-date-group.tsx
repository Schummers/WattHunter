import type { ReactNode } from "react";
import { formatRaceDateLabel } from "@/lib/race-feed-helpers";

type Props = {
  date: string; // ISO yyyy-mm-dd
  children: ReactNode;
};

export function RaceFeedDateGroup({ date, children }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <span className="block pl-1 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
        {formatRaceDateLabel(date)}
      </span>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
