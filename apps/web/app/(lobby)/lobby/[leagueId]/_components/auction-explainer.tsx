import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface AuctionExplainerProps {
  leagueId: string;
}

export function AuctionExplainer({ leagueId }: AuctionExplainerProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
    >
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        How the first auction works
      </h2>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Three sealed-bid rounds, one per day. Each round auto-closes after its
        deadline and the next one opens automatically. Bids are revealed only
        after a round closes — your strategy stays private until then.
      </p>
      <Link
        href={`/league/${leagueId}/help`}
        className="inline-flex w-fit items-center gap-1 text-[length:var(--type-body)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
      >
        Learn more
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}
