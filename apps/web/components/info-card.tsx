import Link from "next/link";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
}

export function InfoCard({ children, className, href }: InfoCardProps) {
  const base =
    "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/80 backdrop-blur-sm";

  if (href) {
    return (
      <Link href={href} className={cn(base, "block", className)}>
        {children}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{children}</div>;
}
