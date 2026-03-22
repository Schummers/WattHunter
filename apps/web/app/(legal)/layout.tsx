import Link from "next/link";
import { Zap } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100svh] bg-[var(--bg-app)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[length:var(--type-caption)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
        >
          <Zap className="h-4 w-4 text-[var(--accent-default)]" />
          <span className="font-semibold text-[length:var(--type-emphasis)] text-[var(--text-high)]">
            WattHunter
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
