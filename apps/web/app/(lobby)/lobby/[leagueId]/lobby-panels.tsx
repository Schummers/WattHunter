"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDefaultStartingLevel } from "@/lib/levels";

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
  isCommissioner: boolean;
  riders: LobbyRider[];
}

export function LobbyPanels({
  league,
  members,
  memberCount,
  isCommissioner,
  riders,
}: LobbyPanelsProps) {
  const recommendedLevel = getDefaultStartingLevel();
  const [selectedLevel, setSelectedLevel] = useState<number>(league.starting_level);

  void members;
  void isCommissioner;
  void setSelectedLevel;

  return (
    <Tabs defaultValue="lobby" className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="lobby">Lobby</TabsTrigger>
        <TabsTrigger value="pool">Level &amp; Pool</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
      </TabsList>

      <TabsContent value="lobby" className="space-y-6 pt-2">
        {/* Task 3-6 populate this panel */}
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {memberCount}/{league.max_players} players · code{" "}
          <span className="font-mono text-[var(--text-high)]">{league.invite_code}</span>
        </p>
      </TabsContent>

      <TabsContent value="pool" className="space-y-6 pt-2">
        {/* Task 7-10 populate this panel */}
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Level {selectedLevel} (recommended: {recommendedLevel}) · {riders.length} riders
          in pool
        </p>
      </TabsContent>

      <TabsContent value="rules" className="space-y-6 pt-2">
        {/* Task 11 populates this panel */}
      </TabsContent>
    </Tabs>
  );
}
