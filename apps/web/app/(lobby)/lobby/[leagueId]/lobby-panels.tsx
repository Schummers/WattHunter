"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuctionExplainer } from "./_components/auction-explainer";
import { GameLoopExplainer } from "./_components/game-loop-explainer";
import { InviteSection } from "./_components/invite-section";
import { LaunchButton } from "./_components/launch-button";
import { LevelSelector } from "./_components/level-selector";
import { LevelStatsCards } from "./_components/level-stats-cards";
import { PlayerList } from "./_components/player-list";

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
}

export function LobbyPanels({
  league,
  members,
  memberCount,
  recommendedLevel,
  isCommissioner,
  riders: _riders,
}: LobbyPanelsProps) {
  const [selectedLevel, setSelectedLevel] = useState<number>(league.starting_level);

  return (
    <Tabs defaultValue="lobby" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="lobby">Lobby</TabsTrigger>
        <TabsTrigger value="pool">Level &amp; Pool</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
      </TabsList>

      <TabsContent value="lobby" className="space-y-6 pt-2">
        <InviteSection inviteCode={league.invite_code} />
        <PlayerList
          members={members}
          memberCount={memberCount}
          maxPlayers={league.max_players}
          commissionerId={league.commissioner_id}
        />
        <AuctionExplainer leagueId={league.id} />
        <LaunchButton
          leagueId={league.id}
          isCommissioner={isCommissioner}
          memberCount={memberCount}
        />
      </TabsContent>

      <TabsContent value="pool" className="space-y-6 pt-2">
        <GameLoopExplainer />
        <LevelSelector
          selected={selectedLevel}
          recommended={recommendedLevel}
          isCommissioner={isCommissioner}
          onSelect={setSelectedLevel}
        />
        <LevelStatsCards level={selectedLevel} />
      </TabsContent>

      <TabsContent value="rules" className="space-y-6 pt-2">
        {/* Task 11 populates this panel */}
      </TabsContent>
    </Tabs>
  );
}
