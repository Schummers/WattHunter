import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_TEAM_IDS,
  DEMO_USER_IDS,
  DEMO_TEAM_NAMES,
  DEMO_VISITOR_TEAM_INDEX,
} from "@/lib/demo-constants";

function pyConst(source: string, name: string): string[] {
  const re = new RegExp(`${name}:\\s*list\\[str\\]\\s*=\\s*\\[(.*?)\\]`, "s");
  const m = re.exec(source);
  if (!m) throw new Error(`Could not extract ${name} from python source`);
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function pyScalar(source: string, name: string, kind: "str" | "int"): string {
  const re = new RegExp(`${name}:\\s*${kind}\\s*=\\s*(.+)`);
  const m = re.exec(source);
  if (!m) throw new Error(`Could not extract ${name} from python source`);
  return m[1].trim().replace(/^"|"$/g, "");
}

describe("demo constants TS ↔ Python parity", () => {
  const py = readFileSync(
    resolve(__dirname, "../../../../services/pcs-sync/demo_constants.py"),
    "utf8",
  );

  it("DEMO_LEAGUE_SLUG matches", () => {
    expect(pyScalar(py, "DEMO_LEAGUE_SLUG", "str")).toBe(DEMO_LEAGUE_SLUG);
  });

  it("DEMO_LEAGUE_ID matches", () => {
    expect(pyScalar(py, "DEMO_LEAGUE_ID", "str")).toBe(DEMO_LEAGUE_ID);
  });

  it("DEMO_TEAM_IDS match", () => {
    expect(pyConst(py, "DEMO_TEAM_IDS")).toEqual([...DEMO_TEAM_IDS]);
  });

  it("DEMO_USER_IDS match", () => {
    expect(pyConst(py, "DEMO_USER_IDS")).toEqual([...DEMO_USER_IDS]);
  });

  it("DEMO_TEAM_NAMES match", () => {
    expect(pyConst(py, "DEMO_TEAM_NAMES")).toEqual([...DEMO_TEAM_NAMES]);
  });

  it("DEMO_VISITOR_TEAM_INDEX matches", () => {
    expect(Number(pyScalar(py, "DEMO_VISITOR_TEAM_INDEX", "int"))).toBe(
      DEMO_VISITOR_TEAM_INDEX,
    );
  });
});
