"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { signupAndCreateLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { setSignupIntentCookie } from "@/app/auth/callback/oauth-intent";

export default function CreateLeaguePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [leagueName, setLeagueName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(signupAndCreateLeague, null);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (leagueName.trim().length < 2) {
      setStep1Error("League name must be at least 2 characters.");
      return;
    }
    if (teamName.trim().length < 2) {
      setStep1Error("Team name must be at least 2 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStep1Error("Please enter a valid email address.");
      return;
    }
    setStep1Error(null);
    setStep(2);
  }

  async function handleGoogle() {
    if (leagueName.trim().length < 2 || teamName.trim().length < 2) {
      setStep1Error("Please fill league name and team name first.");
      return;
    }
    await setSignupIntentCookie({
      kind: "create",
      league_name: leagueName.trim(),
      team_name: teamName.trim(),
    });
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?intent=create` },
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
          Create a league
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {step === 1 ? "Tell us about your league." : "Secure your account."}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <FormField label="League name" htmlFor="league_name">
            <Input
              id="league_name"
              name="league_name"
              placeholder="Ex: The Watt Hunters"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              autoComplete="off"
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
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormField>

          {step1Error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{step1Error}</p>
          )}

          <Button type="submit" variant="cta">Next</Button>
          <Button type="button" variant="outline" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="league_name" value={leagueName} />
          <input type="hidden" name="team_name" value={teamName} />
          <input type="hidden" name="email" value={email} />

          <FormField label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm_password">
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </FormField>

          {state?.error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{state.error}</p>
          )}

          <Button type="submit" variant="cta" disabled={pending}>
            {pending ? "Creating..." : "Create League and Account"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
