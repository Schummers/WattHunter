"use client";

import { useState } from "react";
import {
  Zap,
  Rocket,
  Swords,
  Crosshair,
  Users,
  X,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Check,
  Bell,
} from "lucide-react";
import { Tag } from "@/components/pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type TacticId =
  | "unleash"
  | "overdrive"
  | "nemesis_gc"
  | "nemesis_sprint"
  | "call_the_bus";

type TacticState = "available" | "active_today" | "exhausted" | "disabled";

interface TacticDef {
  id: TacticId;
  name: string;
  short: string;
  description: string;
  icon: typeof Zap;
  used: number;
  max: number;
  state: TacticState;
  disabledReason?: string;
}

const TACTICS: TacticDef[] = [
  {
    id: "unleash",
    name: "Unleash",
    short: "Domestiques → ×1.5",
    description:
      "All your domestiques score as Stage Hunters (×1.5) for one stage.",
    icon: Zap,
    used: 0,
    max: 2,
    state: "available",
  },
  {
    id: "overdrive",
    name: "Overdrive",
    short: "Stage Hunters → ×2.0",
    description:
      "Your Stage Hunters jump from ×1.5 to ×2.0 on a single stage.",
    icon: Rocket,
    used: 1,
    max: 2,
    state: "active_today",
  },
  {
    id: "nemesis_gc",
    name: "Nemesis GC",
    short: "Duel a rival GC",
    description:
      "Pick a rival team and a stage. Beat their GC Leader and you score ×2 while they lose 50%.",
    icon: Swords,
    used: 0,
    max: 1,
    state: "available",
  },
  {
    id: "nemesis_sprint",
    name: "Nemesis Sprint",
    short: "Duel a rival sprinter",
    description:
      "Pick a rival team and a stage. Beat their Sprinter and you score ×2 while they lose 50%.",
    icon: Crosshair,
    used: 1,
    max: 1,
    state: "exhausted",
  },
  {
    id: "call_the_bus",
    name: "Call the Bus",
    short: "+ bench riders",
    description:
      "Bench riders score for one stage as domestiques. Effective squad size grows with your level.",
    icon: Users,
    used: 0,
    max: 3,
    state: "available",
  },
];

interface RivalTeam {
  id: string;
  name: string;
  gcLeader: { name: string; xp: number } | null;
  sprinter: { name: string; xp: number } | null;
  teamGtXp: number;
}

const RIVAL_TEAMS: RivalTeam[] = [
  {
    id: "team-a",
    name: "Team Alpha",
    gcLeader: { name: "Tadej Pogačar", xp: 320 },
    sprinter: { name: "Mads Pedersen", xp: 180 },
    teamGtXp: 620,
  },
  {
    id: "team-b",
    name: "Team Bravo",
    gcLeader: { name: "Jonas Vingegaard", xp: 410 },
    sprinter: { name: "Jasper Philipsen", xp: 95 },
    teamGtXp: 705,
  },
  {
    id: "team-c",
    name: "Team Charlie",
    gcLeader: null,
    sprinter: { name: "Olav Kooij", xp: 60 },
    teamGtXp: 290,
  },
];

interface StageInfo {
  number: number;
  date: string;
  label: string;
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean;
}

const STAGES: StageInfo[] = [
  { number: 1, date: "May 8", label: "Durrës → Tirana", status: "past" },
  { number: 2, date: "May 9", label: "Tirana → Tirana (ITT)", status: "past" },
  { number: 3, date: "May 10", label: "Vlorë → Lezhë", status: "today" },
  { number: 4, date: "May 12", label: "Alberobello → Lecce", status: "upcoming" },
  {
    number: 5,
    date: "May 13",
    label: "Ceglie Messapica → Matera",
    status: "upcoming",
    hasTacticActive: true,
  },
  { number: 6, date: "May 14", label: "Potenza → Naples", status: "upcoming" },
  { number: 7, date: "May 15", label: "Castel di Sangro ITT", status: "upcoming" },
  { number: 8, date: "May 16", label: "Giulianova → Castelraimondo", status: "upcoming" },
  { number: 9, date: "May 17", label: "Avezzano → L'Aquila", status: "upcoming" },
  { number: 11, date: "May 19", label: "Foiano → Castelnovo", status: "upcoming" },
  { number: 12, date: "May 20", label: "Modena → Viadana", status: "upcoming" },
];

// ---------------------------------------------------------------------------
// Top-level preview
// ---------------------------------------------------------------------------

type ModalState =
  | { type: "none" }
  | { type: "boost"; tacticId: TacticId }
  | { type: "nemesis"; tacticId: "nemesis_gc" | "nemesis_sprint"; step: 1 | 2; selectedRival?: string };

export function TacticsPreviewClient() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  const openTactic = (t: TacticDef) => {
    if (t.state === "exhausted" || t.state === "disabled") return;
    if (t.id === "nemesis_gc" || t.id === "nemesis_sprint") {
      setModal({ type: "nemesis", tacticId: t.id, step: 1 });
    } else {
      setModal({ type: "boost", tacticId: t.id });
    }
  };

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-6 py-4 pb-24">
      <PreviewBanner />

      {/* Sponsor Goals — placeholder for context */}
      <SectionPlaceholder
        title="Sponsors Goals"
        body="Soudal Quick-Step · €550K · Sprint + Stage Hunter orientation"
      />

      {/* Nemesis incoming alert — collapsible banner */}
      <NemesisIncomingBanner />

      {/* Team Tactics — the focus */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-4">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Team Tactics
          </h2>
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            1 per day · cutoff 11:00 CET
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TACTICS.map((t) => (
            <TacticCard key={t.id} tactic={t} onClick={() => openTactic(t)} />
          ))}
        </div>
      </section>

      {/* Team Composition — placeholder for context */}
      <SectionPlaceholder
        title="Team Composition"
        body="GC Leader · Sprinter · Climber · TT · 2 Stage Hunters · Domestiques"
      />

      {/* Modals */}
      {modal.type === "boost" && (
        <BoostActivationModal
          tactic={TACTICS.find((t) => t.id === modal.tacticId)!}
          onClose={() => setModal({ type: "none" })}
        />
      )}
      {modal.type === "nemesis" && (
        <NemesisModal
          tactic={TACTICS.find((t) => t.id === modal.tacticId)!}
          step={modal.step}
          selectedRival={modal.selectedRival}
          onNext={(rivalId) =>
            setModal({
              type: "nemesis",
              tacticId: modal.tacticId,
              step: 2,
              selectedRival: rivalId,
            })
          }
          onBack={() =>
            setModal({
              type: "nemesis",
              tacticId: modal.tacticId,
              step: 1,
              selectedRival: modal.selectedRival,
            })
          }
          onClose={() => setModal({ type: "none" })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tactic Card
// ---------------------------------------------------------------------------

function TacticCard({
  tactic,
  onClick,
}: {
  tactic: TacticDef;
  onClick: () => void;
}) {
  const Icon = tactic.icon;
  const remaining = tactic.max - tactic.used;
  const isInteractive =
    tactic.state === "available" || tactic.state === "active_today";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        "flex min-w-[140px] shrink-0 snap-start flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
        // States
        tactic.state === "available" &&
          "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
        tactic.state === "active_today" &&
          "border-[var(--accent-default)] bg-[var(--badge-bg)]",
        tactic.state === "exhausted" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-50",
        tactic.state === "disabled" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-60"
      )}
      aria-label={`${tactic.name} — ${remaining} of ${tactic.max} uses remaining`}
    >
      <div className="flex w-full items-start justify-between">
        <Icon
          className={cn(
            "size-5",
            tactic.state === "active_today"
              ? "text-[var(--accent-default)]"
              : "text-[var(--text-mid)]"
          )}
        />
        {tactic.state === "active_today" && (
          <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
            Today
          </Tag>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {tactic.name}
        </span>
        <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {tactic.short}
        </span>
      </div>

      <div className="mt-auto flex w-full items-baseline justify-between">
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {remaining}
          <span className="text-[length:var(--type-caption)] font-normal text-[var(--text-low)]">
            {" "}
            / {tactic.max}
          </span>
        </span>
        {tactic.state === "disabled" && tactic.disabledReason && (
          <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
            {tactic.disabledReason}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Boost Activation Modal — Unleash, Overdrive, Call the Bus
// ---------------------------------------------------------------------------

function BoostActivationModal({
  tactic,
  onClose,
}: {
  tactic: TacticDef;
  onClose: () => void;
}) {
  const Icon = tactic.icon;
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const remaining = tactic.max - tactic.used;

  const upcomingStages = STAGES.filter((s) => s.status !== "past");

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={<Icon className="size-5 text-[var(--accent-default)]" />}
        title={tactic.name}
        subtitle={tactic.short}
        onClose={onClose}
      />

      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        {tactic.description}
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Select stage
        </span>
        <StageCalendar
          stages={upcomingStages}
          selectedNumber={selectedStage}
          onSelect={setSelectedStage}
        />
      </div>

      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-2">
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Remaining uses
        </span>
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {remaining} / {tactic.max}
        </span>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="cta" disabled={selectedStage === null} onClick={onClose}>
          Activate
          <Check className="size-4" />
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Nemesis Modal — 2 steps
// ---------------------------------------------------------------------------

function NemesisModal({
  tactic,
  step,
  selectedRival,
  onNext,
  onBack,
  onClose,
}: {
  tactic: TacticDef;
  step: 1 | 2;
  selectedRival?: string;
  onNext: (rivalId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const Icon = tactic.icon;
  const isGc = tactic.id === "nemesis_gc";
  const myXp = isGc ? 245 : 110;
  const myLeaderName = isGc ? "Primož Roglič" : "Tim Merlier";

  const eligibleRivals = RIVAL_TEAMS.filter((rt) => {
    const role = isGc ? rt.gcLeader : rt.sprinter;
    if (!role) return false;
    return role.xp >= myXp;
  });

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        icon={<Icon className="size-5 text-[var(--accent-default)]" />}
        title={tactic.name}
        subtitle={step === 1 ? "Select rival team" : "Select stage"}
        onClose={onClose}
      />

      {step === 1 && (
        <Step1Rivals
          isGc={isGc}
          myLeaderName={myLeaderName}
          myXp={myXp}
          eligibleRivals={eligibleRivals}
          onSelect={onNext}
        />
      )}

      {step === 2 && selectedRival && (
        <Step2Stage
          rival={RIVAL_TEAMS.find((r) => r.id === selectedRival)!}
          onBack={onBack}
          onDeclare={onClose}
        />
      )}
    </ModalShell>
  );
}

function Step1Rivals({
  isGc,
  myLeaderName,
  myXp,
  eligibleRivals,
  onSelect,
}: {
  isGc: boolean;
  myLeaderName: string;
  myXp: number;
  eligibleRivals: RivalTeam[];
  onSelect: (rivalId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* Your context */}
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
        <div className="flex flex-col">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Your {isGc ? "GC Leader" : "Sprinter"}
          </span>
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {myLeaderName}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {myXp}
          </span>
          <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
            GT XP
          </span>
        </div>
      </div>

      {/* Rival list */}
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Eligible rival teams
        </span>
        {eligibleRivals.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-4 text-center text-[length:var(--type-caption)] text-[var(--text-mid)]">
            No rival team has more GT XP than you yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {eligibleRivals.map((rt) => {
              const role = isGc ? rt.gcLeader! : rt.sprinter!;
              const isSelected = selected === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setSelected(rt.id)}
                  className={cn(
                    "flex items-center justify-between rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-[var(--accent-default)] bg-[var(--badge-bg)]"
                      : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                      {rt.name}
                    </span>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                      {isGc ? "GC Leader" : "Sprinter"}: {role.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
                      {role.xp}
                    </span>
                    <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                      GT XP
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        The duel resolves with the role-holders at 11:00 CET cutoff. If a leader
        changes between now and the stage, the duel adapts.
      </p>

      <ModalFooter>
        <Button
          variant="cta"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Next
          <ArrowRight className="size-4" />
        </Button>
      </ModalFooter>
    </div>
  );
}

function Step2Stage({
  rival,
  onBack,
  onDeclare,
}: {
  rival: RivalTeam;
  onBack: () => void;
  onDeclare: () => void;
}) {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const upcomingStages = STAGES.filter((s) => s.status !== "past");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
        <Swords className="size-4 text-[var(--accent-default)]" />
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Target:
        </span>
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {rival.name}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Select stage
        </span>
        <StageCalendar
          stages={upcomingStages}
          selectedNumber={selectedStage}
          onSelect={setSelectedStage}
        />
      </div>

      {/* Risk warning */}
      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">
        <AlertTriangle className="size-4 shrink-0 text-[var(--warning)]" />
        <div className="flex flex-col gap-1 text-[length:var(--type-caption)]">
          <span className="font-semibold text-[var(--text-high)]">
            Risk: this is a duel, not a guarantee
          </span>
          <span className="text-[var(--text-mid)]">
            Win → you score ×2, they lose 50%. <br />
            Lose → you lose 25%, they gain 25%.
          </span>
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          variant="cta"
          disabled={selectedStage === null}
          onClick={onDeclare}
        >
          Declare Nemesis
          <Swords className="size-4" />
        </Button>
      </ModalFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Calendar — used in both modals
// ---------------------------------------------------------------------------

function StageCalendar({
  stages,
  selectedNumber,
  onSelect,
}: {
  stages: StageInfo[];
  selectedNumber: number | null;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="grid max-h-[200px] grid-cols-3 gap-2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2">
      {stages.map((s) => {
        const isSelected = selectedNumber === s.number;
        const isLocked = s.hasTacticActive;
        const isToday = s.status === "today";
        return (
          <button
            key={s.number}
            type="button"
            onClick={() => !isLocked && onSelect(s.number)}
            disabled={isLocked}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-[var(--radius-sm)] border px-2 py-1.5 text-left transition-colors",
              isSelected &&
                !isLocked &&
                "border-[var(--accent-default)] bg-[var(--badge-bg)]",
              !isSelected &&
                !isLocked &&
                "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]",
              isLocked &&
                "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-50",
              isToday && !isSelected && !isLocked && "border-[var(--accent-default)]"
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[length:var(--type-caption)] font-bold tabular-nums text-[var(--text-high)]">
                S{s.number}
              </span>
              {isToday && (
                <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--accent-default)]">
                  Today
                </span>
              )}
            </div>
            <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
              {s.date}
            </span>
            {isLocked && (
              <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                Locked
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell — bottom sheet on mobile, centered on desktop
// ---------------------------------------------------------------------------

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] lg:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col gap-4 overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--bg-surface)] p-4 lg:max-w-md lg:rounded-[var(--radius-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  icon,
  title,
  subtitle,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <div className="flex flex-col">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            {title}
          </h2>
          {subtitle && (
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">{children}</div>
  );
}

// ---------------------------------------------------------------------------
// Nemesis incoming alert banner
// ---------------------------------------------------------------------------

function NemesisIncomingBanner() {
  return (
    <div className="mx-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-3">
      <Bell className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Nemesis incoming
        </span>
        <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
          <span className="font-semibold text-[var(--text-high)]">Team Bravo</span>{" "}
          targets your GC Leader on{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--text-high)]">
            S5
          </span>{" "}
          (May 13). If they win, you lose 50%. If you win, you gain 25%.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc — placeholder + preview banner
// ---------------------------------------------------------------------------

function SectionPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="px-4">
      <h2 className="mb-2 text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
        {title}
      </h2>
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          {body}
        </span>
      </div>
    </section>
  );
}

function PreviewBanner() {
  return (
    <div className="mx-4 mt-2 rounded-[var(--radius-md)] border border-[var(--accent-default)] bg-[var(--badge-bg)] px-3 py-2">
      <span className="text-[length:var(--type-caption)] text-[var(--accent-label)]">
        Wireframe preview · GT Tactics ·{" "}
        <span className="text-[var(--text-mid)]">
          tap a card to open its modal
        </span>
      </span>
    </div>
  );
}
