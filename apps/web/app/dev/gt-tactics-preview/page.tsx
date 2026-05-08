import { TacticsPreviewClient } from "./preview-client";

/**
 * Wireframe preview for GT Tactics — section "Team Tactics"
 *
 * Route: /dev/gt-tactics-preview
 * Purpose: validate visual design + interaction flow before implementation.
 * No backend, no auth, all data is mocked client-side.
 *
 * See: docs/plans/2026-05-08-gt-tactics-design.md
 */
export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg-app)]">
      <TacticsPreviewClient />
    </main>
  );
}
