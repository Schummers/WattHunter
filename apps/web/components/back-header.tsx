"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackHeaderProps {
  label: string;
}

export function BackHeader({ label }: BackHeaderProps) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--text-mid)]"
    >
      <ArrowLeft size={18} />
      {label}
    </button>
  );
}
