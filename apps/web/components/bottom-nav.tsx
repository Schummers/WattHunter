"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Gavel, Users, Medal, Trophy, type LucideIcon } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { isClassic, type LeagueMode } from "@/lib/league-mode";

export type NavTabKey = "home" | "auction" | "team" | "budget" | "ranking" | "achievements";

interface NavTab {
  key: NavTabKey;
  label: string;
  icon: LucideIcon;
  href: (leagueId: string) => string;
}

const tabs: NavTab[] = [
  { key: "home",         label: "Home",         icon: House,   href: (id) => `/league/${id}` },
  { key: "auction",      label: "Auction",      icon: Gavel,   href: (id) => `/league/${id}/auction` },
  { key: "team",         label: "Team",         icon: Users,   href: (id) => `/league/${id}/team` },
  { key: "achievements", label: "Palmares",     icon: Medal,   href: (id) => `/league/${id}/achievements` },
  { key: "ranking",      label: "Ranking",      icon: Trophy,  href: (id) => `/league/${id}/ranking` },
];

interface BottomNavProps {
  leagueId: string;
  unlockedTabs: NavTabKey[];
  mode?: LeagueMode;
}

export function BottomNav({ leagueId, unlockedTabs, mode }: BottomNavProps) {
  const pathname = usePathname();
  const visible = useScrollDirection();

  const visibleTabs = isClassic(mode)
    ? tabs.filter((t) => t.key !== "budget")
    : tabs;

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] pt-2 pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-around">
        {visibleTabs.map((tab) => {
          const href = tab.href(leagueId);
          const isActive =
            tab.key === "home"
              ? pathname === href
              : pathname.startsWith(href);
          const isUnlocked = unlockedTabs.includes(tab.key);

          if (!isUnlocked) {
            return (
              <div
                key={tab.key}
                className="relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[var(--text-ghost)]"
              >
                <tab.icon size={20} />
                <span className="text-[length:var(--type-nav)] font-medium">{tab.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={tab.key}
              href={href}
              className={`relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 ${
                isActive ? "text-[var(--accent-default)]" : "text-[var(--text-low)]"
              }`}
            >
              <tab.icon size={20} />
              {isActive && (
                <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--accent-default)]" />
              )}
              <span className="text-[length:var(--type-nav)] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
