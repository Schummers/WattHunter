"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackHeaderProps {
  label: string;
  onBack?: () => void;
}

export function BackHeader({ label, onBack }: BackHeaderProps) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-40 bg-[var(--bg-app)]">
      <button
        onClick={() => (onBack ? onBack() : router.back())}
        className="flex min-h-10 items-center gap-2 px-4 py-2 text-[length:var(--type-emphasis)] font-semibold text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft size={18} />
        {label}
      </button>
    </div>
  );
}
