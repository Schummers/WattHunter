import { describe, expect, it } from "vitest";
import { getRankingRaceName } from "./ranking-race-name";

describe("getRankingRaceName", () => {
  it("labels the grouped Tour filter with its year", () => {
    expect(
      getRankingRaceName({
        raceSlug: "race/tour-de-france/2026/stage-11",
        raceName: "Tour de France — Stage 11",
      }),
    ).toBe("Tour de France 2026");
  });

  it("keeps the existing grouped label for other stage races", () => {
    expect(
      getRankingRaceName({
        raceSlug: "race/giro-d-italia/2026/stage-2",
        raceName: "Giro d'Italia — Stage 2",
      }),
    ).toBe("Giro d'Italia");
  });
});
