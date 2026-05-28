"use client";

import { useState } from "react";
import { Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface InviteSectionProps {
  inviteCode: string;
}

export function InviteSection({ inviteCode }: InviteSectionProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/league/join?code=${inviteCode}`
      : `/league/join?code=${inviteCode}`;

  async function copy(value: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(value);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context or permission denied).
      // The user can still select-all in the read-only input and copy manually.
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Invite players
      </h2>
      <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
        Share the link or code. Anyone with it can join the league.
      </p>

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={inviteUrl}
          aria-label="Invite link"
          className="flex-1 truncate text-[length:var(--type-body)] text-[var(--text-mid)]"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Copy invite link"
          onClick={() => copy(inviteUrl, setCopiedLink)}
        >
          {copiedLink ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={inviteCode}
          aria-label="Invite code"
          className="flex-1 text-center font-mono text-[length:var(--type-section)] font-semibold tracking-widest text-[var(--text-high)]"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label="Copy invite code"
          onClick={() => copy(inviteCode, setCopiedCode)}
        >
          {copiedCode ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </section>
  );
}
