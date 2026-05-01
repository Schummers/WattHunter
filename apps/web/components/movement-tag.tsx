interface MovementTagProps {
  movement: number | null;
}

export function MovementTag({ movement }: MovementTagProps) {
  if (movement === null || movement === 0) {
    return (
      <span className="font-mono text-[length:var(--type-micro)] font-bold text-[var(--text-ghost)]">
        —
      </span>
    );
  }

  if (movement > 0) {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--success-bg)] px-1.5 py-px font-mono text-[length:var(--type-micro)] font-bold text-[var(--success)]">
        +{movement}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--danger-bg)] px-1.5 py-px font-mono text-[length:var(--type-micro)] font-bold text-[var(--danger)]">
      {movement}
    </span>
  );
}
