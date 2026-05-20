"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LeagueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("League error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-[length:var(--type-page-title)] font-semibold">
          Something went wrong
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-default)] text-[var(--text-high)] text-[length:var(--type-body)] font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/league/choose")}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-mid)] text-[length:var(--type-body)] font-medium hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Back to leagues
          </button>
        </div>
      </div>
    </div>
  );
}
