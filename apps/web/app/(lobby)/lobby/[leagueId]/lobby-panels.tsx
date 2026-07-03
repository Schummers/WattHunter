"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuctionExplainer } from "./_components/auction-explainer";
import { GameLoopExplainer } from "./_components/game-loop-explainer";
import { InviteSection } from "./_components/invite-section";
import { LaunchButton } from "./_components/launch-button";
import { LevelSelector } from "./_components/level-selector";
import { LevelStatsCards } from "./_components/level-stats-cards";
import { PlayerList } from "./_components/player-list";
import { RiderPoolList } from "./_components/rider-pool-list";
import { setStartingLevel } from "./actions";
import { type LeagueMode, isClassic } from "@/lib/league-mode";

export interface LobbyLeague {
  id: string;
  name: string;
  invite_code: string;
  commissioner_id: string;
  max_players: number;
  starting_level: number;
}

export interface LobbyMember {
  user_id: string;
  users: { display_name: string; avatar_url: string | null } | null;
  teams: { name: string } | null;
}

export interface LobbyRider {
  id: string;
  full_name: string;
  pcs_rank: number;
  pcs_points_1yr: number;
}

export interface LobbyPanelsProps {
  league: LobbyLeague;
  members: LobbyMember[];
  memberCount: number;
  recommendedLevel: number;
  isCommissioner: boolean;
  riders: LobbyRider[];
  mode: LeagueMode;
}

export function LobbyPanels({
  league,
  members,
  memberCount,
  recommendedLevel,
  isCommissioner,
  riders,
  mode,
}: LobbyPanelsProps) {
  const [selectedLevel, setSelectedLevel] = useState<number>(league.starting_level);
  const [savingLevel, startSavingLevel] = useTransition();
  const [levelError, setLevelError] = useState<string | null>(null);

  function handleLevelChange(next: number) {
    if (!isCommissioner) return;
    const previous = selectedLevel;
    setSelectedLevel(next);
    setLevelError(null);
    startSavingLevel(async () => {
      const result = await setStartingLevel(league.id, next);
      if (!result.ok) {
        setSelectedLevel(previous);
        setLevelError(result.error);
      }
    });
  }

  const classicMode = isClassic(mode);

  return (
    <Tabs defaultValue="lobby" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="lobby">Lobby</TabsTrigger>
        {!classicMode && <TabsTrigger value="pool">Level &amp; Pool</TabsTrigger>}
      </TabsList>

      <TabsContent value="lobby" className="space-y-6 pt-2">
        <InviteSection inviteCode={league.invite_code} />
        <PlayerList
          members={members}
          memberCount={memberCount}
          maxPlayers={league.max_players}
          commissionerId={league.commissioner_id}
        />
        <AuctionExplainer />
        <LaunchButton
          leagueId={league.id}
          isCommissioner={isCommissioner}
          memberCount={memberCount}
        />
      </TabsContent>

      {!classicMode && (
        <TabsContent value="pool" className="space-y-6 pt-2">
          <GameLoopExplainer />
          {isCommissioner && levelError ? (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">
              {levelError}
            </p>
          ) : isCommissioner && savingLevel ? (
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Saving…
            </p>
          ) : null}
          <LevelSelector
            selected={selectedLevel}
            recommended={recommendedLevel}
            isCommissioner={isCommissioner}
            disabled={savingLevel}
            onSelect={handleLevelChange}
          />
          <LevelStatsCards level={selectedLevel} />
          <RiderPoolList
            leagueId={league.id}
            level={selectedLevel}
            riders={riders}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
