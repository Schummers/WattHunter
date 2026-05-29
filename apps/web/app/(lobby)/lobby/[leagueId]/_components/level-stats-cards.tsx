import { getLevelByNumber } from "@/lib/levels";

export interface LevelStatsCardsProps {
  level: number;
}

/**
 * Extracts the lead sponsor budget shown in the lobby preview.
 * Pulled from the `sponsor` display string in `lib/levels.ts` (e.g. "Lotto · 250K").
 * Returns null when the level has no sponsor unlock.
 */
function previewSponsorBudget(displaySponsor: string | null): string | null {
  if (!displaySponsor) return null;
  const match = displaySponsor.match(/(\d+(?:\.\d+)?)\s*([KMB])/i);
  if (!match) return null;
  const [, amount, suffix] = match;
  return `€${amount}${suffix.toUpperCase()}`;
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
        {label}
      </span>
      <span className="font-mono text-[length:var(--type-stat)] font-bold text-[var(--text-high)]">
        {value}
      </span>
      {hint ? (
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function LevelStatsCards({ level }: LevelStatsCardsProps) {
  const data = getLevelByNumber(level);
  const budget = previewSponsorBudget(data.sponsor);

  return (
    <section className="grid grid-cols-3 gap-3">
      <StatCard label="Rider slots" value={String(data.slots)} />
      <StatCard
        label="Sponsor / phase"
        value={budget ?? "—"}
        hint={budget ? undefined : "Unlocks higher up"}
      />
      <StatCard
        label="Strategies"
        value={`${data.maxActive} active`}
        hint={data.strategy ? `New: ${data.strategy}` : undefined}
      />
    </section>
  );
}
