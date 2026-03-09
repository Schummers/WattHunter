"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Switch } from "@/components/ui/switch";
import { Lock } from "lucide-react";

const POLICY_TYPES = [
  { key: "speciality", name: "Speciality", description: "Boost riders matching a specific specialty (GC, Sprint, TT, One Day).", unlockLevel: 1 },
  { key: "nationality", name: "Nationality", description: "Boost riders from a specific country or region.", unlockLevel: 3 },
  { key: "teams", name: "Teams", description: "Boost riders belonging to a specific pro team.", unlockLevel: 5 },
  { key: "age", name: "Age", description: "Boost riders within a specific age range.", unlockLevel: 7 },
];

interface Props {
  leagueId: string;
}

export default function PoliciesRail({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from("league_members")
        .select("id, team_id, teams:team_id(level)")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();

      if (!cancelled && member) {
        const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
        setLevel((team as any)?.level ?? 1);
      }
      if (!cancelled) setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-default)]" />
      </div>
    );
  }

  const maxActive = level >= 5 ? 2 : 1;

  return (
    <div className="px-4 pt-4 space-y-4">
      <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
        <p className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
          Changes apply to the next round. Current policies active until round closes.
        </p>
      </div>

      <div className="space-y-0">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Policy slots
          </span>
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            {maxActive} max active
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {POLICY_TYPES.map((policy) => {
            const isUnlocked = level >= policy.unlockLevel;
            return (
              <div key={policy.key} className="flex items-center gap-3 py-4">
                <Switch checked={false} disabled={!isUnlocked} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[length:var(--type-emphasis)] font-semibold ${
                        isUnlocked ? "text-[var(--text-high)]" : "text-[var(--text-ghost)]"
                      }`}
                    >
                      {policy.name}
                    </span>
                    {!isUnlocked && (
                      <span className="flex items-center gap-1 text-[length:var(--type-caption)] text-[var(--text-ghost)]">
                        <Lock size={12} />
                        Unlock Lv.{policy.unlockLevel}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[length:var(--type-caption)] mt-0.5 ${
                      isUnlocked ? "text-[var(--text-mid)]" : "text-[var(--text-ghost)]"
                    }`}
                  >
                    {policy.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
