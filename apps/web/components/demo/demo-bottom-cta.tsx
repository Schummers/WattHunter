"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useDemo } from "@/contexts/demo-context";

export function DemoBottomCta() {
  const { isDemo } = useDemo();
  // useScrollDirection returns `true` when visible (scrolling up / at top),
  // `false` when scrolling down — hide the CTA when scrolling down.
  const visible = useScrollDirection();
  if (!isDemo) return null;
  return (
    <div
      data-testid="demo-bottom-cta"
      className={[
        "fixed inset-x-0 bottom-16 z-20 px-4 transition-transform duration-200 lg:hidden",
        !visible ? "translate-y-[120%]" : "translate-y-0",
      ].join(" ")}
    >
      <Button asChild variant="cta" className="w-full shadow-lg">
        <Link href="/">Create your league</Link>
      </Button>
    </div>
  );
}
