import { AchievementBadge } from "@/components/achievement-badge";
import type { EquippedEmblem } from "@/lib/palmares/identity";

/**
 * The badge a player carries in a list row, with initials as the reserve when
 * nothing is equipped — the same reserve the rider avatar uses without a photo.
 *
 * One component for the Ranking row and the Palmares champion row: the two
 * screens must read as one product, and they drifted apart the first time the
 * markup was copied.
 */
export function PlayerEmblem({
  emblem,
  name,
  size,
  dashed = false,
}: {
  emblem: EquippedEmblem | null | undefined;
  name: string;
  size: number;
  /** Dashed reserve, for a season still being played. */
  dashed?: boolean;
}) {
  if (emblem) {
    return <AchievementBadge badgeUrl={emblem.badgeUrl} tier={emblem.tier} size={size} locked={false} />;
  }

  return (
    <div
      className={`flex items-center justify-center rounded-md border text-[length:var(--type-micro)] text-[var(--text-low)] ${
        dashed ? "border-dashed" : ""
      } border-[var(--border-default)] bg-[var(--bg-surface)]`}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
