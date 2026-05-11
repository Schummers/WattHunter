import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getCurrentGTPhase,
  GT_IDENTIFIER,
  GT_FULL_NAME,
  GT_RACE_SLUG_PREFIX,
  type GtPhaseId,
} from "@/lib/gt-phases"
import { GtRescueMarket } from "@/components/gt-rescue-market"

export default async function GtRescuePage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Must be an active GT phase
  const phase = getCurrentGTPhase()
  if (!phase) redirect(`/league/${leagueId}`)

  const phaseId = phase.id as GtPhaseId
  const gtIdentifier = GT_IDENTIFIER[phaseId]
  const gtYear = new Date().getFullYear()

  // Get team
  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, level")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single()
  if (!team) redirect(`/league/${leagueId}`)

  // Verify the team has a claimed DNF refund for this GT
  const { data: dnfClaimed } = await supabase
    .from("gt_squad")
    .select("id")
    .eq("team_id", team.id)
    .eq("phase_id", phaseId)
    .eq("year", gtYear)
    .eq("dnf_refund_claimed", true)
    .limit(1)

  if (!dnfClaimed?.length) redirect(`/league/${leagueId}`)

  // Check for an existing unresolved emergency bid
  const { data: existingBid } = await supabase
    .from("gt_emergency_bids")
    .select("id, rider_id, amount")
    .eq("team_id", team.id)
    .eq("phase_id", phaseId)
    .eq("gt_identifier", gtIdentifier)
    .eq("gt_year", gtYear)
    .eq("resolved", false)
    .maybeSingle()

  // Riders contracted in this league (exclude from list)
  const { data: contractedRiderIds } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("league_id", leagueId)
    .eq("status", "active")

  const excludedIds = new Set((contractedRiderIds ?? []).map((r) => r.rider_id))

  // Startlist for current GT — rider_ids participating in this race
  const gtSlugPrefix = GT_RACE_SLUG_PREFIX[phaseId]
  const { data: startlistRows } = await supabase
    .from("race_startlists")
    .select("rider_id")
    .eq("race_slug", `${gtSlugPrefix}/${gtYear}`)

  const startlistIds = (startlistRows ?? []).map((r) => r.rider_id)

  // If startlist is populated, filter to it; otherwise fall back to full pool
  const useStartlist = startlistIds.length > 0

  let ridersQuery = supabase
    .from("riders")
    .select("id, full_name, photo_url, monthly_salary, pcs_rank")
    .eq("ever_in_pool", true)
    .order("pcs_rank", { ascending: true, nullsFirst: false })
    .limit(200)

  if (useStartlist) {
    ridersQuery = ridersQuery.in("id", startlistIds.filter((id) => !excludedIds.has(id)))
  } else if (excludedIds.size > 0) {
    ridersQuery = ridersQuery.not("id", "in", `(${[...excludedIds].join(",")})`)
  }

  const { data: ridersData } = await ridersQuery

  const eligibleRiders = (ridersData ?? []).map((r) => ({
    id: r.id,
    name: r.full_name,
    photoUrl: r.photo_url ?? null,
    monthlySalary: r.monthly_salary ?? 5000,
    pcsRank: r.pcs_rank ?? null,
  }))

  return (
    <GtRescueMarket
      leagueId={leagueId}
      team={{ id: team.id, treasury: team.treasury }}
      gtPhase={{
        phaseId,
        gtIdentifier,
        gtYear,
        label: GT_FULL_NAME[phaseId],
      }}
      eligibleRiders={eligibleRiders}
      existingBid={
        existingBid
          ? { id: existingBid.id, rider_id: existingBid.rider_id, amount: existingBid.amount }
          : null
      }
    />
  )
}
