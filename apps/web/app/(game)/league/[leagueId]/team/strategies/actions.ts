"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOpenAuction } from "@/lib/supabase/get-open-auction";
import { STRATEGY_TYPES, getMaxActiveStrategies } from "@/lib/strategies";
import { getCurrentPhase, getNextPhase } from "@/lib/phases";

const StrategyInputSchema = z.object({
  slug: z.string(),
  isActive: z.boolean(),
  config: z.record(z.string(), z.string()).nullable(),
});

const SaveStrategiesSchema = z.object({
  teamId: z.uuid(),
  leagueId: z.uuid(),
  strategies: z.array(StrategyInputSchema),
});

export async function saveStrategies(
  teamId: string,
  leagueId: string,
  strategies: { slug: string; isActive: boolean; config: Record<string, string> | null }[]
): Promise<{ success?: boolean; error?: string; effectivePhaseName?: string; immediate?: boolean }> {
  // Zod validation
  const parsed = SaveStrategiesSchema.safeParse({ teamId, leagueId, strategies });
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

  // Immediate effect when there is an open auction
  const openAuction = await getOpenAuction(supabase, leagueId);
  const immediate = !!openAuction;

  // Fetch existing state to project total active strategies
  const { data: existingStrategies } = await supabase
    .from("team_strategies")
    .select("is_active, pending_is_active, strategies(slug)")
    .eq("team_id", teamId);

  const projectedState: Record<string, boolean> = {};

  if (existingStrategies) {
    for (const es of existingStrategies) {
      const slug = Array.isArray(es.strategies) ? es.strategies[0]?.slug : (es.strategies as { slug: string } | null)?.slug;
      if (slug) {
        projectedState[slug] = immediate ? es.is_active : (es.pending_is_active ?? es.is_active);
      }
    }
  }

  // Override with incoming state
  for (const s of strategies) {
    projectedState[s.slug] = s.isActive;
  }

  const projectedActiveCount = Object.values(projectedState).filter(Boolean).length;
  const maxActive = getMaxActiveStrategies(level);

  if (projectedActiveCount > maxActive) {
    return { error: `You can only have ${maxActive} active strategies at your level.` };
  }

  // Validate unlocks for incoming strategies
  for (const strategy of strategies.filter((s) => s.isActive)) {
    const strategyType = STRATEGY_TYPES.find((st) => st.slug === strategy.slug);
    if (!strategyType) {
      return { error: `Unknown strategy type: ${strategy.slug}` };
    }
    if (level < strategyType.unlockLevel) {
      return { error: `${strategyType.name} requires level ${strategyType.unlockLevel}.` };
    }
  }

  // Get strategy IDs from DB
  const { data: dbStrategies } = await supabase
    .from("strategies")
    .select("id, slug");

  if (!dbStrategies) {
    return { error: "Failed to fetch strategies." };
  }

  const slugToId: Record<string, string> = {};
  for (const s of dbStrategies) {
    slugToId[s.slug] = s.id;
  }

  // Only require nextPhase when not in immediate mode (pending mode)
  const nextPhase = immediate ? null : getNextPhase(getCurrentPhase());
  if (!immediate && !nextPhase) {
    return { error: "Cannot change strategies during the last phase of the season." };
  }

  // Note: sponsors and strategies are fully decoupled in the new model.
  // No sponsor eligibility guard needed — sponsors are level-gated only.

  // Upsert each strategy
  for (const strategy of strategies) {
    const strategyId = slugToId[strategy.slug];
    if (!strategyId) continue;

    // Check if a row already exists for this team+strategy
    const { data: existing } = await supabase
      .from("team_strategies")
      .select("id, is_active, config")
      .eq("team_id", teamId)
      .eq("strategy_id", strategyId)
      .single();

    if (immediate) {
      // IMMEDIATE: write directly to is_active + config, clear any pending state
      if (existing) {
        const sameActive = existing.is_active === strategy.isActive;
        const sameConfig = JSON.stringify(existing.config) === JSON.stringify(strategy.config);
        if (sameActive && sameConfig) continue;

        const { error } = await supabase
          .from("team_strategies")
          .update({
            is_active: strategy.isActive,
            config: strategy.config,
            activated_at: new Date().toISOString(),
            pending_is_active: null,
            pending_config: null,
          })
          .eq("id", existing.id);
        if (error) return { error: `Failed to save ${strategy.slug}: ${error.message}` };
      } else {
        const { error } = await supabase
          .from("team_strategies")
          .insert({
            team_id: teamId,
            strategy_id: strategyId,
            is_active: strategy.isActive,
            config: strategy.config,
            activated_at: new Date().toISOString(),
          });
        if (error) return { error: `Failed to save ${strategy.slug}: ${error.message}` };
      }
    } else {
      // PENDING: changes take effect at next phase
      if (existing) {
        const sameActive = existing.is_active === strategy.isActive;
        const sameConfig = JSON.stringify(existing.config) === JSON.stringify(strategy.config);
        if (sameActive && sameConfig) {
          // No change — clear any previous pending state
          await supabase
            .from("team_strategies")
            .update({ pending_is_active: null, pending_config: null })
            .eq("id", existing.id);
          continue;
        }

        const { error } = await supabase
          .from("team_strategies")
          .update({
            pending_is_active: strategy.isActive,
            pending_config: strategy.config,
          })
          .eq("id", existing.id);
        if (error) return { error: `Failed to save ${strategy.slug}: ${error.message}` };
      } else {
        const { error } = await supabase
          .from("team_strategies")
          .insert({
            team_id: teamId,
            strategy_id: strategyId,
            is_active: false,
            config: null,
            pending_is_active: strategy.isActive,
            pending_config: strategy.config,
          });
        if (error) return { error: `Failed to save ${strategy.slug}: ${error.message}` };
      }
    }
  }

  revalidatePath(`/league/${leagueId}/team`);
  revalidatePath(`/league/${leagueId}/team/strategies`);

  if (immediate) {
    return { success: true, immediate: true };
  }
  return { success: true, effectivePhaseName: nextPhase!.label };
}
