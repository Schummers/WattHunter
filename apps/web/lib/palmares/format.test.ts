import { describe, it, expect } from "vitest";
import { abbreviateName, abbreviateNameShort, formatHeadToHeadScore } from "./format";

describe("abbreviateName", () => {
  it("initials the first word and keeps the rest", () => {
    expect(abbreviateName("David Choncoutié")).toBe("D. Choncoutié");
    expect(abbreviateName("Jonathan Schummers")).toBe("J. Schummers");
    expect(abbreviateName("Marino Alex")).toBe("M. Alex");
  });

  it("leaves a mononym alone", () => {
    expect(abbreviateName("Peejee")).toBe("Peejee");
    expect(abbreviateName("Klimax")).toBe("Klimax");
    expect(abbreviateName("bigdaddy")).toBe("bigdaddy");
    expect(abbreviateName("JibsEPAULE")).toBe("JibsEPAULE");
  });
});

describe("abbreviateNameShort", () => {
  it("also shortens the tail", () => {
    expect(abbreviateNameShort("David Choncoutié")).toBe("D. Chonco.");
    expect(abbreviateNameShort("Marino Alex")).toBe("M. Alex");
  });

  it("clips a long mononym instead of ellipsing it in CSS", () => {
    expect(abbreviateNameShort("TheAussieMate")).toBe("TheAussie");
    expect(abbreviateNameShort("Peejee")).toBe("Peejee");
  });
});

describe("formatHeadToHeadScore", () => {
  it("joins with a non-breaking hyphen", () => {
    expect(formatHeadToHeadScore(16, 8)).toBe("16‑8");
    expect(formatHeadToHeadScore(10, 10)).toBe("10‑10");
  });
});
