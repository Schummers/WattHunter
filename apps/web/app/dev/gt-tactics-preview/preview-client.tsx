"use client";

import { useState } from "react";
import {
  Zap,
  Rocket,
  Swords,
  Crosshair,
  Users,
  X,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { Tag } from "@/components/pill";
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
      "Pick a stage. All your domestiques score as Stage Hunters (×1.5) for that stage only. Bypasses the 2-Stage-Hunter cap.",
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
      "Pick a stage. Your Stage Hunters jump from ×1.5 to ×2.0 for that stage only.",
    icon: Rocket,
    used: 1,
    max: 2,
    state: "active_today",
  },
  {
    id: "nemesis_gc",
    name: "Nemesis GC",
    short: "Duel a rival GC Leader",
    description:
      "Pick a rival team and a stage. Whoever holds the GC Leader role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
    icon: Swords,
    used: 0,
    max: 1,
    state: "available",
  },
  {
    id: "nemesis_sprint",
    name: "Nemesis Sprint",
    short: "Duel a rival Sprinter",
    description:
      "Pick a rival team and a stage. Whoever holds the Sprinter role at 11:00 CET cutoff fights for each side — a last-minute swap changes the duel.",
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
      "Pick a stage. Bench riders score for that stage as domestiques (×1.0). Effective squad grows with your level.",
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
}

const RIVAL_TEAMS: RivalTeam[] = [
  {
    id: "team-a",
    name: "Team Alpha",
    gcLeader: { name: "Tadej Pogačar", xp: 320 },
    sprinter: { name: "Mads Pedersen", xp: 180 },
  },
  {
    id: "team-b",
    name: "Team Bravo",
    gcLeader: { name: "Jonas Vingegaard", xp: 410 },
    sprinter: { name: "Jasper Philipsen", xp: 95 },
  },
  {
    id: "team-c",
    name: "Team Charlie",
    gcLeader: null,
    sprinter: { name: "Olav Kooij", xp: 60 },
  },
];

interface StageInfo {
  number: number;
  date: string;
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean;
}

const STAGES: StageInfo[] = [
  { number: 1, date: "May 8", status: "past" },
  { number: 2, date: "May 9", status: "past" },
  { number: 3, date: "May 10", status: "today" },
  { number: 4, date: "May 12", status: "upcoming" },
  { number: 5, date: "May 13", status: "upcoming", hasTacticActive: true },
  { number: 6, date: "May 14", status: "upcoming" },
  { number: 7, date: "May 15", status: "upcoming" },
  { number: 8, date: "May 16", status: "upcoming" },
  { number: 9, date: "May 17", status: "upcoming" },
  { number: 11, date: "May 19", status: "upcoming" },
  { number: 12, date: "May 20", status: "upcoming" },
];

// ---------------------------------------------------------------------------
// Top-level preview
// ---------------------------------------------------------------------------

type ModalState =
  | { type: "none" }
  | { type: "boost"; tacticId: TacticId }
  | { type: "nemesis"; tacticId: "nemesis_gc" | "nemesis_sprint" };

export function TacticsPreviewClient() {
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  const openTactic = (t: TacticDef) => {
    if (t.state === "exhausted" || t.state === "disabled") return;
    if (t.id === "nemesis_gc" || t.id === "nemesis_sprint") {
      setModal({ type: "nemesis", tacticId: t.id });
    } else {
      setModal({ type: "boost", tacticId: t.id });
    }
  };

  return (
    <div className="mx-auto flex max-w-[600px] flex-col gap-6 py-4 pb-24">
      <PreviewBanner />

      {/* Banner Nemesis incoming — top of page */}
      <NemesisIncomingBanner />

      {/* Sponsor Goals — placeholder for context */}
      <SectionPlaceholder
        title="Sponsors Goals"
        body="Soudal Quick-Step · €550K · Sprint + Stage Hunter orientation"
      />

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
  const [selectedStage, setSelectedStage] = useState<string>("");
  const remaining = tactic.max - tactic.used;

  return (
    <ModalShell
      onClose={onClose}
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={onClose}
          submitLabel="Activate"
          submitDisabled={!selectedStage}
        />
      }
    >
      <div className="flex h-full flex-col gap-4 p-4">
        {/* Fixed top */}
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left`}
          subtitleMono
          onClose={onClose}
        />

        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {tactic.description}
        </p>

        {/* Stage list takes remaining height, scrolls inside */}
        <div className="flex flex-1 flex-col gap-2 min-h-0">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Target stage
          </span>
          <StageList value={selectedStage} onChange={setSelectedStage} fillParent />
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Nemesis Modal — single page (team + stage + risk explained upfront)
// ---------------------------------------------------------------------------

function NemesisModal({
  tactic,
  onClose,
}: {
  tactic: TacticDef;
  onClose: () => void;
}) {
  const Icon = tactic.icon;
  const isGc = tactic.id === "nemesis_gc";
  const myXp = isGc ? 245 : 110;
  const myLeaderName = isGc ? "Primož Roglič" : "Tim Merlier";
  const roleLabel = isGc ? "GC Leader" : "Sprinter";

  const eligibleRivals = RIVAL_TEAMS.filter((rt) => {
    const role = isGc ? rt.gcLeader : rt.sprinter;
    if (!role) return false;
    return role.xp >= myXp;
  });

  const [selectedRival, setSelectedRival] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const canDeclare = !!selectedRival && !!selectedStage;
  const remaining = tactic.max - tactic.used;

  return (
    <ModalShell
      onClose={onClose}
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={onClose}
          submitLabel="Declare Nemesis"
          submitDisabled={!canDeclare}
        />
      }
    >
      <div className="flex h-full flex-col gap-4 p-4">
        {/* === Fixed top section === */}
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left`}
          subtitleMono
          onClose={onClose}
        />

        {/* Single description — duel + cutoff in one paragraph */}
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {tactic.description}
        </p>

        {/* Risk warning */}
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
          <div className="flex flex-col gap-1 text-[length:var(--type-caption)]">
            <span className="font-semibold text-[var(--text-high)]">
              This is a duel, not a guarantee
            </span>
            <span className="text-[var(--text-mid)]">
              <strong className="text-[var(--text-high)]">Win</strong> → you
              score ×2, they lose 50%. <br />
              <strong className="text-[var(--text-high)]">Lose</strong> → you
              lose 25%, they gain 25%.
            </span>
          </div>
        </div>

        {/* Your leader info */}
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
          <div className="flex flex-col">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Your {roleLabel}
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

        {/*
          === Lists area ===
          Splits remaining vertical space between the two lists.
          Each list has its own scroll. The modal body itself never scrolls.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Rival team list */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Rival team
              </span>
              <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                ≥ your GT XP
              </span>
            </div>
            {eligibleRivals.length === 0 ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-4 text-center text-[length:var(--type-caption)] text-[var(--text-mid)]">
                No rival team has matched or exceeded your GT XP yet.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]">
                <div className="flex flex-col">
                  {eligibleRivals.map((rt, i) => (
                    <RivalRow
                      key={rt.id}
                      rival={rt}
                      isGc={isGc}
                      isSelected={selectedRival === rt.id}
                      isFirst={i === 0}
                      onSelect={() => setSelectedRival(rt.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Target stage list */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Target stage
            </span>
            <StageList
              value={selectedStage}
              onChange={setSelectedStage}
              fillParent
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Rival Row — radio button + team info (matches sponsors marketplace pattern)
// ---------------------------------------------------------------------------

function RivalRow({
  rival,
  isGc,
  isSelected,
  isFirst,
  onSelect,
}: {
  rival: RivalTeam;
  isGc: boolean;
  isSelected: boolean;
  isFirst: boolean;
  onSelect: () => void;
}) {
  const role = isGc ? rival.gcLeader! : rival.sprinter!;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
        !isFirst && "border-t border-[var(--border-subtle)]",
        isSelected
          ? "bg-[var(--badge-bg)]"
          : "hover:bg-[var(--bg-surface-hover)]"
      )}
    >
      <div
        role="radio"
        aria-checked={isSelected}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isSelected
            ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
            : "border-[var(--border-default)] bg-transparent"
        )}
      >
        {isSelected && (
          <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {rival.name}
        </span>
        <span className="truncate text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {role.name}
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
}

// ---------------------------------------------------------------------------
// Stage list — scrollable rows with radio button (mobile-friendly)
// Matches the Rival Teams pattern in NemesisModal
// ---------------------------------------------------------------------------

function StageList({
  value,
  onChange,
  fillParent,
}: {
  value: string;
  onChange: (v: string) => void;
  /**
   * When true, fills the parent flex container and scrolls within it.
   * When false (default), uses a max-height of 224px.
   */
  fillParent?: boolean;
}) {
  const upcoming = STAGES.filter((s) => s.status !== "past");

  return (
    <div
      className={cn(
        "overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]",
        fillParent ? "min-h-0 flex-1" : "max-h-[224px]"
      )}
    >
      <div className="flex flex-col">
        {upcoming.map((s, i) => {
          const isSelected = value === String(s.number);
          const isLocked = !!s.hasTacticActive;
          const isToday = s.status === "today";
          const isFirst = i === 0;
          return (
            <button
              key={s.number}
              type="button"
              onClick={() => !isLocked && onChange(String(s.number))}
              disabled={isLocked}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                !isFirst && "border-t border-[var(--border-subtle)]",
                isSelected && !isLocked && "bg-[var(--badge-bg)]",
                !isSelected && !isLocked && "hover:bg-[var(--bg-surface-hover)]",
                isLocked && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                    : "border-[var(--border-default)] bg-transparent"
                )}
              >
                {isSelected && (
                  <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="font-mono text-[length:var(--type-emphasis)] font-bold tabular-nums text-[var(--text-high)]">
                  Stage {s.number}
                </span>
                <span className="font-mono text-[length:var(--type-caption)] tabular-nums text-[var(--text-low)]">
                  {s.date}
                </span>
              </div>
              {isToday && !isLocked && (
                <Tag
                  variant="highlighted"
                  className="text-[length:var(--type-micro)]"
                >
                  Today
                </Tag>
              )}
              {isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Tactic set
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell — bottom sheet on mobile, centered on desktop
// ---------------------------------------------------------------------------

function ModalShell({
  children,
  footer,
  onClose,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] lg:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-[var(--radius-lg)] bg-[var(--bg-surface)] lg:max-w-md lg:rounded-[var(--radius-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/*
          Body uses overflow-hidden — content has fixed height, scroll lives
          INSIDE individual list sections (no parent scroll = no double scroll).
        */}
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalHeader({
  icon,
  title,
  subtitle,
  subtitleMono,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  subtitleMono?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        {icon}
        <div className="flex flex-col">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            {title}
          </h2>
          {subtitle && (
            <span
              className={cn(
                "text-[length:var(--type-caption)] text-[var(--text-low)]",
                subtitleMono && "font-mono tabular-nums"
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 text-[var(--text-low)] hover:text-[var(--text-high)]"
      >
        <X size={20} />
      </button>
    </div>
  );
}

/**
 * Action buttons matching RoleAssignSheet pattern:
 * - flex-col-reverse on mobile (primary on top, Cancel below)
 * - flex-row right-aligned on desktop
 */
function ModalActions({
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
}: {
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitDisabled}
        className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banners + placeholders
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
          <span className="font-semibold text-[var(--text-high)]">
            Team Bravo
          </span>{" "}
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
