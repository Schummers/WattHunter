"use client";

import { useState } from "react";
import { Table } from "@/lib/help-table";
import {
  Gamepad2,
  Globe,
  Calendar,
  Gavel,
  Coins,
  TrendingUp,
  Shield,
  Layers,
  Handshake,
  Wallet,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

/* ─── Types ─── */
interface HelpSection {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

/* ─── Formula box helper ─── */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--bg-surface)] p-3 font-mono text-[length:var(--type-caption)]">
      {children}
    </div>
  );
}

/* ─── Content wrapper (prose styles) ─── */
function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-[length:var(--type-body)] text-[var(--text-mid)] [&_strong]:text-[var(--text-high)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_code]:rounded [&_code]:bg-[var(--bg-surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[length:var(--type-caption)]">
      {children}
    </div>
  );
}

/* ─── 10 Topics ─── */
const HELP_SECTIONS: HelpSection[] = [
  /* 1. Overview */
  {
    id: "overview",
    title: "How WattHunter Works",
    subtitle: "Game loop, metrics, and how to win",
    icon: Gamepad2,
    content: (
      <Prose>
        <p>
          WattHunter is a fantasy cycling manager based on real-world professional cycling data
          from <strong>ProCyclingStats (PCS)</strong>. You manage a team of riders, earn XP from
          their race performances, and compete against other managers in your league.
        </p>
        <Table
          headers={["Metric", "Purpose", "How it works"]}
          rows={[
            ["XP (Team Score)", "League ranking & progression", "Cumulative — earned daily from rider race results. Never decreases."],
            ["Treasury (EUR)", "Budget management", "Cash balance — income minus expenses. Determines your bidding power."],
          ]}
        />
        <Formula>
          <p>Game loop: Bid at auctions → Riders race → Earn XP + bonuses → Level up → Unlock better riders</p>
        </Formula>
        <p>
          <strong>Season structure:</strong> The season runs from January to November, divided
          into 8 auction phases aligned with the real cycling calendar. Each phase features
          different races and auction windows.
        </p>
        <p>
          <strong>How to win:</strong> Accumulate the most XP in your league. Smart budget
          management, the right sponsor, and a well-themed roster are the keys to success.
        </p>
      </Prose>
    ),
  },

  /* 2. PCS Points */
  {
    id: "pcs-points",
    title: "PCS Points Explained",
    subtitle: "Real-world point scales by race type",
    icon: Globe,
    content: (
      <Prose>
        <p>
          <strong>ProCyclingStats (PCS)</strong> is the reference website for professional cycling
          statistics. PCS assigns points to riders based on their finishing position in each race.
          Points vary by race prestige — a Grand Tour GC win is worth far more than a classic stage.
        </p>
        <p>
          WattHunter uses the <strong>PCS individual ranking</strong> (rolling 12 months) to determine
          rider salaries, pool gating, and daily XP conversion.
        </p>
        <p><strong>GC &amp; One-day races</strong></p>
        <Table
          headers={["Pos", "TdF GC", "Giro/Vuelta GC", "Monument", "WT Stage Race", "WT Classic"]}
          rows={[
            ["1st", "500", "400", "275", "250", "225"],
            ["2nd", "380", "290", "200", "190", "150"],
            ["3rd", "340", "240", "150", "160", "110"],
            ["4th", "300", "220", "120", "140", "90"],
            ["5th", "280", "200", "100", "120", "80"],
            ["6th", "260", "190", "90", "110", "70"],
            ["7th", "240", "180", "80", "100", "60"],
            ["8th", "220", "170", "70", "90", "50"],
            ["9th", "210", "160", "60", "80", "46"],
            ["10th", "200", "150", "50", "70", "42"],
            ["11th", "190", "140", "46", "60", "38"],
            ["12th", "180", "130", "42", "55", "34"],
            ["13th", "170", "120", "38", "50", "30"],
            ["14th", "160", "110", "34", "45", "26"],
            ["15th", "150", "100", "30", "40", "22"],
            ["16th", "140", "90", "28", "36", "20"],
            ["17th", "130", "85", "26", "32", "18"],
            ["18th", "120", "80", "24", "28", "17"],
            ["19th", "110", "75", "22", "24", "16"],
            ["20th", "100", "70", "20", "20", "15"],
          ]}
        />
        <p><strong>Stage results</strong></p>
        <Table
          headers={["Pos", "TdF Stage", "Giro/Vuelta Stage", "WT Stage"]}
          rows={[
            ["1st", "100", "80", "50"],
            ["2nd", "70", "50", "30"],
            ["3rd", "50", "35", "18"],
            ["4th", "40", "25", "13"],
            ["5th", "32", "18", "10"],
            ["6th", "26", "15", "7"],
            ["7th", "22", "12", "4"],
            ["8th", "18", "10", "3"],
            ["9th", "14", "8", "2"],
            ["10th", "10", "6", "1"],
          ]}
        />
        <Formula>
          <p>TdF = Tour de France only</p>
          <p>Giro/Vuelta = Giro d&apos;Italia + Vuelta a España</p>
          <p>Monument = Milan-San Remo, Tour of Flanders, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia</p>
          <p>WT Stage Race = Paris-Nice, Dauphiné, Tour de Suisse, etc. (12 races)</p>
          <p>WT Classic = Strade Bianche, Amstel Gold, Flèche Wallonne, etc. (16 races)</p>
          <p>⚠ PCS points ≠ UCI points — this is the ProCyclingStats proprietary system</p>
        </Formula>
        <p>
          Points are cumulated over a rolling 12-month window. A rider&apos;s PCS ranking reflects
          their total points across all races in that period.
        </p>
      </Prose>
    ),
  },

  /* 3. Calendar & Phases */
  {
    id: "calendar",
    title: "Race Calendar & Phases",
    subtitle: "8 auction phases aligned with real cycling",
    icon: Calendar,
    content: (
      <Prose>
        <p>
          The WattHunter season is divided into <strong>9 auction phases</strong>, each aligned
          with a major period of the professional cycling calendar. Each phase starts with{" "}
          <strong>3 auction rounds</strong> (one per day) where you can recruit new riders, then
          racing begins.
        </p>
        <Table
          headers={["#", "Phase", "Period", "Auction rounds", "Key races"]}
          rows={[
            ["1", "Season Start",   "Jan 15 – Mar 1",  "Jan 15, Jan 16, Jan 17",  "Tour Down Under, Cadel Evans, UAE Tour, Omloop"],
            ["2", "Classics Part 1","Mar 2 – Apr 1",   "Mar 2, Mar 3, Mar 4",     "Strade, Paris-Nice, Tirreno, MSR, Catalunya, E3, G-W, Dwars"],
            ["3", "Classics Part 2","Apr 2 – May 1",   "Apr 2, Apr 3, Apr 4",     "Ronde, Itzulia, Roubaix, Amstel, Flèche, LBL, Romandie, Eschborn"],
            ["4", "Giro d'Italia",  "May 2 – Jun 1",   "May 2, May 3, May 4",     "Giro d'Italia"],
            ["5", "Pre-Tour",       "Jun 2 – Jul 1",   "Jun 2, Jun 3, Jun 4",     "Dauphiné, Copenhagen Sprint, Tour de Suisse"],
            ["6", "Tour de France", "Jul 2 – Jul 27",  "Jul 2, Jul 3, Jul 4",     "Tour de France"],
            ["7", "Post-Tour",      "Jul 28 – Aug 18", "Jul 28, Jul 29, Jul 30",  "San Sebastián, Pologne, Cyclassics"],
            ["8", "La Vuelta",      "Aug 19 – Sep 15", "Aug 19, Aug 20, Aug 21",  "Renewi, Vuelta, Bretagne, GP Québec, GP Montréal"],
            ["9", "End of Season",  "Sep 16 – Oct 18", "Sep 16, Sep 17, Sep 18",  "GP de Québec, GP de Montréal, Il Lombardia, Worlds"],
          ]}
        />
        <Formula>
          <p>Each phase = 3 auction rounds (24h each) → racing → next phase</p>
        </Formula>
        <p>
          At the start of each phase you <strong>confirm your setup</strong> (sponsor, roster,
          strategies) before bidding opens. Confirming triggers the payday: sponsor income is added
          and salaries are deducted. Then the 3 auction rounds open on consecutive days.
        </p>
      </Prose>
    ),
  },

  /* 4. Auctions & Bidding */
  {
    id: "auctions",
    title: "Auctions & Bidding",
    subtitle: "72h sealed-bid, 3 rounds of 24h",
    icon: Gavel,
    content: (
      <Prose>
        <Table
          headers={["Rule", "Value"]}
          rows={[
            ["Duration", "72 hours (3 rounds of 24h)"],
            ["Format", "Sealed-bid — bids are secret during each round"],
            ["Minimum bid", "Rider's market salary (PCS-based formula)"],
            ["Minimum increment", "+100 EUR — bids must be multiples of 100 EUR"],
            ["Tie-breaker", "Earliest timestamp wins"],
          ]}
        />
        <Formula>
          <p>⚠ Your bid = the rider&apos;s recurring monthly salary (NOT a one-time purchase price)</p>
          <p>Bidding high = committing to a high salary for the entire contract</p>
        </Formula>
        <p>
          <strong>Budget validation:</strong> A new bid is rejected if{" "}
          <code>sum(active bids) + new bid &gt; treasury</code>. You cannot bid more than you can afford.
        </p>
        <p>
          <strong>Bid visibility:</strong>
        </p>
        <ul>
          <li>During a round: your active bids are secret (only visible to you)</li>
          <li>After a round resolves: won/outbid results visible to all league members</li>
          <li>After auction closes: all bids become fully visible</li>
        </ul>
        <p>
          <strong>Resolution:</strong> After each 24h round, highest bid wins. Budget is verified
          in cascade (riders sorted by bid descending). The winning bid becomes the locked{" "}
          <code>contract_salary</code>. A contract is created and the salary is deducted from your
          treasury immediately.
        </p>
      </Prose>
    ),
  },

  /* 5. Salaries & Bonuses */
  {
    id: "salary-bonus",
    title: "Salaries & Bonuses",
    subtitle: "How rider costs and sponsor bonuses work",
    icon: Coins,
    content: (
      <Prose>
        <p>
          Every rider has a <strong>market salary</strong> based on their PCS ranking.
          When you win an auction, your bid (which must be ≥ market salary) becomes
          their locked monthly salary.
        </p>
        <Formula>
          <p>Monthly salary = max(5,000, floor(PCS_points × 2,000 / 12 / 100) × 100)</p>
          <p>Floor: 5,000 EUR/month | No cap | Rounded to nearest 100 EUR</p>
        </Formula>
        <Table
          headers={["Rider rank", "PCS pts (1y)", "Annual value", "Monthly salary"]}
          rows={[
            ["#500", "114", "228,000 EUR", "19,000 EUR"],
            ["#100", "400", "800,000 EUR", "66,600 EUR"],
            ["#5 (Vingegaard)", "2,216", "4,432,000 EUR", "369,300 EUR"],
            ["#1 (Pogacar)", "4,552", "9,104,000 EUR", "758,600 EUR"],
          ]}
        />
        <p>
          <strong>Sponsor bonuses:</strong> Instead of a rider-based bonus formula, your{" "}
          <strong>sponsor</strong> pays you bonuses when your contracted riders finish in
          qualifying positions. Bonus amounts depend on your sponsor tier, the result type,
          and applicable multipliers.
        </p>
        <Table
          headers={["Result type", "Multiplier", "Condition"]}
          rows={[
            ["Monument or Grand Tour result", "×2", "T1-T4 sponsors (applied to all 3 bonus lines)"],
            ["Rider nationality matches sponsor", "×1.25", "T1-T4 sponsors only (T1 and T2 have no nationality)"],
            ["Monument + matching nationality", "×2.5", "Both multipliers stack multiplicatively"],
          ]}
        />
        <p>
          <strong>Example (Groupama sponsor, French GC specialist):</strong> Your French rider
          finishes 5th in the Tour de France GC. Groupama pays a 20K GC bonus × 2 (Grand Tour) ×
          1.25 (French nationality) = <strong>50K bonus</strong> credited to your treasury that day.
        </p>
      </Prose>
    ),
  },

  /* 6. Scoring & XP */
  {
    id: "scoring-xp",
    title: "Scoring & XP",
    subtitle: "Daily XP calculation and league ranking",
    icon: TrendingUp,
    content: (
      <Prose>
        <p>
          XP is calculated <strong>daily at 09:00 UTC</strong>. When any of your riders earns
          PCS points from a race result, those points are converted to XP and added to your
          team&apos;s cumulative score.
        </p>
        <Formula>
          <p>Rider XP = PCS_points_of_the_day × (1 + sum_of_active_strategy_bonuses)</p>
          <p>Team XP = sum(all riders&apos; XP)</p>
        </Formula>
        <Table
          headers={["Property", "Detail"]}
          rows={[
            ["Calculation time", "Daily at 09:00 UTC"],
            ["Accumulation", "Cumulative — XP never decreases"],
            ["Ranking", "League-wide, sorted by total Team XP"],
            ["Strategy boost", "Additive — each matching strategy adds +5%"],
          ]}
        />
        <p>
          <strong>Example:</strong> Your rider scores 40 PCS points today. You have 2 active
          strategies and the rider matches both (+10% total). Rider XP = 40 × 1.10 = 44 XP
          added to your team.
        </p>
      </Prose>
    ),
  },

  /* 7. Strategies */
  {
    id: "strategies",
    title: "Strategies (XP Boosters)",
    subtitle: "4 strategy types to multiply your XP",
    icon: Shield,
    content: (
      <Prose>
        <p>
          Strategies are <strong>XP multipliers</strong> that reward you for building a
          thematic roster. Each matching rider gets a <strong>+5% XP bonus</strong> per
          active strategy they qualify for.
        </p>
        <Table
          headers={["Strategy", "Bonus", "Unlock level", "Configuration"]}
          rows={[
            ["Speciality", "+5% per matching specialty", "Level 1", "Choose a specialty (Sprinter, GC, etc.)"],
            ["Nationality", "+5% per matching nationality", "Level 3", "Choose a country"],
            ["Teams", "+5% per matching UCI team", "Level 5", "Choose a UCI WorldTeam"],
            ["Age", "+5% for riders ≤23 (Young Blood) or >32 (Road Warriors)", "Level 7", "Choose Young Blood or Road Warriors"],
          ]}
        />
        <Formula>
          <p>Max active strategies: 1 (Level 1-2) | 2 (Level 3-6) | 3 (Level 7-8)</p>
          <p>Bonuses are additive across strategies</p>
        </Formula>
        <p>
          <strong>Strategy change timing:</strong>
        </p>
        <ul>
          <li>
            In <strong>Round 1</strong> of a phase: strategy changes take effect <strong>immediately</strong>
          </li>
          <li>
            In <strong>Round 2+</strong>: strategy changes are <strong>pending</strong> and take effect
            at the next payday (next phase confirmation)
          </li>
        </ul>
        <p>
          <strong>Example:</strong> You activate Nationality (Belgium) and Speciality (Sprinter).
          A Belgian sprinter on your roster gets +10% XP on every race day. A Belgian climber
          gets +5% (only nationality matches). A French sprinter gets +5% (only specialty matches).
        </p>
      </Prose>
    ),
  },

  /* 8. Levels */
  {
    id: "levels",
    title: "Team Levels & Unlocks",
    subtitle: "8 levels aligned with the racing calendar",
    icon: Layers,
    content: (
      <Prose>
        <Table
          headers={["Level", "Phase", "XP", "Slots", "Strategies", "Rider pool", "New unlock"]}
          rows={[
            ["1", "Season Start",   "0",     "6",  "1", "#300–600", "Speciality strategy + Lotto T1 (250K)"],
            ["2", "Classics P1",    "25",    "7",  "1", "#200–600", "Astana T2 (350K)"],
            ["3", "Classics P2",    "150",   "8",  "2", "#100–600", "Nationality strategy + T3 sponsors (450K)"],
            ["4", "Giro",           "350",   "9",  "2", "#30–600",  "T4 sponsors (650K)"],
            ["5", "Pre-Tour",       "600",   "10", "2", "#20–600",  "Teams strategy"],
            ["6", "Tour",           "1,200", "11", "2", "#10–600",  "T5 sponsors (1M)"],
            ["7", "Post-Tour",      "1,800", "12", "3", "#4–600",   "Age strategy + 3 max strategies"],
            ["8", "Vuelta",         "2,400", "12", "3", "#1–600",   "T6 UAE Team Emirates (1.25M)"],
          ]}
        />
        <Formula>
          <p>Higher level = more roster slots + access to better-ranked riders + more strategy slots</p>
        </Formula>
        <p>
          <strong>T3 sponsors (Level 3):</strong> Groupama (FR) and Movistar (ES) are GC-oriented.
          Alpecin (BE/NL) and Uno-X (DK/NO) are One-Day-oriented. All pay 450K/phase.
        </p>
        <p>
          <strong>T4 sponsors (Level 4):</strong> Ineos (GB) and Decathlon (FR) are GC-oriented.
          Soudal Quick-Step (BE) and Lidl-Trek (US/IT) are One-Day-oriented. All pay 650K/phase.
        </p>
        <p>
          <strong>T5 sponsors (Level 6):</strong> Visma ("The prestige bet") and Red Bull-Bora
          ("The regular") both pay 1M/phase with different bonus risk profiles.
        </p>
        <p>
          <strong>Rider pool gating:</strong> The total rider pool is the Top 600 of the PCS
          global ranking (rolling 12 months). At Level 1, you can only recruit riders ranked
          #300-600. As you level up, higher-ranked (better) riders become available. At Level 8,
          the entire pool is unlocked — including the world #1.
        </p>
      </Prose>
    ),
  },

  /* 9. Sponsors & Income */
  {
    id: "sponsors",
    title: "Sponsors & Income",
    subtitle: "6 tiers, 13 sponsors, race bonuses",
    icon: Handshake,
    content: (
      <Prose>
        <p>
          Every team has <strong>exactly one sponsor</strong>, gated by level only — no eligibility
          conditions. Your sponsor provides a fixed monthly budget paid once per phase at payday,
          plus race bonuses when your riders perform.
        </p>
        <Table
          headers={["Tier", "Level", "Budget/phase", "Sponsors"]}
          rows={[
            ["T1", "1", "250,000 EUR", "Lotto (auto-assigned at start)"],
            ["T2", "2", "350,000 EUR", "Astana (auto-upgraded at L2)"],
            ["T3", "3", "450,000 EUR", "Groupama (FR), Movistar (ES) — GC · Alpecin (BE/NL), Uno-X (DK/NO) — One-Day"],
            ["T4", "4", "650,000 EUR", "Ineos (GB), Decathlon (FR) — GC · Soudal Quick-Step (BE), Lidl-Trek (US/IT) — One-Day"],
            ["T5", "6", "1,000,000 EUR", "Visma \"The prestige bet\" · Red Bull-Bora \"The regular\""],
            ["T6", "8", "1,250,000 EUR", "UAE Team Emirates (ultimate sponsor)"],
          ]}
        />
        <p>
          <strong>Race bonuses (T1-T4):</strong> Each sponsor has 3 bonus lines — GC, One-Day,
          and Stage — that trigger when your riders finish within the qualifying threshold.
          Multipliers stack: ×2 for Monuments/Grand Tours, ×1.25 if the rider&apos;s nationality
          matches the sponsor&apos;s. T1 and T2 have no nationality bonus.
        </p>
        <p>
          <strong>Race bonuses (T5-T6):</strong> Explicit bonus amounts for regular vs. prestige
          events (Monuments and Grand Tours). No nationality multiplier at this tier.
        </p>
        <Formula>
          <p>T5 Visma: Monument/GT Podium → 75K · Regular Top 5 → 25K (high risk, high reward)</p>
          <p>T5 Red Bull: Monument/GT Top 5 → 50K · Regular Top 5 → 30K (consistent income)</p>
          <p>T6 UAE: Monument/GT Podium → 100K · Stage win → 25K (victories and podiums only)</p>
        </Formula>
        <p>
          <strong>Changing sponsor:</strong> You can switch anytime.
        </p>
        <ul>
          <li>
            In <strong>Round 1</strong> of a phase: the new sponsor takes effect <strong>immediately</strong>
          </li>
          <li>
            In <strong>Round 2+</strong>: the change is <strong>pending</strong> and takes effect
            at the next payday. Your current sponsor remains active for race bonuses until then.
          </li>
        </ul>

      </Prose>
    ),
  },

  /* 10. Budget & Bankruptcy */
  {
    id: "budget",
    title: "Budget & Bankruptcy",
    subtitle: "Treasury management and what happens when you go broke",
    icon: Wallet,
    content: (
      <Prose>
        <Table
          headers={["Item", "Detail"]}
          rows={[
            ["Starting treasury", "200,000 EUR"],
            ["Payday", "Player-triggered: click Confirm at phase start. +sponsor budget, -salaries"],
            ["Race bonuses", "+sponsor bonus credited on the day race results are imported"],
            ["Auction win", "-locked salary deducted immediately from treasury"],
            ["Release fee", "Free release — phase salary not refunded"],
          ]}
        />
        <Formula>
          <p>After payday: treasury = treasury + sponsor_budget - sum(active_salaries)</p>
          <p>Race bonus: treasury += base_bonus × multiplier (credited same day as result)</p>
        </Formula>
        <p>
          <strong>Releasing riders:</strong>
        </p>
        <ul>
          <li>
            You can <strong>release a rider at any time</strong> — <strong>no release fee</strong>
          </li>
          <li>
            The release takes effect at the <strong>start of the next phase</strong> — the rider
            stays on your roster until then and their current phase salary is not refunded
          </li>
          <li>
            The slot is freed and the rider returns to the pool when the next phase begins
          </li>
        </ul>
        <p>
          <strong>Bankruptcy rules:</strong>
        </p>
        <ul>
          <li>
            At payday, if <code>treasury &lt; -10,000 EUR</code> after salary deduction, an{" "}
            <strong>auto-release cascade</strong> triggers immediately
          </li>
          <li>
            The rider with the <strong>highest cumulative XP</strong> is released first — no fee,
            phase salary not refunded
          </li>
          <li>
            The cascade repeats until <code>treasury ≥ -10,000 EUR</code> or the roster is empty
          </li>
        </ul>
        <Table
          headers={["Scenario", "Treasury", "Action"]}
          rows={[
            ["Healthy", "≥ 0 EUR", "Normal play — can bid at auctions"],
            ["Tolerance zone", "-10,000 to 0 EUR", "Can still play, monitor carefully"],
            ["Bankruptcy", "< -10,000 EUR at payday", "Auto-release cascade (highest XP rider first)"],
          ]}
        />
      </Prose>
    ),
  },
];

/* ─── Shared Accordion Component ─── */
export function GameGuideAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {HELP_SECTIONS.map((section, index) => {
        const isOpen = openId === section.id;
        const Icon = section.icon;

        return (
          <div
            key={section.id}
            id={section.id}
            className={index < HELP_SECTIONS.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="flex w-[calc(100%+2rem)] items-center gap-3 py-3 -mx-4 px-4 text-left transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                <Icon size={18} className="text-[var(--text-mid)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                  {section.title}
                </p>
                <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {section.subtitle}
                </p>
              </div>
              <ChevronDown
                size={16}
                className={`shrink-0 text-[var(--text-ghost)] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Content */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="pb-4 pt-1">
                {section.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
