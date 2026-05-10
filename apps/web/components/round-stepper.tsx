"use client";

import { Fragment } from "react";
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";

export interface StepperRound {
  number: number;
  status: "open" | "scheduled" | "closed" | "resolving";
  opens_at: string;
}

interface RoundStepperProps {
  rounds: StepperRound[];
}

export function RoundStepper({ rounds }: RoundStepperProps) {
  const slots = [1, 2, 3].map((n) => rounds.find((r) => r.number === n) ?? null);

  return (
    <div className="mx-4 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] px-4 py-2.5">
      <div className="flex items-center justify-between">
        {slots.map((slot, i) => {
          const roundNum = i + 1;
          const isClosed = slot?.status === "closed";
          const isActive = slot?.status === "open" || slot?.status === "resolving";
          const isScheduled = slot?.status === "scheduled";

          return (
            <Fragment key={roundNum}>
              <div className="flex items-center gap-1.5">
                {isClosed ? (
                  <CheckCircleIcon
                    weight="fill"
                    size={14}
                    className="shrink-0 text-[var(--text-mid)]"
                  />
                ) : isActive ? (
                  <CircleIcon
                    weight="fill"
                    size={14}
                    className="shrink-0 text-[var(--accent-default)]"
                  />
                ) : (
                  <CircleIcon
                    weight="regular"
                    size={14}
                    className={`shrink-0 ${slot ? "text-[var(--text-mid)]" : "text-[var(--text-ghost)]"}`}
                  />
                )}

                <span
                  className={`text-[length:var(--type-caption)] font-medium ${
                    isActive
                      ? "text-[var(--accent-default)]"
                      : isClosed || isScheduled
                        ? "text-[var(--text-mid)]"
                        : "text-[var(--text-ghost)]"
                  }`}
                >
                  Round {roundNum}
                </span>
              </div>

              {i < 2 && (
                <span className="text-[length:var(--type-micro)] text-[var(--text-ghost)]">
                  →
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
