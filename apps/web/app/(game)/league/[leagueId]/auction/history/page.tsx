import { createClient } from "@/lib/supabase/server";
import { Search } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { GT_FULL_NAME, type GtPhaseId } from "@/lib/gt-phases";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
} from "@/lib/demo-constants";

export default async function AuctionHistoryPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionHistory();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view auction history.
        </p>
      </div>
    );
  }

  // Fetch closed auctions
  const { data: rounds } = await supabase
    .from("auctions")
    .select("id, name, opens_at, closes_at, status")
    .eq("league_id", leagueId)
    .eq("status", "closed")
    .order("opens_at", { ascending: false });

  // Fetch bids for all closed rounds
  const roundIds = (rounds ?? []).map((r) => r.id);
  const bidsByRound: Record<
    string,
    Array<{
      id: string;
      amount: number;
      is_winner: boolean;
      rider_name: string;
      bidder_name: string;
      rider_id: string;
    }>
  > = {};

  if (roundIds.length > 0) {
    const { data: bids } = await supabase
      .from("auction_bids")
      .select(
        "id, amount, status, auction_id, rider_id, riders(full_name), teams:team_id(name)"
      )
      .in("auction_id", roundIds)
      .in("status", ["won", "outbid"])
      .order("amount", { ascending: false });

    for (const bid of bids ?? []) {
      const roundId = bid.auction_id;
      if (!bidsByRound[roundId]) bidsByRound[roundId] = [];
      const rider = Array.isArray(bid.riders) ? bid.riders[0] : bid.riders;
      const team = Array.isArray(bid.teams)
        ? bid.teams[0]
        : bid.teams;
      bidsByRound[roundId].push({
        id: bid.id,
        amount: bid.amount,
        is_winner: bid.status === "won",
        rider_name: (rider as { full_name: string } | null)?.full_name ?? "Unknown",
        bidder_name: (team as { name: string } | null)?.name ?? "Unknown",
        rider_id: bid.rider_id,
      });
    }
  }

  const hasHistory = (rounds ?? []).length > 0;

  // Fetch team for this user in this league
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  // Fetch resolved emergency bids for this team
  const { data: emergencyBids } = team
    ? await supabase
        .from("gt_emergency_bids")
        .select("id, phase_id, gt_year, amount, won, resolved, rider_id, riders:rider_id(full_name)")
        .eq("team_id", team.id)
        .eq("resolved", true)
        .order("gt_year", { ascending: false })
    : { data: [] };

  return (
    <div className="min-h-screen">
      <div className="px-4 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]"
          />
          <input
            type="text"
            placeholder="Search rider or team..."
            className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-transparent pl-9 pr-3 text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--accent-focus-ring)]"
          />
        </div>

        {!hasHistory ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <p className="text-[length:var(--type-body)] font-semibold text-[var(--text-mid)]">
              No auction history yet
            </p>
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Completed rounds will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(rounds ?? []).map((round) => {
              const bids = bidsByRound[round.id] ?? [];
              const closedDate = round.closes_at
                ? new Date(round.closes_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "";

              // Group bids by rider
              const riderBids: Record<string, typeof bids> = {};
              for (const bid of bids) {
                const key = bid.rider_name;
                if (!riderBids[key]) riderBids[key] = [];
                riderBids[key].push(bid);
              }

              return (
                <div key={round.id}>
                  {/* Round header */}
                  <div className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 mb-2">
                    <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                      {round.name} &middot; {closedDate}
                    </span>
                  </div>

                  {/* Rider rows */}
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {Object.entries(riderBids).map(
                      ([riderName, riderBidList]) => (
                        <div key={riderName} className="py-3 space-y-1.5">
                          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                            {riderName}
                          </span>
                          {riderBidList.map((bid) => (
                            <div
                              key={bid.id}
                              className={`flex items-center justify-between text-[length:var(--type-caption)] ${
                                bid.is_winner
                                  ? "text-[var(--text-mid)]"
                                  : "text-[var(--text-low)] opacity-60"
                              }`}
                            >
                              <span>{bid.bidder_name}</span>
                              <span className="font-mono">
                                {formatMoney(bid.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GT Emergency Bids */}
        {(emergencyBids ?? []).length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                GT Emergency Bids
              </span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {(emergencyBids ?? []).map((bid) => {
                const rider = Array.isArray(bid.riders) ? bid.riders[0] : bid.riders;
                const riderName = (rider as { full_name: string } | null)?.full_name ?? "Unknown";
                const gtName = GT_FULL_NAME[bid.phase_id as GtPhaseId] ?? `Phase ${bid.phase_id}`;
                return (
                  <div key={bid.id} className="flex items-center justify-between py-3 text-[length:var(--type-caption)]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                        {riderName}
                      </span>
                      <span className="text-[var(--text-low)]">
                        {gtName} {bid.gt_year} · Emergency
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[var(--text-mid)]">{formatMoney(bid.amount)}</span>
                      <span className={bid.won ? "text-[var(--accent-default)]" : "text-[var(--text-low)] opacity-60"}>
                        {bid.won ? "Won" : "Lost"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoAuctionHistory() {
  const supabase = await createClient();
  const leagueId = DEMO_LEAGUE_ID;

  const { data: rounds } = await supabase
    .from("auctions")
    .select("id, name, opens_at, closes_at, status")
    .eq("league_id", leagueId)
    .eq("status", "closed")
    .order("opens_at", { ascending: false });

  const roundIds = (rounds ?? []).map((r) => r.id);
  const bidsByRound: Record<
    string,
    Array<{
      id: string;
      amount: number;
      is_winner: boolean;
      rider_name: string;
      bidder_name: string;
      rider_id: string;
    }>
  > = {};

  if (roundIds.length > 0) {
    const { data: bids } = await supabase
      .from("auction_bids")
      .select(
        "id, amount, status, auction_id, rider_id, riders(full_name), teams:team_id(name)"
      )
      .in("auction_id", roundIds)
      .in("status", ["won", "outbid"])
      .order("amount", { ascending: false });

    for (const bid of bids ?? []) {
      const roundId = bid.auction_id;
      if (!bidsByRound[roundId]) bidsByRound[roundId] = [];
      const rider = Array.isArray(bid.riders) ? bid.riders[0] : bid.riders;
      const team = Array.isArray(bid.teams) ? bid.teams[0] : bid.teams;
      bidsByRound[roundId].push({
        id: bid.id,
        amount: bid.amount,
        is_winner: bid.status === "won",
        rider_name: (rider as { full_name: string } | null)?.full_name ?? "Unknown",
        bidder_name: (team as { name: string } | null)?.name ?? "Unknown",
        rider_id: bid.rider_id,
      });
    }
  }

  const hasHistory = (rounds ?? []).length > 0;

  // gt_emergency_bids is empty in demo — no GT section will render
  const emergencyBids: never[] = [];

  return (
    <div className="min-h-screen">
      <div className="px-4 space-y-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)]"
          />
          <input
            type="text"
            placeholder="Search rider or team..."
            className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-transparent pl-9 pr-3 text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--accent-focus-ring)]"
          />
        </div>

        {!hasHistory ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <p className="text-[length:var(--type-body)] font-semibold text-[var(--text-mid)]">
              No auction history yet
            </p>
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Completed rounds will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(rounds ?? []).map((round) => {
              const bids = bidsByRound[round.id] ?? [];
              const closedDate = round.closes_at
                ? new Date(round.closes_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "";

              const riderBids: Record<string, typeof bids> = {};
              for (const bid of bids) {
                const key = bid.rider_name;
                if (!riderBids[key]) riderBids[key] = [];
                riderBids[key].push(bid);
              }

              return (
                <div key={round.id}>
                  <div className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 mb-2">
                    <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                      {round.name} &middot; {closedDate}
                    </span>
                  </div>

                  <div className="divide-y divide-[var(--border-subtle)]">
                    {Object.entries(riderBids).map(([riderName, riderBidList]) => (
                      <div key={riderName} className="py-3 space-y-1.5">
                        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                          {riderName}
                        </span>
                        {riderBidList.map((bid) => (
                          <div
                            key={bid.id}
                            className={`flex items-center justify-between text-[length:var(--type-caption)] ${
                              bid.is_winner
                                ? "text-[var(--text-mid)]"
                                : "text-[var(--text-low)] opacity-60"
                            }`}
                          >
                            <span>{bid.bidder_name}</span>
                            <span className="font-mono">{formatMoney(bid.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {emergencyBids.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                GT Emergency Bids
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
