/**
 * Calculate total XP boost percentage from active team strategies matched against roster riders.
 *
 * Each active strategy grants `xp_bonus` (e.g. 0.05 = 5%) per rider that matches its config.
 * Total boost = sum of (xp_bonus × matching riders count) for all active strategies.
 */

export interface StrategyWithConfig {
  xp_bonus: number;
  slug: string;
  config: Record<string, string> | null;
}

export interface RiderForBoost {
  nationality: string | null;
  real_team: string | null;
  specialty: string | null;
  birthdate: string | null;
}

function getAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function riderMatchesStrategy(rider: RiderForBoost, strategy: StrategyWithConfig): boolean {
  const cfg = strategy.config;
  switch (strategy.slug) {
    case "national_pride":
      return !!cfg?.nationality && rider.nationality === cfg.nationality;
    case "team_chemistry":
      return !!cfg?.team && rider.real_team === cfg.team;
    case "specialist":
      return !!cfg?.specialty && rider.specialty?.toLowerCase() === cfg.specialty.toLowerCase();
    case "young_blood": {
      const age = getAge(rider.birthdate);
      const maxAge = cfg?.max_age ? parseInt(cfg.max_age, 10) : 25;
      return age !== null && age <= maxAge;
    }
    case "road_warriors": {
      const rwAge = getAge(rider.birthdate);
      return rwAge !== null && rwAge > 32;
    }
    default:
      return false;
  }
}

export function calculateBoost(
  activeStrategies: StrategyWithConfig[],
  riders: RiderForBoost[]
): number {
  let totalBoost = 0;

  for (const strategy of activeStrategies) {
    const matchCount = riders.filter((r) => riderMatchesStrategy(r, strategy)).length;
    totalBoost += strategy.xp_bonus * matchCount;
  }

  return Math.round(totalBoost * 100);
}
