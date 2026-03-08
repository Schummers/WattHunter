"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, LogOut, Check, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { updateTeamName, leaveLeague } from "./actions";

export function CopyInviteCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-mid)] hover:border-[var(--border-hover)]"
    >
      {copied ? <Check size={16} className="text-[var(--accent-default)]" /> : <Copy size={16} />}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/onboarding");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] py-2.5 px-4 text-sm font-semibold text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}

export function EditableTeamName({ teamId, initialName }: { teamId: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasChanged = name !== initialName;

  async function handleSave() {
    setSaving(true);
    const result = await updateTeamName(teamId, name);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3 text-sm text-[var(--text-high)] outline-none focus:border-[var(--accent-default)]"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!hasChanged || saving}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-mid)] disabled:opacity-30 hover:border-[var(--border-hover)]"
      >
        {saved ? <Check size={16} className="text-[var(--accent-default)]" /> : <Check size={16} />}
      </button>
    </div>
  );
}

export function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this league? This cannot be undone.")) return;
    setLoading(true);
    const result = await leaveLeague(leagueId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={loading}
      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] py-2.5 px-4 text-sm font-semibold text-[var(--status-danger)] hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      <DoorOpen size={16} />
      {loading ? "Leaving..." : "Leave league"}
    </button>
  );
}

export function LeagueSelector({
  leagues,
  currentLeagueId,
  onChange,
}: {
  leagues: { id: string; name: string }[];
  currentLeagueId: string;
  onChange: (leagueId: string) => void;
}) {
  if (leagues.length <= 1) {
    return (
      <div className="flex h-9 items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3">
        <span className="text-sm text-[var(--text-high)]">
          {leagues[0]?.name ?? "League"}
        </span>
      </div>
    );
  }

  return (
    <select
      value={currentLeagueId}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3 text-sm text-[var(--text-high)] outline-none"
    >
      {leagues.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
