"use client";

import { RailLink } from "@/components/rail-link";
import { ChevronRight, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MovementTag } from "@/components/movement-tag";

interface RiderCardProps {
  rider: {
    id: string;
    name: string;
    nationality_flag?: string;
    team_name?: string;
    pcs_rank?: number;
    pcs_rank_diff?: number | null;
    photo_url?: string | null;
  };
  xp?: number;
  boostPct?: number;
  bidState?: "active" | "outbid" | "not-accepted" | "none";
  outbidMessage?: string;
  isOpenSlot?: boolean;
  href?: string;
  onNavigate?: () => void;
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
  onNavigate,
  rightContent,
}: RiderCardProps) {
  const isMuted = bidState === "outbid" || bidState === "not-accepted";

  if (isOpenSlot) {
    const inner = (
      <div className={`relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] transition-colors ${href ? "hover:bg-[var(--bg-surface-hover)]" : ""}`}>
        {/* Avatar placeholder */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-[var(--border-default)]">
            <Plus size={16} className="text-[var(--text-ghost)]" />
          </div>
        </div>

        {/* Text */}
        <div className="flex flex-1 flex-col">
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-ghost)]">
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
      return <RailLink href={href}>{inner}</RailLink>;
    }
    return inner;
  }

  const hasBid = bidState === "active" || bidState === "outbid";
  const bgClass = "";

  const hoverClass = !href ? "" : "hover:bg-[var(--bg-surface-hover)]";

  // Avatar + name area — clickable when onNavigate is set
  const avatarAndName = (
    <>
      {/* Avatar + PCS rank overlay */}
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9">
          {rider.photo_url && (
            <AvatarImage src={resolvePhotoUrl(rider.photo_url)} alt={rider.name} referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="bg-[var(--bg-surface)] text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {getInitials(rider.name)}
          </AvatarFallback>
        </Avatar>
        {rider.pcs_rank != null && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[length:var(--type-micro)] font-semibold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">
            #{rider.pcs_rank}
          </span>
        )}
      </div>

      {/* Name + team */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
            {rider.name}
          </span>
          {onNavigate && (
            <span className="shrink-0 text-[length:var(--type-caption)] text-[var(--text-ghost)] group-hover/nav:text-[var(--accent-default)] transition-colors">›</span>
          )}
          {rider.nationality_flag && (
            <span className="shrink-0 text-[length:var(--type-caption)]">{rider.nationality_flag}</span>
          )}
          {rider.pcs_rank_diff != null && (
            <MovementTag movement={rider.pcs_rank_diff} />
          )}
          {boostPct != null && boostPct > 0 && (
            <span className="shrink-0 bg-[var(--badge-bg)] text-[var(--accent-highlight)] text-[length:var(--type-micro)] font-semibold rounded-[var(--radius-pill)] px-1.5 py-0.5">
              +{boostPct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rider.team_name && (
            <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)] truncate">
              {rider.team_name}
            </span>
          )}
          {bidState === "outbid" && outbidMessage && (
            <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)] truncate">
              {outbidMessage}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const inner = (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] transition-colors ${bgClass} ${
        isMuted ? "opacity-60" : ""
      } ${hoverClass}`}
    >
      {onNavigate ? (
        // Clickable avatar+name area only
        <button
          type="button"
          onClick={onNavigate}
          className="group/nav flex flex-1 items-center gap-3 min-w-0 text-left cursor-pointer"
        >
          {avatarAndName}
        </button>
      ) : (
        // Full-card mode (href) or non-clickable: render inline
        avatarAndName
      )}

      {/* Right side: XP or custom content */}
      {rightContent ? (
        <div className="shrink-0">{rightContent}</div>
      ) : xp != null ? (
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[length:var(--type-stat-small)] font-bold font-mono text-[var(--text-high)]">
            {xp.toLocaleString()}
          </span>
          <span className="text-[length:var(--type-micro)] font-semibold text-[var(--text-low)]">XP</span>
        </div>
      ) : null}

      {/* Far-right chevron — only for href (full-card link), not onNavigate */}
      {href && !onNavigate && (
        <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)] group-hover:text-[var(--accent-default)] transition-colors" />
      )}
    </div>
  );

  if (href) {
    return <RailLink href={href} className="group">{inner}</RailLink>;
  }
  return inner;
}
