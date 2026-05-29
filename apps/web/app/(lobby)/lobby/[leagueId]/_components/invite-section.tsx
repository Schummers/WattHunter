"use client";

import { CopyInput } from "@/components/ui/copy-input";

export interface InviteSectionProps {
  inviteCode: string;
}

export function InviteSection({ inviteCode }: InviteSectionProps) {
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/league/join?code=${inviteCode}`
      : `/league/join?code=${inviteCode}`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Invite players
      </h2>
      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        Share the link or code. Anyone with it can join the league.
      </p>

      <CopyInput
        value={inviteUrl}
        label="Invite link"
        copyButtonLabel="Copy invite link"
      />

      <CopyInput
        value={inviteCode}
        label="Invite code"
        copyButtonLabel="Copy invite code"
        mono
      />
    </section>
  );
}
