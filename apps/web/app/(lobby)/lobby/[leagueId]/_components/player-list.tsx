import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { LobbyMember } from "../lobby-panels";

export interface PlayerListProps {
  members: LobbyMember[];
  memberCount: number;
  maxPlayers: number;
  commissionerId: string;
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerList({
  members,
  memberCount,
  maxPlayers,
  commissionerId,
}: PlayerListProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Players
        </h2>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
          {memberCount}/{maxPlayers}
        </span>
      </header>

      <ul className="flex flex-col">
        {members.map((member) => {
          const name =
            member.teams?.name ?? member.users?.display_name ?? "Player";
          return (
            <li
              key={member.user_id}
              className="flex items-center gap-3 py-2.5"
            >
              <Avatar className="size-8">
                {member.users?.avatar_url ? (
                  <AvatarImage src={member.users.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback className="bg-[var(--bg-surface)] text-[length:var(--type-caption)] text-[var(--text-mid)]">
                  {initialsFor(name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[length:var(--type-body)] text-[var(--text-high)]">
                {name}
              </span>
              {member.user_id === commissionerId ? (
                <Badge variant="default" className="ml-auto">
                  Race Director
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
