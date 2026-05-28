import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface RulesTabProps {
  leagueId: string;
}

// `hash` matches an existing accordion section id in `components/game-guide-accordion.tsx`.
// `hash: null` → link to the help page root (the section is listed in the spec but not yet
// in the accordion; tracked as a follow-up to add Grand Tour mode + Release & cooldown sections).
const SECTIONS: Array<{ id: string; title: string; subtitle: string; hash: string | null }> = [
  { id: "auctions",   title: "How auctions work",     subtitle: "3 sealed-bid rounds, auto-scheduled",   hash: "auctions" },
  { id: "scoring",    title: "Scoring & XP",          subtitle: "How rider results turn into team XP",   hash: "scoring-xp" },
  { id: "levels",     title: "Levels & progression",  subtitle: "Slots, pool size, sponsors per level",  hash: "levels" },
  { id: "sponsors",   title: "Sponsors & budget",     subtitle: "Income, marketplace, switching",        hash: "sponsors" },
  { id: "strategies", title: "Strategies & boosts",   subtitle: "Specialty, Nationality, Teams, Age",    hash: "strategies" },
  { id: "grand-tour", title: "Grand Tour mode",       subtitle: "Squad, roles, tactics, rescue",         hash: null },
  { id: "release",    title: "Release & cooldown",    subtitle: "Freeing a rider and the 7-day rule",    hash: null },
];

export function RulesTab({ leagueId }: RulesTabProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Rules
      </h2>
      <ul className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {SECTIONS.map((s) => (
          <li
            key={s.id}
            className="border-b border-[var(--border-subtle)] last:border-b-0"
          >
            <Link
              href={
                s.hash
                  ? `/league/${leagueId}/help#${s.hash}`
                  : `/league/${leagueId}/help`
              }
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 hover:bg-[var(--bg-surface-hover)]"
            >
              <div className="flex-1">
                <p className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
                  {s.title}
                </p>
                <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {s.subtitle}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[var(--text-low)]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
