"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { joinLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { ArrowLeft } from "lucide-react";

function JoinLeagueForm() {
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? "";
  const [state, formAction, pending] = useActionState(joinLeague, null);

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
          Enter the 6-character code provided by the Race Director.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Invite code" htmlFor="code">
          <Input
            id="code"
            name="code"
            placeholder="Ex: A3K7WN"
            required
            maxLength={6}
            defaultValue={prefillCode}
            className="tracking-widest uppercase"
          />
        </FormField>

        {state?.error && (
          <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">{state.error}</p>
        )}

        <Button type="submit" variant="cta" disabled={pending}>
          {pending ? "Verifying..." : "Join"}
        </Button>
      </form>
    </div>
  );
}

export default function JoinLeaguePage() {
  return (
    <Suspense>
      <JoinLeagueForm />
    </Suspense>
  );
}
