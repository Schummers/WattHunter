"use client";

import { useLayoutEffect, useRef } from "react";
import type { RaceFeedPayload } from "@/lib/race-feed-types";
import { RaceFeedDateGroup } from "./race-feed-date-group";
import { RaceCardPast } from "./race-card-past";
import { RaceCardToday } from "./race-card-today";
import { RaceCardFuture } from "./race-card-future";
import { RaceFeedNemesisCard } from "./race-feed-nemesis-card";
import { RaceFeedRemontadaCard } from "./race-feed-remontada-card";
import { RaceFeedPhaseEndBanner } from "./race-feed-phase-end-banner";

type Props = {
  leagueId: string;
  payload: RaceFeedPayload;
};

export function RaceFeed({ leagueId, payload }: Props) {
  const todayRef = useRef<HTMLDivElement | null>(null);
  const firstFutureRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const target = todayRef.current ?? firstFutureRef.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, []);

  let firstFutureClaimed = false;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-16">
      {payload.groups.map((group) => (
        <RaceFeedDateGroup key={group.date} date={group.date}>
          {group.cards.map((card, idx) => {
            const key = `${group.date}-${idx}`;
            if (card.type === "today") {
              return (
                <div key={key} ref={todayRef}>
                  <RaceCardToday race={card.race} leagueId={leagueId} />
                </div>
              );
            }
            if (card.type === "past") {
              return <RaceCardPast key={key} race={card.race} />;
            }
            if (card.type === "future") {
              let refProp: React.RefObject<HTMLDivElement | null> | null = null;
              if (!firstFutureClaimed) {
                refProp = firstFutureRef;
                firstFutureClaimed = true;
              }
              return (
                <div key={key} ref={refProp as React.RefObject<HTMLDivElement>}>
                  <RaceCardFuture race={card.race} leagueId={leagueId} />
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
      ))}
      <RaceFeedPhaseEndBanner
        leagueId={leagueId}
        nextPhaseRound1Date={payload.nextPhaseRound1Date}
        nextPhaseLabel={payload.nextPhaseLabel}
      />
    </div>
  );
}
