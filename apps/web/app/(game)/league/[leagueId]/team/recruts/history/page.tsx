import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { Search } from "lucide-react";
import { formatEuro } from "@/lib/format";

export default async function AuctionHistoryPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
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
  let bidsByRound: Record<
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

  return (
    <div className="min-h-screen">
      <BackHeader label="Recruts" />

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
                                {formatEuro(bid.amount)}
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
      </div>
    </div>
  );
}
