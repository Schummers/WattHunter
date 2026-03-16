import Link from "next/link";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
}

export function InfoCard({ children, className, href }: InfoCardProps) {
  const base =
    "rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]";

  if (href) {
    return (
      <Link href={href} className={cn(base, "block transition-colors hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-hover)]", className)}>
        {children}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{children}</div>;
}
