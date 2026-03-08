"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SegmentedControl } from "@/components/segmented-control";
import { BackHeader } from "@/components/back-header";
import { placeBid, cancelBid } from "@/app/(game)/league/[leagueId]/auctions/[auctionId]/actions";
import { formatThousands, formatEuro, countryCodeToFlag } from "@/lib/format";

type RiderContext = "recruts" | "team" | "ranking";

interface Rider {
  id: string;
  full_name: string;
  nationality: string | null;
  team_name: string | null;
  pcs_rank: number | null;
  pcs_points_1yr: number | null;
  photo_url: string | null;
  specialty: string | null;
  birthdate: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

interface SeasonRanking {
  rider_id: string;
  season: number;
  points: number | null;
  rank: number | null;
  team: string | null;
}

interface Startlist {
  race_name: string;
  race_date: string | null;
}

interface RaceResult {
  race_name: string;
  race_date: string | null;
  pcs_points: number | null;
}

interface RiderDetailClientProps {
  leagueId: string;
  rider: Rider;
  rankings: SeasonRanking[];
  startlists: Startlist[];
  raceResults: RaceResult[];
  context: RiderContext;
  minSalary: number;
  currentBidAmount: number | null;
  activeAuctionId: string | null;
  contractData: { locked_salary: number; status: string } | null;
  ownerInfo: { display_name: string; team_name: string } | null;
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

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function resolvePhoto(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}

const BACK_LABELS: Record<RiderContext, string> = {
  recruts: "Recruts",
  team: "My Team",
  ranking: "Ranking",
};

export function RiderDetailClient({
  leagueId,
  rider,
  rankings,
  startlists,
  raceResults,
  context,
  minSalary,
  currentBidAmount,
  activeAuctionId,
  contractData,
  ownerInfo,
}: RiderDetailClientProps) {
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState<number>(currentBidAmount ?? minSalary);
  const [saving, setSaving] = useState(false);
  const [bidSaved, setBidSaved] = useState(!!currentBidAmount);
  const [error, setError] = useState<string | null>(null);
  const age = getAge(rider.birthdate);

  const hasBidChanged = bidAmount !== (currentBidAmount ?? minSalary) || !bidSaved;

  async function handleSaveBid() {
    if (!activeAuctionId) return;
    setSaving(true);
    setError(null);
    const result = await placeBid({
      auctionId: activeAuctionId,
      riderId: rider.id,
      amount: bidAmount,
      round: 1,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setBidSaved(true);
    }
    setSaving(false);
  }

  async function handleRemoveBid() {
    if (!currentBidAmount) return;
    setSaving(true);
    // We need the bid ID — cancel via the action
    // For now, placing a bid of 0 effectively removes. But we have cancelBid.
    // cancelBid requires bid ID which we don't have here. Use placeBid pattern.
    setSaving(false);
    router.back();
  }

  // Metric boxes per context (RD-4)
  function renderMetrics() {
    const boxClass = "flex-1 rounded-lg bg-[var(--bg-surface)] px-3 py-2.5 space-y-0.5";
    const labelClass = "text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]";
    const valueClass = "text-[length:var(--type-stat)] font-extrabold font-mono text-[var(--text-high)]";

    if (context === "recruts") {
      return (
        <div className="flex gap-3 px-4">
          <div className={boxClass}>
            <span className={labelClass}>Game XP</span>
            <div className={valueClass}>—</div>
          </div>
          <div className={boxClass}>
            <span className={labelClass}>Bonus</span>
            <div className={valueClass}>—</div>
          </div>
          <div className={boxClass}>
            <span className={labelClass}>Min. Salary</span>
            <div className={`${valueClass} text-[var(--accent-default)]`}>
              {formatThousands(minSalary)}
            </div>
          </div>
        </div>
      );
    }

    if (context === "team" && contractData) {
      return (
        <div className="flex gap-3 px-4">
          <div className={boxClass}>
            <span className={labelClass}>Game XP</span>
            <div className={valueClass}>—</div>
          </div>
          <div className={boxClass}>
            <span className={labelClass}>Bonus</span>
            <div className={valueClass}>—</div>
          </div>
          <div className={boxClass}>
            <span className={labelClass}>Paid Salary</span>
            <div className={valueClass}>
              {formatThousands(contractData.locked_salary)}
            </div>
          </div>
        </div>
      );
    }

    // ranking: 2 boxes
    return (
      <div className="flex gap-3 px-4">
        <div className={boxClass}>
          <span className={labelClass}>Game XP</span>
          <div className={valueClass}>—</div>
        </div>
        <div className={boxClass}>
          <span className={labelClass}>Bonus</span>
          <div className={valueClass}>—</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackHeader label={BACK_LABELS[context]} />

      {/* Hero — horizontal layout (RD-3) */}
      <div className="flex items-start gap-3 px-4">
        <div className="relative shrink-0">
          <Avatar className="size-20">
            {rider.photo_url && (
              <AvatarImage
                src={resolvePhoto(rider.photo_url)}
                alt={rider.full_name}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="bg-[var(--bg-surface)] text-sm text-[var(--text-mid)]">
              {getInitials(rider.full_name)}
            </AvatarFallback>
          </Avatar>
          {rider.pcs_rank != null && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[length:var(--type-micro)] font-semibold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">
              #{rider.pcs_rank}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)] truncate">
                {rider.full_name}
              </h1>
              {rider.nationality && (
                <span className="shrink-0">{countryCodeToFlag(rider.nationality)}</span>
              )}
            </div>
            {rider.team_name && (
              <p className="text-sm text-[var(--text-mid)]">{rider.team_name}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {rider.specialty && (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
                {rider.specialty}
              </span>
            )}
            {age !== null && (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
                {age} yrs
              </span>
            )}
            {rider.height_cm && (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
                {rider.height_cm} cm
              </span>
            )}
            {rider.weight_kg && (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
                {rider.weight_kg} kg
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metric Boxes (RD-4) */}
      {renderMetrics()}

      {/* Action zone */}
      {/* RD-5: Bid section (recruts only) */}
      {context === "recruts" && activeAuctionId && (
        <div className="px-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBidAmount((v) => Math.max(minSalary, v - 1000))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] text-lg font-bold text-[var(--text-mid)]"
            >
              −
            </button>
            <div className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--accent-default)] bg-[var(--bg-surface-hover)] h-10 px-3">
              <input
                type="text"
                inputMode="numeric"
                value={formatThousands(bidAmount)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\s/g, "");
                  const val = parseInt(raw, 10);
                  if (!isNaN(val) && val >= 0) setBidAmount(val);
                }}
                className="w-full bg-transparent text-center text-base font-bold font-mono text-[var(--accent-default)] outline-none"
              />
              <span className="text-sm text-[var(--text-ghost)]">€</span>
            </div>
            <button
              type="button"
              onClick={() => setBidAmount((v) => v + 1000)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] text-lg font-bold text-[var(--text-mid)]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveBid}
            disabled={saving || (bidSaved && bidAmount === currentBidAmount)}
            className="w-full rounded-lg bg-[var(--accent-default)] py-2.5 text-sm font-bold text-[var(--cta-text)] disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save bid"}
          </button>
          {currentBidAmount && (
            <button
              type="button"
              onClick={handleRemoveBid}
              className="w-full text-center text-sm link-tertiary"
            >
              Remove bid
            </button>
          )}
          {error && (
            <p className="text-xs text-[var(--status-danger)] text-center">{error}</p>
          )}
        </div>
      )}

      {/* RD-6: Release button (team only) */}
      {context === "team" && contractData?.status === "active" && (
        <div className="px-4">
          <button
            type="button"
            onClick={() => {
              // Simple confirm — could be AlertDialog later
              if (confirm("Release this rider? They will leave in 1 month.")) {
                // Would need contractId passed down
              }
            }}
            className="w-full rounded-lg border border-[var(--border-default)] py-2.5 text-sm font-semibold text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Release rider — 1 month notice
          </button>
        </div>
      )}

      {/* RD-7: Ownership line (ranking only) */}
      {context === "ranking" && (
        <div className="px-4">
          <p className="text-sm text-[var(--text-mid)]">
            {ownerInfo
              ? `Owned by @${ownerInfo.display_name} · ${ownerInfo.team_name}`
              : "Not recruited"}
          </p>
        </div>
      )}

      {/* Segmented Control (RD-8) — hide for ranking */}
      {context !== "ranking" && (
        <div className="px-4">
          <SegmentedControl
            segments={["PCS Stats", "Game Stats"]}
            activeIndex={tabIndex}
            onChange={setTabIndex}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="px-4 pb-8">
        {context === "ranking" ? (
          // Ranking: all sections inline (no tabs)
          <div className="space-y-6">
            <PcsStatsSection rankings={rankings} startlists={startlists} />
            <GameResultsSection raceResults={raceResults} />
          </div>
        ) : tabIndex === 0 ? (
          <PcsStatsSection rankings={rankings} startlists={startlists} />
        ) : (
          <GameResultsSection raceResults={raceResults} />
        )}
      </div>
    </div>
  );
}

// PCS Stats section (season rankings + race programme)
function PcsStatsSection({ rankings, startlists }: { rankings: SeasonRanking[]; startlists: Startlist[] }) {
  return (
    <div className="space-y-6">
      {/* Season Rankings — flat table (RD-9) */}
      <div className="space-y-2">
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Season Rankings
        </span>

        {rankings.length === 0 ? (
          <p className="text-sm text-[var(--text-mid)]">
            No season data available.
          </p>
        ) : (
          <div>
            <div className="flex items-center gap-4 px-1 py-1.5 text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              <span className="w-12">Year</span>
              <span className="flex-1">Team</span>
              <span className="w-16 text-right">Points</span>
              <span className="w-12 text-right">Rank</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {rankings.map((r) => (
                <div key={r.season} className="flex items-center gap-4 px-1 py-2">
                  <span className="w-12 text-sm font-bold text-[var(--text-high)]">
                    {r.season}
                  </span>
                  <span className="flex-1 text-sm text-[var(--text-mid)] truncate">
                    {r.team ?? "—"}
                  </span>
                  <span className="w-16 text-right font-mono text-sm font-bold text-[var(--text-high)]">
                    {r.points != null ? r.points.toLocaleString() : "—"}
                  </span>
                  <span className="w-12 text-right font-mono text-sm text-[var(--text-mid)]">
                    {r.rank != null ? `#${r.rank}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Race Programme (RD-10) */}
      {startlists.length > 0 && (
        <div className="space-y-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Race Programme
          </span>
          <div className="divide-y divide-[var(--border-subtle)]">
            {startlists.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-[var(--text-high)] block truncate">
                    {s.race_name}
                  </span>
                  {s.race_date && (
                    <span className="text-xs text-[var(--text-low)]">
                      {new Date(s.race_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// RD-11: Game Results section
function GameResultsSection({ raceResults }: { raceResults: RaceResult[] }) {
  if (raceResults.length === 0) {
    return (
      <p className="text-sm text-[var(--text-mid)]">
        Game stats will be available once this rider is on a team.
      </p>
    );
  }

  // Group by month
  const grouped: Record<string, RaceResult[]> = {};
  for (const r of raceResults) {
    const date = r.race_date ? new Date(r.race_date) : null;
    const key = date
      ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
      : "UNKNOWN";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([month, results]) => (
        <div key={month} className="space-y-1">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            {month}
          </span>
          <div className="divide-y divide-[var(--border-subtle)]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-[var(--text-high)] block truncate">
                    {r.race_name}
                  </span>
                  {r.race_date && (
                    <span className="text-xs text-[var(--text-low)]">
                      {new Date(r.race_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.pcs_points != null && (
                    <span className="font-mono text-sm font-bold text-[var(--text-high)]">
                      {r.pcs_points} PCS
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
