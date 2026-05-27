"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signupAndJoinLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { setSignupIntentCookie } from "@/app/auth/callback/oauth-intent";

export default function JoinLeaguePage() {
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code")?.toUpperCase() ?? "";

  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState(prefilledCode);
  const [teamName, setTeamName] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(signupAndJoinLeague, null);

  useEffect(() => {
    if (prefilledCode) setCode(prefilledCode);
  }, [prefilledCode]);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(c)) {
      setStep1Error("Code must be 6 characters (letters and 2-9).");
      return;
    }
    if (teamName.trim().length < 2) {
      setStep1Error("Team name must be at least 2 characters.");
      return;
    }
    setStep1Error(null);
    setCode(c);
    setStep(2);
  }

  async function handleGoogle() {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(c) || teamName.trim().length < 2) {
      setStep1Error("Please fill code and team name first.");
      return;
    }
    await setSignupIntentCookie({
      kind: "join",
      code: c,
      team_name: teamName.trim(),
    });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=join` },
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <Link
        href="/league/choose"
        className="flex items-center gap-1.5 text-[length:var(--type-body)] text-[var(--text-mid)] hover:text-[var(--text-high)] transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
          Join a league
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {step === 1 ? "Enter the code your Race Director shared." : "Create your account to join."}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <FormField label="Invite code" htmlFor="code">
            <Input
              id="code"
              name="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={6}
              maxLength={6}
              autoComplete="off"
              className="text-center text-[length:var(--type-section)] font-semibold tracking-widest uppercase"
            />
          </FormField>
          <FormField label="Your team name" htmlFor="team_name">
            <Input
              id="team_name"
              name="team_name"
              placeholder="Ex: Les Grimpeurs"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              minLength={2}
              maxLength={30}
              autoComplete="off"
            />
          </FormField>

          {step1Error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{step1Error}</p>
          )}

          <Button type="submit" variant="cta">Next</Button>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="team_name" value={teamName} />

          <FormField label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" placeholder="At least 6 characters" required minLength={6} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm_password">
            <Input id="confirm_password" name="confirm_password" type="password" required minLength={6} autoComplete="new-password" />
          </FormField>

          {state?.error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{state.error}</p>
          )}

          <Button type="submit" variant="cta" disabled={pending}>
            {pending ? "Joining..." : "Join League and Create Account"}
          </Button>
          <Button type="button" variant="outline" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
