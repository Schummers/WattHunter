"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CopyInputProps {
  /** Value shown in the read-only input and written to the clipboard. */
  value: string;
  /** aria-label for the read-only input. */
  label: string;
  /** aria-label for the copy button. */
  copyButtonLabel: string;
  /**
   * When true, renders the value with the centered mono treatment used for
   * short invite codes. Defaults to the URL/truncated body treatment.
   */
  mono?: boolean;
  /** How long the check-icon confirmation stays visible after a copy. */
  copiedFeedbackMs?: number;
  /** Optional className merged onto the wrapping row. */
  className?: string;
}

/**
 * Read-only input paired with a clipboard-copy button. The button icon flips
 * to a check for `copiedFeedbackMs` after a successful write. Clipboard
 * rejections (insecure context, denied permission) are swallowed silently —
 * the user can still select-all in the input and copy manually.
 */
export function CopyInput({
  value,
  label,
  copyButtonLabel,
  mono = false,
  copiedFeedbackMs = 2000,
  className,
}: CopyInputProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (insecure context or permission denied).
      // The user can still select-all in the read-only input and copy manually.
      return;
    }
    setCopied(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, copiedFeedbackMs);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        readOnly
        value={value}
        aria-label={label}
        onClick={(e) => (e.target as HTMLInputElement).select()}
        className={cn(
          "flex-1",
          mono
            ? "text-center font-mono text-[length:var(--type-section)] font-semibold tracking-widest text-[var(--text-high)]"
            : "truncate text-[length:var(--type-body)] text-[var(--text-mid)]",
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label={copyButtonLabel}
        onClick={handleCopy}
      >
        {copied ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
