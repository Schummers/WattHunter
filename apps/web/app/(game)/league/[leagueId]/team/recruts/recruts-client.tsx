"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import { RiderCard } from "@/components/rider-card";
import { SegmentedControl } from "@/components/segmented-control";
import { StickyBar } from "@/components/sticky-bar";
import { placeBid, cancelBid } from "@/app/(game)/league/[leagueId]/auctions/[auctionId]/actions";
import { smartCountdown, formatThousands, countryCodeToFlag, calcMinSalary } from "@/lib/format";

interface Rider {
  id: string;
  full_name: string;
  nationality: string | null;
  real_team: string | null;
  pcs_rank: number | null;
  pcs_rank_diff: number | null;
  photo_url: string | null;
  specialty: string | null;
  pcs_points_1yr: number | null;
}

interface ActiveRound {
  id: string;
  name: string;
  opens_at: string;
  closes_at: string;
}

interface InitialBid {
  bid_id: string;
  rider_id: string;
  amount: number;
}

interface NextRound {
  id: string;
  name: string;
  opens_at: string;
}

interface RecrutsClientProps {
  leagueId: string;
  riders: Rider[];
  activeRound: ActiveRound | null;
  nextRound?: NextRound | null;
  nextAuctionLabel?: string | null;
  maxSlots: number;
  currentSlots: number;
  initialBids?: InitialBid[];
  treasury: number;
}

const FILTER_OPTIONS = ["All", "Teams", "Speciality", "Nationality", "Age"];

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AR: "Argentina", AM: "Armenia",
  AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BE: "Belgium", BA: "Bosnia",
  BR: "Brazil", BG: "Bulgaria", CA: "Canada", CL: "Chile", CN: "China",
  CO: "Colombia", CR: "Costa Rica", HR: "Croatia", CZ: "Czechia", DK: "Denmark",
  EC: "Ecuador", EG: "Egypt", ER: "Eritrea", EE: "Estonia", ET: "Ethiopia",
  FI: "Finland", FR: "France", GE: "Georgia", DE: "Germany", GB: "Great Britain",
  GR: "Greece", HU: "Hungary", IS: "Iceland", IN: "India", ID: "Indonesia",
  IR: "Iran", IE: "Ireland", IL: "Israel", IT: "Italy", JP: "Japan",
  KZ: "Kazakhstan", KE: "Kenya", LV: "Latvia", LT: "Lithuania", LU: "Luxembourg",
  MX: "Mexico", MA: "Morocco", NL: "Netherlands", NZ: "New Zealand", NO: "Norway",
  PA: "Panama", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  RO: "Romania", RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia", RS: "Serbia",
  SG: "Singapore", SK: "Slovakia", SI: "Slovenia", ZA: "South Africa", KR: "South Korea",
  ES: "Spain", SE: "Sweden", CH: "Switzerland", TW: "Taiwan", TH: "Thailand",
  TR: "Turkey", UA: "Ukraine", AE: "UAE", US: "United States", UY: "Uruguay",
  UZ: "Uzbekistan", VE: "Venezuela",
};

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code] ?? code;
}

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0].toUpperCase();
  return `${firstInitial}. ${lastName}`;
}


export function RecrutsClient({
  leagueId,
  riders,
  activeRound,
  nextRound,
  nextAuctionLabel,
  maxSlots,
  currentSlots,
  initialBids = [],
  treasury,
}: RecrutsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Initialize bids from server data
  const [bids, setBids] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const b of initialBids) {
      map[b.rider_id] = b.amount;
    }
    return map;
  });
  const [savedBids, setSavedBids] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const b of initialBids) {
      map[b.rider_id] = b.amount;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  // Check if there are unsaved changes
  const hasPendingBids = useMemo(() => {
    const bidKeys = Object.keys(bids);
    const savedKeys = Object.keys(savedBids);
    if (bidKeys.length !== savedKeys.length) return true;
    return bidKeys.some((k) => bids[k] !== savedBids[k]);
  }, [bids, savedBids]);

  // Warn before leaving with unsaved bids (browser back/reload)
  useEffect(() => {
    if (!hasPendingBids) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingBids]);

  const filteredRiders = useMemo(() => {
    let result = riders;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.real_team && r.real_team.toLowerCase().includes(q)) ||
          (r.nationality && r.nationality.toLowerCase().includes(q))
      );
    }

    // Category filter (simplified — full accordion views come later)
    if (activeFilter === "Speciality") {
      result = [...result].sort((a, b) =>
        (a.specialty ?? "").localeCompare(b.specialty ?? "")
      );
    } else if (activeFilter === "Teams") {
      result = [...result].sort((a, b) =>
        (a.real_team ?? "").localeCompare(b.real_team ?? "")
      );
    } else if (activeFilter === "Nationality") {
      result = [...result].sort((a, b) =>
        (a.nationality ?? "").localeCompare(b.nationality ?? "")
      );
    }

    return result;
  }, [riders, search, activeFilter]);

  const groupedRiders = useMemo(() => {
    if (activeFilter === "All") return null;

    const groups: Record<string, Rider[]> = {};
    for (const r of filteredRiders) {
      let key: string;
      if (activeFilter === "Teams") {
        key = r.real_team ?? "No team";
      } else if (activeFilter === "Speciality") {
        key = r.specialty ?? "Unknown";
      } else if (activeFilter === "Nationality") {
        key = countryName(r.nationality);
      } else {
        // Age filter — no birthdate available yet, group all as Unknown
        key = "Unknown";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    // Sort group names alphabetically, fallback labels last
    const fallbacks = new Set(["Unknown", "No team"]);
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (fallbacks.has(a) && !fallbacks.has(b)) return 1;
      if (fallbacks.has(b) && !fallbacks.has(a)) return -1;
      return a.localeCompare(b);
    });

    return sorted;
  }, [filteredRiders, activeFilter]);

  // When filter changes, auto-expand first group
  useEffect(() => {
    if (groupedRiders && groupedRiders.length > 0) {
      setExpandedGroups(new Set([groupedRiders[0][0]]));
    }
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  function handleBidChange(riderId: string, value: number) {
    if (value <= 0) {
      setBids((prev) => {
        const next = { ...prev };
        delete next[riderId];
        return next;
      });
    } else {
      setBids((prev) => ({ ...prev, [riderId]: value }));
    }
  }

  async function handleSave() {
    if (!activeRound) return;
    setSaving(true);
    setErrors({});
    const newErrors: Record<string, string> = {};

    // Cancel bids that were removed (in savedBids but not in current bids)
    const removedRiderIds = Object.keys(savedBids).filter((rid) => !(rid in bids));
    if (removedRiderIds.length > 0) {
      const bidIdsToCancel = initialBids
        .filter((b) => removedRiderIds.includes(b.rider_id))
        .map((b) => b.bid_id);
      await Promise.all(bidIdsToCancel.map((id) => cancelBid(id)));
    }

    // Place or update bids
    const bidEntries = Object.entries(bids);
    const results = await Promise.all(
      bidEntries.map(async ([riderId, amount]) => {
        const result = await placeBid({
          auctionId: activeRound.id,
          riderId,
          amount,
          round: 1,
        });
        return { riderId, result };
      })
    );

    for (const { riderId, result } of results) {
      if (result.error) {
        newErrors[riderId] = result.error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
    } else {
      setSavedBids({ ...bids });
      router.refresh();
    }
    setSaving(false);
  }

  const totalBidAmount = Object.values(bids).reduce((s, v) => s + v, 0);

  return (
    <div className="pb-20">
      {/* Round header */}
      {activeRound ? (
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {activeRound.name} &middot; {smartCountdown(activeRound.closes_at)}
          </span>
          <Link href={`/league/${leagueId}/team/recruts/history`} className="text-[length:var(--type-body)] link-tertiary">
            History &rarr;
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {nextRound
              ? `Next round · ${new Date(nextRound.opens_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : nextAuctionLabel
                ? nextAuctionLabel
                : "Waiting for first auction"}
          </span>
          <Link href={`/league/${leagueId}/team/recruts/history`} className="text-[length:var(--type-body)] link-tertiary">
            History &rarr;
          </Link>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)]">
          <Search size={16} className="shrink-0 text-[var(--text-ghost)]" />
          <input
            type="text"
            placeholder="Search rider, team, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-3">
        <SegmentedControl
          segments={FILTER_OPTIONS}
          activeIndex={FILTER_OPTIONS.indexOf(activeFilter)}
          onChange={(i) => setActiveFilter(FILTER_OPTIONS[i])}
        />
      </div>

      {/* Counter */}
      <div className="px-4 pb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {filteredRiders.length} available
        </span>
      </div>

      {/* Rider list */}
      <div>
        {groupedRiders ? (
          /* Accordion view */
          groupedRiders.map(([groupName, groupRiders]) => {
            const expanded = expandedGroups.has(groupName);
            return (
              <div key={groupName}>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="flex w-full items-center justify-between px-4 py-2.5 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]"
                >
                  <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
                    {groupName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                      {groupRiders.length}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-[var(--text-low)] transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>
                {expanded &&
                  groupRiders.map((r) => {
                    const minSalary = calcMinSalary(r.pcs_points_1yr ?? 0);
                    const currentBid = bids[r.id];
                    return (
                      <RiderCard
                        key={r.id}
                        rider={{
                          id: r.id,
                          name: formatName(r.full_name),
                          nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
                          team_name: r.real_team ?? undefined,
                          pcs_rank: r.pcs_rank ?? undefined,
                          pcs_rank_diff: r.pcs_rank_diff,
                          photo_url: r.photo_url,
                        }}
                        bidState={currentBid ? "active" : "none"}
                        href={`/league/${leagueId}/rider/${r.id}?from=recruts`}
                        rightContent={
                          <div className="flex flex-col items-end gap-0.5">
                            <div
                              className={`flex items-center gap-0.5 rounded-lg px-2 h-7 lg:pointer-events-none ${
                                currentBid
                                  ? "border border-[var(--accent-default)] bg-[var(--bg-surface-hover)]"
                                  : "border border-[var(--border-default)] bg-transparent"
                              }`}
                            >
                              <input
                                type="text"
                                inputMode="numeric"
                                min={minSalary}
                                step={1000}
                                placeholder={formatThousands(minSalary)}
                                value={currentBid ? formatThousands(currentBid) : ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\s/g, "");
                                  const val = parseInt(raw, 10);
                                  handleBidChange(r.id, isNaN(val) ? 0 : val);
                                }}
                                onClick={(e) => { if (window.innerWidth < 1024) e.stopPropagation(); }}
                                className={`w-20 bg-transparent text-right text-[length:var(--type-body)] font-semibold font-mono outline-none ${
                                  currentBid
                                    ? "text-[var(--accent-default)]"
                                    : "text-[var(--text-low)]"
                                }`}
                              />
                              <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)] font-medium">
                                €
                              </span>
                            </div>
                            {errors[r.id] && (
                              <span className="text-[length:var(--type-micro)] text-[var(--status-danger)]">
                                {errors[r.id]}
                              </span>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
              </div>
            );
          })
        ) : (
          /* Flat list view */
          filteredRiders.map((r) => {
            const minSalary = calcMinSalary(r.pcs_points_1yr ?? 0);
            const currentBid = bids[r.id];
            return (
              <RiderCard
                key={r.id}
                rider={{
                  id: r.id,
                  name: formatName(r.full_name),
                  nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
                  team_name: r.real_team ?? undefined,
                  pcs_rank: r.pcs_rank ?? undefined,
                  photo_url: r.photo_url,
                }}
                bidState={currentBid ? "active" : "none"}
                href={`/league/${leagueId}/rider/${r.id}?from=recruts`}
                rightContent={
                  <div className="flex flex-col items-end gap-0.5">
                    <div
                      className={`flex items-center gap-0.5 rounded-lg px-2 h-7 ${
                        currentBid
                          ? "border border-[var(--accent-default)] bg-[var(--bg-surface-hover)]"
                          : "border border-[var(--border-default)] bg-transparent"
                      }`}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        min={minSalary}
                        step={1000}
                        placeholder={formatThousands(minSalary)}
                        value={currentBid ? formatThousands(currentBid) : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\s/g, "");
                          const val = parseInt(raw, 10);
                          handleBidChange(r.id, isNaN(val) ? 0 : val);
                        }}
                        onClick={(e) => e.preventDefault()}
                        className={`w-20 bg-transparent text-right text-[length:var(--type-body)] font-semibold font-mono outline-none ${
                          currentBid
                            ? "text-[var(--accent-default)]"
                            : "text-[var(--text-low)]"
                        }`}
                      />
                      <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)] font-medium">
                        €
                      </span>
                    </div>
                    {errors[r.id] && (
                      <span className="text-[length:var(--type-micro)] text-[var(--status-danger)]">
                        {errors[r.id]}
                      </span>
                    )}
                  </div>
                }
              />
            );
          })
        )}

        {filteredRiders.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              No riders match your search.
            </p>
          </div>
        )}
      </div>

      {/* Sticky bar */}
      <StickyBar
        saveEnabled={hasPendingBids}
        slotInfo={`${currentSlots + Object.keys(bids).length}/${maxSlots} slots`}
        budgetInfo={`${formatThousands(treasury - totalBidAmount)} €`}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
