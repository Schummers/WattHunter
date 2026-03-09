import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { Switch } from "@/components/ui/switch";
import { Lock } from "lucide-react";

const POLICY_TYPES = [
  {
    key: "speciality",
    name: "Speciality",
    description: "Boost riders matching a specific specialty (GC, Sprint, TT, One Day).",
    unlockLevel: 1,
  },
  {
    key: "nationality",
    name: "Nationality",
    description: "Boost riders from a specific country or region.",
    unlockLevel: 3,
  },
  {
    key: "teams",
    name: "Teams",
    description: "Boost riders belonging to a specific pro team.",
    unlockLevel: 5,
  },
  {
    key: "age",
    name: "Age",
    description: "Boost riders within a specific age range.",
    unlockLevel: 7,
  },
];

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view policies.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(level)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;
  const level = team?.level ?? 1;

  // Max active policies: 1 for levels 1-4, 2 for levels 5+
  const maxActive = level >= 5 ? 2 : 1;

  return (
    <div className="min-h-screen">
      <BackHeader label="My Team" />

      <div className="px-4 pt-4 space-y-4">
        {/* Banner */}
        <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
            Changes apply to the next round. Current policies active until round
            closes.
          </p>
        </div>

        {/* Policy slots */}
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
                <div
                  key={policy.key}
                  className="flex items-center gap-3 py-4"
                >
                  {/* Toggle */}
                  <Switch checked={false} disabled={!isUnlocked} className="shrink-0" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[length:var(--type-emphasis)] font-semibold ${
                          isUnlocked
                            ? "text-[var(--text-high)]"
                            : "text-[var(--text-ghost)]"
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
                        isUnlocked
                          ? "text-[var(--text-mid)]"
                          : "text-[var(--text-ghost)]"
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
    </div>
  );
}
