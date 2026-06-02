"use client";

import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";

/**
 * "How scoring works" — pedagogical encart on the Race Team page (Spec A A8).
 * Explains role multipliers, finals barème, stage-hunter rules, sprinter
 * profile gating, and Nemesis profile gating. Constants live in
 * `docs/GAME_RULES.md §11` — this component is human-readable text only.
 *
 * Layout follows `docs/mockups/2026-06-02-ui-mockups.html` (Card + Tag +
 * 2-column mini tables). Uses native <details> for keyboard-accessible
 * collapse with no JS.
 */
export function ScoringDocCard() {
  return (
    <details className="group rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"
        // Hide the default ::-webkit-details-marker triangle.
        style={{ listStyle: "none" }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            How scoring works
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            Role multipliers, finals, stage hunter, sprinter and Nemesis rules.
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-[var(--text-low)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        {/* Section 1 — Role multipliers on daily classifications */}
        <Section
          title="Daily classifications"
          subtitle="Bonus you earn when your rider sits in the top of a daily classification."
        >
          <Table2Col
            rows={[
              { label: "GC daily (rider in top 10)", chips: ["GC Leader"], multiplier: "×2" },
              { label: "Points daily (top 5)", chips: ["Sprinter"], multiplier: "×2" },
              { label: "KOM daily (top 3)", chips: ["Climber"], multiplier: "×2" },
              { label: "Youth daily (top 5)", chips: ["GC Leader"], multiplier: "×1.5" },
            ]}
            headers={["Classification", "Role multiplier"]}
          />
          <Note>
            Multiplier only applies when your rider&apos;s role matches the classification. A non-matched
            rider in the same top still scores, but at ×1.0.
          </Note>
        </Section>

        {/* Section 2 — Final classifications */}
        <Section
          title="Final classifications"
          subtitle="What you earn when the race ends, from each jersey ranking."
        >
          <Table2Col
            rows={[
              { label: "GC final (PCS points 400/290/240…)", chips: ["GC Leader"], multiplier: "×1.0" },
              { label: "Points final (custom 2-tier)", chips: ["Sprinter"], multiplier: "×2" },
              { label: "KOM final (custom 2-tier)", chips: ["Climber"], multiplier: "×2" },
              { label: "Youth final (custom 2-tier)", chips: ["GC Leader"], multiplier: "×1.5" },
            ]}
            headers={["Final", "Role multiplier"]}
          />
          <Note>
            Secondary finals (Points / KOM / Youth) use a flat barème by rank: <b>80 / 20 / 10</b> on
            GTs and Monuments, <b>40 / 10 / 5</b> on 1-week races. The GC final keeps raw PCS points
            and does not get a role multiplier (it pays the windfall already).
          </Note>
        </Section>

        {/* Section 3 — Stage Hunter */}
        <Section
          title="Stage Hunter"
          subtitle="Rewards riders who animate the race from the breakaway."
        >
          <Bullet>
            <b>×1.5 on the stage result</b> if your rider was in the breakaway (≥ 30 km).
          </Bullet>
          <Bullet>
            <b>+1 pt every 10 km</b> spent in the breakaway, added on top (not multiplied).
          </Bullet>
          <Bullet>
            <b>×1.0</b> on every other stage — Stage Hunter is no longer a free ×1.5.
          </Bullet>
        </Section>

        {/* Section 4 — Sprinter profile gating */}
        <Section
          title="Sprinter"
          subtitle="The Sprinter bonus is gated by stage profile."
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              ×1.5 only on profiles
            </span>
            <Tag variant="highlighted">p1</Tag>
            <Tag variant="highlighted">p2</Tag>
            <Tag variant="highlighted">p3</Tag>
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              (flat + hilly). ×1.0 on p4/p5 (mountain) — your sprinter is just a domestique there.
            </span>
          </div>
        </Section>

        {/* Section 5 — Nemesis profile gating */}
        <Section
          title="Nemesis (tactic)"
          subtitle="Nemesis can only be placed where the duel makes sense."
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                Nemesis Sprint
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">→</span>
              <Tag variant="highlighted">p1</Tag>
              <Tag variant="highlighted">p2</Tag>
              <Tag variant="highlighted">p3</Tag>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                Nemesis GC
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">→</span>
              <Tag variant="highlighted">p3</Tag>
              <Tag variant="highlighted">p4</Tag>
              <Tag variant="highlighted">p5</Tag>
            </div>
          </div>
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
  rows: Array<{ label: string; chips: string[]; multiplier: string }>;
  headers: [string, string];
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-app)]">
      {/* Header row */}
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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
              {r.label}
            </span>
            {r.chips.map((c) => (
              <Tag key={c} variant="highlighted">
                {c}
              </Tag>
            ))}
          </div>
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {r.multiplier}
          </span>
        </div>
      ))}
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-[length:var(--type-caption)] text-[var(--text-mid)] before:mt-1.5 before:size-1 before:shrink-0 before:rounded-full before:bg-[var(--text-low)] before:content-['']">
      <span>{children}</span>
    </p>
  );
}
