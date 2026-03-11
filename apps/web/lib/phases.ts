export interface AuctionPhase {
  id: number;
  label: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export const AUCTION_PHASES: AuctionPhase[] = [
  { id: 1, label: "Season Start",   startMonth: 1,  startDay: 1,  endMonth: 2,  endDay: 28 },
  { id: 2, label: "The Flandrians", startMonth: 3,  startDay: 1,  endMonth: 4,  endDay: 12 },
  { id: 3, label: "The Ardennes",   startMonth: 4,  startDay: 13, endMonth: 5,  endDay: 10 },
  { id: 4, label: "Giro d'Italia",  startMonth: 5,  startDay: 11, endMonth: 6,  endDay: 14 },
  { id: 5, label: "Tour de France", startMonth: 6,  startDay: 15, endMonth: 8,  endDay: 2  },
  { id: 6, label: "La Vuelta",      startMonth: 8,  startDay: 3,  endMonth: 9,  endDay: 21 },
  { id: 7, label: "End of Season",  startMonth: 9,  startDay: 22, endMonth: 11, endDay: 2  },
];

export function getCurrentPhase(date: Date = new Date()): AuctionPhase {
  const year = date.getFullYear();
  for (const phase of AUCTION_PHASES) {
    const start = new Date(year, phase.startMonth - 1, phase.startDay);
    const end = new Date(year, phase.endMonth - 1, phase.endDay, 23, 59, 59);
    if (date >= start && date <= end) return phase;
  }
  return AUCTION_PHASES[AUCTION_PHASES.length - 1];
}

export function getPhaseRange(phase: AuctionPhase, year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, phase.startMonth - 1, phase.startDay),
    end: new Date(year, phase.endMonth - 1, phase.endDay, 23, 59, 59),
  };
}

export function formatPhaseRange(phase: AuctionPhase): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[phase.startMonth - 1]} ${phase.startDay} – ${months[phase.endMonth - 1]} ${phase.endDay}`;
}
