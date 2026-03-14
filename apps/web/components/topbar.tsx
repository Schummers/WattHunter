"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, CircleHelp, ChevronDown, Check } from "lucide-react";

interface League {
  id: string;
  name: string;
}

interface TopBarProps {
  leagueId: string;
  leagueName: string;
  leagues: League[];
  settingsHref: string;
}

export function TopBar({
  leagueId,
  leagueName,
  leagues,
  settingsHref,
}: TopBarProps) {
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
    <header
      className="relative z-20 flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 lg:hidden"
    >
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => hasMultiple && setOpen(!open)}
          className="flex items-center gap-1.5 truncate"
          disabled={!hasMultiple}
        >
          <Image
            src="/watthunter-icon.svg"
            alt="WattHunter"
            width={20}
            height={20}
            className="shrink-0"
          />
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            WattHunter
          </span>
          <span className="truncate text-[length:var(--type-body)] text-[var(--text-low)]">
            {leagueName}
          </span>
          {hasMultiple && (
            <ChevronDown
              size={12}
              className={`shrink-0 text-[var(--text-low)] transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] py-1 shadow-lg">
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
                  className={
                    league.id === leagueId
                      ? "font-medium text-[var(--accent-default)]"
                      : "text-[var(--text-high)]"
                  }
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

      <div className="flex items-center gap-3">
        <Link href={`/league/${leagueId}/help`} className="flex items-center justify-center">
          <CircleHelp size={20} className="text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors" />
        </Link>
        <Link href={settingsHref} className="flex items-center justify-center">
          <Settings size={20} className="text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors" />
        </Link>
      </div>
    </header>
  );
}
