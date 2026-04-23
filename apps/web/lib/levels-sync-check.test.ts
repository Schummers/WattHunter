// apps/web/lib/levels-sync-check.test.ts
// Guards against drift between TS LEVELS and Python LEVEL_THRESHOLDS.
// If this test fails, one of the two sources was updated without the other.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "./levels";

describe("LEVELS vs Python LEVEL_THRESHOLDS", () => {
  it("xp values in levels.ts match LEVEL_THRESHOLDS in scoring.py", () => {
    const tsXps = LEVELS.map((l) => l.xp);

    // Resolve scoring.py path relative to this test file.
    const scoringPath = join(
      __dirname,
      "../../../services/pcs-sync/scoring.py",
    );
    const py = readFileSync(scoringPath, "utf-8");
    const match = py.match(/LEVEL_THRESHOLDS\s*=\s*\[([\d\s,]+)\]/);
    expect(match).not.toBeNull();
    const pyXps = match![1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    expect(pyXps).toEqual(tsXps);
  });
});
