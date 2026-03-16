"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { getCurrentPhase, getNextPhase, isInAuctionWindow } from "@/lib/phases";

const SaveSponsorsSchema = z.object({
  teamId: z.uuid(),
  leagueId: z.uuid(),
  secondary: z.uuid().nullable(),
  principal: z.uuid().nullable(),
});

export async function saveSponsors(input: z.infer<typeof SaveSponsorsSchema>): Promise<{ success?: boolean; error?: string; effectivePhaseName?: string; immediate?: boolean }> {
  const result = SaveSponsorsSchema.safeParse(input);
  if (!result.success) return { error: "Invalid sponsor data" };
  const parsed = result.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("id", parsed.teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  const inAuction = isInAuctionWindow();
  const maybeNextPhase = inAuction ? null : getNextPhase(getCurrentPhase());
  if (!inAuction && !maybeNextPhase) {
    return { error: "Cannot change sponsors during the last phase of the season." };
  }

  // Validate secondary sponsor
  if (parsed.secondary) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.secondary)
      .single();
    if (!sponsor || sponsor.slot !== "secondary" || team.level < sponsor.unlock_level) {
      return { error: "Secondary sponsor not available at your level" };
    }
  }

  // Validate principal sponsor
  if (parsed.principal) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.principal)
      .single();
    if (!sponsor || sponsor.slot !== "principal" || team.level < sponsor.unlock_level) {
      return { error: "Main sponsor not available at your level" };
    }
  }

  // Fetch current sponsors (active or already pending)
  const { data: currentSponsors } = await supabase
    .from("team_sponsors")
    .select("slot, sponsor_id, status, pending_sponsor_id")
    .eq("team_id", parsed.teamId);

  const currentSecondary = currentSponsors?.find((s) => s.slot === "secondary");
  const currentPrincipal = currentSponsors?.find((s) => s.slot === "principal");

  if (inAuction) {
    // IMMEDIATE mode: apply sponsor changes directly
    async function upsertSlotImmediate(
      slot: "secondary" | "principal",
      newSponsorId: string | null,
      current: { sponsor_id: string; status: string; pending_sponsor_id: string | null } | undefined,
    ) {
      if (!newSponsorId) {
        if (current) {
          return supabase
            .from("team_sponsors")
            .delete()
            .eq("team_id", parsed.teamId)
            .eq("slot", slot);
        }
        return { error: null };
      }

      const activeSponsorId = current?.sponsor_id ?? null;
      if (newSponsorId === activeSponsorId) {
        // Same sponsor — just clear any pending state
        if (current?.status === "pending_change") {
          return supabase
            .from("team_sponsors")
            .update({
              status: "active",
              pending_sponsor_id: null,
              effective_phase_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("team_id", parsed.teamId)
            .eq("slot", slot);
        }
        return { error: null };
      }

      // Different sponsor — apply immediately
      if (current) {
        return supabase
          .from("team_sponsors")
          .update({
            sponsor_id: newSponsorId,
            status: "active",
            pending_sponsor_id: null,
            effective_phase_id: null,
            payments_count: 0,
            activated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", parsed.teamId)
          .eq("slot", slot);
      }

      return supabase.from("team_sponsors").insert({
        team_id: parsed.teamId,
        sponsor_id: newSponsorId,
        slot,
        status: "active",
        payments_count: 0,
        activated_at: new Date().toISOString(),
      });
    }

    const { error: secErr } = await upsertSlotImmediate("secondary", parsed.secondary, currentSecondary ?? undefined);
    if (secErr) return { error: secErr.message };

    const { error: priErr } = await upsertSlotImmediate("principal", parsed.principal, currentPrincipal ?? undefined);
    if (priErr) return { error: priErr.message };

    revalidatePath(`/league/${parsed.leagueId}/budget`);
    return { success: true, immediate: true };
  }

  // PENDING mode: changes take effect at next phase
  const nextPhaseId = maybeNextPhase!.id;
  const nextPhaseLabel = maybeNextPhase!.label;

  async function upsertSlotPending(
    slot: "secondary" | "principal",
    newSponsorId: string | null,
    current: { sponsor_id: string; status: string; pending_sponsor_id: string | null } | undefined,
  ) {
    if (!newSponsorId) {
      if (current) {
        return supabase
          .from("team_sponsors")
          .update({
            status: "pending_change",
            pending_sponsor_id: null,
            effective_phase_id: nextPhaseId,
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", parsed.teamId)
          .eq("slot", slot);
      }
      return { error: null };
    }

    const activeSponsorId = current?.sponsor_id ?? null;
    if (newSponsorId === activeSponsorId) {
      if (current?.status === "pending_change") {
        return supabase
          .from("team_sponsors")
          .update({
            status: "active",
            pending_sponsor_id: null,
            effective_phase_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", parsed.teamId)
          .eq("slot", slot);
      }
      return { error: null };
    }

    if (current) {
      return supabase
        .from("team_sponsors")
        .update({
          status: "pending_change",
          pending_sponsor_id: newSponsorId,
          effective_phase_id: nextPhaseId,
          updated_at: new Date().toISOString(),
        })
        .eq("team_id", parsed.teamId)
        .eq("slot", slot);
    }

    return supabase.from("team_sponsors").insert({
      team_id: parsed.teamId,
      sponsor_id: newSponsorId,
      slot,
      status: "active",
      payments_count: 0,
      activated_at: new Date().toISOString(),
    });
  }

  const { error: secErr } = await upsertSlotPending("secondary", parsed.secondary, currentSecondary ?? undefined);
  if (secErr) return { error: secErr.message };

  const { error: priErr } = await upsertSlotPending("principal", parsed.principal, currentPrincipal ?? undefined);
  if (priErr) return { error: priErr.message };

  revalidatePath(`/league/${parsed.leagueId}/budget`);
  return { success: true, effectivePhaseName: nextPhaseLabel };
}
