"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import { RiderCard } from "@/components/rider-card";
import { FilterChips } from "@/components/filter-chips";
import { addDraft } from "@/app/(game)/league/[leagueId]/team/auctions/actions";
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
  birthdate: string | null;
}

interface ActiveRound {
  id: string;
  name: string;
  opens_at: string;
  closes_at: string;
}

interface NextRound {
  id: string;
  name: string;
  opens_at: string;
}

interface MarketClientProps {
  leagueId: string;
  riders: Rider[];
  activeRound: ActiveRound | null;
  nextRound?: NextRound | null;
  nextAuctionLabel?: string | null;
  maxSlots: number;
  currentSlots: number;
  treasury: number;
  draftRiderIds?: string[];
}

const FILTER_OPTIONS = [
  { label: "All" },
  { label: "Teams" },
  { label: "Speciality" },
  { label: "Nationality" },
  { label: "Age" },
];

const INITIAL_DISPLAY_COUNT = 100;

function getAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAgeGroup(birthdate: string | null): string {
  const age = getAge(birthdate);
  if (age === null) return "Unknown";
  if (age <= 23) return "Young Talents (≤23)";
  if (age <= 32) return "24–32 yrs";
  return "Veterans (>32)";
}

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


export function MarketClient({
  leagueId,
  riders,
  activeRound,
  nextRound,
  nextAuctionLabel,
  currentSlots,
  maxSlots,
  draftRiderIds = [],
}: MarketClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilterIndex, setActiveFilterIndex] = useState(0);
  const activeFilter = FILTER_OPTIONS[activeFilterIndex].label;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Track which riders are in draft (optimistic)
  const [draftSet, setDraftSet] = useState<Set<string>>(() => new Set(draftRiderIds));
  // Per-rider loading state for "Add to Draft" button
  const [draftingRider, setDraftingRider] = useState<string | null>(null);
  // Per-rider bid input values (for amount when adding to draft)
  const [bidInputs, setBidInputs] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset display count when filter or search changes
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [activeFilterIndex, search]);

  const filteredRiders = useMemo(() => {
    let result = riders;

    // Search filter — rider name or team only
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.real_team && r.real_team.toLowerCase().includes(q))
      );
    }

    // Category sort
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
      } else if (activeFilter === "Age") {
        key = getAgeGroup(r.birthdate);
      } else {
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

  function handleBidInputChange(riderId: string, value: number) {
    setBidInputs((prev) => ({ ...prev, [riderId]: value }));
  }

  async function handleAddDraft(riderId: string, minSalary: number) {
    const amount = bidInputs[riderId] ?? minSalary;
    setDraftingRider(riderId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[riderId];
      return next;
    });

    const result = await addDraft({ leagueId, riderId, amount });

    if (result.error) {
      setErrors((prev) => ({ ...prev, [riderId]: result.error! }));
    } else {
      setDraftSet((prev) => new Set([...prev, riderId]));
      router.refresh();
    }
    setDraftingRider(null);
  }

  // Paginated flat list
  const paginatedFlatRiders = useMemo(() => {
    if (groupedRiders) return null;
    return filteredRiders.slice(0, displayCount);
  }, [filteredRiders, groupedRiders, displayCount]);

  const remainingCount = groupedRiders ? 0 : Math.max(0, filteredRiders.length - displayCount);

  return (
    <div className="pb-20">
      {/* Round header */}
      {activeRound ? (
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {activeRound.name} &middot; {smartCountdown(activeRound.closes_at)}
          </span>
          <Link href={`/league/${leagueId}/team/market/history`} className="text-[length:var(--type-body)] link-tertiary">
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
          <Link href={`/league/${leagueId}/team/market/history`} className="text-[length:var(--type-body)] link-tertiary">
            History &rarr;
          </Link>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-transparent px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)]">
          <Search size={16} className="shrink-0 text-[var(--text-ghost)]" />
          <input
            type="text"
            placeholder="Search rider or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-base md:text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none"
          />
        </div>
      </div>

      {/* Filter chips — no horizontal scroll */}
      <div className="px-4 pb-3">
        <FilterChips
          options={FILTER_OPTIONS}
          activeIndex={activeFilterIndex}
          onChange={(i) => setActiveFilterIndex(i)}
        />
      </div>

      {/* Counter */}
      <div className="px-4 pb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {filteredRiders.length} available · {currentSlots}/{maxSlots} slots
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
                    const inDraft = draftSet.has(r.id);
                    const isAdding = draftingRider === r.id;
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
                        bidState={inDraft ? "active" : "none"}
                        href={`/league/${leagueId}/rider/${r.id}?from=market`}
                        rightContent={
                          <div className="flex flex-col items-end gap-0.5">
                            {inDraft ? (
                              <span className="text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)]">
                                In Draft ✓
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5 rounded-lg px-2 h-7 border border-[var(--border-default)] bg-transparent">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    min={minSalary}
                                    step={500}
                                    placeholder={formatThousands(minSalary)}
                                    value={bidInputs[r.id] ? formatThousands(bidInputs[r.id]) : ""}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\s/g, "");
                                      const val = parseInt(raw, 10);
                                      handleBidInputChange(r.id, isNaN(val) ? 0 : val);
                                    }}
                                    onClick={(e) => { if (window.innerWidth < 1024) e.stopPropagation(); }}
                                    className="w-16 bg-transparent text-right text-base md:text-[length:var(--type-body)] font-semibold font-mono outline-none text-[var(--text-low)]"
                                  />
                                  <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)] font-medium">
                                    €
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={isAdding}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddDraft(r.id, minSalary);
                                  }}
                                  className="h-7 px-2 rounded-[var(--radius-md)] border border-[var(--accent-default)] text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 shrink-0"
                                >
                                  {isAdding ? "..." : "+ Draft"}
                                </button>
                              </div>
                            )}
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
          /* Flat list view with pagination */
          <>
            {(paginatedFlatRiders ?? []).map((r) => {
              const minSalary = calcMinSalary(r.pcs_points_1yr ?? 0);
              const inDraft = draftSet.has(r.id);
              const isAdding = draftingRider === r.id;
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
                  bidState={inDraft ? "active" : "none"}
                  href={`/league/${leagueId}/rider/${r.id}?from=market`}
                  rightContent={
                    <div className="flex flex-col items-end gap-0.5">
                      {inDraft ? (
                        <span className="text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)]">
                          In Draft ✓
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5 rounded-lg px-2 h-7 border border-[var(--border-default)] bg-transparent">
                            <input
                              type="text"
                              inputMode="numeric"
                              min={minSalary}
                              step={500}
                              placeholder={formatThousands(minSalary)}
                              value={bidInputs[r.id] ? formatThousands(bidInputs[r.id]) : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\s/g, "");
                                const val = parseInt(raw, 10);
                                handleBidInputChange(r.id, isNaN(val) ? 0 : val);
                              }}
                              onClick={(e) => e.preventDefault()}
                              className="w-16 bg-transparent text-right text-base md:text-[length:var(--type-body)] font-semibold font-mono outline-none text-[var(--text-low)]"
                            />
                            <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)] font-medium">
                              €
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddDraft(r.id, minSalary);
                            }}
                            className="h-7 px-2 rounded-[var(--radius-md)] border border-[var(--accent-default)] text-[length:var(--type-caption)] font-semibold text-[var(--accent-default)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 shrink-0"
                          >
                            {isAdding ? "..." : "+ Draft"}
                          </button>
                        </div>
                      )}
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

            {/* Load more */}
            {remainingCount > 0 && (
              <div className="px-4 py-4 text-center">
                <button
                  type="button"
                  onClick={() => setDisplayCount((c) => c + INITIAL_DISPLAY_COUNT)}
                  className="text-[length:var(--type-body)] font-semibold text-[var(--accent-default)] hover:underline"
                >
                  Load more ({remainingCount} remaining)
                </button>
              </div>
            )}
          </>
        )}

        {filteredRiders.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              No riders match your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
