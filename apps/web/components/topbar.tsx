"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings, ChevronDown } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface TopBarProps {
  leagueName: string;
  hasMultipleLeagues?: boolean;
  settingsHref: string;
  onLeagueSwitch?: () => void;
}

export function TopBar({
  leagueName,
  hasMultipleLeagues,
  settingsHref,
  onLeagueSwitch,
}: TopBarProps) {
  const visible = useScrollDirection();

  return (
    <header
      className={`sticky top-0 z-50 flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <button
        type="button"
        onClick={onLeagueSwitch}
        className="flex items-center gap-1.5 truncate"
        disabled={!hasMultipleLeagues}
      >
        <Image
          src="/watthunter-icon.svg"
          alt="WattHunter"
          width={20}
          height={20}
          className="shrink-0"
        />
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

      <Link href={settingsHref} className="flex items-center justify-center">
        <Settings size={20} className="text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors" />
      </Link>
    </header>
  );
}
