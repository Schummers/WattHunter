import { BackHeader } from "@/components/back-header";
import { notFound } from "next/navigation";

const DOCS: Record<
  string,
  { title: string; sections: { heading: string; content: React.ReactNode }[] }
> = {
  points: {
    title: "How points work",
    sections: [
      {
        heading: "Two independent metrics",
        content: (
          <>
            <p>
              WattHunter tracks two separate metrics for each team:{" "}
              <strong>Team Score (XP)</strong> and{" "}
              <strong>Treasury (cash)</strong>.
            </p>
            <ul>
              <li>
                <strong>XP</strong> — Cumulative score since team creation.
                Determines league ranking, team level, and feature unlocks.
                Calculated daily at 09:00 UTC.
              </li>
              <li>
                <strong>Treasury</strong> — Cash balance (income minus expenses).
                Determines your ability to bid at auctions. Always visible in the
                header.
              </li>
            </ul>
            <p>
              XP and treasury are independent — money does not directly give XP.
              But a high treasury lets you buy better riders who generate more XP.
            </p>
          </>
        ),
      },
      {
        heading: "Daily XP calculation",
        content: (
          <>
            <div className="rounded-lg bg-[var(--bg-surface)] p-3 font-mono text-[length:var(--type-caption)]">
              <p>Rider XP = PCS_points_of_the_day × (1 + sum of active policy bonuses)</p>
              <p>Team XP = sum of XP from all riders on roster</p>
            </div>
          </>
        ),
      },
      {
        heading: "Policies (XP boosters)",
        content: (
          <>
            <p>
              4 policy types, each granting <strong>+5% XP</strong> per matching
              rider. Maximum 2 active policies (unlocked at Level 5).
            </p>
            <Table
              headers={["Policy", "Bonus", "Configuration"]}
              rows={[
                ["Young Blood", "+5% for riders < 23 years", "Automatic"],
                ["Road Warriors", "+5% for riders > 30 years", "Automatic"],
                ["National Pride", "+5% for riders of a nationality", "Player choice"],
                ["Team Chemistry", "+5% for riders of a UCI team", "Player choice"],
                ["Specialist", "+5% for riders of a specialty", "Player choice"],
              ]}
            />
            <p>
              Bonuses are <strong>additive</strong>. Example: National Pride
              (Belgium) + Specialist (Sprinter) = +10% for riders matching both.
            </p>
          </>
        ),
      },
    ],
  },
  money: {
    title: "Bonus & money",
    sections: [
      {
        heading: "Starting treasury",
        content: (
          <p>
            Every team starts with <strong>200,000 EUR</strong>.
          </p>
        ),
      },
      {
        heading: "Income",
        content: (
          <ul>
            <li>
              <strong>Rider bonuses</strong> — earned per race (see formula
              below)
            </li>
            <li>
              <strong>Sponsor payments</strong> — monthly on the 1st
            </li>
            <li>
              <strong>Default sponsor (beta)</strong> — 200,000 EUR/month, flat,
              no conditions, active from the start
            </li>
          </ul>
        ),
      },
      {
        heading: "Expenses",
        content: (
          <ul>
            <li>
              <strong>Rider salaries</strong> — monthly on the 1st
            </li>
            <li>
              <strong>Won auctions</strong> — the winning bid becomes the
              recurring monthly salary (no upfront purchase price)
            </li>
          </ul>
        ),
      },
      {
        heading: "Salary formula",
        content: (
          <>
            <div className="rounded-lg bg-[var(--bg-surface)] p-3 font-mono text-[length:var(--type-caption)]">
              <p>Monthly salary = PCS_points_1y × 2,000 / 12</p>
              <p>Floor: 5,000 EUR/month | No cap</p>
            </div>
            <Table
              headers={["Rider", "PCS pts", "Annual", "Monthly salary"]}
              rows={[
                ["#500", "114", "228k", "19,000 EUR"],
                ["#100", "400", "800k", "66,667 EUR"],
                ["#5 (Vingegaard)", "2,216", "4.4M", "369,333 EUR"],
                ["#1 (Pogacar)", "4,552", "9.1M", "758,666 EUR"],
              ]}
            />
          </>
        ),
      },
      {
        heading: "Race bonus formula",
        content: (
          <>
            <div className="rounded-lg bg-[var(--bg-surface)] p-3 font-mono text-[length:var(--type-caption)]">
              Bonus = max(0, race_points × 1,500 − monthly_salary)
            </div>
            <p>
              The bonus is calculated <strong>per race</strong> (not cumulated
              monthly). It is always positive or zero — a rider never penalizes
              your treasury beyond their salary.
            </p>
            <p>
              <strong>Hidden gem mechanic:</strong> Stars (high salary) almost
              never generate bonuses. Cheap riders (#400-500) generate bonuses as
              soon as they perform. This is the core strategic mechanic.
            </p>
            <Table
              headers={["Rider", "Salary", "Race pts", "Bonus"]}
              rows={[
                ["#450", "21k", "20", "9,000 EUR"],
                ["#100", "67k", "30", "0 EUR"],
                ["Pogacar", "759k", "100", "0 EUR"],
              ]}
            />
          </>
        ),
      },
      {
        heading: "Bankruptcy",
        content: (
          <>
            <p>
              <strong>Month 1 of negative treasury:</strong> Debt status. Blocked
              from auctions, but can still play.
            </p>
            <p>
              <strong>Month 2 consecutive of negative treasury:</strong> Automatic
              rider release — <strong>best scorer first</strong> (highest PCS
              points) — until treasury is positive again. No notice period for
              auto-releases.
            </p>
          </>
        ),
      },
    ],
  },
  levels: {
    title: "Team levels & unlocks",
    sections: [
      {
        heading: "Progression table",
        content: (
          <Table
            headers={[
              "Level",
              "XP required",
              "Slots",
              "Active policies",
              "PCS rank unlocked",
              "New policy",
            ]}
            rows={[
              ["1", "0", "6", "1", "#351-500", "Speciality"],
              ["2", "50", "7", "1", "#251-500", "—"],
              ["3", "150", "7", "1", "#176-500", "Nationality"],
              ["4", "350", "8", "1", "#101-500", "—"],
              ["5", "700", "9", "2", "#76-500", "Teams"],
              ["6", "1,200", "9", "2", "#51-500", "—"],
              ["7", "1,900", "10", "2", "#26-500", "Age"],
              ["8", "2,900", "11", "2", "#11-500", "—"],
              ["9", "4,400", "11", "2", "#4-500", "—"],
              ["10", "6,400", "12", "2", "#1-500", "—"],
            ]}
          />
        ),
      },
      {
        heading: "Rider pool gating",
        content: (
          <>
            <p>
              The total rider pool is the <strong>Top 500</strong> of the PCS
              global individual ranking (rolling 12 months).
            </p>
            <p>
              At Level 1, you can only recruit riders ranked #351-500. As you
              level up, higher-ranked (better) riders become available. At Level
              10, the entire top 500 is unlocked — including the podium top 3.
            </p>
          </>
        ),
      },
      {
        heading: "Slots",
        content: (
          <p>
            You start with <strong>6 rider slots</strong> at Level 1 and gain
            additional slots as you level up, reaching a maximum of{" "}
            <strong>12 slots</strong> at Level 10.
          </p>
        ),
      },
      {
        heading: "Policies",
        content: (
          <>
            <p>
              You start with <strong>1 active policy slot</strong> and unlock a
              second slot at Level 5. New policy types unlock at specific levels:
            </p>
            <ul>
              <li>Level 1 — Speciality</li>
              <li>Level 3 — Nationality</li>
              <li>Level 5 — Teams</li>
              <li>Level 7 — Age</li>
            </ul>
          </>
        ),
      },
    ],
  },
  auctions: {
    title: "Auctions & rounds",
    sections: [
      {
        heading: "Auction format",
        content: (
          <Table
            headers={["Rule", "Value"]}
            rows={[
              ["Duration", "72 hours (3 rounds of 24h)"],
              ["Minimum bid", "Rider's market salary (formula)"],
              ["Minimum increment", "+100 EUR"],
              ["Format", "Sealed-bid, 3 rounds"],
            ]}
          />
        ),
      },
      {
        heading: "Key rule: bid = monthly salary",
        content: (
          <p>
            The winning bid is <strong>not</strong> a one-time purchase price. It
            becomes the rider&apos;s <strong>recurring monthly salary</strong>,
            deducted every month. Bidding high = committing to a high salary for
            the entire contract duration.
          </p>
        ),
      },
      {
        heading: "Resolution rules",
        content: (
          <ol>
            <li>Highest bid wins</li>
            <li>Tie-breaker: earliest timestamp wins</li>
            <li>Budget verification in cascade (riders sorted by bid descending)</li>
            <li>
              Winning bid = locked <code>contract_salary</code> (no immediate
              treasury deduction)
            </li>
            <li>Losing bids → outbid, cancelled bids → cancelled</li>
            <li>Contract created with locked salary</li>
          </ol>
        ),
      },
      {
        heading: "Budget validation",
        content: (
          <p>
            A new bid is rejected if:{" "}
            <code>sum(other active bids) + new bid &gt; treasury</code>. You
            cannot bid more than you can afford.
          </p>
        ),
      },
      {
        heading: "Bid visibility",
        content: (
          <ul>
            <li>
              <strong>During auction:</strong> Won/outbid bids visible to all
              league members. Active bids (next round) are secret — only visible
              to your team.
            </li>
            <li>
              <strong>After auction:</strong> All bids become visible.
            </li>
          </ul>
        ),
      },
      {
        heading: "Contracts",
        content: (
          <>
            <p>
              When a contract is created, the <code>contract_salary</code> is the
              winning auction bid — locked for the contract duration.
            </p>
            <p>
              <strong>Releasing a rider:</strong> 1 month notice + 1 extra month
              of salary. Slot is freed immediately; rider returns to the pool
              after notice period.
            </p>
          </>
        ),
      },
    ],
  },
};

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full text-left text-[length:var(--type-caption)]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 font-semibold text-[var(--text-mid)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border-subtle)] last:border-0"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--text-high)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; slug: string }>;
}) {
  const { slug } = await params;
  const doc = DOCS[slug];

  if (!doc) notFound();

  return (
    <div className="min-h-screen">
      <BackHeader label="Documentation" />

      <div className="px-4 pt-4 space-y-6">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          {doc.title}
        </h1>

        {doc.sections.map((section) => (
          <div key={section.heading} className="space-y-2">
            <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              {section.heading}
            </h2>
            <div className="space-y-2 text-[length:var(--type-body)] text-[var(--text-mid)] [&_strong]:text-[var(--text-high)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_code]:rounded [&_code]:bg-[var(--bg-surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[length:var(--type-caption)]">
              {section.content}
            </div>
          </div>
        ))}

        <div className="pb-8" />
      </div>
    </div>
  );
}
