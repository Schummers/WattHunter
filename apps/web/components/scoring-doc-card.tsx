"use client";

import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";

/**
 * "How scoring works" — pedagogical encart shown on the Race Team page and the
 * Auction page. Grand Tour scoring, rank-based barème (2026-07 refonte).
 * Four blocks: stage points, daily bonus, final classifications, and how roles
 * change the points. Constants live in `docs/GAME_RULES.md §7/§11` — this
 * component is human-readable text only.
 *
 * Uses native <details> for keyboard-accessible collapse with no JS.
 */
export function ScoringDocCard() {
  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"
        style={{ listStyle: "none" }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            How scoring works
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            Stage points, daily bonuses, final classifications, and how roles change them.
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-[var(--text-low)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        {/* 1 — Stage points */}
        <Section
          title="1 · Stage points"
          subtitle="On a Grand Tour, a rider scores from his finish position, not from PCS points."
        >
          <Table2Col
            headers={["Stage finish", "Points"]}
            rows={[
              { label: "1st", multiplier: "100" },
              { label: "2nd / 3rd", multiplier: "80 / 70" },
              { label: "5th", multiplier: "55" },
              { label: "10th", multiplier: "25" },
              { label: "20th (last scoring place)", multiplier: "2" },
            ]}
          />
          <Note>
            <b>Example:</b> a rider finishing 3rd scores <b>70</b> base points. His role multiplier
            (below) then applies: a sprinter winning a flat stage scores 100 × 1.5 = <b>150</b>.
          </Note>
        </Section>

        {/* 2 — Daily bonus */}
        <Section
          title="2 · Daily bonus"
          subtitle="Each day, every rider placed high in a classification earns a flat bonus. His matching role doubles it."
        >
          <Table2Col
            headers={["Daily classification", "Bonus (all roles)"]}
            rows={[
              { label: "GC — top 10", multiplier: "15→2" },
              { label: "Points — top 5", multiplier: "6→1" },
              { label: "KOM — top 5", multiplier: "6→1" },
              { label: "Youth — top 5", multiplier: "4→1" },
            ]}
          />
          <Note>
            <b>Example:</b> your GC Leader leading the GC that evening earns 15 × 1.5 = <b>22.5</b>.
            A domestique sitting 3rd on GC still earns <b>10</b> (flat, no role match). Match:
            GC Leader→GC (×1.5), Sprinter→Points and Climber→KOM (×2), GC Leader→Youth (×1.5).
          </Note>
        </Section>

        {/* 3 — Final classifications */}
        <Section
          title="3 · Final classifications"
          subtitle="When the Grand Tour ends, final standings pay a one-off — flat for every role, no multiplier."
        >
          <Table2Col
            headers={["Final jersey", "Winner → depth"]}
            rows={[
              { label: "GC (top 30)", multiplier: "250 → 1" },
              { label: "Points / KOM (top 10)", multiplier: "100 → 5" },
              { label: "Youth (top 10, half)", multiplier: "50 → 2" },
            ]}
          />
          <Note>
            <b>Example:</b> winning the GC is worth <b>250</b> (≈ 2.5 stage wins). Winning the green
            or KOM jersey is worth <b>100</b> (one stage win). The Youth jersey pays half. Roles do
            not multiply finals — they play during the race, not on the final result.
          </Note>
        </Section>

        {/* 4 — How roles change the points */}
        <Section
          title="4 · Roles"
          subtitle="Every rider has one role. It multiplies his stage points and doubles his matching daily bonus."
        >
          <div className="flex flex-col gap-2.5">
            <RoleLine role="GC Leader">
              ×1.5 on every stage · doubles GC (and ×1.5 Youth) daily bonus.
            </RoleLine>
            <RoleLine role="Sprinter">
              ×1.5 on flat/hilly stages (p1–p3) · doubles Points daily bonus. ×1.0 in the mountains.
            </RoleLine>
            <RoleLine role="Climber">
              ×1.5 on hilly/mountain stages (p3–p5) · doubles KOM daily bonus. ×1.0 on the flat.
            </RoleLine>
            <RoleLine role="TT Specialist">
              ×2 on individual time-trial stages only.
            </RoleLine>
            <RoleLine role="Stage Hunter">
              ×1.5 only when in the breakaway (≥30 km), + 1 pt per 10 km in the break. ×1.0 otherwise.
            </RoleLine>
            <RoleLine role="Underdog">
              The cheaper the rider (higher PCS rank), the bigger the boost: stage points × (rank ÷ 100),
              from ×1 (rank ≤100) up to ×4 (rank ≥400).
            </RoleLine>
            <RoleLine role="Domestique">
              No multiplier, but earns <b>assists</b> when a teammate from his real pro team finishes
              stage top 3 (4/2/1) or holds GC top 3 that day (3/2/1). None on time-trials.
            </RoleLine>
          </div>
          <Note>
            <b>Nemesis</b> (a tactic, not a role) can multiply a rider&apos;s whole stage total when he
            wins his duel. Finals stay flat for everyone, whatever the role.
          </Note>
        </Section>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Internal pieces (kept private to this file)
// ---------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">{subtitle}</p>
        )}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Table2Col({
  rows,
  headers,
}: {
  rows: Array<{ label: string; multiplier: string }>;
  headers: [string, string];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)]">
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
        <span className="text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {headers[0]}
        </span>
        <span className="text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {headers[1]}
        </span>
      </div>
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 last:border-b-0"
        >
          <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
            {r.label}
          </span>
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {r.multiplier}
          </span>
        </div>
      ))}
    </div>
  );
}

function RoleLine({ role, children }: { role: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Tag variant="highlighted">{role}</Tag>
      <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">{children}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] border-l-2 border-l-[var(--accent-label)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--type-caption)] text-[var(--text-mid)]">
      {children}
    </p>
  );
}
