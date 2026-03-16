"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { POLICY_TYPES, getMaxActivePolicies } from "@/lib/policies";
import { getCurrentPhase, getNextPhase, isInAuctionWindow } from "@/lib/phases";

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

  const inAuction = isInAuctionWindow();

  // Only require nextPhase when outside auction window (pending mode)
  const nextPhase = inAuction ? null : getNextPhase(getCurrentPhase());
  if (!inAuction && !nextPhase) {
    return { error: "Cannot change policies during the last phase of the season." };
  }

  // Sponsor eligibility guard: block if deactivating/changing specialist would break a sponsor
  const specialistPolicy = policies.find((p) => p.slug === "specialist");
  if (specialistPolicy) {
    const { data: teamSponsors } = await supabase
      .from("team_sponsors")
      .select("sponsor_id, sponsors!sponsor_id(name, specialty)")
      .eq("team_id", teamId)
      .eq("status", "active");

    for (const ts of teamSponsors ?? []) {
      const sponsor = ts.sponsors as unknown as { name: string; specialty: string[] } | null;
      if (!sponsor || !sponsor.specialty || sponsor.specialty.length === 0) continue;

      // Sponsor requires a specialty — check if the new policy still satisfies it
      if (!specialistPolicy.isActive) {
        return { error: `Cannot deactivate specialty — your sponsor ${sponsor.name} requires it.` };
      }
      const newSpecialty = specialistPolicy.config?.specialty ?? null;
      if (newSpecialty && !sponsor.specialty.some((s) => s.toLowerCase() === newSpecialty.toLowerCase())) {
        return { error: `Cannot change specialty to ${newSpecialty} — your sponsor ${sponsor.name} requires ${sponsor.specialty.join(" or ")}.` };
      }
    }
  }

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

    if (inAuction) {
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
            effective_phase_id: null,
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
            .update({ pending_is_active: null, pending_config: null, effective_phase_id: null })
            .eq("id", existing.id);
          continue;
        }

        const { error } = await supabase
          .from("team_policies")
          .update({
            pending_is_active: policy.isActive,
            pending_config: policy.config,
            effective_phase_id: nextPhase!.id,
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
            effective_phase_id: nextPhase!.id,
          });
        if (error) return { error: `Failed to save ${policy.slug}: ${error.message}` };
      }
    }
  }

  revalidatePath(`/league/${leagueId}/team`);
  revalidatePath(`/league/${leagueId}/team/policies`);

  if (inAuction) {
    return { success: true, immediate: true };
  }
  return { success: true, effectivePhaseName: nextPhase!.label };
}
