"use client";

import { useState, useEffect } from "react";

interface ReleaseConfirmModalProps {
  riderName: string;
  contractId: string;
  isPaidPhase: boolean;
  isBlockedThisPhase?: boolean;
  onConfirm: (contractId: string) => void;
  onCancel: () => void;
  error?: string | null;
}

export function ReleaseConfirmModal({
  riderName,
  contractId,
  isPaidPhase,
  isBlockedThisPhase = false,
  onConfirm,
  onCancel,
  error,
}: ReleaseConfirmModalProps) {
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    if (error) setReleasing(false);
  }, [error]);

  function handleConfirm() {
    setReleasing(true);
    onConfirm(contractId);
  }

  function bodyMessage() {
    if (isBlockedThisPhase) {
      return `${riderName} was recruited this phase and cannot be released yet. You can release them starting next phase.`;
    }
    if (isPaidPhase) {
      return `Release ${riderName}? The salary for this phase has already been deducted and will not be refunded.`;
    }
    return `Remove ${riderName} from your roster? No salary has been charged yet for this phase — this release is free.`;
  }

  const isDisabled = releasing || isBlockedThisPhase || !!error;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] px-4 pb-6" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Release rider?
          </p>
          <p className={`mt-1 text-[length:var(--type-body)] ${isBlockedThisPhase ? "text-[var(--status-danger)]" : "text-[var(--text-mid)]"}`}>
            {bodyMessage()}
          </p>
        </div>
        {error && !isBlockedThisPhase && (
          <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={releasing}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-active)] py-2.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDisabled}
            className={`flex-1 rounded-[var(--radius-md)] py-2.5 text-[length:var(--type-emphasis)] font-semibold transition-colors disabled:opacity-50 ${
              isPaidPhase && !isBlockedThisPhase
                ? "border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--status-danger)] hover:bg-[var(--danger-bg)]"
                : "border border-[var(--border-default)] bg-[var(--bg-surface-active)] text-[var(--text-high)] hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            {releasing ? "Releasing..." : "Release"}
          </button>
        </div>
      </div>
    </div>
  );
}
