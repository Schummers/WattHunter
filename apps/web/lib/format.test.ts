import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRoundCountdown } from "./format";

const NOW = new Date("2026-04-04T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function future(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString();
}

const H = 60 * 60 * 1000;
const D = 24 * H;

describe("formatRoundCountdown — text", () => {
  it("shows days and hours when >= 1 day (open)", () => {
    expect(formatRoundCountdown(future(1 * D + 5 * H), "open").text).toBe("closes in 1d 5h");
  });

  it("shows days and hours when >= 1 day (scheduled)", () => {
    expect(formatRoundCountdown(future(3 * D + 2 * H), "scheduled").text).toBe("opens in 3d 2h");
  });

  it("shows hours only when < 1 day (open)", () => {
    expect(formatRoundCountdown(future(18 * H), "open").text).toBe("closes in 18h");
  });

  it("shows hours only when < 1 day (scheduled)", () => {
    expect(formatRoundCountdown(future(6 * H), "scheduled").text).toBe("opens in 6h");
  });

  it("shows '< 1h' when less than 1 hour remains (open)", () => {
    expect(formatRoundCountdown(future(30 * 60 * 1000), "open").text).toBe("closes in < 1h");
  });

  it("shows '< 1h' when less than 1 hour remains (scheduled)", () => {
    expect(formatRoundCountdown(future(1), "scheduled").text).toBe("opens in < 1h");
  });

  it("returns 'ended' for past dates (defensive fallback)", () => {
    expect(formatRoundCountdown(future(-1), "open").text).toBe("ended");
  });

  it("accepts a Date object as well as a string", () => {
    const target = new Date(NOW.getTime() + 2 * D + 3 * H);
    expect(formatRoundCountdown(target, "open").text).toBe("closes in 2d 3h");
  });
});

describe("formatRoundCountdown — urgent flag", () => {
  it("is false when more than 48h remain", () => {
    expect(formatRoundCountdown(future(3 * D), "open").urgent).toBe(false);
  });

  it("is true when exactly 48h remain", () => {
    expect(formatRoundCountdown(future(2 * D), "open").urgent).toBe(true);
  });

  it("is true when less than 48h remain", () => {
    expect(formatRoundCountdown(future(23 * H), "open").urgent).toBe(true);
  });

  it("is false for ended (defensive fallback)", () => {
    expect(formatRoundCountdown(future(-1), "open").urgent).toBe(false);
  });
});
