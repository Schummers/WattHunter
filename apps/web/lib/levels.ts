export const LEVELS = [
  { level: 1, xp: 0, slots: 6, pool: "#300-600", poolMin: 300, strategy: "Speciality", maxActive: 1, sponsor: "Lotto · 250K" },
  { level: 2, xp: 25, slots: 7, pool: "#200-600", poolMin: 200, strategy: null, maxActive: 1, sponsor: "Astana · 350K" },
  { level: 3, xp: 150, slots: 8, pool: "#100-600", poolMin: 100, strategy: "Nationality", maxActive: 2, sponsor: "T3 · 450K (×4)" },
  { level: 4, xp: 350, slots: 9, pool: "#30-600", poolMin: 30, strategy: null, maxActive: 2, sponsor: null },
  { level: 5, xp: 600, slots: 10, pool: "#20-600", poolMin: 20, strategy: "Teams", maxActive: 2, sponsor: "T4 · 650K (×4)" },
  { level: 6, xp: 900, slots: 11, pool: "#10-600", poolMin: 10, strategy: null, maxActive: 2, sponsor: null },
  { level: 7, xp: 1500, slots: 12, pool: "#4-600", poolMin: 4, strategy: "Age", maxActive: 3, sponsor: "T5 · 1M (×2)" },
  { level: 8, xp: 2000, slots: 12, pool: "#1-600", poolMin: 1, strategy: null, maxActive: 3, sponsor: "T6 UAE · 1.25M" },
] as const;

export type LevelData = (typeof LEVELS)[number];

export function getLevelForXp(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) return LEVELS[i].level;
  }
  return 1;
}

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

  if (current.strategy) {
    pills.push(`Strategy: ${current.strategy}`);
  }

  if (prev && current.maxActive !== prev.maxActive) {
    pills.push(`${current.maxActive} max strategies`);
  }

  if (current.sponsor) {
    pills.push(current.sponsor);
  }

  return pills;
}

export function getDefaultStartingLevel(date: Date = new Date()): number {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = m * 100 + d;
  if (md < 305) return 1;   // Before Mar 5
  if (md < 405) return 2;   // Mar 5 – Apr 4
  if (md < 505) return 3;   // Apr 5 – May 4
  if (md < 605) return 4;   // May 5 – Jun 4
  if (md < 704) return 5;   // Jun 5 – Jul 3
  if (md < 731) return 6;   // Jul 4 – Jul 30
  if (md < 822) return 7;   // Jul 31 – Aug 21
  return 8;                  // Aug 22+
}

export function getUnlockDescriptions(level: number): string[] {
  const current = getLevelByNumber(level);
  const prev = level > 1 ? getLevelByNumber(level - 1) : null;
  const descriptions: string[] = [];

  if (!prev || current.slots !== prev.slots) {
    const prevSlots = prev?.slots ?? 0;
    descriptions.push(`Roster expanded to **${current.slots} slots** (was ${prevSlots})`);
  }

  if (!prev || current.pool !== prev.pool) {
    const poolStart = current.pool.replace("#", "");
    descriptions.push(`Access riders ranked **#${poolStart}**`);
  }

  if (current.strategy) {
    descriptions.push(`Unlock **${current.strategy}** strategy type`);
  }

  if (prev && current.maxActive !== prev.maxActive) {
    descriptions.push(`Use **${current.maxActive} strategies** at the same time`);
  }

  if (current.sponsor) {
    descriptions.push(`Access **${current.sponsor}**`);
  }

  return descriptions;
}
