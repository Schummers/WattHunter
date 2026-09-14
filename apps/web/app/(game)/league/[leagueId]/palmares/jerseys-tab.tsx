"use client";

import { computeJerseys } from "@/lib/palmares/aggregate";
import { abbreviateName } from "@/lib/palmares/format";
import { JERSEYS, JERSEY_LABEL, type JerseyId, type PalmaresEvent } from "@/lib/palmares/types";

interface JerseysTabProps {
  events: PalmaresEvent[];
}

export function JerseysTab({ events }: JerseysTabProps) {
  const rows = computeJerseys(events);

  // Column maxima, computed once and applied to all four jersey columns the same
  // way. A zero is never a maximum: an empty column highlights nothing.
  const maxByJersey = {} as Record<JerseyId, number>;
  for (const jersey of JERSEYS) {
    maxByJersey[jersey] = rows.reduce((max, row) => Math.max(max, row.byJersey[jersey]), 0);
  }

  return (
    <div className="space-y-6 px-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              <th className="px-2 py-2 text-left text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Player
              </th>
              {JERSEYS.map((jersey) => (
                <th
                  key={jersey}
                  className="px-2 py-2 text-center text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]"
                >
                  {JERSEY_LABEL[jersey]}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                TOT
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border-subtle)]">
                <td
                  className={`px-2 py-2 text-left text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] ${
                    row.isFormerPlayer ? "italic" : ""
                  }`}
                >
                  {abbreviateName(row.displayName)}
                  {row.isFormerPlayer ? (
                    <span className="ml-1.5 text-[length:var(--type-micro)] text-[var(--text-low)]">
                      former player
                    </span>
                  ) : null}
                </td>
                {JERSEYS.map((jersey) => {
                  const count = row.byJersey[jersey];
                  const isMax = count > 0 && count === maxByJersey[jersey];
                  const tone = count === 0
                    ? "text-[var(--text-ghost)]"
                    : isMax
                      ? "text-[var(--accent-highlight)] font-semibold"
                      : "text-[var(--text-high)]";
                  return (
                    <td
                      key={jersey}
                      className={`px-2 py-2 text-center font-mono tabular-nums text-[length:var(--type-body)] ${tone}`}
                    >
                      {count === 0 ? "·" : count}
                    </td>
                  );
                })}
                <td
                  className={`px-2 py-2 text-center font-mono tabular-nums font-bold text-[length:var(--type-stat-small)] ${
                    row.total === 0 ? "text-[var(--text-ghost)]" : "text-[var(--text-high)]"
                  }`}
                >
                  {row.total === 0 ? "·" : row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        <span className="font-semibold text-[var(--text-mid)]">A jersey</span> is won on a Grand
        Tour. Points from that classification are added up per team over the whole race, and the
        jersey goes to the team with the most. Owning the rider ranked first is not enough: you can
        win green without ever having the top sprinter. Classics award no jerseys.
      </p>
    </div>
  );
}
