// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RankingClient } from "../ranking-client";
import { formatThousands } from "@/lib/format";

/**
 * The archived line must read as a line of the live ranking: rank, badge, the
 * player's current name, and a value on the right. It was a rank and a raw
 * account name until the identity resolver landed.
 *
 * `currentSeason` is set to the archived year so the season selector opens on
 * it: the component renders the archive path with no interaction.
 */
function renderArchived() {
  return render(
    <RankingClient
      leagueId="league-1"
      teams={[]}
      riders={[]}
      races={[]}
      teamXpByRace={{}}
      riderXpByRace={{}}
      currentSeason={2025}
      archivedSeasons={[
        {
          year: 2025,
          ranking: [
            {
              key: "David Choncoutié",
              displayName: "GoudalEnergies",
              isFormerPlayer: false,
              score: 2230,
              badgeUrl: null,
              badgeTier: null,
            },
            {
              key: "Fangio",
              displayName: "Fangio",
              isFormerPlayer: true,
              score: 940,
              badgeUrl: null,
              badgeTier: null,
            },
          ],
        },
      ]}
    />,
  );
}

describe("archived season row", () => {
  it("shows the player's current team name, not their account name", () => {
    renderArchived();
    expect(screen.getByText("GoudalEnergies")).toBeTruthy();
    expect(screen.queryByText("David Choncoutié")).toBeNull();
  });

  it("shows the season score in points, never as XP", () => {
    renderArchived();
    // formatThousands groups with a narrow no-break space, which the DOM query
    // normalizes to a regular one. Compare on the digits.
    const digits = (node: Element | null) => node?.textContent?.replace(/\D/g, "");
    expect(
      screen.getByText((_, node) => digits(node) === "2230" && node?.tagName === "SPAN"),
    ).toBeTruthy();
    expect(screen.getAllByText("PTS").length).toBe(2);
    expect(screen.queryByText("XP")).toBeNull();
  });

  it("falls back on initials when no badge is equipped", () => {
    renderArchived();
    expect(screen.getByText("G")).toBeTruthy();
  });

  it("keeps a former player in italics", () => {
    renderArchived();
    expect(screen.getByText("Fangio").className).toContain("italic");
  });
});
