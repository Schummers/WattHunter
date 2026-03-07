"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, LogOut, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

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
      className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-[var(--status-danger)]"
    >
      <LogOut size={16} />
      Sign out
    </button>
  );
}
