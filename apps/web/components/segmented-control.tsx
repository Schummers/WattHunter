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
