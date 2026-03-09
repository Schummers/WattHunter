"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { POLICY_TYPES, getMaxActivePolicies } from "@/lib/policies";

const PolicyInputSchema = z.object({
  slug: z.string(),
  isActive: z.boolean(),
  config: z.record(z.string(), z.string()).nullable(),
});

const SavePoliciesSchema = z.object({
  teamId: z.string().uuid(),
  leagueId: z.string().uuid(),
  policies: z.array(PolicyInputSchema),
});

export async function savePolicies(
  teamId: string,
  leagueId: string,
  policies: { slug: string; isActive: boolean; config: Record<string, string> | null }[]
): Promise<{ success?: boolean; error?: string }> {
  // Zod validation
  const parsed = SavePoliciesSchema.safeParse({ teamId, leagueId, policies });
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated." };
  }

  // Verify team ownership
  const { data: team } = await supabase
    .from("teams")
    .select("id, level, user_id")
    .eq("id", teamId)
    .single();

  if (!team || team.user_id !== user.id) {
    return { error: "Not authorized." };
  }

  const level = team.level ?? 1;

  // Validate level unlocks and max active count
  const activePolicies = policies.filter((p) => p.isActive);
  const maxActive = getMaxActivePolicies(level);

  if (activePolicies.length > maxActive) {
    return { error: `You can only have ${maxActive} active policies at your level.` };
  }

  for (const policy of activePolicies) {
    const policyType = POLICY_TYPES.find((pt) => pt.slug === policy.slug);
    if (!policyType) {
      return { error: `Unknown policy type: ${policy.slug}` };
    }
    if (level < policyType.unlockLevel) {
      return { error: `${policyType.name} requires level ${policyType.unlockLevel}.` };
    }
  }

  // Get policy IDs from DB
  const { data: dbPolicies } = await supabase
    .from("policies")
    .select("id, slug");

  if (!dbPolicies) {
    return { error: "Failed to fetch policies." };
  }

  const slugToId: Record<string, string> = {};
  for (const p of dbPolicies) {
    slugToId[p.slug] = p.id;
  }

  // Upsert each policy
  for (const policy of policies) {
    const policyId = slugToId[policy.slug];
    if (!policyId) continue;

    const { error } = await supabase
      .from("team_policies")
      .upsert(
        {
          team_id: teamId,
          policy_id: policyId,
          is_active: policy.isActive,
          config: policy.config,
        },
        { onConflict: "team_id,policy_id" }
      );

    if (error) {
      return { error: `Failed to save ${policy.slug}: ${error.message}` };
    }
  }

  revalidatePath(`/league/${leagueId}/team`);
  revalidatePath(`/league/${leagueId}/team/policies`);

  return { success: true };
}
