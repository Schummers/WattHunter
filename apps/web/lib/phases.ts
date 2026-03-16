export interface AuctionPhase {
  id: number;
  label: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  auctionDates: { month: number; day: number }[] | null;
}

export const AUCTION_PHASES: AuctionPhase[] = [
  { id: 1, label: "Season Start",     startMonth: 1,  startDay: 15, endMonth: 3,  endDay: 1,  auctionDates: [{ month: 3, day: 2 }, { month: 3, day: 3 }, { month: 3, day: 4 }] },
  { id: 2, label: "Classics Part 1",  startMonth: 3,  startDay: 5,  endMonth: 4,  endDay: 1,  auctionDates: [{ month: 4, day: 2 }, { month: 4, day: 3 }, { month: 4, day: 4 }] },
  { id: 3, label: "Classics Part 2",  startMonth: 4,  startDay: 5,  endMonth: 5,  endDay: 1,  auctionDates: [{ month: 5, day: 2 }, { month: 5, day: 3 }, { month: 5, day: 4 }] },
  { id: 4, label: "Giro d'Italia",    startMonth: 5,  startDay: 5,  endMonth: 6,  endDay: 1,  auctionDates: [{ month: 6, day: 2 }, { month: 6, day: 3 }, { month: 6, day: 4 }] },
  { id: 5, label: "Pre-Tour",         startMonth: 6,  startDay: 5,  endMonth: 7,  endDay: 1,  auctionDates: [{ month: 7, day: 2 }, { month: 7, day: 3 }, { month: 7, day: 4 }] },
  { id: 6, label: "Tour de France",   startMonth: 7,  startDay: 4,  endMonth: 7,  endDay: 27, auctionDates: [{ month: 7, day: 28 }, { month: 7, day: 29 }, { month: 7, day: 30 }] },
  { id: 7, label: "Post-Tour",        startMonth: 7,  startDay: 31, endMonth: 8,  endDay: 18, auctionDates: [{ month: 8, day: 19 }, { month: 8, day: 20 }, { month: 8, day: 21 }] },
  { id: 8, label: "La Vuelta",        startMonth: 8,  startDay: 22, endMonth: 9,  endDay: 15, auctionDates: [{ month: 9, day: 16 }, { month: 9, day: 17 }, { month: 9, day: 18 }] },
  { id: 9, label: "End of Season",    startMonth: 9,  startDay: 19, endMonth: 10, endDay: 18, auctionDates: null },
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

export interface NextAuction {
  phase: AuctionPhase;
  round: number;
  date: Date;
}

export function getNextAuctionDate(from: Date = new Date()): NextAuction | null {
  const year = from.getFullYear();

  for (const phase of AUCTION_PHASES) {
    if (!phase.auctionDates) continue;
    for (let r = 0; r < phase.auctionDates.length; r++) {
      const ad = phase.auctionDates[r];
      const auctionDate = new Date(year, ad.month - 1, ad.day);
      if (auctionDate > from) {
        return { phase, round: r + 1, date: auctionDate };
      }
    }
  }

  return null;
}

export function formatAuctionDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
