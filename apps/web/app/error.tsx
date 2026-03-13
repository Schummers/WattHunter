"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-[var(--bg-app)] text-[var(--text-high)] flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-[length:var(--type-title)] font-semibold">
            Something went wrong
          </h2>
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--accent-default)] text-[var(--text-high)] text-[length:var(--type-body)] font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
