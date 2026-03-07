"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Users,
  BadgeEuro,
  Trophy,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  key: "home" | "team" | "budget" | "ranking";
  label: string;
  icon: LucideIcon;
  href: (leagueId: string) => string;
  subItems?: { label: string; href: (leagueId: string) => string }[];
}

const navItems: NavItem[] = [
  { key: "home", label: "Home", icon: House, href: (id) => `/league/${id}` },
  {
    key: "team",
    label: "Team",
    icon: Users,
    href: (id) => `/league/${id}/team`,
    subItems: [
      { label: "My Team", href: (id) => `/league/${id}/team` },
      { label: "Recruts", href: (id) => `/league/${id}/team/recruts` },
    ],
  },
  { key: "budget", label: "Budget", icon: BadgeEuro, href: (id) => `/league/${id}/budget` },
  { key: "ranking", label: "Ranking", icon: Trophy, href: (id) => `/league/${id}/ranking` },
];

interface SidebarProps {
  leagueId: string;
  leagueName: string;
  unlockedTabs: ("home" | "team" | "budget" | "ranking")[];
}

export function Sidebar({ leagueId, leagueName, unlockedTabs }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-[220px] lg:flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Image
          src="/watthunter-icon.svg"
          alt="WattHunter"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span className="text-sm font-bold text-[var(--text-high)]">WattHunter</span>
      </div>
      <div className="px-4 pb-4">
        <span className="text-xs text-[var(--text-low)]">{leagueName}</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const href = item.href(leagueId);
          const isActive =
            item.key === "home"
              ? pathname === href
              : pathname.startsWith(href);
          const isUnlocked = unlockedTabs.includes(item.key);

          if (!isUnlocked) {
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-ghost)]"
              >
                <item.icon size={16} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
              </div>
            );
          }

          return (
            <div key={item.key}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent-default)]/10 text-[var(--accent-default)]"
                    : "text-[var(--text-mid)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
                )}
              >
                <item.icon size={16} className="shrink-0" />
                {item.label}
              </Link>
              {/* Sub-items when active */}
              {isActive && item.subItems && (
                <div className="ml-7 mt-1 flex flex-col gap-0.5">
                  {item.subItems.map((sub) => {
                    const subHref = sub.href(leagueId);
                    const isSubActive = pathname === subHref;
                    return (
                      <Link
                        key={subHref}
                        href={subHref}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm transition-colors",
                          isSubActive
                            ? "text-[var(--accent-default)] font-medium"
                            : "text-[var(--text-mid)] hover:text-[var(--text-high)]"
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
        >
          <Settings size={16} className="shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
