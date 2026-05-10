export type RaceCardStatus = "past" | "today" | "in_progress" | "future";
export type RaceType = "stage" | "classic";
export type GtRole = "GC" | "SPR" | "HUN" | "DOM";

export type RiderRaceResult = {
  riderId: string;
  riderShortName: string;
  role: GtRole | null;
  xpGained: number;
  bonusEur: number;
};

export type TeamRaceResult = {
  teamId: string;
  teamName: string;
  isMyTeam: boolean;
  totalXp: number;
  totalBonusEur: number;
  riders: RiderRaceResult[];
};

export type RaceData = {
  raceSlug: string;
  raceName: string;
  raceTitle: string;
  parentRaceSlug: string | null;
  parentRaceLabel: string | null;
  raceDate: string;
  raceType: RaceType;
  status: RaceCardStatus;
  isGtPhase: boolean;
};

export type RaceDataWithBreakdown = RaceData & {
  teams: TeamRaceResult[];
  winnerTeamId: string | null;
  winnerTeamInitials: string | null;
  winnerTeamName: string | null;
  winnerTeamBadgeUrl: string | null;
  winnerTeamAchievementName: string | null;
  winnerTeamAchievementTier: import("./achievements").AchievementTier | null;
};

export type NemesisData = {
  activationId: string;
  raceSlug: string;
  attackerTeamName: string;
  attackerRiderShortName: string;
  targetTeamName: string;
  targetRiderShortName: string;
  outcome: "attacker_won" | "target_won" | "no_resolution" | "pending";
  isMyTeamAttacker: boolean;
};

export type RemontadaData = {
  boostId: string;
  teamId: string;
  teamName: string;
  isMyTeam: boolean;
  multiplier: number;
  stagesRemaining: number;
  triggeredAt: string;
  overtakenTeamName: string | null;
};

export type RaceFeedCard =
  | { type: "past"; race: RaceDataWithBreakdown }
  | { type: "today"; race: RaceDataWithBreakdown }
  | { type: "in_progress"; race: RaceData }
  | { type: "future"; race: RaceData }
  | { type: "nemesis"; data: NemesisData; raceSlug: string }
  | { type: "remontada"; data: RemontadaData };

export type RaceFeedDateGroup = {
  date: string;
  cards: RaceFeedCard[];
};

export type RaceFeedPayload = {
  groups: RaceFeedDateGroup[];
  nextPhaseRound1Date: string | null;
  nextPhaseLabel: string | null;
  isGtPhase: boolean;
  phaseId: number;
};

export type TacticRival = {
  teamId: string;
  teamName: string;
  leaderName: string | null;
};

export type TacticContextForFeed = {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  activations: Array<{ tactic_type: string; stage_slug: string; outcome: string | null }>;
  gcRivals: TacticRival[];
  sprintRivals: TacticRival[];
};
