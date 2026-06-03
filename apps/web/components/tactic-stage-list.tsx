"use client";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import type { GtStage, StageProfileIcon } from "@/lib/gt-stages";

interface Props {
  stages: GtStage[];
  value: string;
  onChange: (v: string) => void;
  fillParent?: boolean;
  /**
   * If set, stages whose `profileIcon` is NOT in the set are rendered
   * disabled and dimmed. Used by Nemesis tactic placement:
   * Nemesis Sprint → {p1,p2,p3}, Nemesis GC → {p3,p4,p5}.
   * Stages without a known profile (`profileIcon == null`) are also disabled
   * when `requiredProfiles` is set — the server-side gate would reject them.
   */
  requiredProfiles?: Set<StageProfileIcon>;
  /**
   * If true, stages whose `stageType` is `"ITT"` or `"TTT"` are disabled and
   * surface a "Time trial" label. Mirrors the server-side gate in
   * `place_tactic` v4 which rejects Nemesis Sprint / Nemesis GC / Overdrive
   * on time trials (no peloton or echappée dynamics).
   */
  blockTimeTrials?: boolean;
}

export function StageList({
  stages,
  value,
  onChange,
  fillParent,
  requiredProfiles,
  blockTimeTrials,
}: Props) {
  return (
    <div
      className={cn(
        "overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]",
        fillParent ? "min-h-0 flex-1" : "max-h-[224px]"
      )}
    >
      <div className="flex flex-col">
        {stages.map((s, i) => {
          const isSelected = value === s.slug;
          const isLocked = !!s.hasTacticActive;
          const isCutoffLocked = s.status === "today" && !!s.isTodayCutoffPassed;
          const isProfileMismatch =
            !!requiredProfiles && (!s.profileIcon || !requiredProfiles.has(s.profileIcon));
          const isTimeTrial = s.stageType === "ITT" || s.stageType === "TTT";
          const isTimeTrialBlocked = !!blockTimeTrials && isTimeTrial;
          const isDisabled =
            isLocked || isCutoffLocked || isProfileMismatch || isTimeTrialBlocked;
          const isToday = s.status === "today";
          const isFirst = i === 0;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => !isDisabled && onChange(isSelected ? "" : s.slug)}
              disabled={isDisabled}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                !isFirst && "border-t border-[var(--border-subtle)]",
                isSelected && !isDisabled && "bg-[var(--badge-bg)]",
                !isSelected && !isDisabled && "hover:bg-[var(--bg-surface-hover)]",
                isDisabled && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                    : "border-[var(--border-default)] bg-transparent"
                )}
              >
                {isSelected && (
                  <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="font-mono text-[length:var(--type-emphasis)] font-bold tabular-nums text-[var(--text-high)]">
                  Stage {s.number}
                </span>
                <span className="font-mono text-[length:var(--type-caption)] tabular-nums text-[var(--text-low)]">
                  {s.date}
                </span>
              </div>
              {s.profileIcon && (
                <Tag
                  variant="highlighted"
                  className="text-[length:var(--type-micro)]"
                  data-testid={`profile-chip-${s.slug}`}
                  aria-label={`Profile ${s.profileIcon}`}
                >
                  {s.profileIcon}
                </Tag>
              )}
              {isTimeTrial && (
                <Tag
                  variant="highlighted"
                  className="text-[length:var(--type-micro)]"
                  data-testid={`tt-badge-${s.slug}`}
                  aria-label={`${s.stageType} time trial`}
                >
                  {s.stageType}
                </Tag>
              )}
              {isToday && !isLocked && !isCutoffLocked && !isProfileMismatch && !isTimeTrialBlocked && (
                <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
                  Today
                </Tag>
              )}
              {isCutoffLocked && !isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Cutoff
                </span>
              )}
              {isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Tactic set
                </span>
              )}
              {isProfileMismatch && !isLocked && !isCutoffLocked && (
                <span
                  className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]"
                  data-testid={`profile-mismatch-${s.slug}`}
                >
                  Wrong profile
                </span>
              )}
              {isTimeTrialBlocked && !isLocked && !isCutoffLocked && !isProfileMismatch && (
                <span
                  className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]"
                  data-testid={`tt-blocked-${s.slug}`}
                >
                  Time trial
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
