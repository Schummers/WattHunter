"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { resolvePhotoUrl } from "@/lib/photo-url"
import { placeEmergencyBid } from "@/app/(game)/league/[leagueId]/team/gt/rescue/actions"
import { BackHeader } from "@/components/back-header"

interface EligibleRider {
  id: string
  name: string
  photoUrl: string | null
  monthlySalary: number
  pcsRank: number | null
}

interface Props {
  leagueId: string
  team: { id: string; treasury: number }
  gtPhase: { phaseId: number; gtIdentifier: string; gtYear: number; label: string }
  eligibleRiders: EligibleRider[]
  existingBid: { id: string; rider_id: string; amount: number } | null
}

function formatSalary(amount: number): string {
  return `${Math.round(amount / 1000)}k€/mo`
}

function formatTreasury(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function GtRescueMarket({ leagueId, team, gtPhase, eligibleRiders, existingBid }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState("")
  const [selectedRider, setSelectedRider] = useState<EligibleRider | null>(null)
  const [bidAmount, setBidAmount] = useState<number | "">("")
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return eligibleRiders
    const q = search.toLowerCase()
    return eligibleRiders.filter((r) => r.name.toLowerCase().includes(q))
  }, [eligibleRiders, search])

  function handleSelectRider(rider: EligibleRider) {
    setSelectedRider(rider)
    setBidAmount(Math.max(5000, rider.monthlySalary))
    setError(null)
  }

  function handleSubmit() {
    if (!selectedRider || bidAmount === "") return

    setError(null)
    startTransition(async () => {
      const result = await placeEmergencyBid({
        riderId: selectedRider.id,
        amount: Number(bidAmount),
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

  // Already placed a bid — show confirmation state
  if (existingBid) {
    return (
      <div className="flex flex-col max-w-lg mx-auto">
        <BackHeader label="Replace your rider" onBack={() => router.push(`/league/${leagueId}`)} />
        <div className="flex flex-col gap-6 px-4 py-6">
          <div className="flex flex-col gap-1">
            <span className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
              {gtPhase.label} · Emergency Bid
            </span>
            <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
              GT Rescue Window
            </h1>
          </div>

          <div
            className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 flex flex-col gap-3"
            role="status"
          >
            <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              Bid already placed
            </p>
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              Your emergency bid of{" "}
              <span className="font-mono tabular-nums text-[var(--text-high)]">
                {formatSalary(existingBid.amount)}
              </span>{" "}
              is pending. It will be resolved at the next rest day.
            </p>
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Only one emergency bid is allowed per Grand Tour.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-lg mx-auto">
      <BackHeader label="Replace your rider" onBack={() => router.push(`/league/${leagueId}`)} />
      <div className="flex flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
          {gtPhase.label} · Emergency Bid
        </span>
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          GT Rescue Window
        </h1>
        <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Replace your DNF rider with one available recruit.
        </p>
      </div>

      {/* Treasury */}
      <div className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 flex items-center justify-between">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)] uppercase tracking-wide">
          Treasury
        </span>
        <span className="font-mono tabular-nums text-[length:var(--type-stat-small)] font-bold text-[var(--accent-highlight)]">
          {formatTreasury(team.treasury)}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {/* Search */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="rescue-search"
            className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]"
          >
            Choose a rider
          </label>
          <div className="relative">
            <MagnifyingGlassIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] pointer-events-none"
              aria-hidden
            />
            <input
              id="rescue-search"
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] pl-9 pr-3 py-2 text-[length:var(--type-body)] text-[var(--text-high)] placeholder:text-[var(--text-ghost)] focus:outline-none focus:border-[var(--accent-default)] transition-colors"
            />
          </div>
        </div>

        {/* Rider list */}
        <div
          className="flex flex-col divide-y divide-[var(--border-subtle)] rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden max-h-72 overflow-y-auto"
          role="listbox"
          aria-label="Eligible riders"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-[length:var(--type-body)] text-[var(--text-mid)] text-center">
              No riders found.
            </p>
          ) : (
            filtered.map((rider) => {
              const isSelected = selectedRider?.id === rider.id
              return (
                <button
                  key={rider.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectRider(rider)}
                  className={[
                    "flex items-center gap-3 px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "bg-[var(--bg-surface-active)]"
                      : "hover:bg-[var(--bg-surface-hover)]",
                  ].join(" ")}
                >
                  {/* Photo */}
                  <div className="relative shrink-0 w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-subtle)]">
                    {rider.photoUrl ? (
                      <Image
                        src={resolvePhotoUrl(rider.photoUrl) ?? ""}
                        alt={rider.name}
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[length:var(--type-micro)] text-[var(--text-ghost)] font-semibold uppercase">
                        {rider.name.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
                      {rider.name}
                    </span>
                    <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                      {rider.pcsRank != null ? `#${rider.pcsRank}` : "—"}&nbsp;·&nbsp;Min{" "}
                      {formatSalary(rider.monthlySalary)}
                    </span>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent-default)]" aria-hidden />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Bid amount */}
        {selectedRider && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="rescue-amount"
              className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]"
            >
              Monthly bid (€/mo)
            </label>
            <input
              id="rescue-amount"
              type="number"
              min={Math.max(5000, selectedRider.monthlySalary)}
              step={100}
              value={bidAmount}
              onChange={(e) =>
                setBidAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 font-mono tabular-nums text-[length:var(--type-body)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent-default)] transition-colors"
            />
            <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Minimum {formatSalary(Math.max(5000, selectedRider.monthlySalary))} · increments of 100€
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-[length:var(--type-caption)] text-[#ef4444]"
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedRider || bidAmount === "" || isPending}
          className="rounded-[6px] px-4 py-2.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--cta-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{
            background: "var(--cta-gradient)",
          }}
        >
          {isPending ? "Placing bid…" : "Place emergency bid"}
        </button>
      </div>
      </div>
    </div>
  )
}
