// Server component: fetches active boost and renders the banner if any.
// Kept as a separate file so the banner is easy to mount/unmount in the page.

import { RemontadaBoostBanner } from "@/components/remontada-boost-banner";
import { getActiveRemontadaBoost, type RemontadaBoost } from "@/lib/remontada";

type Props = {
  teamId: string;
  gtIdentifier: RemontadaBoost["gt_identifier"];
  currentStageNumber: number;
};

export async function RemontadaBannerSlot({
  teamId,
  gtIdentifier,
  currentStageNumber,
}: Props) {
  const boost = await getActiveRemontadaBoost(
    teamId,
    gtIdentifier,
    currentStageNumber,
  );
  if (!boost) return null;
  return (
    <RemontadaBoostBanner
      stagesRemaining={boost.stages_remaining}
      multiplier={boost.multiplier}
      overtakenTeamName={boost.overtaken_team_name}
    />
  );
}
