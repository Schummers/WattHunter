"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Users,
  BadgeEuro,
  Trophy,
  Settings,
  CircleHelp,
  ChevronDown,
  Check,
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
      { label: "Market", href: (id) => `/league/${id}/team/market` },
    ],
  },
  { key: "budget", label: "Budget", icon: BadgeEuro, href: (id) => `/league/${id}/budget` },
  { key: "ranking", label: "Ranking", icon: Trophy, href: (id) => `/league/${id}/ranking` },
];

interface League {
  id: string;
  name: string;
}

interface SidebarProps {
  leagueId: string;
  leagueName: string;
  leagues: League[];
  unlockedTabs: ("home" | "team" | "budget" | "ranking")[];
}

export function Sidebar({ leagueId, leagueName, leagues, unlockedTabs }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasMultiple = leagues.length > 1;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <aside className="hidden lg:flex lg:w-[180px] lg:flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <Image
          src="/watthunter-icon.svg"
          alt="WattHunter"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">WattHunter</span>
      </div>

      {/* League switcher */}
      <div className="relative px-4 pb-4" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => hasMultiple && setOpen(!open)}
          disabled={!hasMultiple}
          className="flex items-center gap-1 text-[length:var(--type-caption)] text-[var(--text-low)] hover:text-[var(--text-mid)] transition-colors"
        >
          <span className="truncate">{leagueName}</span>
          {hasMultiple && (
            <ChevronDown
              size={10}
              className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {open && (
          <div className="absolute left-4 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-lg">
            {leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (league.id !== leagueId) {
                    router.push(`/league/${league.id}`);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[length:var(--type-body)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                <span
                  className={`truncate ${
                    league.id === leagueId
                      ? "font-medium text-[var(--accent-default)]"
                      : "text-[var(--text-high)]"
                  }`}
                >
                  {league.name}
                </span>
                {league.id === leagueId && (
                  <Check size={14} className="ml-auto shrink-0 text-[var(--accent-default)]" />
                )}
              </button>
            ))}
          </div>
        )}
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
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-ghost)]"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[length:var(--type-body)] font-medium transition-colors",
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
                          "rounded-lg px-3 py-1.5 text-[length:var(--type-body)] transition-colors",
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

      {/* Help + Settings at bottom */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <Link
          href={`/league/${leagueId}/help`}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
        >
          <CircleHelp size={16} className="shrink-0" />
          Help
        </Link>
        <Link
          href={`/league/${leagueId}/settings`}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)]"
        >
          <Settings size={16} className="shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
