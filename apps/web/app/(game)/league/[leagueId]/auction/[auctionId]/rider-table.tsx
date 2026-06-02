"use client";

import { useState, useMemo } from "react";
import { countryCodeToFlag } from "@/lib/format";
import { RiderPrice } from "@/components/rider-price";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Rider {
  id: string;
  full_name: string;
  real_team: string | null;
  specialty: string | null;
  nationality: string | null;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
  is_contracted: boolean;
  cooldown_until: string | null;
}

interface RiderTableProps {
  riders: Rider[];
  myBidRiderIds: Set<string>;
  onRiderClick: (rider: Rider) => void;
}

const SPECIALTY_LABELS: Record<string, string> = {
  climber: "GRI",
  sprinter: "SPR",
  rouleur: "ROU",
  puncheur: "PUN",
  time_trialist: "CLM",
  all_rounder: "POL",
};

export function RiderTable({ riders, myBidRiderIds, onRiderClick }: RiderTableProps) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const teams = useMemo(
    () => [...new Set(riders.map((r) => r.real_team).filter(Boolean))].sort() as string[],
    [riders]
  );

  const filtered = useMemo(() => {
    return riders
      .filter((r) => {
        if (search && !r.full_name.toLowerCase().includes(search.toLowerCase())) return false;
        if (teamFilter && r.real_team !== teamFilter) return false;
        if (specialtyFilter && r.specialty !== specialtyFilter) return false;
        return true;
      })
      .sort((a, b) => b.pcs_points_1yr - a.pcs_points_1yr);
  }, [riders, search, teamFilter, specialtyFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search rider..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[length:var(--type-body)]"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          className="h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[length:var(--type-body)]"
        >
          <option value="">All specialties</option>
          <option value="climber">Climber</option>
          <option value="sprinter">Sprinter</option>
          <option value="rouleur">Rouleur</option>
          <option value="puncheur">Puncheur</option>
          <option value="time_trialist">Time Trialist</option>
          <option value="all_rounder">All-Rounder</option>
        </select>
      </div>

      <span className="text-[length:var(--type-caption)] font-medium uppercase text-[var(--text-mid)]">
        {filtered.length} riders
      </span>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rider</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Spec.</TableHead>
            <TableHead>Nat.</TableHead>
            <TableHead className="text-right">PCS</TableHead>
            <TableHead className="text-right">Salary</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((rider) => {
            const disabled = rider.is_contracted || !!rider.cooldown_until;
            return (
              <TableRow
                key={rider.id}
                className={
                  disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "cursor-pointer hover:bg-[var(--bg-subtle)]"
                }
                onClick={() => !disabled && onRiderClick(rider)}
              >
                <TableCell className="font-medium">{rider.full_name}</TableCell>
                <TableCell className="text-[var(--text-mid)]">{rider.real_team}</TableCell>
                <TableCell>
                  <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                    {rider.specialty ? (SPECIALTY_LABELS[rider.specialty] ?? rider.specialty) : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-[var(--text-mid)]">{rider.nationality ? countryCodeToFlag(rider.nationality) : "—"}</TableCell>
                <TableCell className="text-right font-mono">{rider.pcs_points_1yr.toLocaleString("en-US")}</TableCell>
                <TableCell className="text-right">
                  <RiderPrice amount={rider.monthly_salary} />
                </TableCell>
                <TableCell>
                  {rider.is_contracted && <Badge variant="default">Signed</Badge>}
                  {rider.cooldown_until && (
                    <Badge variant="warning">
                      Available {new Date(rider.cooldown_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Badge>
                  )}
                  {myBidRiderIds.has(rider.id) && <Badge variant="highlighted">Bid</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
