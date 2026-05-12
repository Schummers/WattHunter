type Props = {
  gtName: string;
};

export function RaceCardRestDay({ gtName }: Props) {
  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3.5 py-3 flex items-center justify-between opacity-60">
      <span className="text-[length:var(--type-emphasis)] font-medium text-[var(--text-mid)]">
        {gtName} — Rest Day
      </span>
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[length:var(--type-caption)] text-[var(--text-ghost)]"
        aria-hidden="true"
      >
        {"—"}
      </span>
    </div>
  );
}
