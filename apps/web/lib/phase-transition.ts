"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Apply all pending changes for a given phase.
 * Called at the start of a new phase to finalize:
 * - Rider releases (status: notice → released)
 * - Policy changes (pending → active)
 * - Sponsor swaps (pending_change → active)
 */
export async function applyPhaseTransition(phaseId: number) {
  const supabase = await createClient();

  const results = { riders: 0, policies: 0, sponsors: 0, errors: [] as string[] };

  // 1. Release riders whose notice period ends at this phase
  const { data: noticedContracts, error: riderErr } = await supabase
    .from("contracts")
    .select("id")
    .eq("status", "notice")
    .lte("effective_phase_id", phaseId);

  if (riderErr) {
    results.errors.push(`Riders fetch: ${riderErr.message}`);
  } else if (noticedContracts && noticedContracts.length > 0) {
    const ids = noticedContracts.map((c) => c.id);
    const { error } = await supabase
      .from("contracts")
      .update({ status: "released" })
      .in("id", ids);
    if (error) results.errors.push(`Riders update: ${error.message}`);
    else results.riders = ids.length;
  }

  // 2. Apply pending policy changes
  const { data: pendingPolicies, error: policyErr } = await supabase
    .from("team_policies")
    .select("id, pending_is_active, pending_config")
    .not("pending_is_active", "is", null)
    .lte("effective_phase_id", phaseId);

  if (policyErr) {
    results.errors.push(`Policies fetch: ${policyErr.message}`);
  } else if (pendingPolicies && pendingPolicies.length > 0) {
    for (const p of pendingPolicies) {
      const { error } = await supabase
        .from("team_policies")
        .update({
          is_active: p.pending_is_active,
          config: p.pending_config,
          activated_at: p.pending_is_active ? new Date().toISOString() : null,
          pending_is_active: null,
          pending_config: null,
          effective_phase_id: null,
        })
        .eq("id", p.id);
      if (error) results.errors.push(`Policy ${p.id}: ${error.message}`);
      else results.policies++;
    }
  }

  // 3. Apply pending sponsor changes
  const { data: pendingSponsors, error: sponsorErr } = await supabase
    .from("team_sponsors")
    .select("id, pending_sponsor_id")
    .eq("status", "pending_change")
    .lte("effective_phase_id", phaseId);

  if (sponsorErr) {
    results.errors.push(`Sponsors fetch: ${sponsorErr.message}`);
  } else if (pendingSponsors && pendingSponsors.length > 0) {
    for (const s of pendingSponsors) {
      if (s.pending_sponsor_id) {
        // Swap to new sponsor
        const { error } = await supabase
          .from("team_sponsors")
          .update({
            sponsor_id: s.pending_sponsor_id,
            status: "active",
            pending_sponsor_id: null,
            effective_phase_id: null,
            payments_count: 0,
            activated_at: new Date().toISOString(),
          })
          .eq("id", s.id);
        if (error) results.errors.push(`Sponsor ${s.id}: ${error.message}`);
        else results.sponsors++;
      } else {
        // Removal — delete the row
        const { error } = await supabase
          .from("team_sponsors")
          .delete()
          .eq("id", s.id);
        if (error) results.errors.push(`Sponsor delete ${s.id}: ${error.message}`);
        else results.sponsors++;
      }
    }
  }

  return results;
}
