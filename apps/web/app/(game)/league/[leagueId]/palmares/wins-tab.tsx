"use client";

import { computeWins, playedEventTypes } from "@/lib/palmares/aggregate";
import { abbreviateName } from "@/lib/palmares/format";
import { EVENT_CODE, type PalmaresEvent } from "@/lib/palmares/types";

interface WinsTabProps {
  events: PalmaresEvent[];
}

/** A zero is a dash in the podium table: an empty count is not a measurement. */
function podiumCell(value: number): string {
  return value === 0 ? "—" : String(value);
}

function FormerPlayerMark() {
  return (
    <span className="ml-1.5 text-[length:var(--type-micro)] text-[var(--text-low)]">
      former player
    </span>
  );
}

export function WinsTab({ events }: WinsTabProps) {
  const rows = computeWins(events);
  const eventTypes = playedEventTypes(events);
  const winnersOnly = rows.filter((row) => row.wins > 0);

  return (
    <div className="space-y-6 px-4">
      {/* Podium table. Wins sit on the far right, in primary weight. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              <th className="px-2 py-2 text-left text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Player
              </th>
              <th className="px-2 py-2 text-right text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                3rd
              </th>
              <th className="px-2 py-2 text-right text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                2nd
              </th>
              <th className="px-2 py-2 text-right text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                1st
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border-subtle)]">
                <td className="px-2 py-2 text-left">
                  <div
                    className={`text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] ${
                      row.isFormerPlayer ? "italic" : ""
                    }`}
                  >
                    {row.displayName}
                    {row.isFormerPlayer ? <FormerPlayerMark /> : null}
                  </div>
                  <div className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                    <span className="font-mono tabular-nums">{row.starts}</span> starts
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-[length:var(--type-body)] text-[var(--text-low)]">
                  {podiumCell(row.podium[2])}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-[length:var(--type-body)] text-[var(--text-low)]">
                  {podiumCell(row.podium[1])}
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-[length:var(--type-stat-small)] text-[var(--text-high)]">
                  {podiumCell(row.podium[0])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cross table: wins per event type, winners only. */}
      <div className="space-y-2">
        <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          By race
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="px-2 py-2 text-left text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                  Player
                </th>
                {eventTypes.map((eventType) => (
                  <th
                    key={eventType}
                    className="px-2 py-2 text-center text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]"
                  >
                    {EVENT_CODE[eventType]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {winnersOnly.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border-subtle)]">
                  <td
                    className={`px-2 py-2 text-left text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] ${
                      row.isFormerPlayer ? "italic" : ""
                    }`}
                  >
                    {abbreviateName(row.displayName)}
                    {row.isFormerPlayer ? <FormerPlayerMark /> : null}
                  </td>
                  {eventTypes.map((eventType) => {
                    const count = row.winsByEvent[eventType];
                    return (
                      <td
                        key={eventType}
                        className={`px-2 py-2 text-center font-mono tabular-nums text-[length:var(--type-body)] ${
                          count === 0 ? "text-[var(--text-ghost)]" : "text-[var(--text-high)]"
                        }`}
                      >
                        {count === 0 ? "·" : count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        <span className="font-semibold text-[var(--text-mid)]">A win</span> is a first place in a
        race: Classics, Giro, Tour de France or Vuelta. One-week races do not count. The season
        title is not a win, it lives in Seasons.
      </p>
    </div>
  );
}
