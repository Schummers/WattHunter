export const LEVELS = [
  { level: 1, xp: 0, slots: 6, pool: "#351-500", poolMin: 351, policy: "Speciality", maxActive: 1, sponsor: "Sponsor T1 · 40k€" },
  { level: 2, xp: 50, slots: 7, pool: "#251-500", poolMin: 251, policy: null, maxActive: 1, sponsor: null },
  { level: 3, xp: 150, slots: 7, pool: "#176-500", poolMin: 176, policy: "Nationality", maxActive: 1, sponsor: "Sponsor T2 · 60k€" },
  { level: 4, xp: 350, slots: 8, pool: "#101-500", poolMin: 101, policy: null, maxActive: 1, sponsor: null },
  { level: 5, xp: 700, slots: 9, pool: "#76-500", poolMin: 76, policy: "Teams", maxActive: 2, sponsor: "Sponsor T3 · 125k€" },
  { level: 6, xp: 1200, slots: 9, pool: "#51-500", poolMin: 51, policy: null, maxActive: 2, sponsor: null },
  { level: 7, xp: 1900, slots: 10, pool: "#26-500", poolMin: 26, policy: "Age", maxActive: 2, sponsor: "Sponsor T4 · 200k€" },
  { level: 8, xp: 2900, slots: 11, pool: "#11-500", poolMin: 11, policy: null, maxActive: 2, sponsor: "Sponsor T5 · 400k€" },
  { level: 9, xp: 4400, slots: 11, pool: "#4-500", poolMin: 4, policy: null, maxActive: 2, sponsor: null },
  { level: 10, xp: 6400, slots: 12, pool: "#1-500", poolMin: 1, policy: null, maxActive: 2, sponsor: null },
] as const;

export type LevelData = (typeof LEVELS)[number];

export function getLevelByNumber(level: number): LevelData {
  return LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))];
}

export function getNextLevel(level: number): LevelData | null {
  const idx = level - 1;
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getProgressPct(xp: number, currentLevel: number): number {
  const current = getLevelByNumber(currentLevel);
  const next = getNextLevel(currentLevel);
  if (!next) return 100;
  const range = next.xp - current.xp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((xp - current.xp) / range) * 100));
}

export function getMaxSlots(level: number): number {
  return getLevelByNumber(level).slots;
}

export function getNewUnlocks(level: number): string[] {
  const current = getLevelByNumber(level);
  const prev = level > 1 ? getLevelByNumber(level - 1) : null;
  const pills: string[] = [];

  if (!prev || current.slots !== prev.slots) {
    pills.push(`${current.slots} slots`);
  }

  if (!prev || current.pool !== prev.pool) {
    pills.push(`Pool ${current.pool}`);
  }

  if (current.policy) {
    pills.push(`Policy: ${current.policy}`);
  }

  if (prev && current.maxActive !== prev.maxActive) {
    pills.push(`${current.maxActive} max policies`);
  }

  if (current.sponsor) {
    pills.push(current.sponsor);
  }

  return pills;
}
