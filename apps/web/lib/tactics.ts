// apps/web/lib/tactics.ts
import { Zap, Rocket, Swords, Crosshair, Users, type LucideIcon } from "lucide-react";

export type TacticId =
  | "unleash"
  | "overdrive"
  | "nemesis_gc"
  | "nemesis_sprint"
  | "call_the_bus";

export type TacticState = "available" | "active_today" | "exhausted" | "disabled";

export interface TacticDef {
  id: TacticId;
  name: string;
  short: string;
  description: string;
  icon: LucideIcon;
  max: number;
}

export const TACTICS: readonly TacticDef[] = [
  {
    id: "unleash",
    name: "Unleash",
    short: "Domestiques → ×1.5",
    description:
      "Pick a stage. All your domestiques score as Stage Hunters (×1.5) for that stage only. Bypasses the 2-Stage-Hunter cap.",
    icon: Zap,
    max: 2,
  },
  {
    id: "overdrive",
    name: "Overdrive",
    short: "Stage Hunters → ×2.0",
    description:
      "Pick a stage. Your Stage Hunters jump from ×1.5 to ×2.0 for that stage only.",
    icon: Rocket,
    max: 2,
  },
  {
    id: "nemesis_gc",
    name: "Nemesis GC",
    short: "Duel a rival GC Leader",
    description:
      "Pick a rival team and a stage. Whoever holds the GC Leader role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
    icon: Swords,
    max: 1,
  },
  {
    id: "nemesis_sprint",
    name: "Nemesis Sprint",
    short: "Duel a rival Sprinter",
    description:
      "Pick a rival team and a stage. Whoever holds the Sprinter role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
    icon: Crosshair,
    max: 1,
  },
  {
    id: "call_the_bus",
    name: "Call the Bus",
    short: "+ bench riders",
    description:
      "Pick a stage. Bench riders score for that stage as domestiques (×1.0). Effective squad grows with your level.",
    icon: Users,
    max: 3,
  },
] as const;

export function findTactic(id: TacticId): TacticDef {
  const t = TACTICS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown tactic: ${id}`);
  return t;
}
