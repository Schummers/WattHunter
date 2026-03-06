"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Zap, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TopBarProps {
  leagueName: string;
  hasMultipleLeagues?: boolean;
  userAvatarUrl?: string | null;
  userInitials: string;
  settingsHref: string;
  onLeagueSwitch?: () => void;
}

export function TopBar({
  leagueName,
  hasMultipleLeagues,
  userAvatarUrl,
  userInitials,
  settingsHref,
  onLeagueSwitch,
}: TopBarProps) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    function handleScroll() {
      if (!main) return;
      const currentY = main.scrollTop;
      if (currentY > lastScrollY.current && currentY > 32) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    }

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 flex h-8 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <button
        type="button"
        onClick={onLeagueSwitch}
        className="flex items-center gap-1.5 truncate"
        disabled={!hasMultipleLeagues}
      >
        <Zap size={16} className="shrink-0 text-[var(--accent-highlight)]" />
        <span className="text-sm font-semibold text-[var(--text-high)]">
          WattHunter
        </span>
        <span className="truncate text-sm text-[var(--text-low)]">
          {leagueName}
        </span>
        {hasMultipleLeagues && (
          <ChevronDown size={12} className="shrink-0 text-[var(--text-low)]" />
        )}
      </button>

      <Link href={settingsHref}>
        <Avatar className="h-6 w-6" size="sm">
          {userAvatarUrl && (
            <AvatarImage src={userAvatarUrl} alt="User avatar" />
          )}
          <AvatarFallback className="bg-[var(--bg-surface)] text-[9px] text-[var(--text-mid)]">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
