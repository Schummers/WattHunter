"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { joinLeague } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function JoinLeaguePage() {
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") ?? "";
  const [state, formAction, pending] = useActionState(joinLeague, null);

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Rejoindre une ligue
        </h2>
        <p className="text-sm text-muted-foreground">
          Entrez le code a 6 caracteres fourni par le commissaire.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            Code d&apos;invitation
          </label>
          <Input
            id="code"
            name="code"
            placeholder="Ex: A3K7WN"
            required
            maxLength={6}
            defaultValue={prefillCode}
            className="text-center text-lg tracking-widest uppercase"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Verification..." : "Rejoindre"}
        </Button>
      </form>
    </div>
  );
}
