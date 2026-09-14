"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PalmaresData } from "@/lib/palmares/load";
import { SeasonsTab } from "./seasons-tab";
import { WinsTab } from "./wins-tab";
import { JerseysTab } from "./jerseys-tab";
import { PlayersTab } from "./players-tab";

const TABS = [
  { value: "seasons", label: "Seasons" },
  { value: "wins", label: "Wins" },
  { value: "jerseys", label: "Jerseys" },
  { value: "players", label: "Players" },
] as const;

export function PalmaresClient({ data }: { data: PalmaresData }) {
  const [tab, setTab] = useState<string>("seasons");

  return (
    <div className="pb-24">
      <div className="px-4 pt-4">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Palmares
        </h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-3 gap-0">
        <div className="px-4">
          <TabsList variant="line">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="seasons" className="pt-4">
          <SeasonsTab data={data} />
        </TabsContent>
        <TabsContent value="wins" className="pt-4">
          <WinsTab events={data.events} />
        </TabsContent>
        <TabsContent value="jerseys" className="pt-4">
          <JerseysTab events={data.events} />
        </TabsContent>
        <TabsContent value="players" className="pt-4">
          <PlayersTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
