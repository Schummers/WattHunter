import { describe, it, expect } from "vitest";
import { getReplaceWindowClosesAt } from "./gt-stage-schedule";

describe("getReplaceWindowClosesAt", () => {
  it("returns end of 1st rest day Europe/Paris for Giro 2026", () => {
    const closesAt = getReplaceWindowClosesAt("giro-d-italia", 2026);
    expect(closesAt).not.toBeNull();
    // 2026-05-11 23:59:59 +02:00 = 2026-05-11 21:59:59 UTC
    expect(closesAt!.toISOString()).toBe("2026-05-11T21:59:59.000Z");
  });

  it("returns end of 1st rest day Europe/Paris for Tour 2026", () => {
    const closesAt = getReplaceWindowClosesAt("tour-de-france", 2026);
    expect(closesAt).not.toBeNull();
    // 2026-07-13 23:59:59 +02:00 = 2026-07-13 21:59:59 UTC
    expect(closesAt!.toISOString()).toBe("2026-07-13T21:59:59.000Z");
  });

  it("returns null for an unconfigured GT", () => {
    // Vuelta 2026 schedule is not yet configured.
    expect(getReplaceWindowClosesAt("vuelta-a-espana", 2026)).toBeNull();
    expect(getReplaceWindowClosesAt("unknown-gt", 2099)).toBeNull();
  });
});
