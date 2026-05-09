import { Swords } from "lucide-react";
import type { NemesisData } from "@/lib/race-feed-types";

type Props = { data: NemesisData };

export function RaceFeedNemesisCard({ data }: Props) {
  const myTeamWon =
    (data.isMyTeamAttacker && data.outcome === "attacker_won") ||
    (!data.isMyTeamAttacker && data.outcome === "target_won");
  const myTeamLost =
    (data.isMyTeamAttacker && data.outcome === "target_won") ||
    (!data.isMyTeamAttacker && data.outcome === "attacker_won");

  let outcomeText = "En attente";
  let outcomeClass = "text-[var(--text-mid)]";
  if (data.outcome === "attacker_won") {
    outcomeText = `→ ${data.attackerTeamName}`;
    outcomeClass = myTeamWon ? "text-[var(--success)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "target_won") {
    outcomeText = `→ ${data.targetTeamName}`;
    outcomeClass = myTeamLost ? "text-[var(--danger)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "no_resolution") {
    outcomeText = "Pas de résolution";
    outcomeClass = "text-[var(--text-mid)]";
  }

  return (
    <div className="rounded-[10px] border bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.20)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Swords size={14} className="text-[var(--danger)]" aria-hidden="true" />
        <span>
          Nemesis · {data.attackerRiderShortName} VS {data.targetRiderShortName}
        </span>
      </div>
      <div className={`mt-1 text-[length:var(--type-caption)] font-medium ${outcomeClass}`}>
        {outcomeText}
      </div>
    </div>
  );
}
