import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Enchères</h1>

      {active && (
        <div className="rounded-md border border-border bg-wh-surface p-6">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold text-foreground">
                {active.name}
              </span>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Round {activeRound}/3</Badge>
                <span>Résolution à minuit</span>
              </div>
            </div>
            <Link href={`/league/${leagueId}/auctions/${active.id}`}>
              <Button variant="default">Voir les coureurs</Button>
            </Link>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="border-b border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              À venir
            </span>
            {upcoming.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(a.opens_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
                <Badge variant="secondary">Planifié</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <div className="border-b border-border" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Terminées
            </span>
            {closed.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(a.opens_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-sm text-foreground">{a.name}</span>
                </div>
                <Link href={`/league/${leagueId}/auctions/${a.id}/results`}>
                  <Button variant="ghost" size="sm">
                    Résultats
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {(!auctions || auctions.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-sm text-muted-foreground">
            Aucune enchère planifiée pour le moment.
          </p>
        </div>
      )}
    </div>
  );
}
