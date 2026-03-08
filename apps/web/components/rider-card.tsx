"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RiderCardProps {
  rider: {
    id: string;
    name: string;
    nationality_flag?: string;
    team_name?: string;
    pcs_rank?: number;
    photo_url?: string | null;
  };
  xp?: number;
  boostPct?: number;
  bidState?: "active" | "outbid" | "not-accepted" | "none";
  outbidMessage?: string;
  isOpenSlot?: boolean;
  href?: string;
  rightContent?: React.ReactNode;
}

function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RiderCard({
  rider,
  xp,
  boostPct,
  bidState = "none",
  outbidMessage,
  isOpenSlot,
  href,
  rightContent,
}: RiderCardProps) {
  const isMuted = bidState === "outbid" || bidState === "not-accepted";

  if (isOpenSlot) {
    const inner = (
      <div className={`relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] transition-colors ${href ? "hover:bg-[var(--bg-subtle)]" : ""}`}>
        {/* Avatar placeholder */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)]">
            <Plus size={16} className="text-[var(--text-ghost)]" />
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-[var(--text-ghost)]">
            Open slot
          </span>
        </div>

        {/* Chevron */}
        {href && (
          <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)]" />
        )}
      </div>
    );

    if (href) {
      return <Link href={href}>{inner}</Link>;
    }
    return inner;
  }

  const bgClass =
    bidState === "active"
      ? "bg-[var(--bg-surface-hover)]"
      : "";

  const inner = (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] transition-colors ${bgClass} ${
        isMuted ? "opacity-60" : ""
      } ${href ? "hover:bg-[var(--bg-subtle)]" : ""}`}
    >
      {/* Avatar + PCS rank overlay */}
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          {rider.photo_url && (
            <AvatarImage src={resolvePhotoUrl(rider.photo_url)} alt={rider.name} referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="bg-[var(--bg-surface)] text-xs text-[var(--text-mid)]">
            {getInitials(rider.name)}
          </AvatarFallback>
        </Avatar>
        {rider.pcs_rank != null && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">
            #{rider.pcs_rank}
          </span>
        )}
      </div>

      {/* Name + team */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-[var(--text-high)] truncate">
            {rider.name}
          </span>
          {rider.nationality_flag && (
            <span className="shrink-0">{rider.nationality_flag}</span>
          )}
          {boostPct != null && boostPct > 0 && (
            <span className="shrink-0 bg-[var(--bg-surface)] text-[var(--text-high)] text-[9px] font-bold rounded-lg px-1.5 py-0.5">
              +{boostPct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rider.team_name && (
            <span className="text-xs text-[var(--text-mid)] truncate">
              {rider.team_name}
            </span>
          )}
          {bidState === "outbid" && outbidMessage && (
            <span className="text-xs text-[var(--text-mid)] truncate">
              {outbidMessage}
            </span>
          )}
        </div>
      </div>

      {/* Right side: XP or custom content */}
      {rightContent ? (
        <div className="shrink-0">{rightContent}</div>
      ) : xp != null ? (
        <div className="flex flex-col items-end shrink-0">
          <span className="text-base font-bold font-mono text-[var(--text-high)]">
            {xp.toLocaleString()}
          </span>
          <span className="text-[9px] text-[var(--text-low)]">XP</span>
        </div>
      ) : null}

      {/* Chevron */}
      {href && (
        <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)] group-hover:text-[var(--accent-default)] transition-colors" />
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="group">{inner}</Link>;
  }
  return inner;
}
