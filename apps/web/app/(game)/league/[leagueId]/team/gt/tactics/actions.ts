// apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts
"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PlaceTacticInput = z.object({
  teamId: z.uuid(),
  phaseId: z.union([z.literal(4), z.literal(6), z.literal(8)]),
  year: z.number().int().min(2025).max(2100),
  tacticType: z.enum([
    "unleash", "overdrive", "call_the_bus", "nemesis_gc", "nemesis_sprint",
  ]),
  stageSlug: z.string().min(1),
  nemesisTargetTeamId: z.uuid().optional(),
  nemesisTargetRole: z.enum(["gc_leader", "sprinter"]).optional(),
});

export type PlaceTacticInput = z.infer<typeof PlaceTacticInput>;

export async function placeTactic(input: PlaceTacticInput): Promise<string> {
  const parsed = PlaceTacticInput.parse(input);

  // Client-side guard: nemesis tactics require target
  if (
    (parsed.tacticType === "nemesis_gc" || parsed.tacticType === "nemesis_sprint") &&
    (!parsed.nemesisTargetTeamId || !parsed.nemesisTargetRole)
  ) {
    throw new Error("Nemesis tactics require a target team and role");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_tactic", {
    p_team_id: parsed.teamId,
    p_phase_id: parsed.phaseId,
    p_year: parsed.year,
    p_tactic_type: parsed.tacticType,
    p_stage_slug: parsed.stageSlug,
    p_nemesis_target_team_id: parsed.nemesisTargetTeamId,
    p_nemesis_target_role: parsed.nemesisTargetRole,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/league/[leagueId]/team/gt`, "page");
  return data as string;
}

// === Read helpers ===

export async function listTacticActivations(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gt_tactic_activations")
    .select("*")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEligibleRivals(opts: {
  leagueId: string;
  myTeamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  role: "gc_leader" | "sprinter";
}) {
  const supabase = await createClient();
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", opts.leagueId)
    .neq("id", opts.myTeamId);
  if (teamsErr) throw new Error(teamsErr.message);
  if (!teams) return [];

  const result = [];
  for (const t of teams) {
    const { data: roleRow } = await supabase
      .from("gt_role_assignments")
      .select("rider_id, riders(full_name)")
      .eq("team_id", t.id)
      .eq("phase_id", opts.phaseId)
      .eq("year", opts.year)
      .eq("role", opts.role)
      .order("applied_at", { ascending: false })
      .limit(1)
      .single();

    if (!roleRow) {
      result.push({ teamId: t.id, teamName: t.name, leader: null, xp: 0 });
      continue;
    }

    const gtSlug = phaseToGtSlug(opts.phaseId);
    const { data: xpRows } = await supabase
      .from("rider_xp_daily")
      .select("xp_gained")
      .eq("team_id", t.id)
      .eq("rider_id", roleRow.rider_id)
      .like("race_slug", `race/${gtSlug}/${opts.year}/%`);
    const xp = (xpRows ?? []).reduce((s, r) => s + (r.xp_gained ?? 0), 0);

    result.push({
      teamId: t.id,
      teamName: t.name,
      leader: { riderId: roleRow.rider_id, name: (roleRow.riders as { full_name: string }).full_name },
      xp,
    });
  }

  return result;
}

export async function getMyLeaderXp(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  role: "gc_leader" | "sprinter";
}): Promise<{ leader: { riderId: string; name: string } | null; xp: number }> {
  const supabase = await createClient();
  const { data: roleRow } = await supabase
    .from("gt_role_assignments")
    .select("rider_id, riders(full_name)")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year)
    .eq("role", opts.role)
    .order("applied_at", { ascending: false })
    .limit(1)
    .single();

  if (!roleRow) return { leader: null, xp: 0 };

  const gtSlug = phaseToGtSlug(opts.phaseId);
  const { data: xpRows } = await supabase
    .from("rider_xp_daily")
    .select("xp_gained")
    .eq("team_id", opts.teamId)
    .eq("rider_id", roleRow.rider_id)
    .like("race_slug", `race/${gtSlug}/${opts.year}/%`);
  const xp = (xpRows ?? []).reduce((s, r) => s + (r.xp_gained ?? 0), 0);

  return {
    leader: { riderId: roleRow.rider_id, name: (roleRow.riders as { full_name: string }).full_name },
    xp,
  };
}

export async function getIncomingNemesis(opts: {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gt_tactic_activations")
    .select(`
      tactic_type, stage_slug, outcome, resolved_at, created_at,
      team:team_id (id, name)
    `)
    .eq("nemesis_target_team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const slugs = Array.from(new Set(data.map((d) => d.stage_slug)));
  const { data: stageRows } = await supabase
    .from("race_results")
    .select("race_slug, race_date")
    .in("race_slug", slugs);
  const dateBySlug = new Map<string, string>(
    (stageRows ?? []).map((r) => [r.race_slug, r.race_date])
  );

  const cutoff = Date.now() - 24 * 3600 * 1000;
  return data
    .filter((d) => !d.resolved_at || new Date(d.resolved_at).getTime() > cutoff)
    .map((d) => ({
      attackerTeamName: (d.team as unknown as { name: string }).name,
      role: d.tactic_type === "nemesis_gc" ? "gc_leader" as const : "sprinter" as const,
      stageNumber: parseStageNumber(d.stage_slug),
      stageDate: dateBySlug.get(d.stage_slug) ?? "",
      outcome: d.outcome ?? null,
    }));
}

// === Internal helpers ===

function phaseToGtSlug(phaseId: 4 | 6 | 8): string {
  return { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" }[phaseId];
}

function parseStageNumber(slug: string): number {
  const m = slug.match(/\/stage-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
