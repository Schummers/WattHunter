"use client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModalShell({
  children,
  footer,
  onClose,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] lg:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-[var(--radius-lg)] bg-[var(--bg-surface)] lg:max-w-md lg:rounded-[var(--radius-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalHeader({
  icon,
  title,
  subtitle,
  subtitleMono,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  subtitleMono?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        {icon}
        <div className="flex flex-col">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            {title}
          </h2>
          {subtitle && (
            <span
              className={cn(
                "text-[length:var(--type-caption)] text-[var(--text-low)]",
                subtitleMono && "font-mono tabular-nums"
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 text-[var(--text-low)] hover:text-[var(--text-high)]"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export function ModalActions({
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
