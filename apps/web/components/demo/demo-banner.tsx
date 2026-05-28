"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/contexts/demo-context";

export function DemoBanner() {
  const { isDemo, registerPulseTarget } = useDemo();
  if (!isDemo) return null;
  return (
    <div
      ref={(el) => registerPulseTarget(el)}
      data-testid="demo-banner"
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5 transition-shadow"
    >
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        You&apos;re exploring a demo league.
      </span>
      <Button asChild variant="cta" size="sm">
        <Link href="/">Get Started</Link>
      </Button>
    </div>
  );
}
