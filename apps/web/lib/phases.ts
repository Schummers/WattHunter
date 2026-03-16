export interface AuctionPhase {
  id: number;
  label: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export const AUCTION_PHASES: AuctionPhase[] = [
  { id: 1, label: "Season Start",     startMonth: 1,  startDay: 15, endMonth: 3,  endDay: 1  },
  { id: 2, label: "Classics Part 1",  startMonth: 3,  startDay: 5,  endMonth: 4,  endDay: 1  },
  { id: 3, label: "Classics Part 2",  startMonth: 4,  startDay: 5,  endMonth: 5,  endDay: 1  },
  { id: 4, label: "Giro d'Italia",    startMonth: 5,  startDay: 5,  endMonth: 6,  endDay: 1  },
  { id: 5, label: "Pre-Tour",         startMonth: 6,  startDay: 5,  endMonth: 7,  endDay: 1  },
  { id: 6, label: "Tour de France",   startMonth: 7,  startDay: 4,  endMonth: 7,  endDay: 27 },
  { id: 7, label: "Post-Tour",        startMonth: 7,  startDay: 31, endMonth: 8,  endDay: 18 },
  { id: 8, label: "La Vuelta",        startMonth: 8,  startDay: 22, endMonth: 9,  endDay: 15 },
  { id: 9, label: "End of Season",    startMonth: 9,  startDay: 19, endMonth: 10, endDay: 18 },
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
