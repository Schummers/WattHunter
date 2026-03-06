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
    <div className="flex rounded-lg bg-[var(--bg-app)] p-0.5">
      {segments.map((segment, index) => (
        <button
          key={segment}
          type="button"
          onClick={() => onChange(index)}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            index === activeIndex
              ? "bg-[var(--bg-surface)] text-[var(--text-high)]"
              : "text-[var(--text-mid)]"
          }`}
        >
          {segment}
        </button>
      ))}
    </div>
  );
}
