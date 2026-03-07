"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface SubTabsProps {
  tabs: { label: string; href: string }[];
}

export function SubTabs({ tabs }: SubTabsProps) {
  const pathname = usePathname();
  const visible = useScrollDirection();

  return (
    <nav
      className={`sticky top-10 lg:top-0 z-40 flex gap-6 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 pt-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-b-2 border-[var(--accent-default)] text-[var(--text-high)]"
                : "text-[var(--text-mid)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
