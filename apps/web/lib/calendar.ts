import calendarData from "../../../services/pcs-sync/wt_calendar_2026.json";

interface RaceOneDay {
  slug: string;
  name: string;
  date: string;
  type: "one-day";
}

interface RaceStage {
  slug: string;
  name: string;
  start_date: string;
  end_date: string;
  type: "stage-race";
}

type Race = RaceOneDay | RaceStage;

export interface UpcomingRace {
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  type: "one-day" | "stage-race";
}

function getRaceStartDate(race: Race): string {
  return race.type === "one-day" ? race.date : race.start_date;
}

function getRaceEndDate(race: Race): string | null {
  return race.type === "stage-race" ? race.end_date : null;
}

export function getUpcomingRaces(count: number): UpcomingRace[] {
  const today = new Date().toISOString().slice(0, 10);
  const races = (calendarData as Race[])
    .filter((race) => {
      const end = race.type === "stage-race" ? race.end_date : race.date;
      return end >= today;
    })
    .sort((a, b) => getRaceStartDate(a).localeCompare(getRaceStartDate(b)))
    .slice(0, count)
    .map((race) => ({
      slug: race.slug,
      name: race.name,
      startDate: getRaceStartDate(race),
      endDate: getRaceEndDate(race),
      type: race.type,
    }));

  return races;
}

export function formatRaceDate(startDate: string, endDate: string | null): string {
  const start = new Date(startDate + "T12:00:00");
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (!endDate) return startStr;

  const end = new Date(endDate + "T12:00:00");
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${startStr} – ${end.getDate()}`;
  }
  return `${startStr} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
