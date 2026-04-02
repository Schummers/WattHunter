"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { POLICY_TYPES, getMaxActivePolicies } from "@/lib/policies";
import { getCurrentPhase, getNextPhase, isInAuctionWindow, isLeagueFirstCycle } from "@/lib/phases";

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
): Promise<{ success?: boolean; error?: string; effectivePhaseName?: string; immediate?: boolean }> {
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

  const firstCycle = await isLeagueFirstCycle(supabase, leagueId);
  const immediate = firstCycle;

  // Fetch existing state to project total active policies
  const { data: existingPolicies } = await supabase
    .from("team_policies")
    .select("is_active, pending_is_active, policies(slug)")
    .eq("team_id", teamId);

  const projectedState: Record<string, boolean> = {};

  if (existingPolicies) {
    for (const ep of existingPolicies) {
      const slug = Array.isArray(ep.policies) ? ep.policies[0]?.slug : (ep.policies as any)?.slug;
      if (slug) {
        projectedState[slug] = immediate ? ep.is_active : (ep.pending_is_active ?? ep.is_active);
      }
    }
  }

  // Override with incoming state
  for (const p of policies) {
    projectedState[p.slug] = p.isActive;
  }

  const projectedActiveCount = Object.values(projectedState).filter(Boolean).length;
  const maxActive = getMaxActivePolicies(level);

  if (projectedActiveCount > maxActive) {
    return { error: `You can only have ${maxActive} active policies at your level.` };
  }

  // Validate unlocks for incoming policies
  for (const policy of policies.filter((p) => p.isActive)) {
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

  // Only require nextPhase when not in immediate mode (pending mode)
  const nextPhase = immediate ? null : getNextPhase(getCurrentPhase());
  if (!immediate && !nextPhase) {
    return { error: "Cannot change policies during the last phase of the season." };
  }

  // Note: sponsors and policies are fully decoupled in the new model.
  // No sponsor eligibility guard needed — sponsors are level-gated only.

  // Upsert each policy
  for (const policy of policies) {
    const policyId = slugToId[policy.slug];
    if (!policyId) continue;

    // Check if a row already exists for this team+policy
    const { data: existing } = await supabase
      .from("team_policies")
      .select("id, is_active, config")
      .eq("team_id", teamId)
      .eq("policy_id", policyId)
      .single();

    if (immediate) {
      // IMMEDIATE: write directly to is_active + config, clear any pending state
      if (existing) {
        const sameActive = existing.is_active === policy.isActive;
        const sameConfig = JSON.stringify(existing.config) === JSON.stringify(policy.config);
        if (sameActive && sameConfig) continue;

        const { error } = await supabase
          .from("team_policies")
          .update({
            is_active: policy.isActive,
            config: policy.config,
            activated_at: new Date().toISOString(),
            pending_is_active: null,
            pending_config: null,
          })
          .eq("id", existing.id);
        if (error) return { error: `Failed to save ${policy.slug}: ${error.message}` };
      } else {
        const { error } = await supabase
          .from("team_policies")
          .insert({
            team_id: teamId,
            policy_id: policyId,
            is_active: policy.isActive,
            config: policy.config,
            activated_at: new Date().toISOString(),
          });
        if (error) return { error: `Failed to save ${policy.slug}: ${error.message}` };
      }
    } else {
      // PENDING: changes take effect at next phase
      if (existing) {
        const sameActive = existing.is_active === policy.isActive;
        const sameConfig = JSON.stringify(existing.config) === JSON.stringify(policy.config);
        if (sameActive && sameConfig) {
          // No change — clear any previous pending state
          await supabase
            .from("team_policies")
            .update({ pending_is_active: null, pending_config: null })
            .eq("id", existing.id);
          continue;
        }

        const { error } = await supabase
          .from("team_policies")
          .update({
            pending_is_active: policy.isActive,
            pending_config: policy.config,
          })
          .eq("id", existing.id);
        if (error) return { error: `Failed to save ${policy.slug}: ${error.message}` };
      } else {
        const { error } = await supabase
          .from("team_policies")
          .insert({
            team_id: teamId,
            policy_id: policyId,
            is_active: false,
            config: null,
            pending_is_active: policy.isActive,
            pending_config: policy.config,
          });
        if (error) return { error: `Failed to save ${policy.slug}: ${error.message}` };
      }
    }
  }

  revalidatePath(`/league/${leagueId}/team`);
  revalidatePath(`/league/${leagueId}/team/policies`);

  if (immediate) {
    return { success: true, immediate: true };
  }
  return { success: true, effectivePhaseName: nextPhase!.label };
}
