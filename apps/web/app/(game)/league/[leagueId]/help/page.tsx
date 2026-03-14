"use client";

import { useState } from "react";
import { BackHeader } from "@/components/back-header";
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
          into 7 auction phases aligned with the real cycling calendar. Each phase features
          different races and auction windows.
        </p>
        <p>
          <strong>How to win:</strong> Accumulate the most XP in your league. Smart budget
          management and &quot;hidden gem&quot; riders (cheap riders who overperform) are
          the key to success.
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
          Points vary by race prestige — a Grand Tour GC win is worth far more than a stage race stage.
        </p>
        <p>
          WattHunter uses the <strong>PCS individual ranking</strong> (rolling 12 months) to determine
          rider salaries, pool gating, and daily XP conversion.
        </p>
        <Table
          headers={["Place", "GT GC", "GT Stage", "Monument", "WT One-day", "WT Stage Race GC", "WT Stage"]}
          rows={[
            ["1st", "800", "40", "400", "300", "250", "20"],
            ["2nd", "500", "28", "250", "200", "150", "14"],
            ["3rd", "350", "20", "175", "150", "100", "10"],
            ["4th", "275", "14", "125", "115", "75", "6"],
            ["5th", "225", "10", "100", "85", "60", "4"],
            ["6th", "175", "8", "75", "65", "50", "3"],
            ["7th", "150", "6", "60", "50", "40", "2"],
            ["8th", "125", "4", "50", "40", "30", "1"],
            ["9th", "100", "3", "40", "30", "25", "—"],
            ["10th", "85", "2", "35", "25", "20", "—"],
            ["11th", "70", "—", "30", "20", "16", "—"],
            ["12th", "60", "—", "25", "16", "13", "—"],
            ["13th", "55", "—", "22", "13", "11", "—"],
            ["14th", "50", "—", "19", "11", "9", "—"],
            ["15th", "45", "—", "16", "9", "7", "—"],
            ["16th", "40", "—", "14", "7", "5", "—"],
            ["17th", "35", "—", "12", "5", "4", "—"],
            ["18th", "30", "—", "10", "4", "3", "—"],
            ["19th", "25", "—", "8", "3", "2", "—"],
            ["20th", "20", "—", "6", "2", "1", "—"],
          ]}
        />
        <Formula>
          <p>GT = Grand Tour (Tour de France, Giro d&apos;Italia, Vuelta a España)</p>
          <p>Monument = Milan-San Remo, Tour of Flanders, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia</p>
          <p>WT = UCI WorldTour</p>
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
    subtitle: "7 auction phases aligned with real cycling",
    icon: Calendar,
    content: (
      <Prose>
        <p>
          The WattHunter season is divided into <strong>7 auction phases</strong>, each aligned
          with major periods of the professional cycling calendar. The 2026 WorldTour features{" "}
          <strong className="font-mono">34</strong> races.
        </p>
        <Table
          headers={["#", "Phase", "Period", "Key races"]}
          rows={[
            ["1", "Season Start", "Jan 1 – Feb 28", "Tour Down Under, UAE Tour"],
            ["2", "The Flandrians", "Mar 1 – Apr 12", "Milan-San Remo, Tour of Flanders, Paris-Roubaix"],
            ["3", "The Ardennes", "Apr 13 – May 10", "Amstel Gold, Flèche Wallonne, Liège-Bastogne-Liège"],
            ["4", "Giro d'Italia", "May 11 – Jun 14", "Giro d'Italia, Critérium du Dauphiné"],
            ["5", "Tour de France", "Jun 15 – Aug 2", "Tour de France"],
            ["6", "La Vuelta", "Aug 3 – Sep 21", "Vuelta a España, Clasica San Sebastian"],
            ["7", "End of Season", "Sep 22 – Nov 2", "Il Lombardia, World Championships"],
          ]}
        />
        <Formula>
          <p>Each phase = auction window → races → XP calculation → next phase</p>
        </Formula>
        <p>
          Auctions open during each phase, giving you the opportunity to recruit riders
          who are racing in the upcoming events.
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
            ["Minimum increment", "+100 EUR over current highest bid"],
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
          <code>contract_salary</code>. A contract is created immediately.
        </p>
      </Prose>
    ),
  },

  /* 5. Salaries & Bonuses */
  {
    id: "salary-bonus",
    title: "Salaries & Bonuses",
    subtitle: "How rider costs and race income work",
    icon: Coins,
    content: (
      <Prose>
        <p>
          Every rider has a <strong>market salary</strong> based on their PCS ranking.
          When you win an auction, your bid (which must be ≥ market salary) becomes
          their locked monthly salary.
        </p>
        <Formula>
          <p>Monthly salary = PCS_points_1y × 2,000 / 12</p>
          <p>Floor: 5,000 EUR/month | No cap</p>
        </Formula>
        <Table
          headers={["Rider rank", "PCS pts (1y)", "Annual value", "Monthly salary"]}
          rows={[
            ["#500", "114", "228,000 EUR", "19,000 EUR"],
            ["#100", "400", "800,000 EUR", "66,667 EUR"],
            ["#5 (Vingegaard)", "2,216", "4,432,000 EUR", "369,333 EUR"],
            ["#1 (Pogacar)", "4,552", "9,104,000 EUR", "758,667 EUR"],
          ]}
        />
        <Formula>
          <p>Race bonus = max(0, race_points × 1,500 − monthly_salary)</p>
        </Formula>
        <p>
          <strong>Hidden gem mechanic:</strong> Stars (high salary) almost never generate bonuses
          because their salary exceeds the bonus formula. Cheap riders (#400-500) generate bonuses
          as soon as they score race points. This is the core strategic mechanic.
        </p>
        <Table
          headers={["Rider", "Monthly salary", "Race points", "Bonus earned"]}
          rows={[
            ["#450 rider", "21,000 EUR", "20 pts", "9,000 EUR"],
            ["#100 rider", "67,000 EUR", "30 pts", "0 EUR (45k < 67k salary)"],
            ["#1 Pogacar", "759,000 EUR", "100 pts", "0 EUR (150k < 759k salary)"],
          ]}
        />
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
          <p>Rider XP = PCS_points_of_the_day × (1 + sum_of_active_policy_bonuses)</p>
          <p>Team XP = sum(all riders&apos; XP)</p>
        </Formula>
        <Table
          headers={["Property", "Detail"]}
          rows={[
            ["Calculation time", "Daily at 09:00 UTC"],
            ["Accumulation", "Cumulative — XP never decreases"],
            ["Ranking", "League-wide, sorted by total Team XP"],
            ["Policy boost", "Additive — each matching policy adds +5%"],
          ]}
        />
        <p>
          <strong>Example:</strong> Your rider scores 40 PCS points today. You have 2 active
          policies and the rider matches both (+10% total). Rider XP = 40 × 1.10 = 44 XP
          added to your team.
        </p>
      </Prose>
    ),
  },

  /* 7. Policies */
  {
    id: "policies",
    title: "Policies (XP Boosters)",
    subtitle: "5 policy types to multiply your XP",
    icon: Shield,
    content: (
      <Prose>
        <p>
          Policies are <strong>XP multipliers</strong> that reward you for building a
          thematic roster. Each matching rider gets a <strong>+5% XP bonus</strong> per
          active policy they qualify for.
        </p>
        <Table
          headers={["Policy", "Bonus", "Unlock level", "Configuration"]}
          rows={[
            ["Speciality", "+5% per matching specialty", "Level 1", "Choose a specialty (Sprinter, GC, etc.)"],
            ["Nationality", "+5% per matching nationality", "Level 3", "Choose a country"],
            ["Teams", "+5% per matching UCI team", "Level 5", "Choose a UCI WorldTeam"],
            ["Young Blood", "+5% for riders under 23 years", "Level 7", "Automatic"],
            ["Road Warriors", "+5% for riders over 30 years", "Level 7", "Automatic"],
          ]}
        />
        <Formula>
          <p>Max active policies: 1 (Level 1-4) | 2 (Level 5+)</p>
          <p>Bonuses are additive across policies</p>
        </Formula>
        <p>
          <strong>Example:</strong> You activate National Pride (Belgium) and Specialist (Sprinter).
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
    subtitle: "10 levels of progression",
    icon: Layers,
    content: (
      <Prose>
        <Table
          headers={["Level", "XP required", "Slots", "Policies", "Rider pool", "New unlock"]}
          rows={[
            ["1", "0", "6", "1", "#351–500", "Speciality policy"],
            ["2", "50", "7", "1", "#251–500", "—"],
            ["3", "150", "7", "1", "#176–500", "Nationality policy"],
            ["4", "350", "8", "1", "#101–500", "—"],
            ["5", "700", "9", "2", "#76–500", "Teams policy"],
            ["6", "1,200", "9", "2", "#51–500", "—"],
            ["7", "1,900", "10", "2", "#26–500", "Age policies"],
            ["8", "2,900", "11", "2", "#11–500", "—"],
            ["9", "4,400", "11", "2", "#4–500", "—"],
            ["10", "6,400", "12", "2", "#1–500", "—"],
          ]}
        />
        <Formula>
          <p>Higher level = more roster slots + access to better-ranked riders + more policy slots</p>
        </Formula>
        <p>
          <strong>Rider pool gating:</strong> The total rider pool is the Top 500 of the PCS
          global ranking (rolling 12 months). At Level 1, you can only recruit riders ranked
          #351-500. As you level up, higher-ranked (better) riders become available. At Level 10,
          the entire top 500 is unlocked — including the podium top 3.
        </p>
      </Prose>
    ),
  },

  /* 9. Sponsors */
  {
    id: "sponsors",
    title: "Sponsors & Income",
    subtitle: "Monthly income from sponsor contracts",
    icon: Handshake,
    content: (
      <Prose>
        <p>
          Sponsors provide your team with a <strong>monthly income</strong>, paid on the 1st
          of each month. During beta, every team has a default sponsor.
        </p>
        <Table
          headers={["Sponsor tier", "Monthly payment", "Unlock level"]}
          rows={[
            ["Default (Beta)", "200,000 EUR", "Level 1 (active from start)"],
            ["Tier 1", "200,000 EUR", "Level 1"],
            ["Tier 2", "350,000 EUR", "Level 3"],
            ["Tier 3", "550,000 EUR", "Level 5"],
            ["Tier 4", "750,000 EUR", "Level 7"],
            ["Tier 5", "1,000,000 EUR", "Level 8"],
          ]}
        />
        <Formula>
          <p>Contract duration: 2 months</p>
          <p>Payment: monthly on the 1st</p>
          <p>Beta: flat 200,000 EUR/month — no conditions, active from start</p>
        </Formula>
        <p>
          Post-beta, sponsors will have conditions and tiers tied to your team level.
          Higher-tier sponsors pay more but require higher levels to unlock.
        </p>
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
            ["Inflows", "Sponsor payments (monthly 1st) + Rider bonuses (per race)"],
            ["Outflows", "Rider salaries (monthly 1st)"],
            ["Monthly cycle", "On the 1st: salaries deducted, then sponsor paid"],
          ]}
        />
        <Formula>
          <p>Treasury = starting_balance + cumulative_sponsor_payments + cumulative_bonuses − cumulative_salaries</p>
        </Formula>
        <p>
          <strong>Bankruptcy rules:</strong>
        </p>
        <ul>
          <li>
            <strong>Month 1 of negative treasury:</strong> Debt status — blocked from
            auctions, but you can still play and earn bonuses
          </li>
          <li>
            <strong>Month 2 consecutive negative:</strong> Auto-release kicks in —
            your best scorer (highest PCS points) is released first, then the next,
            until treasury is positive again
          </li>
        </ul>
        <Table
          headers={["Scenario", "Treasury", "Action"]}
          rows={[
            ["Healthy", "> 0 EUR", "Normal play — can bid at auctions"],
            ["Month 1 debt", "< 0 EUR", "Blocked from auctions — earn your way back"],
            ["Month 2 debt", "< 0 EUR (2nd consecutive)", "Auto-release best riders until positive"],
          ]}
        />
        <p>
          No notice period applies to auto-releases during bankruptcy. Released riders
          return to the auction pool immediately.
        </p>
      </Prose>
    ),
  },
];

/* ─── Main Component ─── */
export default function HelpPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

      <div className="px-4 pt-4 space-y-2 pb-24">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)] mb-4">
          Game Guide
        </h1>

        {HELP_SECTIONS.map((section) => {
          const isOpen = openId === section.id;
          const Icon = section.icon;

          return (
            <div
              key={section.id}
              id={section.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/80 backdrop-blur-sm overflow-hidden"
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-subtle)]"
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
                <div className="border-t border-[var(--border-subtle)] px-4 py-4">
                  {section.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
