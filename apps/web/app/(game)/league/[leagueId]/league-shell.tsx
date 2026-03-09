"use client";

import { useRail } from "@/contexts/rail-context";
import { DetailRail } from "@/components/detail-rail";
import { RailRouter } from "@/components/rail-router";

export function LeagueShell({ children }: { children: React.ReactNode }) {
  const { rail, closeRail } = useRail();

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {children}
      {rail.isOpen && rail.path && (
        <DetailRail onClose={closeRail}>
          <RailRouter path={rail.path} />
        </DetailRail>
      )}
    </div>
  );
}
