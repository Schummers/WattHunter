"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";

interface EmailConfirmationBannerProps {
  email: string | null;
  isConfirmed: boolean;
}

export function EmailConfirmationBanner({
  email,
  isConfirmed,
}: EmailConfirmationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (isConfirmed || !email || dismissed) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2">
      <Mail className="size-4 shrink-0 text-[var(--text-mid)]" />
      <p className="flex-1 text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Confirm your email{" "}
        <span className="text-[var(--text-high)]">{email}</span> so we can help
        you recover your account if needed.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[var(--text-low)] transition-colors hover:text-[var(--text-mid)]"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
