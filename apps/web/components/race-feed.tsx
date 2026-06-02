"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { RaceFeedPayload, TacticContextForFeed } from "@/lib/race-feed-types";
import { RaceFeedDateGroup } from "./race-feed-date-group";
import { RaceCardPast } from "./race-card-past";
import { RaceCardToday } from "./race-card-today";
import { RaceCardFuture } from "./race-card-future";
import { RaceFeedNemesisCard } from "./race-feed-nemesis-card";
import { RaceFeedPhaseEndBanner } from "./race-feed-phase-end-banner";
import { RaceFeedTacticModal } from "./race-feed-tactic-modal";
import { GtDnfCard, type GtDnfCardProps } from "./gt-dnf-card";
import { RaceCardRestDay } from "./race-card-rest-day";

type Props = {
  leagueId: string;
  payload: RaceFeedPayload;
  tacticContext?: TacticContextForFeed | null;
  dnfRiders?: GtDnfCardProps[];
};

export function RaceFeed({ leagueId, payload, tacticContext, dnfRiders }: Props) {
  // Scroll to the most recent known result (last past/today group).
  // Falls back to the first future card if no results exist yet.
  const lastKnownRef = useRef<HTMLDivElement | null>(null);
  const firstFutureRef = useRef<HTMLDivElement | null>(null);
  const [openTacticStage, setOpenTacticStage] = useState<{ slug: string; name: string } | null>(null);

  // Date of the most recent group that has at least one past/today card WITH real data.
  // A card counts as "having data" only if its teams array is non-empty — stages
  // that were injected from the schedule but haven't had Pipeline B run yet are
  // "today" cards with empty teams, and should not be the scroll target.
  const lastKnownDate =
    [...payload.groups]
      .reverse()
      .find((g) =>
        g.cards.some(
          (c) => (c.type === "past" || c.type === "today") && c.race.teams.length > 0
        )
      )
      ?.date ?? null;

  useLayoutEffect(() => {
    const target = lastKnownRef.current ?? firstFutureRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, []);

  let firstFutureClaimed = false;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-16">
      {payload.groups.map((group) => {
        const isLastKnown = group.date === lastKnownDate;

        // DNF cards whose stage matches a race in this date group
        const dnfForGroup = (dnfRiders ?? []).filter((dnf) =>
          group.cards.some(
            (card) =>
              "race" in card &&
              card.race.raceSlug.endsWith(`/stage-${dnf.dnfStage}`)
          )
        );

        return (
          <div key={group.date} ref={isLastKnown ? lastKnownRef : undefined}>
            <RaceFeedDateGroup date={group.date}>
              {group.cards.map((card, idx) => {
                const key = `${group.date}-${idx}`;
                if (card.type === "today") {
                  return <RaceCardToday key={key} race={card.race} leagueId={leagueId} />;
                }
                if (card.type === "past") {
                  return (
                    <RaceCardPast
                      key={key}
                      race={card.race}
                      leagueId={leagueId}
                      defaultExpanded={isLastKnown}
                    />
                  );
                }
                if (card.type === "in_progress" || card.type === "future") {
                  let refProp: React.RefObject<HTMLDivElement | null> | null = null;
                  if (!firstFutureClaimed) {
                    refProp = firstFutureRef;
                    firstFutureClaimed = true;
                  }
                  return (
                    <div key={key} ref={refProp as React.RefObject<HTMLDivElement>}>
                      <RaceCardFuture
                        race={card.race}
                        leagueId={leagueId}
                        isInProgress={card.type === "in_progress"}
                        onTacticClick={
                          card.type === "future" && tacticContext
                            ? () => setOpenTacticStage({ slug: card.race.raceSlug, name: card.race.raceTitle })
                            : undefined
                        }
                      />
                    </div>
                  );
                }
                if (card.type === "rest_day") {
                  return <RaceCardRestDay key={key} gtName={card.gtName} />;
                }
                if (card.type === "nemesis") {
                  return <RaceFeedNemesisCard key={key} data={card.data} />;
                }
                return null;
              })}
            </RaceFeedDateGroup>
            {dnfForGroup.map((dnf) => (
              <GtDnfCard key={dnf.gtSquadId} {...dnf} />
            ))}
          </div>
        );
      })}
      {/* Phase-end shown as a date group at the round 1 date */}
      {payload.nextPhaseRound1Date && (
        <RaceFeedDateGroup date={payload.nextPhaseRound1Date}>
          <RaceFeedPhaseEndBanner
            leagueId={leagueId}
            nextPhaseRound1Date={payload.nextPhaseRound1Date}
            nextPhaseLabel={payload.nextPhaseLabel}
          />
        </RaceFeedDateGroup>
      )}
      {!payload.nextPhaseRound1Date && (
        <RaceFeedPhaseEndBanner
          leagueId={leagueId}
          nextPhaseRound1Date={null}
          nextPhaseLabel={null}
        />
      )}
      {openTacticStage && tacticContext && (
        <RaceFeedTacticModal
          stageSlug={openTacticStage.slug}
          stageName={openTacticStage.name}
          tacticContext={tacticContext}
          onClose={() => setOpenTacticStage(null)}
        />
      )}
    </div>
  );
}
