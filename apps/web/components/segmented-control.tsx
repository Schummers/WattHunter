"use client";

interface SegmentedControlProps {
  segments: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({
  segments,
  activeIndex,
  onChange,
}: SegmentedControlProps) {
  return (
    // p-[3px]: DS Option C canonical container padding. Intentional exception — no Tailwind utility covers 3px (p-px=1px, p-0.5=2px, p-1=4px). MISSING_TOKEN candidate: --space-0.75.
    <div className="flex w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] p-[3px] gap-1.5">
      {segments.map((segment, index) => (
        <button
          key={segment}
          type="button"
          onClick={() => onChange(index)}
          className={`flex-1 rounded-[var(--radius-md)] px-3.5 py-1.5 text-[length:var(--type-caption)] transition-colors ${
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
