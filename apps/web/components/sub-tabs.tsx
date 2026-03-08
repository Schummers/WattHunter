"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubTabsProps {
  tabs: { label: string; href: string }[];
}

export function SubTabs({ tabs }: SubTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
      <div className="flex gap-6 px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-1.5 pt-3 text-[length:var(--type-section)] font-semibold transition-colors ${
                isActive
                  ? "border-b-2 border-[var(--accent-default)] text-[var(--text-high)]"
                  : "text-[var(--text-mid)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
