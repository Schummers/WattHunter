"use client";

interface SegmentedControlProps {
  segments: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** Greyed out and inert. Kept visible on purpose: hiding the control would
   *  make the layout jump between two states of the same screen. */
  disabled?: boolean;
}

export function SegmentedControl({
  segments,
  activeIndex,
  onChange,
  disabled = false,
}: SegmentedControlProps) {
  // p-[3px] below: DS Option C canonical container padding. Intentional exception
  // — no Tailwind utility covers 3px (p-px=1px, p-0.5=2px, p-1=4px).
  // MISSING_TOKEN candidate: --space-0.75.
  return (
    <div
      className={`flex w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] p-[3px] gap-1.5 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {segments.map((segment, index) => (
        <button
          key={segment}
          type="button"
          onClick={() => onChange(index)}
          disabled={disabled}
          className={`flex-1 rounded-[var(--radius-md)] px-3.5 py-1.5 text-[length:var(--type-caption)] transition-colors disabled:cursor-not-allowed ${
            index === activeIndex
              ? "bg-[var(--bg-surface-active)] text-[var(--text-high)] font-semibold"
              : "text-[var(--text-low)] font-medium"
          }`}
        >
          {segment}
        </button>
      ))}
    </div>
  );
}
