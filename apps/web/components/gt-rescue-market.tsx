"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, X, ArrowLeft } from "lucide-react"
import { RiderCard } from "@/components/rider-card"
import { StickyBar } from "@/components/sticky-bar"
import { placeEmergencyBid } from "@/app/(game)/league/[leagueId]/team/gt/rescue/actions"
import { formatThousands, countryCodeToFlag, calcMinSalary, formatEuro } from "@/lib/format"

interface Rider {
  id: string
  full_name: string
  nationality: string | null
  real_team: string | null
  pcs_rank: number | null
  pcs_rank_diff: number | null
  photo_url: string | null
  pcs_points_1yr: number | null
}

interface Props {
  leagueId: string
  team: { id: string; treasury: number }
  gtPhase: { phaseId: number; gtIdentifier: string; gtYear: number; label: string }
  eligibleRiders: Rider[]
  existingBid: { id: string; rider_id: string; amount: number } | null
}

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean)
  if (parts.length <= 1) return fullName
  const lastName = parts[parts.length - 1]
  const firstInitial = parts[0][0].toUpperCase()
  return `${firstInitial}. ${lastName}`
}

export function GtRescueMarket({ leagueId, team, gtPhase, eligibleRiders, existingBid }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null)
  const [bidAmount, setBidAmount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return eligibleRiders
    const q = search.toLowerCase()
    return eligibleRiders.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.real_team && r.real_team.toLowerCase().includes(q))
    )
  }, [eligibleRiders, search])

  function handleBidChange(riderId: string, value: number) {
    if (value <= 0) {
      if (selectedRiderId === riderId) {
        setSelectedRiderId(null)
        setBidAmount(0)
      }
      return
    }
    setSelectedRiderId(riderId)
    setBidAmount(value)
    setError(null)
  }

  function handleSubmit() {
    if (!selectedRiderId || !bidAmount) return
    setError(null)
    startTransition(async () => {
      const result = await placeEmergencyBid({
        riderId: selectedRiderId,
        amount: bidAmount,
        phaseId: gtPhase.phaseId,
        gtIdentifier: gtPhase.gtIdentifier,
        gtYear: gtPhase.gtYear,
        leagueId,
      })
      if (result && "error" in result && result.error) {
        setError(result.error)
        return
      }
      router.push(`/league/${leagueId}`)
    })
  }

  const hasBid = Boolean(selectedRiderId && bidAmount > 0)

  function renderRight(r: Rider) {
    const minSalary = calcMinSalary(r.pcs_points_1yr ?? 0)
    const isSelected = selectedRiderId === r.id
    const currentBid = isSelected ? bidAmount : 0

    return (
      <div
        className="flex flex-col items-end gap-0.5"
        onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center gap-0.5 rounded-lg px-2 h-7 transition-colors focus-within:border-[var(--accent-default)] ${
            isSelected
              ? "border border-[var(--accent-default)] bg-[var(--bg-surface-hover)]"
              : "border border-[var(--border-default)] bg-transparent"
          }`}
          onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
        >
          <input
            type="text"
            inputMode="numeric"
            min={minSalary}
            step={100}
            placeholder={formatThousands(minSalary)}
            value={isSelected && currentBid > 0 ? formatThousands(currentBid) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\s/g, "")
              const val = parseInt(raw, 10)
              handleBidChange(r.id, isNaN(val) ? 0 : val)
            }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            autoComplete="off"
            className={`w-20 bg-transparent text-right text-base md:text-[length:var(--type-body)] font-semibold font-mono outline-none ${
              isSelected ? "text-[var(--accent-default)]" : "text-[var(--text-low)]"
            }`}
          />
          <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)] font-medium">
            €
          </span>
        </div>
        {isSelected && (
          <div className="text-[length:var(--type-micro)] text-[var(--text-low)] mt-px">
            Min: <span className="font-mono">€{formatThousands(minSalary)}</span>
          </div>
        )}
        {isSelected && error && (
          <span className="text-[length:var(--type-micro)] text-[var(--status-danger)]">
            {error}
          </span>
        )}
      </div>
    )
  }

  // Already placed a bid — show confirmation state
  if (existingBid) {
    return (
      <div className="pb-20">
        <div className="px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => router.push(`/league/${leagueId}`)}
            className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <div className="px-4 pt-2 space-y-1">
          <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
            Grand Tour Emergency Bid
          </h1>
          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {gtPhase.label} · Closes at end of rest day
          </p>
        </div>
        <div className="px-4 mt-6 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] mx-4 p-6 flex flex-col gap-3">
          <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            Bid already placed
          </p>
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            Your emergency bid of{" "}
            <span className="font-mono tabular-nums text-[var(--text-high)]">
              {formatEuro(existingBid.amount)}
            </span>{" "}
            is pending. It will be resolved at the next rest day.
          </p>
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Only one emergency bid is allowed per Grand Tour.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* Back button */}
      <div className="px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push(`/league/${leagueId}`)}
          className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Page header */}
      <div className="px-4 pt-2 pb-3 space-y-0.5">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Grand Tour Emergency Bid
        </h1>
        <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {gtPhase.label} · Closes at end of rest day · 1 bid allowed
        </p>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-transparent px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)]">
          <Search size={16} className="shrink-0 text-[var(--text-ghost)]" />
          <input
            type="text"
            placeholder="Search rider or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="flex-1 bg-transparent text-base md:text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="shrink-0 rounded-full p-0.5 text-[var(--text-ghost)] hover:text-[var(--text-mid)] transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Counter */}
      <div className="px-4 pb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          {filtered.length} available · {hasBid ? 1 : 0}/1 bet
        </span>
      </div>

      {/* Rider list */}
      <div>
        {filtered.map((r) => (
          <RiderCard
            key={r.id}
            rider={{
              id: r.id,
              name: formatName(r.full_name),
              nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
              team_name: r.real_team ?? undefined,
              pcs_rank: r.pcs_rank ?? undefined,
              pcs_rank_diff: r.pcs_rank_diff,
              photo_url: r.photo_url,
            }}
            bidState={selectedRiderId === r.id ? "active" : "none"}
            onNavigate={() => router.push(`/league/${leagueId}/rider/${r.id}?from=rescue`)}
            rightContent={renderRight(r)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              No riders match your search.
            </p>
          </div>
        )}
      </div>

      <StickyBar
        saveEnabled={hasBid}
        onSave={handleSubmit}
        saving={isPending}
        slotInfo={`${hasBid ? 1 : 0}/1 bet`}
        budgetInfo={formatEuro(team.treasury)}
        buttonLabel="Place emergency bid"
      />
    </div>
  )
}
