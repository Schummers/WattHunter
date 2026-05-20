"use client";

import { useState, useMemo, useCallback } from "react";
import { Lock, Save, Target, Globe, Users, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyBar } from "@/components/sticky-bar";
import { Tag } from "@/components/pill";
import { STRATEGY_TYPES, getMaxActiveStrategies } from "@/lib/strategies";
import { riderMatchesStrategy } from "@/lib/boost";
import { countryCodeToFlag } from "@/lib/format";
import { saveStrategies } from "./actions";

const SPECIALTY_LABELS: Record<string, string> = { GC: "GC", Sprint: "Sprint", TT: "TT", OneDay: "One-day" };

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Target,
  Globe,
  Users,
  Clock,
};

interface StrategyState {
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

interface StrategiesClientProps {
  teamId: string;
  leagueId: string;
  level: number;
  initialStrategies: Record<string, StrategyState>;
  nationalities: string[];
  teams: string[];
  rosterRiders: RosterRider[];
  nextPhaseName?: string | null;
  isInAuctionWindow: boolean;
}

export function StrategiesClient({
  teamId,
  leagueId,
  level,
  initialStrategies,
  nationalities,
  teams,
  rosterRiders,
  nextPhaseName,
  isInAuctionWindow,
}: StrategiesClientProps) {
  const [localStrategies, setLocalStrategies] = useState<Record<string, StrategyState>>(initialStrategies);
  const [savedStrategies, setSavedStrategies] = useState<Record<string, StrategyState>>(initialStrategies);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<"immediate" | "pending" | false>(false);

  const maxActive = getMaxActiveStrategies(level);
  const activeCount = Object.values(localStrategies).filter((s) => s.isActive).length;
  const hasPendingOnLoad = Object.values(initialStrategies).some((s) => s.hasPending);

  const hasChanges = useMemo(() => {
    return JSON.stringify(localStrategies) !== JSON.stringify(savedStrategies);
  }, [localStrategies, savedStrategies]);

  // Coverage calculation
  const { coveredCount, totalRiders, boostPct } = useMemo(() => {
    const activeStrats = STRATEGY_TYPES
      .filter((st) => localStrategies[st.slug]?.isActive)
      .map((st) => ({
        slug: st.slug,
        xp_bonus: 0.05,
        config: localStrategies[st.slug]?.config ?? null,
      }));

    const total = rosterRiders.length;
    if (total === 0 || activeStrats.length === 0) {
      return { coveredCount: 0, totalRiders: total, boostPct: 0 };
    }

    const covered = rosterRiders.filter((rider) =>
      activeStrats.some((strat) => riderMatchesStrategy(rider, strat))
    ).length;

    const boost = activeStrats.reduce((sum, strat) => {
      const matches = rosterRiders.filter((r) => riderMatchesStrategy(r, strat)).length;
      return sum + matches * 5;
    }, 0);

    return { coveredCount: covered, totalRiders: total, boostPct: boost };
  }, [localStrategies, rosterRiders]);

  const handleToggle = useCallback((slug: string, checked: boolean) => {
    setLocalStrategies((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], isActive: checked },
    }));
    setSavedBanner(false);
  }, []);

  const handleConfigChange = useCallback((slug: string, key: string, value: string) => {
    setLocalStrategies((prev) => ({
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
    const payload = STRATEGY_TYPES.map((st) => ({
      slug: st.slug,
      isActive: localStrategies[st.slug]?.isActive ?? false,
      config: localStrategies[st.slug]?.config ?? null,
    }));
    const result = await saveStrategies(teamId, leagueId, payload);
    setSaving(false);
    if (result.success) {
      setSavedStrategies({ ...localStrategies });
      setSavedBanner(result.immediate ? "immediate" : "pending");
    } else if (result.error) {
      alert(result.error);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Pending / saved banner */}
      {savedBanner === "immediate" ? (
        <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Save size={14} className="shrink-0 text-[var(--text-high)]" />
            <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              Changes applied
            </p>
          </div>
        </div>
      ) : savedBanner === "pending" || (!savedBanner && hasPendingOnLoad) ? (
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Save size={14} className="shrink-0 text-[var(--text-high)]" />
            <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              Changes saved — active from {nextPhaseName ?? "next phase"}
            </p>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {STRATEGY_TYPES.filter((st) => localStrategies[st.slug]?.isActive).map((st) => {
              const config = localStrategies[st.slug]?.config;
              const value = config?.[st.paramKey] ?? null;
              const IconComp = ICON_MAP[st.icon];
              return (
                <li key={st.slug} className="flex items-center gap-1.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {IconComp && <IconComp size={12} />}
                  {st.name}{value ? ` · ${value}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--bg-subtle)] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
            {isInAuctionWindow
              ? "Changes apply now. Update anytime while a round is open."
              : "Auction closed — changes apply from the next phase."}
          </p>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Slots
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          <span className="font-mono tabular-nums">{activeCount}</span> / <span className="font-mono tabular-nums">{maxActive}</span> max active
        </span>
      </div>

      {/* Separator */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Flat list of all 4 types */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {STRATEGY_TYPES.map((strategy) => {
          const isUnlocked = level >= strategy.unlockLevel;
          const isActive = localStrategies[strategy.slug]?.isActive ?? false;
          const maxReached = !isActive && activeCount >= maxActive;
          const config = localStrategies[strategy.slug]?.config;
          const hasPending = initialStrategies[strategy.slug]?.hasPending ?? false;
          const IconComp = ICON_MAP[strategy.icon];

          return (
            <div
              key={strategy.slug}
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
                      {strategy.name}
                    </span>
                    {!isUnlocked && (
                      <Tag variant="default">
                        <Lock size={10} className="inline mr-0.5" />
                        Lv.{strategy.unlockLevel}
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
                    {strategy.description}
                  </p>
                </div>

                {/* Toggle on RIGHT */}
                <Switch
                  checked={isActive}
                  disabled={!isUnlocked || maxReached}
                  onCheckedChange={(checked) => handleToggle(strategy.slug, checked)}
                  className={`shrink-0 ${!isUnlocked ? "opacity-30" : ""}`}
                />
              </div>

              {/* Select dropdown (conditional) */}
              {isActive && isUnlocked && (
                <div className="mt-3">
                  {strategy.slug === "specialist" && (
                    <Select
                      value={config?.specialty ?? ""}
                      onValueChange={(v) => handleConfigChange(strategy.slug, "specialty", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        {strategy.options!.map((opt) => (
                          <SelectItem key={opt} value={opt}>{SPECIALTY_LABELS[opt] ?? opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {strategy.slug === "national_pride" && (
                    <Select
                      value={config?.nationality ?? ""}
                      onValueChange={(v) => handleConfigChange(strategy.slug, "nationality", v)}
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

                  {strategy.slug === "team_chemistry" && (
                    <Select
                      value={config?.team ?? ""}
                      onValueChange={(v) => handleConfigChange(strategy.slug, "team", v)}
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

                  {strategy.slug === "young_blood" && (
                    <Select
                      value={config?.max_age ?? ""}
                      onValueChange={(v) => handleConfigChange(strategy.slug, "max_age", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select max age" />
                      </SelectTrigger>
                      <SelectContent>
                        {strategy.options!.map((opt) => (
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

      {/* Sticky footer */}
      <StickyBar saveEnabled={hasChanges} onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              <span className="font-mono tabular-nums">{coveredCount}</span> / <span className="font-mono tabular-nums">{totalRiders}</span> riders covered
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
