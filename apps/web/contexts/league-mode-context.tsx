"use client";

import { createContext, useContext } from "react";
import type { LeagueMode } from "@/lib/league-mode";

const LeagueModeContext = createContext<LeagueMode>("manager");

/**
 * Provides the current league's game mode to client components nested under the
 * league layout. Next.js does not forward arbitrary props to nested layouts, so
 * the server layout reads `leagues.mode` and publishes it here.
 */
export function LeagueModeProvider({
  mode,
  children,
}: {
  mode: LeagueMode;
  children: React.ReactNode;
}) {
  return (
    <LeagueModeContext.Provider value={mode}>
      {children}
    </LeagueModeContext.Provider>
  );
}

export function useLeagueMode(): LeagueMode {
  return useContext(LeagueModeContext);
}
