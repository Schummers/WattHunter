import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import Link from "next/link";

export default async function AuctionsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("league_id", leagueId)
    .order("opens_at", { ascending: false });

  const now = new Date();

  const active = auctions?.find((a) => a.status === "open");
  const upcoming = auctions?.filter((a) => a.status === "scheduled") ?? [];
  const closed = auctions?.filter((a) => a.status === "closed") ?? [];

  // Calculate round for active auction
  let activeRound = 0;
  if (active) {
    const opens = new Date(active.opens_at);
    activeRound = Math.floor((now.getTime() - opens.getTime()) / 86400000) + 1;
    activeRound = Math.min(Math.max(activeRound, 1), 3);
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        Auctions
      </h1>

      {active && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
                {active.name}
              </span>
              <div className="flex items-center gap-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
                <Badge variant="secondary">Round {activeRound}/3</Badge>
                <span>Resolves at midnight</span>
              </div>
            </div>
            <Link href={`/league/${leagueId}/auctions/${active.id}`}>
              <Button variant="default">View riders</Button>
            </Link>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="border-b border-[var(--border-subtle)]" />
          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-mid)]">
              Upcoming
            </span>
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                    {formatShortDate(a.opens_at)}
                  </span>
                  <span className="text-[length:var(--type-body)] text-[var(--text-high)]">
                    {a.name}
                  </span>
                </div>
                <Badge variant="secondary">Scheduled</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <div className="border-b border-[var(--border-subtle)]" />
          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-mid)]">
              Completed
            </span>
            {closed.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-[var(--border-subtle)] py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                    {formatShortDate(a.opens_at)}
                  </span>
                  <span className="text-[length:var(--type-body)] text-[var(--text-high)]">
                    {a.name}
                  </span>
                </div>
                <Link href={`/league/${leagueId}/auctions/${a.id}/results`}>
                  <Button variant="ghost" size="sm">
                    Results
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {(!auctions || auctions.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            No auctions scheduled yet.
          </p>
        </div>
      )}
    </div>
  );
}
