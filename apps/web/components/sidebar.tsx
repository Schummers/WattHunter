"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

function getNavItems(leagueId: string): NavItem[] {
  return [
    { label: "Tableau de bord", href: `/league/${leagueId}`, icon: "solar:home-2-linear" },
    { label: "Encheres", href: `/league/${leagueId}/auctions`, icon: "solar:bolt-linear" },
    { label: "Mon equipe", href: `/league/${leagueId}/team`, icon: "solar:users-group-rounded-linear" },
    { label: "Tresorerie", href: `/league/${leagueId}/treasury`, icon: "solar:wallet-linear" },
    { label: "Classement", href: `/league/${leagueId}/standings`, icon: "solar:chart-2-linear" },
    { label: "Politiques", href: `/league/${leagueId}/policies`, icon: "solar:target-linear" },
    { label: "Sponsors", href: `/league/${leagueId}/sponsors`, icon: "solar:handshake-linear" },
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
              <Icon icon={item.icon} className="size-4 shrink-0" />
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
          <Icon icon="solar:settings-linear" className="size-4 shrink-0" />
          Parametres
        </Link>
      </div>
    </aside>
  );
}
