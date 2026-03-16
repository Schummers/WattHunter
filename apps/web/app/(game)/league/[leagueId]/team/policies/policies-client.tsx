"use client";

import { useState, useMemo, useCallback } from "react";
import { Lock, Info, Save, Target, Globe, Users, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyBar } from "@/components/sticky-bar";
import { Tag } from "@/components/pill";
import { POLICY_TYPES, getMaxActivePolicies } from "@/lib/policies";
import { riderMatchesPolicy } from "@/lib/boost";
import { countryCodeToFlag } from "@/lib/format";
import { savePolicies } from "./actions";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Target,
  Globe,
  Users,
  Clock,
};

interface PolicyState {
  isActive: boolean;
  config: Record<string, string> | null;
  hasPending?: boolean;
  pendingIsActive?: boolean;
  pendingConfig?: Record<string, string> | null;
}

interface RosterRider {
  nationality: string | null;
  real_team: string | null;
  specialty: string | null;
  birthdate: string | null;
}

interface PoliciesClientProps {
  teamId: string;
  leagueId: string;
  level: number;
  initialPolicies: Record<string, PolicyState>;
  nationalities: string[];
  teams: string[];
  rosterRiders: RosterRider[];
  nextPhaseName?: string | null;
}

export function PoliciesClient({
  teamId,
  leagueId,
  level,
  initialPolicies,
  nationalities,
  teams,
  rosterRiders,
  nextPhaseName,
}: PoliciesClientProps) {
  const [localPolicies, setLocalPolicies] = useState<Record<string, PolicyState>>(initialPolicies);
  const [savedPolicies, setSavedPolicies] = useState<Record<string, PolicyState>>(initialPolicies);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const maxActive = getMaxActivePolicies(level);
  const activeCount = Object.values(localPolicies).filter((p) => p.isActive).length;

  const hasChanges = useMemo(() => {
    return JSON.stringify(localPolicies) !== JSON.stringify(savedPolicies);
  }, [localPolicies, savedPolicies]);

  // Coverage calculation
  const { coveredCount, totalRiders, boostPct } = useMemo(() => {
    const activePols = POLICY_TYPES
      .filter((pt) => localPolicies[pt.slug]?.isActive)
      .map((pt) => ({
        slug: pt.slug,
        xp_bonus: 0.05,
        config: localPolicies[pt.slug]?.config ?? null,
      }));

    const total = rosterRiders.length;
    if (total === 0 || activePols.length === 0) {
      return { coveredCount: 0, totalRiders: total, boostPct: 0 };
    }

    const covered = rosterRiders.filter((rider) =>
      activePols.some((pol) => riderMatchesPolicy(rider, pol))
    ).length;

    const boost = activePols.reduce((sum, pol) => {
      const matches = rosterRiders.filter((r) => riderMatchesPolicy(r, pol)).length;
      return sum + matches * 5;
    }, 0);

    return { coveredCount: covered, totalRiders: total, boostPct: boost };
  }, [localPolicies, rosterRiders]);

  const handleToggle = useCallback((slug: string, checked: boolean) => {
    setLocalPolicies((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], isActive: checked },
    }));
    setSavedBanner(false);
  }, []);

  const handleConfigChange = useCallback((slug: string, key: string, value: string) => {
    setLocalPolicies((prev) => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        config: { ...(prev[slug]?.config ?? {}), [key]: value },
      },
    }));
    setSavedBanner(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    const payload = POLICY_TYPES.map((pt) => ({
      slug: pt.slug,
      isActive: localPolicies[pt.slug]?.isActive ?? false,
      config: localPolicies[pt.slug]?.config ?? null,
    }));
    const result = await savePolicies(teamId, leagueId, payload);
    setSaving(false);
    if (result.success) {
      setSavedPolicies({ ...localPolicies });
      setSavedBanner(true);
    } else if (result.error) {
      alert(result.error);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {/* PO-6: Pending banner */}
      {savedBanner ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Save size={14} className="shrink-0 text-[var(--text-high)]" />
            <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              Changes saved — active from {nextPhaseName ?? "next phase"}
            </p>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {POLICY_TYPES.filter((pt) => localPolicies[pt.slug]?.isActive).map((pt) => {
              const config = localPolicies[pt.slug]?.config;
              const value = config?.[pt.paramKey] ?? null;
              const IconComp = ICON_MAP[pt.icon];
              return (
                <li key={pt.slug} className="flex items-center gap-1.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {IconComp && <IconComp size={12} />}
                  {pt.name}{value ? ` · ${value}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--bg-subtle)] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
            Change will take effect after the next auction phase.
          </p>
        </div>
      )}

      {/* PO-4: Section header */}
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Slots
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          {activeCount} / {maxActive} max active
        </span>
      </div>

      {/* Separator */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* PO-1: Flat list of all 4 types */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {POLICY_TYPES.map((policy) => {
          const isUnlocked = level >= policy.unlockLevel;
          const isActive = localPolicies[policy.slug]?.isActive ?? false;
          const isForced = level === 1 && policy.slug === "specialist" && maxActive === 1;
          const maxReached = !isActive && activeCount >= maxActive;
          const config = localPolicies[policy.slug]?.config;
          const hasPending = initialPolicies[policy.slug]?.hasPending ?? false;
          const IconComp = ICON_MAP[policy.icon];

          return (
            <div
              key={policy.slug}
              className={`py-4 ${!isUnlocked ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {IconComp && <IconComp size={16} className={isUnlocked ? "text-[var(--text-high)]" : "text-[var(--text-ghost)]"} />}
                    <span
                      className={`text-[length:var(--type-emphasis)] font-semibold ${
                        isUnlocked ? "text-[var(--text-high)]" : "text-[var(--text-ghost)]"
                      }`}
                    >
                      {policy.name}
                    </span>
                    {!isUnlocked && (
                      <Tag variant="default">
                        <Lock size={10} className="inline mr-0.5" />
                        Lv.{policy.unlockLevel}
                      </Tag>
                    )}
                    {hasPending && !savedBanner && (
                      <Tag variant="warning">
                        Pending
                      </Tag>
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

                {/* PO-2: Toggle on RIGHT */}
                <Switch
                  checked={isActive}
                  disabled={!isUnlocked || (isForced && isActive) || maxReached}
                  onCheckedChange={(checked) => handleToggle(policy.slug, checked)}
                  className={`shrink-0 ${
                    isForced && isActive ? "opacity-50" : ""
                  } ${!isUnlocked ? "opacity-30" : ""}`}
                />
              </div>

              {/* PO-3: Select dropdown (conditional) */}
              {isActive && isUnlocked && (
                <div className="mt-3">
                  {policy.slug === "specialist" && (
                    <Select
                      value={config?.specialty ?? ""}
                      onValueChange={(v) => handleConfigChange(policy.slug, "specialty", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {policy.options!.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {policy.slug === "national_pride" && (
                    <Select
                      value={config?.nationality ?? ""}
                      onValueChange={(v) => handleConfigChange(policy.slug, "nationality", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        {nationalities.map((nat) => (
                          <SelectItem key={nat} value={nat}>
                            {countryCodeToFlag(nat)} {nat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {policy.slug === "team_chemistry" && (
                    <Select
                      value={config?.team ?? ""}
                      onValueChange={(v) => handleConfigChange(policy.slug, "team", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {policy.slug === "young_blood" && (
                    <Select
                      value={config?.max_age ?? ""}
                      onValueChange={(v) => handleConfigChange(policy.slug, "max_age", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select max age" />
                      </SelectTrigger>
                      <SelectContent>
                        {policy.options!.map((opt) => (
                          <SelectItem key={opt} value={opt}>Under {opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PO-5: Sticky footer */}
      <StickyBar saveEnabled={hasChanges} onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              {coveredCount} / {totalRiders} riders covered
            </span>
            <span className="text-[length:var(--type-body)] font-bold font-mono text-[var(--accent-highlight)]">
              +{boostPct}% boost
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-lg cta-gradient px-4 py-1.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--cta-text)] disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </StickyBar>
    </div>
  );
}
