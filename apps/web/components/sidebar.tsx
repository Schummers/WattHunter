"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Zap,
  Users,
  BadgeEuro,
  Trophy,
  Shield,
  Handshake,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

function getNavItems(leagueId: string): NavItem[] {
  return [
    { label: "Tableau de bord", href: `/league/${leagueId}`, icon: House },
    { label: "Encheres", href: `/league/${leagueId}/auctions`, icon: Zap },
    { label: "Mon equipe", href: `/league/${leagueId}/team`, icon: Users },
    { label: "Tresorerie", href: `/league/${leagueId}/treasury`, icon: BadgeEuro },
    { label: "Classement", href: `/league/${leagueId}/standings`, icon: Trophy },
    { label: "Politiques", href: `/league/${leagueId}/policies`, icon: Shield },
    { label: "Sponsors", href: `/league/${leagueId}/sponsors`, icon: Handshake },
  ];
}

export function Sidebar({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const navItems = getNavItems(leagueId);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-wh-surface">
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold text-foreground">WattHunter</span>
      </div>

      <div className="border-b border-border" />

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === `/league/${leagueId}`
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-wh-accent-muted text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-b border-border" />

      <div className="p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4 shrink-0" />
          Parametres
        </Link>
      </div>
    </aside>
  );
}
