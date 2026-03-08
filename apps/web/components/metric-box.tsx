interface MetricBoxProps {
  value: string | number;
  label: string;
  highlight?: boolean;
}

export function MetricBox({ value, label, highlight }: MetricBoxProps) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <span
        className={`font-mono text-base font-bold ${
          highlight
            ? "text-[var(--accent-highlight)]"
            : "text-[var(--text-high)]"
        }`}
      >
        {formattedValue}
      </span>
      <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
        {label}
      </span>
    </div>
  );
}
