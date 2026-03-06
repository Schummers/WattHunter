"use client";

import { useState, useMemo } from "react";
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
  real_team: string;
  specialty: string;
  nationality: string;
  pcs_points_1yr: number;
  pcs_rank: number | null;
  monthly_salary: number;
  photo_url: string | null;
  age: number | null;
  is_contracted: boolean;
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
    () => [...new Set(riders.map((r) => r.real_team))].sort(),
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
          placeholder="Rechercher un coureur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-[var(--bg-surface)] px-3 text-sm"
        >
          <option value="">Toutes les équipes</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-[var(--bg-surface)] px-3 text-sm"
        >
          <option value="">Toutes spécialités</option>
          <option value="climber">Grimpeur</option>
          <option value="sprinter">Sprinteur</option>
          <option value="rouleur">Rouleur</option>
          <option value="puncheur">Puncheur</option>
          <option value="time_trialist">CLM</option>
          <option value="all_rounder">Polyvalent</option>
        </select>
      </div>

      <span className="text-xs font-medium uppercase text-[var(--text-mid)]">
        {filtered.length} coureurs
      </span>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coureur</TableHead>
            <TableHead>Équipe</TableHead>
            <TableHead>Spé.</TableHead>
            <TableHead>Nat.</TableHead>
            <TableHead className="text-right">PCS</TableHead>
            <TableHead className="text-right">Salaire</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((rider) => (
            <TableRow
              key={rider.id}
              className={
                rider.is_contracted
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:bg-[var(--bg-subtle)]"
              }
              onClick={() => !rider.is_contracted && onRiderClick(rider)}
            >
              <TableCell className="font-medium">{rider.full_name}</TableCell>
              <TableCell className="text-[var(--text-mid)]">{rider.real_team}</TableCell>
              <TableCell>
                <span className="text-xs text-[var(--text-mid)]">
                  {SPECIALTY_LABELS[rider.specialty] ?? rider.specialty}
                </span>
              </TableCell>
              <TableCell className="text-[var(--text-mid)]">{rider.nationality}</TableCell>
              <TableCell className="text-right">{rider.pcs_points_1yr.toLocaleString("fr-FR")}</TableCell>
              <TableCell className="text-right">
                {rider.monthly_salary.toLocaleString("fr-FR")} €
              </TableCell>
              <TableCell>
                {rider.is_contracted && <Badge variant="outline">Recruté</Badge>}
                {myBidRiderIds.has(rider.id) && <Badge variant="secondary">Mise</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
