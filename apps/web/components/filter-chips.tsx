"use client";

interface FilterChipOption {
  label: string;
  variant?: "default" | "accent";
}

interface FilterChipsProps {
  options: FilterChipOption[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function FilterChips({ options, activeIndex, onChange }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none">
      {options.map((option, i) => {
        const isActive = i === activeIndex;
        const isAccent = option.variant === "accent";

        let className =
          "shrink-0 cursor-pointer rounded-[6px] border px-[14px] py-[6px] text-[length:var(--type-caption)] font-medium transition-all duration-150 whitespace-nowrap outline-none ";

        if (isActive && isAccent) {
          className +=
            "border-[var(--accent-default)] bg-[var(--badge-bg)] text-[var(--accent-default)] font-semibold";
        } else if (isActive) {
          className +=
            "border-[var(--border-hover)] bg-[var(--bg-surface-active)] text-[var(--text-high)] font-semibold";
        } else {
          className +=
            "border-[var(--border-default)] bg-transparent text-[var(--text-low)] hover:border-[var(--border-hover)] hover:text-[var(--text-mid)]";
        }

        return (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              onChange(i);
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
            className={className}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
