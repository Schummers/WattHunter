"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";
import { launchFirstAuction } from "./actions";

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
  const [copied, setCopied] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canLaunch = memberCount >= 1;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(league.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    const result = await launchFirstAuction(league.id);
    if (result?.error) {
      setError(result.error);
      setLaunching(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            {league.name}
          </h2>
          <Badge variant="secondary">En attente</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {memberCount}/{league.max_players} joueurs
        </p>
      </div>

      <div className="my-6 border-b border-border" />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">
          Code d&apos;invitation
        </p>
        <div className="flex items-center gap-3">
          <code className="rounded-md bg-muted px-4 py-2 text-lg font-semibold tracking-widest text-foreground">
            {league.invite_code}
          </code>
          <Button variant="ghost" size="sm" onClick={handleCopyCode}>
            <Icon
              icon={copied ? "solar:check-circle-linear" : "solar:copy-linear"}
              className="size-4"
            />
            {copied ? "Copie" : "Copier"}
          </Button>
        </div>
      </div>

      <div className="my-6 border-b border-border" />

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-foreground">Joueurs</p>
        <div className="flex flex-col">
          {members.map((member) => {
            const name = member.users?.display_name ?? "Joueur";
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
              >
                <Avatar className="size-8">
                  {member.users?.avatar_url && (
                    <AvatarImage
                      src={member.users.avatar_url}
                      alt={name}
                    />
                  )}
                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">{name}</span>
                {member.user_id === league.commissioner_id && (
                  <Badge variant="outline" className="ml-auto">
                    Commissaire
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isCommissioner && (
        <>
          <div className="my-6 border-b border-border" />
          <div className="flex flex-col gap-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="brand"
              className="w-full"
              disabled={!canLaunch || launching}
              onClick={handleLaunch}
            >
              {launching ? "Lancement..." : "Lancer la premiere enchere"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
