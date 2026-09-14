"use client";

import { AchievementBadge } from "@/components/achievement-badge";
import { RACE_GROUP_IDS } from "@/lib/race-groups";
import { abbreviateName, abbreviateNameShort } from "@/lib/palmares/format";
import { EVENT_CODE, type PalmaresEvent, type Player, type SeasonStanding } from "@/lib/palmares/types";
import type { EquippedEmblem, PalmaresData } from "@/lib/palmares/load";

const EMBLEM_SIZE = 36;

const EMPTY_LABEL: Record<Exclude<PalmaresEvent["status"], "played">, string> = {
  ongoing: "ongoing",
  upcoming: "upcoming",
  "not-played": "not played",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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
 * An archived season has no emblem — nobody had a badge equipped in 2019, and
 * showing today's badge on a 2019 card would say something false. Those fall
 * back on the player's initials, the same reserve the rider avatar already uses
 * when a photo is missing.
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
        {emblem ? (
          <AchievementBadge badgeUrl={emblem.badgeUrl} tier={emblem.tier} size={EMBLEM_SIZE} locked={false} />
        ) : (
          <div
            className={`flex items-center justify-center rounded-md border text-[length:var(--type-micro)] text-[var(--text-low)] ${
              season.isCurrent ? "border-dashed" : ""
            } border-[var(--border-default)] bg-[var(--bg-surface)]`}
            style={{ width: EMBLEM_SIZE, height: EMBLEM_SIZE }}
          >
            {initials(champion.displayName)}
          </div>
        )}
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

        return (
          <div key={eventType} className="contents">
            <span className="border-t border-[var(--border-subtle)] pt-1.5 text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              {EVENT_CODE[eventType]}
            </span>

            {status !== "played" || podium.length === 0 ? (
              <span className="col-span-3 border-t border-[var(--border-subtle)] pt-1.5 text-[length:var(--type-caption)] italic text-[var(--text-ghost)]">
                {EMPTY_LABEL[status === "played" ? "not-played" : status]}
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
        const emblem =
          season.source === "watthunter" && champion
            ? emblemByPlayer[champion.key]
            : undefined;

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
        the player with the highest total XP across every race of the year. Race podiums are
        the original finishing orders. A name in italics is a player who has left the group.
      </p>
    </div>
  );
}
