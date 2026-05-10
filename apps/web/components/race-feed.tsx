"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { RaceFeedPayload, TacticContextForFeed } from "@/lib/race-feed-types";
import { RaceFeedDateGroup } from "./race-feed-date-group";
import { RaceCardPast } from "./race-card-past";
import { RaceCardToday } from "./race-card-today";
import { RaceCardFuture } from "./race-card-future";
import { RaceFeedNemesisCard } from "./race-feed-nemesis-card";
import { RaceFeedRemontadaCard } from "./race-feed-remontada-card";
import { RaceFeedPhaseEndBanner } from "./race-feed-phase-end-banner";
import { RaceFeedTacticModal } from "./race-feed-tactic-modal";

type Props = {
  leagueId: string;
  payload: RaceFeedPayload;
  tacticContext?: TacticContextForFeed | null;
};

export function RaceFeed({ leagueId, payload, tacticContext }: Props) {
  // Scroll to the most recent known result (last past/today group).
  // Falls back to the first future card if no results exist yet.
  const lastKnownRef = useRef<HTMLDivElement | null>(null);
  const firstFutureRef = useRef<HTMLDivElement | null>(null);
  const [openTacticStage, setOpenTacticStage] = useState<{ slug: string; name: string } | null>(null);

  // Date of the most recent group that has at least one past or today card
  const lastKnownDate =
    [...payload.groups]
      .reverse()
      .find((g) => g.cards.some((c) => c.type === "past" || c.type === "today"))
      ?.date ?? null;

  useLayoutEffect(() => {
    const target = lastKnownRef.current ?? firstFutureRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, []);

  let firstFutureClaimed = false;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-16">
      {payload.groups.map((group) => {
        const isLastKnown = group.date === lastKnownDate;
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
                if (card.type === "future") {
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
                        onTacticClick={
                          tacticContext
                            ? () => setOpenTacticStage({ slug: card.race.raceSlug, name: card.race.raceTitle })
                            : undefined
                        }
                      />
                    </div>
                  );
                }
                if (card.type === "nemesis") {
                  return <RaceFeedNemesisCard key={key} data={card.data} />;
                }
                if (card.type === "remontada") {
                  return <RaceFeedRemontadaCard key={key} data={card.data} />;
                }
                return null;
              })}
            </RaceFeedDateGroup>
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
