import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TopBarProps {
  title: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
}

export function TopBar({ title, userDisplayName, userAvatarUrl }: TopBarProps) {
  const initials = userDisplayName
    ? userDisplayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-8">
      <h1 className="text-sm font-medium text-foreground">{title}</h1>
      <Avatar className="size-8">
        {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userDisplayName ?? ""} />}
        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
