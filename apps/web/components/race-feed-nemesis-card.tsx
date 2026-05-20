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

  const typeLabel = data.nemesisType === "gc" ? "GC Nemesis" : "Sprinter Nemesis";
  const duelKind = data.nemesisType === "gc" ? "GC duel" : "sprinter duel";

  let outcomeText = "Pending";
  let outcomeClass = "text-[var(--text-mid)]";
  if (data.outcome === "attacker_won") {
    outcomeText = `→ ${data.attackerTeamName}`;
    outcomeClass = myTeamWon ? "text-[var(--success)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "target_won") {
    outcomeText = `→ ${data.targetTeamName}`;
    outcomeClass = myTeamLost ? "text-[var(--danger)]" : "text-[var(--text-mid)]";
  } else if (data.outcome === "no_resolution") {
    outcomeText = "No resolution";
    outcomeClass = "text-[var(--text-mid)]";
  }

  const ridersKnown =
    data.outcome !== "pending" &&
    data.attackerRiderShortName !== "?" &&
    data.targetRiderShortName !== "?";
  let riderLine: string | null = null;
  if (ridersKnown) {
    if (data.outcome === "attacker_won") {
      riderLine = `${data.attackerRiderShortName} beat ${data.targetRiderShortName}`;
    } else if (data.outcome === "target_won") {
      riderLine = `${data.targetRiderShortName} beat ${data.attackerRiderShortName}`;
    }
  }

  return (
    <div className="rounded-[var(--radius-compound)] border bg-[var(--danger-bg)] border-[var(--danger-border)] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
        <Swords size={14} className="text-[var(--danger)]" aria-hidden="true" />
        <span>{typeLabel}</span>
      </div>
      <div className="mt-1 text-[length:var(--type-caption)] text-[var(--text-mid)]">
        <span className="font-semibold text-[var(--text-high)]">{data.attackerTeamName}</span>
        {" challenges "}
        <span className="font-semibold text-[var(--text-high)]">{data.targetTeamName}</span>
        {` in a ${duelKind}`}
      </div>
      <div className={`mt-1 text-[length:var(--type-caption)] font-medium ${outcomeClass}`}>
        {outcomeText}
        {riderLine && (
          <span className="ml-2 font-normal text-[var(--text-mid)]">· {riderLine}</span>
        )}
      </div>
    </div>
  );
}
