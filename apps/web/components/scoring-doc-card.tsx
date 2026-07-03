"use client";

import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";

/**
 * "How scoring works" — pedagogical encart on the Race Team page (Spec A A8).
 * Explains the rank-based barème (2026-07 refonte), role multipliers, finals
 * barème, stage-hunter rules, sprinter/climber profile gating, domestique
 * assists, and Nemesis profile gating. Constants live in
 * `docs/GAME_RULES.md §7/§11` — this component is human-readable text only.
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
            Role multipliers, finals, stage hunter, sprinter, underdog and Nemesis rules.
          </span>
        </div>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-[var(--text-low)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-5 px-4 pb-4 pt-1">
        {/* Section 0 — Rank-based stage & GC points (2026-07 refonte) */}
        <Section
          title="Stage & GC points"
          subtitle="On Grand Tours, points come from finish rank — not raw PCS points."
        >
          <Table2Col
            rows={[
              { label: "Stage — 1st / 2nd / 3rd", chips: [], multiplier: "100 / 80 / 70" },
              { label: "Stage — 10th", chips: [], multiplier: "25" },
              { label: "Stage — 20th (last scoring rank)", chips: [], multiplier: "2" },
              { label: "GC final — 1st / 2nd / 3rd", chips: [], multiplier: "250 / 210 / 170" },
              { label: "GC final — 10th", chips: [], multiplier: "65" },
              { label: "GC final — 30th (last scoring rank)", chips: [], multiplier: "1" },
            ]}
            headers={["Result", "Points"]}
          />
          <Note>
            Winning the GC pays <b>2.5×</b> a stage win — down from the old raw-PCS ratio (5×). Non-GT
            races (classics, 1-week) still use raw PCS points.
          </Note>
        </Section>

        {/* Section 1 — Role multipliers on daily classifications */}
        <Section
          title="Daily classifications"
          subtitle="Every squad rider in the top scores — the matching role just multiplies it."
        >
          <Table2Col
            rows={[
              { label: "GC daily (top 10, 15/12/10/8/7/6/5/4/3/2)", chips: ["GC Leader"], multiplier: "×2" },
              { label: "Points daily (top 5, 6/4/3/2/1)", chips: ["Sprinter"], multiplier: "×2" },
              { label: "KOM daily (top 5, 6/4/3/2/1)", chips: ["Climber"], multiplier: "×2" },
              { label: "Youth daily (top 5, 4/3/2/1/1)", chips: ["GC Leader"], multiplier: "×1.5" },
            ]}
            headers={["Classification", "Role multiplier"]}
          />
          <Note>
            Everyone in the top scores the flat table shown, whatever their role. The listed role just
            doubles (or ×1.5) it on top — a domestique 3rd on GC still earns 10 points, a GC Leader in
            the same spot earns 20.
          </Note>
        </Section>

        {/* Section 2 — Final classifications */}
        <Section
          title="Final classifications"
          subtitle="What you earn when the race ends, from each jersey ranking — flat for every role."
        >
          <Table2Col
            rows={[
              { label: "GC final (top 30, 250/210/170…)", chips: [], multiplier: "×1.0" },
              { label: "Points final (top 10, 100/80/65…)", chips: [], multiplier: "×1.0" },
              { label: "KOM final (top 10, 100/80/65…)", chips: [], multiplier: "×1.0" },
              { label: "Youth final (top 10, half scale)", chips: [], multiplier: "×1.0" },
            ]}
            headers={["Final", "Role multiplier"]}
          />
          <Note>
            Finals no longer carry a role multiplier — roles play in-race, not on the final result. A
            Points-final win is worth one stage win (100); the Youth final pays half of Points/KOM.
          </Note>
        </Section>

        {/* Section 2b — Domestique assists */}
        <Section
          title="Domestique assists"
          subtitle="A Domestique scores when his real pro-team teammate performs — not his fantasy squad."
        >
          <Table2Col
            rows={[
              { label: "Real-team teammate finishes stage top 3", chips: ["Domestique"], multiplier: "4 / 2 / 1" },
              { label: "Real-team teammate holds GC top 3 that evening", chips: ["Domestique"], multiplier: "3 / 2 / 1" },
            ]}
            headers={["Trigger", "Points"]}
          />
          <Note>
            Only the best-placed teammate counts per category. No assists on individual time-trial
            stages. Draft a domestique from a strong real team (UAE, Visma…) and he keeps earning even
            when he never scores himself.
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

        {/* Section 4b — Climber profile gating (2026-07, mirrors Sprinter) */}
        <Section
          title="Climber"
          subtitle="Since 2026-07, the Climber bonus is gated by stage profile too."
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              ×1.5 only on profiles
            </span>
            <Tag variant="highlighted">p3</Tag>
            <Tag variant="highlighted">p4</Tag>
            <Tag variant="highlighted">p5</Tag>
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              (hilly + mountain). ×1.0 on p1/p2 (flat) — a top-20 flat finish no longer gets the climber
              boost.
            </span>
          </div>
        </Section>

        {/* Section 5 — Underdog scoring by rank */}
        <Section
          title="Underdog"
          subtitle="The cheaper the rider (higher PCS rank), the bigger the stage boost."
        >
          <Table2Col
            rows={[
              { label: "PCS rank ≤ 100", chips: [], multiplier: "×1.0" },
              { label: "PCS rank 200", chips: [], multiplier: "×2.0" },
              { label: "PCS rank 300", chips: [], multiplier: "×3.0" },
              { label: "PCS rank 400+", chips: [], multiplier: "×4.0" },
            ]}
            headers={["PCS rank", "Stage multiplier"]}
          />
          <Note>
            Multiplier = PCS rank ÷ 100, floored at ×1 and capped at ×4, applied to the stage rank
            points above (not on GC / Points / KOM finals — those are flat for everyone). A rank-350
            underdog finishing 15th (12 rank points) earns 42.
          </Note>
        </Section>

        {/* Section 6 — Nemesis profile gating */}
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
