"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, LogOut, Check, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { leaveLeague } from "./actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EditableField({
  label,
  initialValue,
  onSave,
  disabled,
}: {
  label: string;
  initialValue: string;
  onSave: (value: string) => Promise<{ success?: boolean; error?: string }>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const hasChanged = value !== initialValue;

  async function handleSave() {
    setSaving(true);
    setError("");
    const result = await onSave(value);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3 text-base md:text-[length:var(--type-body)] text-[var(--text-high)] outline-none focus:border-[var(--accent-default)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanged || saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-mid)] disabled:opacity-30 hover:border-[var(--border-hover)]"
          >
            {saved ? (
              <Check size={16} className="text-[var(--accent-default)]" />
            ) : (
              <Check size={16} />
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[length:var(--type-micro)] text-[var(--status-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

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
      {copied ? (
        <Check size={16} className="text-[var(--accent-default)]" />
      ) : (
        <Copy size={16} />
      )}
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
      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] py-2.5 px-4 text-[length:var(--type-body)] font-semibold text-[var(--status-danger)] hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}

export function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    if (
      !confirm(
        "Are you sure you want to leave this league? This cannot be undone."
      )
    )
      return;
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
      className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] py-2.5 px-4 text-[length:var(--type-body)] font-semibold text-[var(--status-danger)] hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      <DoorOpen size={16} />
      {loading ? "Leaving..." : "Leave league"}
    </button>
  );
}

export function InviteUrlDisplay({ inviteCode }: { inviteCode: string }) {
  const inviteUrl = `${window.location.origin}/league/join?code=${inviteCode}`;

  return (
    <div className="space-y-1">
      <label className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
        Invite URL
      </label>
      <div className="flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 overflow-hidden">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)] truncate">
            {inviteUrl}
          </span>
        </div>
        <CopyInviteCodeButton code={inviteUrl} />
      </div>
    </div>
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
        <span className="text-[length:var(--type-body)] text-[var(--text-high)]">
          {leagues[0]?.name ?? "League"}
        </span>
      </div>
    );
  }

  return (
    <Select value={currentLeagueId} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {leagues.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
