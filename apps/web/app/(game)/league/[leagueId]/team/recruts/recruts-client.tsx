"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { RiderCard } from "@/components/rider-card";
import { Pill } from "@/components/pill";
import { StickyBar } from "@/components/sticky-bar";

interface Rider {
  id: string;
  full_name: string;
  nationality: string | null;
  team_name: string | null;
  pcs_rank: number | null;
  photo_url: string | null;
  specialty: string | null;
  pcs_points_1yr: number | null;
}

interface ActiveRound {
  id: string;
  round_number: number;
  opens_at: string;
  closes_at: string;
}

interface RecrutsClientProps {
  leagueId: string;
  riders: Rider[];
  activeRound: ActiveRound | null;
  maxSlots: number;
  currentSlots: number;
}

const FILTER_OPTIONS = ["All", "Teams", "Speciality", "Nationality", "Age"];

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0].toUpperCase();
  return `${firstInitial}. ${lastName}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecrutsClient({
  leagueId,
  riders,
  activeRound,
  maxSlots,
  currentSlots,
}: RecrutsClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [bids, setBids] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const hasPendingBids = Object.keys(bids).length > 0;

  const filteredRiders = useMemo(() => {
    let result = riders;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.team_name && r.team_name.toLowerCase().includes(q)) ||
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
        (a.team_name ?? "").localeCompare(b.team_name ?? "")
      );
    } else if (activeFilter === "Nationality") {
      result = [...result].sort((a, b) =>
        (a.nationality ?? "").localeCompare(b.nationality ?? "")
      );
    }

    return result;
  }, [riders, search, activeFilter]);

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
    setSaving(true);
    // TODO: connect to auction server actions
    await new Promise((resolve) => setTimeout(resolve, 500));
    setBids({});
    setSaving(false);
  }

  const totalBidAmount = Object.values(bids).reduce((s, v) => s + v, 0);

  return (
    <div className="pb-20">
      {/* Round header */}
      {activeRound ? (
        <div className="flex items-center justify-between bg-[var(--bg-subtle)] px-4 py-2">
          <span className="text-sm font-bold text-[var(--text-high)]">
            Round {activeRound.round_number} &middot;{" "}
            {formatDate(activeRound.opens_at)} &middot;{" "}
            <span className="text-[var(--warning)]">
              J-{daysUntil(activeRound.closes_at)}
            </span>
          </span>
          <button className="text-sm text-[var(--accent-default)]">
            History &rarr;
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-[var(--bg-subtle)] px-4 py-2">
          <span className="text-sm font-bold text-[var(--text-mid)]">
            No active round
          </span>
          <button className="text-sm text-[var(--accent-default)]">
            History &rarr;
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)]">
          <Search size={16} className="shrink-0 text-[var(--text-ghost)]" />
          <input
            type="text"
            placeholder="Search rider, team, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
        {FILTER_OPTIONS.map((f) => (
          <Pill
            key={f}
            label={f}
            active={activeFilter === f}
            onClick={() => setActiveFilter(f)}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="px-4 pb-2">
        <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {filteredRiders.length} available
        </span>
      </div>

      {/* Rider list */}
      <div>
        {filteredRiders.map((r) => {
          const minSalary = Math.max(
            5000,
            Math.round(((r.pcs_points_1yr ?? 0) * 2000) / 12)
          );
          const currentBid = bids[r.id];

          return (
            <RiderCard
              key={r.id}
              rider={{
                id: r.id,
                name: formatName(r.full_name),
                nationality_flag: r.nationality ?? undefined,
                team_name: r.team_name ?? undefined,
                pcs_rank: r.pcs_rank ?? undefined,
                photo_url: r.photo_url,
              }}
              bidState={currentBid ? "active" : "none"}
              href={`/league/${leagueId}/rider/${r.id}`}
              rightContent={
                <div className="flex flex-col items-end gap-0.5">
                  <input
                    type="number"
                    min={minSalary}
                    step={100}
                    placeholder={minSalary.toLocaleString()}
                    value={currentBid ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      handleBidChange(r.id, isNaN(val) ? 0 : val);
                    }}
                    onClick={(e) => e.preventDefault()}
                    className={`min-w-[72px] h-7 rounded-lg px-2 text-right text-sm font-semibold outline-none ${
                      currentBid
                        ? "border border-[var(--accent-default)] bg-[var(--bid-active-bg)] text-[var(--accent-default)]"
                        : "border border-[var(--border-default)] bg-transparent text-[var(--text-low)]"
                    }`}
                  />
                  <span className="text-[9px] text-[var(--text-low)]">
                    /month
                  </span>
                </div>
              }
            />
          );
        })}

        {filteredRiders.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[var(--text-mid)]">
              No riders match your search.
            </p>
          </div>
        )}
      </div>

      {/* Sticky bar */}
      <StickyBar
        visible={hasPendingBids}
        slotInfo={`${currentSlots + Object.keys(bids).length}/${maxSlots} slots`}
        budgetInfo={`${totalBidAmount.toLocaleString()} EUR`}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
