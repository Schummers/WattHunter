"use client";

import { PlayerEmblem } from "@/components/player-emblem";
import { RACE_GROUP_IDS } from "@/lib/race-groups";
import { abbreviateName, abbreviateNameShort } from "@/lib/palmares/format";
import { EVENT_CODE, type PalmaresEvent, type Player, type SeasonStanding } from "@/lib/palmares/types";
import type { EquippedEmblem, PalmaresData } from "@/lib/palmares/load";

// DS-EXCEPTION: 36 — AchievementBadge takes a numeric size, and 36 is the size
// the Ranking row uses. Matching it is the point: the champion must read as a
// Ranking line, not as a smaller cousin of one.
const EMBLEM_SIZE = 36;

const EMPTY_LABEL: Record<Exclude<PalmaresEvent["status"], "played">, string> = {
  ongoing: "ongoing",
  upcoming: "upcoming",
  "not-played": "not played",
};

function PlayerName({ player, short }: { player: Player; short?: boolean }) {
  const label = short ? abbreviateNameShort(player.displayName) : player.displayName;
  return (
    <span className={player.isFormerPlayer ? "italic font-normal" : undefined}>{label}</span>
  );
}

/**
 * The champion is presented as a Ranking row: the same emblem component, at the
 * same size, so the two screens read as one product.
 *
 * The badge is the player's current one on every season, archived ones
 * included: name and badge are identity markers of who that player is today,
 * not claims about what they had equipped in 2019. A player with nothing
 * equipped falls back on their initials, the same reserve the rider avatar
 * already uses when a photo is missing.
 */
function ChampionRow({
  season,
  emblem,
}: {
  season: SeasonStanding;
  emblem: EquippedEmblem | undefined;
}) {
  const [champion, second, third] = season.ranking;
  if (!champion) return null;

  const word = season.isCurrent ? "leading" : "champion";
  const parts = [second && `${abbreviateName(second.displayName)} (2nd)`, third && `${abbreviateName(third.displayName)} (3rd)`]
    .filter(Boolean);
  const subtitle = parts.length > 0 ? `${word} · ahead of ${parts.join(" and ")}` : word;

  return (
    <div className="relative flex items-center gap-3 overflow-hidden py-2">
      {emblem?.bannerUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${emblem.bannerUrl})`, opacity: 0.12 }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-app)] via-transparent to-[var(--bg-app)]" />
        </>
      )}

      <div className="relative shrink-0">
        <PlayerEmblem
          emblem={emblem}
          name={champion.displayName}
          size={EMBLEM_SIZE}
          dashed={season.isCurrent}
        />
      </div>

      <div className="relative min-w-0 flex-1">
        <div
          className={`truncate text-[length:var(--type-section)] ${
            season.isCurrent
              ? "font-semibold text-[var(--text-mid)]"
              : "font-bold text-[var(--text-high)]"
          }`}
        >
          <PlayerName player={champion} />
        </div>
        <div className="truncate text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function EventGrid({ events }: { events: PalmaresEvent[] }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-baseline gap-x-2">
      <span />
      {["1st", "2nd", "3rd"].map((header) => (
        <span
          key={header}
          className="border-b border-[var(--border-subtle)] pb-1 text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]"
        >
          {header}
        </span>
      ))}

      {RACE_GROUP_IDS.map((eventType) => {
        const event = events.find((e) => e.eventType === eventType);
        const status = event?.status ?? "not-played";
        const podium = event?.standings.slice(0, 3) ?? [];
        // An event with a status but no result still has nothing to show.
        const emptyLabel =
          status === "played" ? (podium.length === 0 ? EMPTY_LABEL["not-played"] : null) : EMPTY_LABEL[status];

        return (
          <div key={eventType} className="contents">
            <span className="border-t border-[var(--border-subtle)] pt-1.5 text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              {EVENT_CODE[eventType]}
            </span>

            {emptyLabel !== null ? (
              <span className="col-span-3 border-t border-[var(--border-subtle)] pt-1.5 text-[length:var(--type-caption)] italic text-[var(--text-low)]">
                {emptyLabel}
              </span>
            ) : (
              [0, 1, 2].map((index) => {
                const player = podium[index];
                return (
                  <span
                    key={index}
                    className={`truncate border-t border-[var(--border-subtle)] pt-1.5 text-[length:var(--type-caption)] ${
                      index === 0
                        ? "font-semibold text-[var(--text-high)]"
                        : "text-[var(--text-mid)]"
                    }`}
                  >
                    {player ? <PlayerName player={player} short /> : "·"}
                  </span>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SeasonsTab({ data }: { data: PalmaresData }) {
  const { standings, events, emblemByPlayer } = data;

  return (
    <div className="space-y-2 px-4">
      {standings.map((season) => {
        const champion = season.ranking[0];
        const emblem = champion ? emblemByPlayer[champion.key] : undefined;

        return (
          <div
            key={season.seasonYear}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[length:var(--type-stat)] font-bold tabular-nums text-[var(--text-high)]">
                {season.seasonYear}
              </span>
              {season.note && (
                <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
                  {season.note}
                </span>
              )}
            </div>

            <ChampionRow season={season} emblem={emblem} />

            <EventGrid
              events={events.filter((event) => event.seasonYear === season.seasonYear)}
            />
          </div>
        );
      })}

      {standings.length === 0 && (
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          No season has been played yet.
        </p>
      )}

      <p className="pt-2 text-[length:var(--type-caption)] text-[var(--text-low)]">
        <span className="font-semibold text-[var(--text-mid)]">The season champion</span> is
        the player with the highest total across every race of the year, counted in whichever
        scale that season used. Race podiums are the original finishing orders. A name in
        italics is a player who has left the group.
      </p>
    </div>
  );
}
