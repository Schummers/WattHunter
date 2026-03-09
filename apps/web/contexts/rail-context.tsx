"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface RailState {
  isOpen: boolean;
  path: string | null;
}

interface RailContextValue {
  rail: RailState;
  openRail: (path: string) => void;
  closeRail: () => void;
}

const RailContext = createContext<RailContextValue | null>(null);

export function RailProvider({ children }: { children: ReactNode }) {
  const [rail, setRail] = useState<RailState>({ isOpen: false, path: null });

  const openRail = useCallback((path: string) => {
    setRail({ isOpen: true, path });
  }, []);

  const closeRail = useCallback(() => {
    setRail({ isOpen: false, path: null });
  }, []);

  return (
    <RailContext.Provider value={{ rail, openRail, closeRail }}>
      {children}
    </RailContext.Provider>
  );
}

export function useRail() {
  const ctx = useContext(RailContext);
  if (!ctx) throw new Error("useRail must be used within RailProvider");
  return ctx;
}
