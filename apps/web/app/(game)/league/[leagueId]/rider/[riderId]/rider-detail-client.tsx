"use client";

import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MetricBox } from "@/components/metric-box";
import { SegmentedControl } from "@/components/segmented-control";
import { BackHeader } from "@/components/back-header";

interface Rider {
  id: string;
  full_name: string;
  nationality: string | null;
  team_name: string | null;
  pcs_rank: number | null;
  pcs_points_1yr: number | null;
  photo_url: string | null;
  specialty: string | null;
  birthdate: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

interface SeasonRanking {
  id: string;
  rider_id: string;
  season: number;
  pcs_points: number | null;
  pcs_rank: number | null;
  team_name: string | null;
}

interface RiderDetailClientProps {
  rider: Rider;
  rankings: SeasonRanking[];
  isOwned: boolean;
}

function getAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RiderDetailClient({
  rider,
  rankings,
  isOwned,
}: RiderDetailClientProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const age = getAge(rider.birthdate);

  return (
    <div className="space-y-6 py-2">
      <BackHeader label="Back" />

      {/* Hero */}
      <div className="flex flex-col items-center gap-2 px-4">
        <Avatar className="size-14">
          {rider.photo_url ? (
            <AvatarImage src={rider.photo_url} alt={rider.full_name} />
          ) : null}
          <AvatarFallback>{getInitials(rider.full_name)}</AvatarFallback>
        </Avatar>

        {rider.pcs_rank && (
          <Badge variant="outline" className="text-[10px]">
            PCS #{rider.pcs_rank}
          </Badge>
        )}

        <h1 className="text-lg font-black text-[var(--text-high)]">
          {rider.full_name}
          {rider.nationality && (
            <span className="ml-1.5 text-sm font-normal text-[var(--text-mid)]">
              {rider.nationality}
            </span>
          )}
        </h1>

        {rider.team_name && (
          <p className="text-sm text-[var(--text-mid)]">{rider.team_name}</p>
        )}

        {/* Tags */}
        <div className="flex gap-2">
          {rider.specialty && (
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-mid)]">
              {rider.specialty}
            </span>
          )}
          {age !== null && (
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-mid)]">
              {age} yrs
            </span>
          )}
          {rider.height_cm && (
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-mid)]">
              {rider.height_cm} cm
            </span>
          )}
          {rider.weight_kg && (
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-mid)]">
              {rider.weight_kg} kg
            </span>
          )}
        </div>
      </div>

      {/* Metric Boxes */}
      <div className="flex gap-3 px-4">
        <MetricBox
          value={
            rider.pcs_points_1yr != null
              ? rider.pcs_points_1yr.toLocaleString()
              : "--"
          }
          label="PCS Points"
        />
        <MetricBox
          value={rider.pcs_rank != null ? `#${rider.pcs_rank}` : "--"}
          label="PCS Rank"
        />
        <MetricBox value="--" label="Game XP" highlight={isOwned} />
      </div>

      {/* Segmented Control */}
      <div className="px-4">
        <SegmentedControl
          segments={["PCS Stats", "Game Stats"]}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />
      </div>

      {/* Tab Content */}
      <div className="px-4">
        {tabIndex === 0 ? (
          <div className="space-y-3">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Season Rankings
            </span>

            {rankings.length === 0 ? (
              <p className="text-sm text-[var(--text-mid)]">
                No season data available.
              </p>
            ) : (
              <div className="space-y-1">
                {rankings.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[var(--text-high)]">
                        {r.season}
                      </span>
                      {r.team_name && (
                        <span className="text-[11px] text-[var(--text-low)]">
                          {r.team_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm font-bold text-[var(--text-high)]">
                          {r.pcs_points != null
                            ? r.pcs_points.toLocaleString()
                            : "--"}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
                          pts
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm font-bold text-[var(--text-mid)]">
                          {r.pcs_rank != null ? `#${r.pcs_rank}` : "--"}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
                          rank
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Game Statistics
            </span>
            <p className="text-sm text-[var(--text-mid)]">
              Game stats will be available once this rider is on a team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
