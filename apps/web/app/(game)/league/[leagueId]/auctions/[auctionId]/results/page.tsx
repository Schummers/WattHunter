import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuctionResultsPage({
  params,
}: {
  params: Promise<{ leagueId: string; auctionId: string }>;
}) {
  const { leagueId, auctionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: auction }, { data: bids }, { data: teams }] =
    await Promise.all([
      supabase.from("auctions").select("*").eq("id", auctionId).single(),
      supabase
        .from("auction_bids")
        .select(
          "*, riders(full_name, real_team, specialty, nationality), teams(name)"
        )
        .eq("auction_id", auctionId)
        .in("status", ["won", "outbid"]),
      supabase
        .from("teams")
        .select("id, user_id")
        .eq("league_id", leagueId),
    ]);

  if (!auction) {
    return (
      <p className="text-[var(--text-mid)]">Auction not found.</p>
    );
  }

  const myTeamId = teams?.find((t) => t.user_id === user?.id)?.id;

  const rounds = [1, 2, 3];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-high)]">
          {auction.name}
        </h1>
        <Badge variant="outline">Completed</Badge>
      </div>

      <Tabs defaultValue="1">
        <TabsList variant="line">
          {rounds.map((r) => (
            <TabsTrigger key={r} value={r.toString()}>
              Round {r}
            </TabsTrigger>
          ))}
        </TabsList>

        {rounds.map((round) => {
          const roundBids = (bids ?? []).filter((b) => b.round === round);
          const won = roundBids.filter((b) => b.status === "won");
          const total = won.reduce((s, b) => s + b.amount, 0);

          return (
            <TabsContent key={round} value={round.toString()}>
              {won.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-mid)]">
                  No riders assigned for this round.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rider</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Spec.</TableHead>
                        <TableHead>Winner</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {won.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            {bid.riders?.full_name}
                          </TableCell>
                          <TableCell className="text-[var(--text-mid)]">
                            {bid.riders?.real_team}
                          </TableCell>
                          <TableCell className="text-xs text-[var(--text-mid)]">
                            {bid.riders?.specialty}
                          </TableCell>
                          <TableCell
                            className={
                              bid.team_id === myTeamId
                                ? "font-medium text-[var(--accent-default)]"
                                : "text-[var(--text-high)]"
                            }
                          >
                            {bid.teams?.name}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {bid.amount.toLocaleString("en-US")} EUR
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="my-6 border-b border-border" />

                  <div className="flex flex-col gap-0">
                    <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                      <span className="text-[var(--text-mid)]">
                        Riders assigned
                      </span>
                      <span className="font-medium font-mono text-[var(--text-high)]">
                        {won.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                      <span className="text-[var(--text-mid)]">
                        Total amount
                      </span>
                      <span className="font-medium font-mono text-[var(--text-high)]">
                        {total.toLocaleString("en-US")} EUR
                      </span>
                    </div>
                    {won.length > 0 && (
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-[var(--text-mid)]">
                          Average bid
                        </span>
                        <span className="font-medium font-mono text-[var(--text-high)]">
                          {Math.round(total / won.length).toLocaleString(
                            "en-US"
                          )}{" "}
                          EUR
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
