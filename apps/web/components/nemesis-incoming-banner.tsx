"use client";
import { Bell } from "lucide-react";

export interface IncomingNemesis {
  attackerTeamName: string;
  role: "gc_leader" | "sprinter";
  stageNumber: number;
  stageDate: string;
  outcome: "attacker_won" | "target_won" | "no_resolution" | null;
}

export function NemesisIncomingBanner({ incomings }: { incomings: IncomingNemesis[] }) {
  if (incomings.length === 0) return null;
  return (
    <div className="mx-4 flex flex-col gap-2">
      {incomings.map((n, i) => (
        <NemesisRow key={i} n={n} />
      ))}
    </div>
  );
}

function NemesisRow({ n }: { n: IncomingNemesis }) {
  const roleLabel = n.role === "gc_leader" ? "GC Leader" : "Sprinter";
  const isResolved = !!n.outcome;
  const won = n.outcome === "target_won";
  const lost = n.outcome === "attacker_won";

  let statusLine: React.ReactNode;
  if (!isResolved) {
    statusLine = <>If they win, you lose 50%. If you win, you gain 25%.</>;
  } else if (won) {
    statusLine = <span className="text-[var(--success)]">You won the duel — +25%</span>;
  } else if (lost) {
    statusLine = <span className="text-[var(--danger)]">You lost the duel — −50%</span>;
  } else {
    statusLine = <span className="text-[var(--text-mid)]">Duel ended without resolution</span>;
  }

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-3">
      <Bell className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Nemesis incoming
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          <span className="font-semibold text-[var(--text-high)]">{n.attackerTeamName}</span>{" "}
          targets your {roleLabel} on{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--text-high)]">
            S{n.stageNumber}
          </span>{" "}
          ({n.stageDate}). {statusLine}
        </span>
      </div>
    </div>
  );
}
