"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, CheckCircle } from "lucide-react";
import { launchFirstAuction } from "./actions";

function getDefaultDates(): string[] {
  const dates = [];
  for (let i = 1; i <= 3; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface LobbyViewProps {
  league: {
    id: string;
    name: string;
    invite_code: string;
    commissioner_id: string;
    max_players: number;
  };
  members: Array<{
    user_id: string;
    users: { display_name: string; avatar_url: string | null } | null;
    teams: { name: string } | null;
  }>;
  memberCount: number;
  isCommissioner: boolean;
}

export function LobbyView({
  league,
  members,
  memberCount,
  isCommissioner,
}: LobbyViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundDates, setRoundDates] = useState(getDefaultDates);
  const canLaunch = memberCount >= 1;

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/league/join?code=${league.invite_code}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(league.invite_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRoundDateChange = (index: number, dateStr: string) => {
    setRoundDates((prev) => {
      const next = [...prev];
      next[index] = dateStr;
      return next;
    });
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    const result = await launchFirstAuction(league.id, roundDates);
    if (result?.error) {
      setError(result.error);
      setLaunching(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg pt-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-[var(--text-high)]">
            {league.name}
          </h2>
          <Badge variant="secondary">Pending</Badge>
        </div>
      </div>

      {/* Invite section */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--text-high)]">
          Invite players
        </p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={inviteUrl}
            className="flex-1 truncate text-sm text-[var(--text-mid)]"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopyLink}>
            {copiedLink ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={league.invite_code}
            className="flex-1 text-center text-lg font-semibold tracking-widest"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopyCode}>
            {copiedCode ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="border-b border-[var(--border-subtle)]" />

      {/* Players */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text-high)]">Players</p>
          <span className="text-xs text-[var(--text-low)]">
            {memberCount}/{league.max_players}
          </span>
        </div>
        <div className="flex flex-col">
          {members.map((member) => {
            const name = member.teams?.name ?? member.users?.display_name ?? "Player";
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 py-2.5"
              >
                <Avatar className="size-8">
                  {member.users?.avatar_url && (
                    <AvatarImage
                      src={member.users.avatar_url}
                      alt={name}
                    />
                  )}
                  <AvatarFallback className="bg-[var(--bg-surface)] text-xs text-[var(--text-mid)]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-[var(--text-high)]">{name}</span>
                {member.user_id === league.commissioner_id && (
                  <Badge variant="outline" className="ml-auto">
                    Race Director
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-b border-[var(--border-subtle)]" />

      {/* Auction rounds */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--text-high)]">
          Auction rounds
        </p>

        <div className="flex flex-col gap-2">
          {roundDates.map((dateStr, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              <span className="text-xs font-bold text-[var(--text-mid)] w-16 shrink-0">
                Round {i + 1}
              </span>
              {isCommissioner ? (
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => handleRoundDateChange(i, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--text-high)] outline-none [color-scheme:dark]"
                />
              ) : (
                <span className="flex-1 text-sm text-[var(--text-high)]">
                  {formatDate(dateStr)}
                </span>
              )}
            </div>
          ))}
        </div>

        {!isCommissioner && (
          <p className="text-xs text-[var(--text-low)]">
            The Race Director will set the dates and launch the auction.
          </p>
        )}
      </div>

      {isCommissioner && (
        <div className="flex flex-col gap-3 pb-4">
          {error && <p className="text-sm text-[var(--status-danger)]">{error}</p>}
          <Button
            variant="cta"
            className="w-full"
            disabled={!canLaunch || launching}
            onClick={handleLaunch}
          >
            {launching ? "Launching..." : "Launch first auction"}
          </Button>
        </div>
      )}
    </div>
  );
}
