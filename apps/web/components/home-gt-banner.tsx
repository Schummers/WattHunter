"use client";

import Link from "next/link";
import { getGTBannerText } from "@/lib/gt-phases";

export function HomeGtBanner({ leagueId }: { leagueId: string }) {
  const text = getGTBannerText();
  if (!text) return null;
  return (
    <Link
      href={`/league/${leagueId}/team/gt`}
      className="mx-4 mb-1 mt-3 block rounded-[var(--radius-lg)] border border-[var(--accent-default)]/40 bg-[var(--accent-default)]/10 px-4 py-3 text-[length:var(--type-body)] font-medium text-[var(--text-high)] transition-colors hover:bg-[var(--accent-default)]/20"
    >
      {text}
    </Link>
  );
}
